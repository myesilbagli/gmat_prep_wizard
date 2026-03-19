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
  // New shape (preferred)
  text?: string
  type?: 'word' | 'phrase'
  // Back-compat shape
  word?: string
  result: GeneratedResult
  tags?: string[]
}) {
  const uid = requireUserId()
  const rawText = (params.text ?? params.word ?? '').trim()
  if (!rawText) throw new Error('Text is required.')
  const normalizedText = rawText.replace(/\s+/g, ' ')
  const inferredType: 'word' | 'phrase' =
    params.type ?? (normalizedText.includes(' ') ? 'phrase' : 'word')
  const textLower = normalizedText.toLowerCase()

  const wordsCol = collection(db, 'users', uid, 'words')
  // Prefer dedupe by textLower (works for both words and phrases).
  const existingByText = await getDocs(
    query(wordsCol, where('textLower', '==', textLower)),
  )
  // Back-compat: older docs might only have `word` for single words.
  const existingByWord =
    inferredType === 'word'
      ? await getDocs(query(wordsCol, where('word', '==', textLower)))
      : null
  const existing =
    !existingByText.empty ? existingByText : existingByWord ?? existingByText

  const payload: Omit<WordDoc, 'createdAt' | 'updatedAt'> & {
    createdAt?: unknown
    updatedAt: unknown
  } = {
    // legacy field (keep for compatibility; only meaningful for single words)
    word: inferredType === 'word' ? textLower : textLower,
    // new fields for simplified model
    text: normalizedText,
    textLower,
    type: inferredType,
    definition: params.result.definition ?? '',
    simpleDefinition: params.result.simpleDefinition ?? '',
    exampleSentence: params.result.exampleSentence,
    synonyms: Array.isArray(params.result.synonyms) ? params.result.synonyms : [],
    nuanceNote: params.result.nuanceNote,
    gmatUsageNote: params.result.gmatUsageNote,
    status: 'learning',
    flagged: false,
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

