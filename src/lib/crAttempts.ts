/**
 * Firestore CRUD for `users/{uid}/crAttempts/{attemptId}`.
 *
 * Lifecycle:
 *   1. Setup → createCrAttempt(questions, timerMode)   // doc with all 5 questions + startedAt
 *   2. Practice mount → load attempt, resume from first unanswered
 *   3. Each Next → recordCrAnswer(id, idx, ans, secs)  // patches one question; computes isCorrect
 *   4. After last (or timer expiry) → markCrAttemptComplete(id, score, totalTimeSeconds)
 *
 * The questions array is stored SELF-CONTAINED — every question carries its
 * own questionType, so analytics can later read attempts alone and group by
 * type without joining anything.
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
  CrAttempt,
  CrAttemptQuestion,
  CrQuestion,
  CrTimerMode,
} from '../../shared/crTypes'

function requireUid(): string {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You must be signed in.')
  return uid
}

function crAttemptsCol(uid: string) {
  return collection(db, 'users', uid, 'crAttempts')
}

function crAttemptDoc(uid: string, attemptId: string) {
  return doc(db, 'users', uid, 'crAttempts', attemptId)
}

/**
 * Create a fresh attempt with all 5 generated questions and blank user
 * answers. timerMode and startedAt are recorded so the practice page can
 * compute remaining time if the user refreshes mid-practice.
 */
export async function createCrAttempt(
  questions: CrQuestion[],
  timerMode: CrTimerMode,
): Promise<string> {
  const uid = requireUid()
  const blanked: CrAttemptQuestion[] = questions.map((q) => ({
    ...q,
    userAnswerIndex: null,
    isCorrect: false,
    timeSeconds: 0,
  }))
  const ref = await addDoc(crAttemptsCol(uid), {
    timerMode,
    totalTimeSeconds: 0,
    score: 0,
    questions: blanked,
    createdAt: serverTimestamp(),
    startedAt: serverTimestamp(),
  })
  await updateDoc(ref, { attemptId: ref.id })
  return ref.id
}

export async function getCrAttempt(attemptId: string): Promise<CrAttempt | null> {
  const uid = requireUid()
  const snap = await getDoc(crAttemptDoc(uid, attemptId))
  if (!snap.exists()) return null
  const data = snap.data() as Partial<CrAttempt>
  return {
    attemptId: snap.id,
    createdAt: data.createdAt,
    completedAt: data.completedAt,
    startedAt: data.startedAt,
    timerMode:
      data.timerMode === '10min' || data.timerMode === '5min' || data.timerMode === 'none'
        ? data.timerMode
        : 'none',
    totalTimeSeconds: typeof data.totalTimeSeconds === 'number' ? data.totalTimeSeconds : 0,
    score: typeof data.score === 'number' ? data.score : 0,
    questions: Array.isArray(data.questions) ? (data.questions as CrAttemptQuestion[]) : [],
  }
}

/**
 * Patch a single question's user answer + per-question time. Computes
 * isCorrect inside the transaction by comparing against the stored
 * correctIndex (single source of truth — the user's selection cannot
 * fabricate an isCorrect flag).
 */
export async function recordCrAnswer(
  attemptId: string,
  questionIndex: number,
  userAnswerIndex: number | null,
  timeSeconds: number,
): Promise<void> {
  const uid = requireUid()
  const ref = crAttemptDoc(uid, attemptId)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Attempt not found.')
    const data = snap.data() as { questions?: CrAttemptQuestion[] }
    const questions = Array.isArray(data.questions) ? [...data.questions] : []
    if (questionIndex < 0 || questionIndex >= questions.length) {
      throw new Error('questionIndex out of bounds.')
    }
    const q = questions[questionIndex]
    const isCorrect = userAnswerIndex != null && userAnswerIndex === q.correctIndex
    questions[questionIndex] = {
      ...q,
      userAnswerIndex,
      isCorrect,
      timeSeconds,
    }
    tx.update(ref, { questions, updatedAt: serverTimestamp() })
  })
}

/**
 * Final write: stamp completedAt and roll up score + totalTimeSeconds. The
 * practice page already has both values in state from the per-question
 * record calls, so we accept them as args rather than re-deriving in a
 * transaction.
 */
export async function markCrAttemptComplete(
  attemptId: string,
  score: number,
  totalTimeSeconds: number,
): Promise<void> {
  const uid = requireUid()
  await updateDoc(crAttemptDoc(uid, attemptId), {
    score,
    totalTimeSeconds,
    completedAt: serverTimestamp(),
  })
}
