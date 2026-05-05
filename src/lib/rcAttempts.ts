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
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import type {
  RcAttempt,
  RcPassageResponse,
  RcQuestion,
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

export async function getRcAttempt(attemptId: string): Promise<RcAttempt | null> {
  const uid = requireUid()
  const snap = await getDoc(rcAttemptDoc(uid, attemptId))
  if (!snap.exists()) return null
  const data = snap.data() as Partial<RcAttempt>
  return {
    attemptId: snap.id,
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
  }
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
