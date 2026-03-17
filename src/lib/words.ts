import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import type { GeneratedResult, WordDoc } from './types'

function requireUserId(): string {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You must be signed in.')
  return uid
}

export async function saveWord(params: {
  word: string
  result: GeneratedResult
  tags?: string[]
}) {
  const uid = requireUserId()
  const wordNormalized = params.word.trim()
  if (!wordNormalized) throw new Error('Word is required.')

  const wordsCol = collection(db, 'users', uid, 'words')
  const existingQ = query(
    wordsCol,
    where('word', '==', wordNormalized.toLowerCase()),
  )
  const existing = await getDocs(existingQ)

  const payload: Omit<WordDoc, 'createdAt' | 'updatedAt'> & {
    createdAt?: unknown
    updatedAt: unknown
  } = {
    word: wordNormalized.toLowerCase(),
    source: 'gpt',
    result: params.result,
    tags: params.tags ?? [],
    updatedAt: serverTimestamp(),
  }

  if (!existing.empty) {
    const ref = doc(db, 'users', uid, 'words', existing.docs[0].id)
    await updateDoc(ref, payload)
    return { id: existing.docs[0].id }
  }

  const ref = await addDoc(wordsCol, { ...payload, createdAt: serverTimestamp() })
  return { id: ref.id }
}

export async function listWords() {
  const uid = requireUserId()
  const wordsCol = collection(db, 'users', uid, 'words')
  const q = query(wordsCol, orderBy('updatedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, data: d.data() as WordDoc }))
}

export async function getWord(wordId: string) {
  const uid = requireUserId()
  const ref = doc(db, 'users', uid, 'words', wordId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return { id: snap.id, data: snap.data() as WordDoc }
}

