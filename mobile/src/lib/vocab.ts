import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore'
import type { VocabItem, VocabStatus } from '@shared/types'
import { normalizeRawVocabDoc } from '@shared/vocab'
import { auth, db } from './firebase'

function requireUserId(): string {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You must be signed in.')
  return uid
}

export async function listVocabItems(): Promise<VocabItem[]> {
  const uid = requireUserId()
  const wordsCol = collection(db, 'users', uid, 'words')
  const q = query(wordsCol, orderBy('updatedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => normalizeRawVocabDoc(d.id, d.data()))
}

export async function updateVocabStatus(params: { id: string; status: VocabStatus }) {
  const uid = requireUserId()
  const ref = doc(db, 'users', uid, 'words', params.id)
  await updateDoc(ref, { status: params.status, updatedAt: new Date() })
}

export async function toggleVocabFlagged(params: { id: string; flagged: boolean }) {
  const uid = requireUserId()
  const ref = doc(db, 'users', uid, 'words', params.id)
  await updateDoc(ref, { flagged: params.flagged, updatedAt: new Date() })
}

export async function deleteVocabItem(id: string) {
  const uid = requireUserId()
  const ref = doc(db, 'users', uid, 'words', id)
  await deleteDoc(ref)
}
