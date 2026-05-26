/**
 * Firestore CRUD for `users/{uid}/rcAttempts/{attemptId}`.
 *
 * Lifecycle (mirrors what RcPracticePage drives):
 *   1. Setup → createRcAttempt(passage)        // doc with passage + startedAt
 *   2. Practice mount → updateRcAttemptQuestions(id, questions) // adds questions
 *   3. Each Next → recordQuestionAnswer(id, idx, ans, secs)     // per-question patch
 *   4. After last → markRcAttemptComplete(id)  // sets completedAt
 */
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import type {
  RcAttempt,
  RcDifficulty,
  RcPassageResponse,
  RcQuestion,
  RcSubtypeDrillResponse,
} from '../../shared/rcTypes'

function requireUid(): string {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You must be signed in.')
  return uid
}

function rcAttemptsCol(uid: string) {
  return collection(db, 'users', uid, 'rcAttempts')
}

function rcAttemptDoc(uid: string, attemptId: string) {
  return doc(db, 'users', uid, 'rcAttempts', attemptId)
}

/**
 * Create a fresh attempt with the passage but no questions yet. The page
 * router gets the returned attemptId and navigates to the practice URL.
 */
export async function createRcAttempt(passage: RcPassageResponse): Promise<string> {
  const uid = requireUid()
  const ref = await addDoc(rcAttemptsCol(uid), {
    passage: passage.passage,
    paragraphs: passage.paragraphs,
    topic: passage.topic,
    difficulty: passage.difficulty,
    questions: [],
    createdAt: serverTimestamp(),
    startedAt: serverTimestamp(),
  })
  // Mirror the doc id back into the doc so consumers can read it
  // alongside the rest of the fields without an extra source of truth.
  await updateDoc(ref, { attemptId: ref.id })
  return ref.id
}

function readRcAttemptDoc(id: string, data: Partial<RcAttempt>): RcAttempt {
  return {
    attemptId: id,
    createdAt: data.createdAt,
    passage: typeof data.passage === 'string' ? data.passage : '',
    paragraphs: Array.isArray(data.paragraphs) ? (data.paragraphs as string[]) : [],
    topic: typeof data.topic === 'string' ? data.topic : '',
    difficulty:
      data.difficulty === 'easy' || data.difficulty === 'medium' || data.difficulty === 'hard'
        ? data.difficulty
        : 'medium',
    questions: Array.isArray(data.questions) ? (data.questions as RcAttempt['questions']) : [],
    startedAt: data.startedAt,
    completedAt: data.completedAt,
    kind: data.kind === 'drill' ? 'drill' : data.kind === 'set' ? 'set' : undefined,
    drillSubtype: typeof data.drillSubtype === 'string' ? data.drillSubtype : undefined,
    passages: Array.isArray(data.passages)
      ? (data.passages as RcAttempt['passages'])
      : undefined,
  }
}

export async function getRcAttempt(attemptId: string): Promise<RcAttempt | null> {
  const uid = requireUid()
  const snap = await getDoc(rcAttemptDoc(uid, attemptId))
  if (!snap.exists()) return null
  return readRcAttemptDoc(snap.id, snap.data() as Partial<RcAttempt>)
}

/**
 * List ALL of the current user's RC attempts (exam sets + drills), most
 * recent first. Used by the /test practice hub to aggregate per-subtype
 * accuracy. Returns an empty array if the user has none.
 *
 * NOTE: Firestore `orderBy('createdAt')` will skip docs that lack the
 * field — every doc written by createRcAttempt / createRcDrillAttempt
 * stamps createdAt, so this is safe. If a legacy doc were missing it,
 * the missing-doc behavior is "filtered out," not "throw."
 */
export async function listRcAttempts(): Promise<RcAttempt[]> {
  const uid = requireUid()
  const q = query(rcAttemptsCol(uid), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => readRcAttemptDoc(d.id, d.data() as Partial<RcAttempt>))
}

/**
 * Stage 2 just returned. Persist the array so a back-then-forward
 * navigation doesn't re-spend the OpenAI call.
 */
export async function updateRcAttemptQuestions(
  attemptId: string,
  questions: RcQuestion[],
): Promise<void> {
  const uid = requireUid()
  await updateDoc(rcAttemptDoc(uid, attemptId), {
    questions,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Patch a single question's user answer + per-question time. Uses a
 * transaction because Firestore's dot-path updates do not support
 * array-index targets, so we read-modify-write the whole array atomically.
 */
export async function recordQuestionAnswer(
  attemptId: string,
  questionIndex: number,
  userAnswerIndex: number,
  timeSeconds: number,
): Promise<void> {
  const uid = requireUid()
  const ref = rcAttemptDoc(uid, attemptId)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Attempt not found.')
    const data = snap.data() as { questions?: RcAttempt['questions'] }
    const questions = Array.isArray(data.questions) ? [...data.questions] : []
    if (questionIndex < 0 || questionIndex >= questions.length) {
      throw new Error('questionIndex out of bounds.')
    }
    questions[questionIndex] = {
      ...questions[questionIndex],
      userAnswerIndex,
      timeSeconds,
    }
    tx.update(ref, { questions, updatedAt: serverTimestamp() })
  })
}

export async function markRcAttemptComplete(attemptId: string): Promise<void> {
  const uid = requireUid()
  await updateDoc(rcAttemptDoc(uid, attemptId), {
    completedAt: serverTimestamp(),
  })
}

/**
 * Create a drill attempt from a /generateRcSubtypeDrill response.
 *
 * Flattens the response's per-passage questions into a single
 * `questions[]` array, stamping each question with its `passageIndex`
 * so the runner can render the right passage alongside it. The
 * singular `passage`/`paragraphs`/`topic` fields mirror passages[0] so
 * any legacy reader sees a non-empty passage.
 */
export async function createRcDrillAttempt(args: {
  drillSubtype: string
  difficulty: RcDifficulty
  drill: RcSubtypeDrillResponse
}): Promise<string> {
  const uid = requireUid()
  const { drillSubtype, difficulty, drill } = args
  if (drill.passages.length === 0) {
    throw new Error('Drill response has no passages.')
  }

  const passages = drill.passages.map((p) => ({
    passage: p.passage,
    paragraphs: p.paragraphs,
    topic: p.topic,
  }))

  const flat: RcAttempt['questions'] = []
  drill.passages.forEach((p, pi) => {
    for (const q of p.questions) {
      flat.push({ ...(q as RcQuestion), passageIndex: pi })
    }
  })

  const first = drill.passages[0]
  const ref = await addDoc(rcAttemptsCol(uid), {
    kind: 'drill',
    drillSubtype,
    difficulty,
    passage: first.passage,
    paragraphs: first.paragraphs,
    topic: first.topic,
    passages,
    questions: flat,
    createdAt: serverTimestamp(),
    startedAt: serverTimestamp(),
  })
  await updateDoc(ref, { attemptId: ref.id })
  return ref.id
}
