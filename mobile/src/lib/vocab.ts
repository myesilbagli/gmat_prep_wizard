import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import type { VocabItem, VocabStatus } from '@shared/types'
import {
  mapRawStatusToVocabStatus,
  normalizeRawVocabDoc,
  rawStatusNeedsFirestoreMigration,
} from '@shared/vocab'
import { auth, db } from './firebase'

function requireUserId(): string {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You must be signed in.')
  return uid
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

export async function updateVocabStatus(params: { id: string; status: VocabStatus }) {
  const uid = requireUserId()
  const ref = doc(db, 'users', uid, 'words', params.id)
  await updateDoc(ref, { status: params.status, updatedAt: serverTimestamp() })
}

export async function toggleVocabFlagged(params: { id: string; flagged: boolean }) {
  const uid = requireUserId()
  const ref = doc(db, 'users', uid, 'words', params.id)
  await updateDoc(ref, { flagged: params.flagged, updatedAt: serverTimestamp() })
}

export async function deleteVocabItem(id: string) {
  const uid = requireUserId()
  const ref = doc(db, 'users', uid, 'words', id)
  await deleteDoc(ref)
}

export async function recordWordExposure(wordId: string) {
  const uid = requireUserId()
  const ref = doc(db, 'users', uid, 'words', wordId)
  await updateDoc(ref, {
    seenCount: increment(1),
    lastSeenAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/** After review/new word in daily session: increment exposure and set status. */
export async function applySessionWordOutcome(params: { id: string; status: VocabStatus }) {
  const uid = requireUserId()
  const ref = doc(db, 'users', uid, 'words', params.id)
  await updateDoc(ref, {
    seenCount: increment(1),
    lastSeenAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: params.status,
  })
}
