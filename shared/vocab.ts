import { MASTERED_MIN_SCORE, statusFromExposureScore } from './exposureScore'
import { normalizeCorrectDaysCount } from './learningBuckets'
import { normalizeMainLanguageCode } from './languages'
import type { GeneratedResult, VocabItem, VocabStatus, WordSource } from './types'

/** Map Firestore raw status (including legacy) to canonical learning | mastered. */
export function mapRawStatusToVocabStatus(raw: unknown): VocabStatus {
  if (raw === 'mastered') return 'mastered'
  if (raw === 'know') return 'mastered'
  if (raw === 'learning' || raw === 'do_not_know') return 'learning'
  return 'learning'
}

/** True if we should persist migration to Firestore (legacy enum values). */
export function rawStatusNeedsFirestoreMigration(raw: unknown): boolean {
  return raw === 'do_not_know' || raw === 'know'
}

export function normalizeRawVocabDoc(id: string, data: any): VocabItem {
  const text: string =
    typeof data.text === 'string' && data.text.trim()
      ? data.text
      : typeof data.word === 'string' && data.word.trim()
        ? data.word
        : id

  const type: 'word' | 'phrase' =
    data.type === 'phrase' || data.type === 'word' ? data.type : 'word'

  let definition = ''
  if (typeof data.definition === 'string' && data.definition.trim()) {
    definition = data.definition.trim()
  } else if (typeof data.result?.definition === 'string' && data.result.definition.trim()) {
    definition = data.result.definition.trim()
  } else if (Array.isArray(data.result?.definitions) && data.result.definitions[0]) {
    definition = String(data.result.definitions[0])
  }

  const simpleDefinition: string =
    typeof data.simpleDefinition === 'string' && data.simpleDefinition.trim()
      ? data.simpleDefinition.trim()
      : typeof data.result?.simpleDefinition === 'string' && data.result.simpleDefinition.trim()
        ? data.result.simpleDefinition.trim()
        : definition

  const examplesFromDoc = (): string[] | undefined => {
    const top = Array.isArray(data.examples) ? data.examples.map((x: unknown) => String(x).trim()).filter(Boolean) : []
    const fromResult = Array.isArray(data.result?.examples)
      ? data.result.examples.map((x: unknown) => String(x).trim()).filter(Boolean)
      : []
    const merged = top.length ? top : fromResult
    return merged.length ? merged : undefined
  }

  const examples = examplesFromDoc()

  let exampleSentence: string | undefined =
    typeof data.exampleSentence === 'string' && data.exampleSentence.trim()
      ? data.exampleSentence.trim()
      : typeof data.result?.exampleSentence === 'string' && data.result.exampleSentence.trim()
        ? data.result.exampleSentence.trim()
        : undefined

  if (!exampleSentence && examples?.length) {
    exampleSentence = examples[0]
  }

  const wordTagsRaw = Array.isArray(data.wordTags)
    ? data.wordTags
    : Array.isArray(data.result?.wordTags)
      ? data.result.wordTags
      : undefined
  const wordTags =
    wordTagsRaw && wordTagsRaw.length
      ? wordTagsRaw.map((t: unknown) => String(t).trim()).filter(Boolean)
      : undefined

  const contrastFromTop = data.contrastWord ?? data.result?.contrastWord
  const contrastWord =
    contrastFromTop &&
    typeof contrastFromTop === 'object' &&
    typeof (contrastFromTop as { word?: unknown }).word === 'string' &&
    typeof (contrastFromTop as { explanation?: unknown }).explanation === 'string'
      ? {
          word: String((contrastFromTop as { word: string }).word).trim(),
          explanation: String((contrastFromTop as { explanation: string }).explanation).trim(),
        }
      : undefined

  const memoryHookRaw =
    typeof data.memoryHook === 'string' && data.memoryHook.trim()
      ? data.memoryHook.trim()
      : typeof data.result?.memoryHook === 'string' && data.result.memoryHook.trim()
        ? data.result.memoryHook.trim()
        : undefined

  const synonyms: string[] = Array.isArray(data.synonyms)
    ? data.synonyms.map((s: unknown) => String(s)).filter(Boolean)
    : Array.isArray(data.result?.synonyms)
      ? data.result.synonyms.map((s: unknown) => String(s)).filter(Boolean)
      : []

  const seenCount =
    typeof data.seenCount === 'number' && Number.isFinite(data.seenCount)
      ? Math.max(0, Math.floor(data.seenCount))
      : 0

  let exposureScore: number
  if (typeof data.exposureScore === 'number' && Number.isFinite(data.exposureScore)) {
    exposureScore = Math.max(0, Math.floor(data.exposureScore))
  } else {
    const legacyStatus = mapRawStatusToVocabStatus(data.status)
    if (legacyStatus === 'mastered') {
      exposureScore = Math.max(MASTERED_MIN_SCORE, seenCount)
    } else {
      exposureScore = seenCount
    }
  }

  const status: VocabStatus = statusFromExposureScore(exposureScore)

  const meaningQuizStreak =
    typeof data.meaningQuizStreak === 'number' && Number.isFinite(data.meaningQuizStreak)
      ? Math.max(0, Math.floor(data.meaningQuizStreak))
      : undefined

  let lastSessionSwipe: 'weak' | 'strong' | undefined
  if (data.lastSessionSwipe === 'weak' || data.lastSessionSwipe === 'strong') {
    lastSessionSwipe = data.lastSessionSwipe
  }

  let translations: Record<string, string> | undefined
  if (data.translations && typeof data.translations === 'object' && !Array.isArray(data.translations)) {
    const o: Record<string, string> = {}
    for (const [k, v] of Object.entries(data.translations as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) o[k] = v.trim()
    }
    if (Object.keys(o).length) translations = o
  }

  let lastCorrect: boolean | null | undefined
  if (data.lastCorrect === true || data.lastCorrect === false) lastCorrect = data.lastCorrect
  else if (data.lastCorrect === null) lastCorrect = null

  let wordSource: WordSource | undefined
  const src = data.wordSource ?? data.source
  if (src === 'word_stack' || src === 'stack') wordSource = 'word_stack'
  else if (src === 'onboarding') wordSource = 'onboarding'
  else if (src === 'lookup' || src === 'gpt') wordSource = 'lookup'

  const stackId = typeof data.stackId === 'string' ? data.stackId : data.stackId === null ? null : undefined
  const stackPosition =
    typeof data.stackPosition === 'number' && Number.isFinite(data.stackPosition)
      ? Math.floor(data.stackPosition)
      : undefined

  const correctDaysCount = normalizeCorrectDaysCount(data.correctDaysCount)
  const lastIntroducedAt =
    data.lastIntroducedAt === null || data.lastIntroducedAt === undefined ? null : data.lastIntroducedAt

  const nuanceNote =
    typeof data.nuanceNote === 'string' && data.nuanceNote.trim()
      ? data.nuanceNote.trim()
      : typeof data.result?.nuanceNote === 'string' && data.result.nuanceNote.trim()
        ? data.result.nuanceNote.trim()
        : undefined

  const partOfSpeechRaw =
    typeof data.partOfSpeech === 'string' && data.partOfSpeech.trim()
      ? data.partOfSpeech.trim()
      : typeof data.result?.partOfSpeech === 'string' && data.result.partOfSpeech.trim()
        ? String(data.result.partOfSpeech).trim()
        : undefined

  return {
    id,
    text,
    textLower: typeof data.textLower === 'string' ? data.textLower : text.toLowerCase(),
    type,
    definition,
    simpleDefinition,
    ...(examples?.length ? { examples } : {}),
    exampleSentence,
    synonyms,
    ...(wordTags?.length ? { wordTags } : {}),
    ...(contrastWord?.word && contrastWord.explanation ? { contrastWord } : {}),
    nuanceNote,
    ...(partOfSpeechRaw ? { partOfSpeech: partOfSpeechRaw } : {}),
    ...(memoryHookRaw ? { memoryHook: memoryHookRaw } : {}),
    gmatUsageNote:
      typeof data.gmatUsageNote === 'string' && data.gmatUsageNote.trim()
        ? data.gmatUsageNote.trim()
        : typeof data.result?.gmatUsageNote === 'string' && data.result.gmatUsageNote.trim()
          ? data.result.gmatUsageNote.trim()
          : undefined,
    translations,
    status,
    flagged: Boolean(data.flagged),
    exposureScore,
    ...(correctDaysCount.length ? { correctDaysCount } : {}),
    ...(lastIntroducedAt != null ? { lastIntroducedAt } : {}),
    seenCount,
    ...(meaningQuizStreak !== undefined ? { meaningQuizStreak } : {}),
    ...(lastSessionSwipe !== undefined ? { lastSessionSwipe } : {}),
    lastSeenAt: data.lastSeenAt,
    lastAnsweredAt: data.lastAnsweredAt,
    ...(lastCorrect !== undefined ? { lastCorrect } : {}),
    ...(wordSource ? { wordSource } : {}),
    ...(stackId !== undefined ? { stackId } : {}),
    ...(stackPosition !== undefined ? { stackPosition } : {}),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

export { timestampToMillis } from './exposureScore'

/** Short gloss in the learner's main language, if stored and not English. */
export function getNativeGloss(item: VocabItem, mainLanguage: string): string | undefined {
  const lang = normalizeMainLanguageCode(mainLanguage)
  if (lang === 'en') return undefined
  const t = item.translations?.[lang]
  return typeof t === 'string' && t.trim() ? t.trim() : undefined
}

/** Merge Firestore `translations` when saving a generated word; preserves keys for other languages. */
export function mergeTranslationsForSave(
  existing: Record<string, string> | undefined,
  mainLanguage: string | undefined,
  result: Pick<GeneratedResult, 'translationSimple'>,
): Record<string, string> | undefined {
  const lang = normalizeMainLanguageCode(mainLanguage ?? 'en')
  const prev: Record<string, string> =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? Object.fromEntries(
          Object.entries(existing).filter(([, v]) => typeof v === 'string' && String(v).trim()),
        )
      : {}
  if (lang !== 'en') {
    const gloss = typeof result.translationSimple === 'string' ? result.translationSimple.trim() : ''
    if (gloss) prev[lang] = gloss
  }
  return Object.keys(prev).length ? prev : undefined
}
