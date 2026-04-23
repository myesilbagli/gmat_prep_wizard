import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import {
  applyDelta,
  DELTA_QUIZ_CORRECT,
  DELTA_QUIZ_WRONG,
  DELTA_SHOWN,
  statusFromExposureScore,
} from '@shared/exposureScore'
import type { VocabItem, VocabStatus } from '@shared/types'
import type { SessionWordOutcome } from '@shared/sessionOutcome'
import { pushCorrectDayIfMissing, normalizeCorrectDaysCount } from '@shared/learningBuckets'
import {
  mapRawStatusToVocabStatus,
  normalizeRawVocabDoc,
  rawStatusNeedsFirestoreMigration,
} from '@shared/vocab'
import { auth, db } from './firebase'
import { ensureUserProfileDefaults, getTodayKey } from './userProfile'

function requireUserId(): string {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You must be signed in.')
  return uid
}

function readExposureScoreFromRaw(data: Record<string, unknown> | undefined): number {
  if (data && typeof data.exposureScore === 'number' && Number.isFinite(data.exposureScore)) {
    return Math.max(0, Math.floor(data.exposureScore))
  }
  const seen = data && typeof data.seenCount === 'number' && Number.isFinite(data.seenCount) ? Math.max(0, Math.floor(data.seenCount)) : 0
  const legacyMastered = data?.status === 'mastered' || data?.status === 'know'
  if (legacyMastered) return Math.max(20, seen)
  return seen
}

async function persistLegacyStatusIfNeeded(id: string, raw: Record<string, unknown>) {
  if (!rawStatusNeedsFirestoreMigration(raw.status)) return
  const uid = requireUserId()
  const ref = doc(db, 'users', uid, 'words', id)
  await updateDoc(ref, {
    status: mapRawStatusToVocabStatus(raw.status),
    updatedAt: serverTimestamp(),
  })
}

export async function listVocabItems(): Promise<VocabItem[]> {
  const uid = requireUserId()
  const wordsCol = collection(db, 'users', uid, 'words')
  const q = query(wordsCol, orderBy('updatedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const raw = d.data() as Record<string, unknown>
    const item = normalizeRawVocabDoc(d.id, raw)
    void persistLegacyStatusIfNeeded(d.id, raw).catch(() => {})
    return item
  })
}

/** @deprecated Prefer exposure score; kept for rare admin paths. */
export async function updateVocabStatus(params: { id: string; status: VocabStatus }) {
  const uid = requireUserId()
  const ref = doc(db, 'users', uid, 'words', params.id)
  await updateDoc(ref, {
    status: params.status,
    exposureScore: params.status === 'mastered' ? 20 : 19,
    updatedAt: serverTimestamp(),
  })
}

export async function toggleVocabFlagged(params: { id: string; flagged: boolean }) {
  const uid = requireUserId()
  const ref = doc(db, 'users', uid, 'words', params.id)
  await updateDoc(ref, { flagged: params.flagged, updatedAt: serverTimestamp() })
}

export async function deleteVocabItem(id: string) {
  const uid = requireUserId()
  const wordRef = doc(db, 'users', uid, 'words', id)
  await runTransaction(db, async (transaction) => {
    const wordSnap = await transaction.get(wordRef)
    if (!wordSnap.exists()) return
    const data = wordSnap.data() as Record<string, unknown>
    const stackIds: string[] = Array.isArray(data.userStackIds)
      ? data.userStackIds.map((x: unknown) => String(x).trim()).filter(Boolean)
      : []
    for (const sid of stackIds) {
      const sref = doc(db, 'users', uid, 'myStacks', sid)
      const ss = await transaction.get(sref)
      if (ss.exists()) {
        const wc =
          typeof (ss.data() as { wordCount?: unknown }).wordCount === 'number'
            ? Math.max(0, Math.floor((ss.data() as { wordCount: number }).wordCount))
            : 0
        transaction.update(sref, { wordCount: Math.max(0, wc - 1), updatedAt: serverTimestamp() })
      }
    }
    transaction.delete(wordRef)
  })
}

/** Flashcard / passive “shown” (+1 exposure). */
export async function recordWordExposure(wordId: string) {
  const uid = requireUserId()
  const ref = doc(db, 'users', uid, 'words', wordId)
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref)
    if (!snap.exists()) throw new Error('Word not found')
    const data = snap.data() as Record<string, unknown>
    const current = readExposureScoreFromRaw(data)
    const newScore = applyDelta(current, DELTA_SHOWN)
    transaction.update(ref, {
      exposureScore: newScore,
      status: statusFromExposureScore(newScore),
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })
}

