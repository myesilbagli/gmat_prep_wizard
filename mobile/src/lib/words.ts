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
import { WORD_TAG_KNOWN } from '@shared/wordTags'
import { auth, db } from './firebase'

function requireUserId(): string {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You must be signed in.')
  return uid
}

/** Max user stacks a single word can belong to (enforced client + server-side normalize). */
export const MAX_USER_STACKS_PER_WORD = 10

function normalizeUserStackIdsInput(ids: string[] | undefined): string[] {
  const u = [...new Set((ids ?? []).map((x) => String(x).trim()).filter(Boolean))]
  return u.slice(0, MAX_USER_STACKS_PER_WORD)
}

export async function saveWordFromStackImport(params: {
  text: string
  mainLanguage?: string
  stackId: string
  stackPosition: number
  /** When true, persists the reserved `'known'` tag so the word is excluded from sessions. */
  markKnown?: boolean
}) {
  return saveWord({
    text: params.text,
    result: getStackImportResult(params.stackId, params.stackPosition, params.mainLanguage),
    mainLanguage: params.mainLanguage,
    source: 'stack',
    stackId: params.stackId,
    stackPosition: params.stackPosition,
    markKnown: params.markKnown,
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
  /**
   * When `true`, ensures the reserved `'known'` tag is present on the saved doc.
   * Write-only signal: `false`/`undefined` is identical and never removes an
   * existing `'known'` tag — use `toggleWordKnown(id, false)` to remove.
   */
  markKnown?: boolean
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

  /** Flatten hook/contrast/examples tags whenever present — not only when `examples.length === 2` (legacy saves hid nested tutor fields). */
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
    ...topFromResult,
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
      const preservedTags: string[] = Array.isArray(prev.tags)
        ? prev.tags.map((x: unknown) => String(x).trim()).filter(Boolean)
        : []
      const nextTags =
        params.markKnown === true && !preservedTags.includes(WORD_TAG_KNOWN)
          ? [...preservedTags, WORD_TAG_KNOWN]
          : preservedTags
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
        // Firestore update() rejects undefined — legacy docs may omit these fields.
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
        tags: nextTags,
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
      tags: params.markKnown === true ? [WORD_TAG_KNOWN] : [],
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
