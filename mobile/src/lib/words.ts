import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import type { GeneratedResult } from '@shared/types'
import { getStackImportResult } from '@shared/wordStackContent'
import { mergeTranslationsForSave } from '@shared/vocab'
import { auth, db } from './firebase'

function requireUserId(): string {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You must be signed in.')
  return uid
}

const MAX_USER_STACKS_PER_WORD = 10

function normalizeUserStackIdsInput(ids: string[] | undefined): string[] {
  const u = [...new Set((ids ?? []).map((x) => String(x).trim()).filter(Boolean))]
  return u.slice(0, MAX_USER_STACKS_PER_WORD)
}

export async function saveWordFromStackImport(params: {
  text: string
  mainLanguage?: string
  stackId: string
  stackPosition: number
}) {
  return saveWord({
    text: params.text,
    result: getStackImportResult(params.stackId, params.stackPosition),
    mainLanguage: params.mainLanguage,
    source: 'stack',
    stackId: params.stackId,
    stackPosition: params.stackPosition,
  })
}

export async function saveWord(params: {
  text: string
  type?: 'word' | 'phrase'
  result: GeneratedResult
  mainLanguage?: string
  /** Legacy; mapped to `wordSource` on write. */
  source?: 'gpt' | 'stack'
  stackId?: string
  stackPosition?: number
  /** User-created stacks; omit on update to preserve existing membership. */
  userStackIds?: string[]
}) {
  const uid = requireUserId()
  const normalizedText = params.text.trim().replace(/\s+/g, ' ')
  if (!normalizedText) throw new Error('Text is required.')
  const type = params.type ?? (normalizedText.includes(' ') ? 'phrase' : 'word')
  const textLower = normalizedText.toLowerCase()
  const wordsCol = collection(db, 'users', uid, 'words')

  const existingSnap = await getDocs(query(wordsCol, where('textLower', '==', textLower)))
  const existingTranslations =
    !existingSnap.empty
      ? (existingSnap.docs[0].data() as { translations?: Record<string, string> }).translations
      : undefined
  const translations = mergeTranslationsForSave(
    existingTranslations,
    params.mainLanguage,
    params.result,
  )
  const wordSource =
    params.source === 'stack' ? 'word_stack' : ('lookup' as const)

  const useNewCardShape =
    Array.isArray(params.result.examples) && params.result.examples.length === 2

  const legacyExampleFields = useNewCardShape
    ? {}
    : {
        exampleSentence: params.result.exampleSentence ?? '',
        gmatUsageNote: params.result.gmatUsageNote ?? '',
      }

  const legacyStripOnUpdate = useNewCardShape
    ? { exampleSentence: deleteField(), gmatUsageNote: deleteField() }
    : {}

  const newShapeFields = {
    ...(useNewCardShape
      ? {
          examples: params.result.examples,
          wordTags: params.result.wordTags ?? [],
          contrastWord: params.result.contrastWord,
          memoryHook: params.result.memoryHook ?? '',
        }
      : {}),
  }

  const contentPayload = {
    word: textLower,
    text: normalizedText,
    textLower,
    type,
    definition: params.result.definition ?? '',
    simpleDefinition: params.result.simpleDefinition ?? '',
    ...legacyExampleFields,
    synonyms: Array.isArray(params.result.synonyms) ? params.result.synonyms : [],
    nuanceNote: params.result.nuanceNote ?? '',
    ...newShapeFields,
    source: params.source ?? 'gpt',
    result: params.result,
    ...(translations ? { translations } : {}),
    updatedAt: serverTimestamp(),
  }

  const existingId = existingSnap.empty ? null : existingSnap.docs[0].id

  return runTransaction(db, async (transaction) => {
    const wordRef = existingId
      ? doc(db, 'users', uid, 'words', existingId)
      : doc(wordsCol)

    let prevUserStackIds: string[] = []
    let prevData: Record<string, unknown> | null = null
    if (existingId) {
      const wSnap = await transaction.get(wordRef)
      if (!wSnap.exists()) throw new Error('Word no longer exists.')
      prevData = wSnap.data() as Record<string, unknown>
      prevUserStackIds = Array.isArray(prevData.userStackIds)
        ? prevData.userStackIds.map((x: unknown) => String(x).trim()).filter(Boolean)
        : []
    }

    const nextUserStackIds =
      params.userStackIds !== undefined
        ? normalizeUserStackIdsInput(params.userStackIds)
        : prevUserStackIds

    const removed = prevUserStackIds.filter((id) => !nextUserStackIds.includes(id))
    const added = nextUserStackIds.filter((id) => !prevUserStackIds.includes(id))

    for (const sid of removed) {
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
    for (const sid of added) {
      const sref = doc(db, 'users', uid, 'myStacks', sid)
      const ss = await transaction.get(sref)
      if (!ss.exists()) throw new Error(`Stack not found: ${sid}`)
      const wc =
        typeof (ss.data() as { wordCount?: unknown }).wordCount === 'number'
          ? Math.max(0, Math.floor((ss.data() as { wordCount: number }).wordCount))
          : 0
      transaction.update(sref, { wordCount: wc + 1, updatedAt: serverTimestamp() })
    }

    if (existingId && prevData) {
      const prev = prevData
      const mergedWordSource =
        params.source === 'stack' ? 'word_stack' : (prev.wordSource as string) || wordSource
      const preservedTags = Array.isArray(prev.tags) ? prev.tags : []
      transaction.update(wordRef, {
        ...contentPayload,
        ...legacyStripOnUpdate,
        wordSource: mergedWordSource,
        ...(params.stackId != null ? { stackId: params.stackId } : prev.stackId != null ? { stackId: prev.stackId } : {}),
        ...(params.stackPosition != null
          ? { stackPosition: params.stackPosition }
          : prev.stackPosition != null
            ? { stackPosition: prev.stackPosition }
            : {}),
        userStackIds: nextUserStackIds,
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
        tags: preservedTags,
      })
      return { id: existingId }
    }

    transaction.set(wordRef, {
      ...contentPayload,
      status: 'learning',
      exposureScore: 0,
      lastSeenAt: null,
      lastAnsweredAt: null,
      lastCorrect: null,
      flagged: false,
      wordSource,
      ...(params.stackId != null ? { stackId: params.stackId } : {}),
      ...(params.stackPosition != null ? { stackPosition: params.stackPosition } : {}),
      userStackIds: nextUserStackIds,
      tags: [],
      createdAt: serverTimestamp(),
    })
    return { id: wordRef.id }
  })
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