/** Test / standalone MCQ answer (+2 / -1). */
export async function applyQuizAnswerExposure(wordId: string, correct: boolean) {
  const uid = requireUserId()
  const profile = await ensureUserProfileDefaults()
  const todayKey = getTodayKey(profile)
  const ref = doc(db, 'users', uid, 'words', wordId)
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref)
    if (!snap.exists()) return
    const data = snap.data() as Record<string, unknown>
    const current = readExposureScoreFromRaw(data)
    const delta = correct ? DELTA_QUIZ_CORRECT : DELTA_QUIZ_WRONG
    const newScore = applyDelta(current, delta)
    const patch: Record<string, unknown> = {
      exposureScore: newScore,
      status: statusFromExposureScore(newScore),
      lastAnsweredAt: serverTimestamp(),
      lastCorrect: correct,
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    if (correct) {
      const prevDays = normalizeCorrectDaysCount(data.correctDaysCount)
      patch.correctDaysCount = pushCorrectDayIfMissing(prevDays, todayKey)
    }
    transaction.update(ref, patch)
  })
}

/** Session intro: mark word introduced (+1 exposure, set lastIntroducedAt). */
export async function markWordIntroduced(wordId: string) {
  const uid = requireUserId()
  const ref = doc(db, 'users', uid, 'words', wordId)
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref)
    if (!snap.exists()) throw new Error('Word not found')
    const data = snap.data() as Record<string, unknown>
    const current = readExposureScoreFromRaw(data)
    const newScore = applyDelta(current, DELTA_SHOWN)
    transaction.update(ref, {
      exposureScore: newScore,
      status: statusFromExposureScore(newScore),
      lastIntroducedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })
}

/** Paragraph targets after successful generate (+1 each). */
export async function applyParagraphExposure(wordIds: string[]) {
  const uid = requireUserId()
  if (wordIds.length === 0) return
  await runTransaction(db, async (transaction) => {
    const refs = wordIds.map((id) => doc(db, 'users', uid, 'words', id))
    const snaps = await Promise.all(refs.map((r) => transaction.get(r)))
    for (let i = 0; i < refs.length; i++) {
      const snap = snaps[i]
      const ref = refs[i]!
      if (!snap?.exists()) continue
      const data = snap.data() as Record<string, unknown>
      const current = readExposureScoreFromRaw(data)
      const newScore = applyDelta(current, DELTA_SHOWN)
      transaction.update(ref, {
        exposureScore: newScore,
        status: statusFromExposureScore(newScore),
        lastSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
  })
}

/** Daily session: MCQ-only delta per word (swipe does not add +1 in same run). */
export async function applySessionBatchOutcome(
  itemsById: Map<string, VocabItem>,
  outcomes: SessionWordOutcome[],
) {
  const uid = requireUserId()
  const filtered = outcomes.filter((o) => itemsById.has(o.id))
  if (filtered.length === 0) return

  const profile = await ensureUserProfileDefaults()
  const todayKey = getTodayKey(profile)

  await runTransaction(db, async (transaction) => {
    const refs = filtered.map((o) => doc(db, 'users', uid, 'words', o.id))
    const snaps = await Promise.all(refs.map((r) => transaction.get(r)))
    for (let i = 0; i < refs.length; i++) {
      const o = filtered[i]!
      const snap = snaps[i]
      const ref = refs[i]!
      if (!snap?.exists()) continue
      const data = snap.data() as Record<string, unknown>
      const current = readExposureScoreFromRaw(data)
      const delta = o.mcqCorrect ? DELTA_QUIZ_CORRECT : DELTA_QUIZ_WRONG
      const newScore = applyDelta(current, delta)
      const patch: Record<string, unknown> = {
        exposureScore: newScore,
        status: statusFromExposureScore(newScore),
        lastAnsweredAt: serverTimestamp(),
        lastCorrect: o.mcqCorrect,
        lastSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      if (o.mcqCorrect) {
        const prevDays = normalizeCorrectDaysCount(data.correctDaysCount)
        patch.correctDaysCount = pushCorrectDayIfMissing(prevDays, todayKey)
      }
      transaction.update(ref, patch)
    }
  })
}
