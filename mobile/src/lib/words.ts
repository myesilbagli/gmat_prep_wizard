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
import type { GeneratedResult } from '@shared/types'
import { mergeTranslationsForSave } from '@shared/vocab'
import { auth, db } from './firebase'

function requireUserId(): string {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You must be signed in.')
  return uid
}

export async function saveWord(params: {
  text: string
  type?: 'word' | 'phrase'
  result: GeneratedResult
  mainLanguage?: string
}) {
  const uid = requireUserId()
  const normalizedText = params.text.trim().replace(/\s+/g, ' ')
  if (!normalizedText) throw new Error('Text is required.')
  const type = params.type ?? (normalizedText.includes(' ') ? 'phrase' : 'word')
  const textLower = normalizedText.toLowerCase()
  const wordsCol = collection(db, 'users', uid, 'words')

  const existing = await getDocs(query(wordsCol, where('textLower', '==', textLower)))
  const existingTranslations =
    !existing.empty
      ? (existing.docs[0].data() as { translations?: Record<string, string> }).translations
      : undefined
  const translations = mergeTranslationsForSave(
    existingTranslations,
    params.mainLanguage,
    params.result,
  )
  const payload = {
    word: textLower,
    text: normalizedText,
    textLower,
    type,
    definition: params.result.definition ?? '',
    simpleDefinition: params.result.simpleDefinition ?? '',
    exampleSentence: params.result.exampleSentence ?? '',
    synonyms: Array.isArray(params.result.synonyms) ? params.result.synonyms : [],
    nuanceNote: params.result.nuanceNote ?? '',
    gmatUsageNote: params.result.gmatUsageNote ?? '',
    status: 'learning',
    flagged: false,
    source: 'gpt',
    result: params.result,
    ...(translations ? { translations } : {}),
    tags: [],
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

export async function getWord(wordId: string) {
  const uid = requireUserId()
  const ref = doc(db, 'users', uid, 'words', wordId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return { id: snap.id, data: snap.data() }
}

export async function listWords() {
  const uid = requireUserId()
  const wordsCol = collection(db, 'users', uid, 'words')
  const q = query(wordsCol, orderBy('updatedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }))
}
