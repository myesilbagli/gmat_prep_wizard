import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { mergeTranslationsForSave } from '../../shared/vocab'
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
  mainLanguage?: string
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

  const existingTranslations =
    !existing.empty
      ? (existing.docs[0].data() as { translations?: Record<string, string> }).translations
      : undefined
  const translations = mergeTranslationsForSave(
    existingTranslations,
    params.mainLanguage,
    params.result,
  )

  const useNewCardShape =
    Array.isArray(params.result.examples) && params.result.examples.length === 2

  const legacyExampleFields = useNewCardShape
    ? {}
    : {
        exampleSentence: params.result.exampleSentence,
        gmatUsageNote: params.result.gmatUsageNote,
      }

  const legacyStripOnUpdate = useNewCardShape
    ? { exampleSentence: deleteField(), gmatUsageNote: deleteField() }
    : {}

  const newShapeFields = useNewCardShape
    ? {
        examples: params.result.examples,
        wordTags: params.result.wordTags ?? [],
        contrastWord: params.result.contrastWord,
        memoryHook: params.result.memoryHook ?? '',
      }
    : {}

  const contentPayload: Omit<WordDoc, 'createdAt' | 'updatedAt'> & {
    createdAt?: unknown
    updatedAt: unknown
  } = {
    word: inferredType === 'word' ? textLower : textLower,
    text: normalizedText,
    textLower,
    type: inferredType,
    definition: params.result.definition ?? '',
    simpleDefinition: params.result.simpleDefinition ?? '',
    ...legacyExampleFields,
    synonyms: Array.isArray(params.result.synonyms) ? params.result.synonyms : [],
    nuanceNote: params.result.nuanceNote,
    ...newShapeFields,
    source: 'gpt' as const,
    result: params.result,
    ...(translations ? { translations } : {}),
    tags: params.tags ?? [],
    updatedAt: serverTimestamp(),
  }

  if (!existing.empty) {
    const prev = existing.docs[0].data() as Record<string, unknown>
    const ref = doc(db, 'users', uid, 'words', existing.docs[0].id)
    const mergedWordSource =
      typeof prev.wordSource === 'string' ? prev.wordSource : ('lookup' as const)
    const preservedTags = Array.isArray(prev.tags) ? prev.tags : params.tags ?? []
    await updateDoc(ref, {
      ...contentPayload,
      ...legacyStripOnUpdate,
      tags: preservedTags,
      wordSource: mergedWordSource,
      exposureScore:
        typeof prev.exposureScore === 'number' && Number.isFinite(prev.exposureScore)
          ? prev.exposureScore
          : 0,
      flagged: Boolean(prev.flagged),
      lastSeenAt: prev.lastSeenAt ?? null,
      lastAnsweredAt: prev.lastAnsweredAt ?? null,
      lastCorrect: prev.lastCorrect === true || prev.lastCorrect === false ? prev.lastCorrect : null,
      seenCount: typeof prev.seenCount === 'number' ? prev.seenCount : undefined,
      meaningQuizStreak:
        typeof prev.meaningQuizStreak === 'number' ? prev.meaningQuizStreak : undefined,
      lastSessionSwipe:
        prev.lastSessionSwipe === 'weak' || prev.lastSessionSwipe === 'strong'
          ? prev.lastSessionSwipe
          : undefined,
      status: typeof prev.status === 'string' ? prev.status : 'learning',
    })
    return { id: existing.docs[0].id }
  }

  const payloadNew = {
    ...contentPayload,
    status: 'learning',
    exposureScore: 0,
    lastSeenAt: null,
    lastAnsweredAt: null,
    lastCorrect: null,
    flagged: false,
    wordSource: 'lookup' as const,
  }

  const ref = await addDoc(wordsCol, { ...payloadNew, createdAt: serverTimestamp() })
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

