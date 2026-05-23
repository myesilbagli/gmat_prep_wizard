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
import { WORD_TAG_KNOWN } from '../../shared/wordTags'
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
  /** Where the save originates. 'stack' triggers stack-import semantics
   *  (wordSource: 'word_stack', stackId/stackPosition recorded, optional
   *  markKnown tag). Defaults to 'lookup' for existing callers. */
  source?: 'lookup' | 'stack'
  /** Canonical stack id (e.g. 'stack_arg_architecture'). Required when
   *  source === 'stack'. */
  stackId?: string
  /** 0-indexed position of this word within its stack. */
  stackPosition?: number
  /** Sets the 'known' tag on the word — mirrors mobile triage behavior. */
  markKnown?: boolean
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

  const topFromResult: Record<string, unknown> = {}
  if (useNewCardShape) {
    topFromResult.examples = params.result.examples
    topFromResult.wordTags = params.result.wordTags ?? []
  }
  const mhTrim =
    typeof params.result.memoryHook === 'string' ? params.result.memoryHook.trim() : ''
  if (mhTrim) topFromResult.memoryHook = mhTrim
  const cw = params.result.contrastWord
  if (
    cw &&
    typeof cw.word === 'string' &&
    cw.word.trim() &&
    typeof cw.explanation === 'string' &&
    cw.explanation.trim()
  ) {
    topFromResult.contrastWord = {
      word: cw.word.trim(),
      explanation: cw.explanation.trim(),
    }
  }

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
    ...topFromResult,
    source: 'gpt' as const,
    result: params.result,
    ...(translations ? { translations } : {}),
    tags: params.tags ?? [],
    updatedAt: serverTimestamp(),
  }

  if (!existing.empty) {
    const prev = existing.docs[0].data() as Record<string, unknown>
    const ref = doc(db, 'users', uid, 'words', existing.docs[0].id)
    // Stack-source upgrades a 'lookup'-sourced word's provenance; otherwise
    // preserve whatever the doc already has.
    const mergedWordSource =
      params.source === 'stack'
        ? 'word_stack'
        : typeof prev.wordSource === 'string'
          ? prev.wordSource
          : ('lookup' as const)
    const preservedTags = Array.isArray(prev.tags) ? (prev.tags as string[]) : params.tags ?? []
    // Mirror mobile: only ADD 'known', never remove on update.
    const nextTags =
      params.markKnown === true && !preservedTags.includes(WORD_TAG_KNOWN)
        ? [...preservedTags, WORD_TAG_KNOWN]
        : preservedTags
    // Carry stackId/stackPosition forward if not provided in this save.
    const stackIdField =
      params.stackId != null
        ? { stackId: params.stackId }
        : typeof prev.stackId === 'string'
          ? { stackId: prev.stackId }
          : {}
    const stackPositionField =
      params.stackPosition != null
        ? { stackPosition: params.stackPosition }
        : typeof prev.stackPosition === 'number'
          ? { stackPosition: prev.stackPosition }
          : {}
    await updateDoc(ref, {
      ...contentPayload,
      ...legacyStripOnUpdate,
      tags: nextTags,
      wordSource: mergedWordSource,
      ...stackIdField,
      ...stackPositionField,
      exposureScore:
        typeof prev.exposureScore === 'number' && Number.isFinite(prev.exposureScore)
          ? prev.exposureScore
          : 0,
      flagged: Boolean(prev.flagged),
      lastSeenAt: prev.lastSeenAt ?? null,
      lastAnsweredAt: prev.lastAnsweredAt ?? null,
      lastCorrect: prev.lastCorrect === true || prev.lastCorrect === false ? prev.lastCorrect : null,
      // Firestore rejects undefined in updates — legacy docs may omit these fields.
      seenCount:
        typeof prev.seenCount === 'number' && Number.isFinite(prev.seenCount) ? prev.seenCount : 0,
      meaningQuizStreak:
        typeof prev.meaningQuizStreak === 'number' && Number.isFinite(prev.meaningQuizStreak)
          ? prev.meaningQuizStreak
          : 0,
      lastSessionSwipe:
        prev.lastSessionSwipe === 'weak' || prev.lastSessionSwipe === 'strong'
          ? prev.lastSessionSwipe
          : null,
      status: typeof prev.status === 'string' ? prev.status : 'learning',
    })
    return { id: existing.docs[0].id }
  }

  const isStackImport = params.source === 'stack'
  const payloadNew = {
    ...contentPayload,
    // markKnown overrides the params.tags default — same behavior as mobile.
    tags: params.markKnown === true ? [WORD_TAG_KNOWN] : params.tags ?? [],
    status: 'learning' as const,
    exposureScore: 0,
    lastSeenAt: null,
    lastAnsweredAt: null,
    lastCorrect: null,
    flagged: false,
    wordSource: (isStackImport ? 'word_stack' : 'lookup') as 'word_stack' | 'lookup',
    ...(params.stackId != null ? { stackId: params.stackId } : {}),
    ...(params.stackPosition != null ? { stackPosition: params.stackPosition } : {}),
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

