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

function trimStr(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t || undefined
}

/** Normalize Firestore `examples` whether stored as array or occasional legacy map-shaped blobs. */
function parseExamplesList(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean)
  if (typeof raw === 'object') {
    return Object.values(raw as Record<string, unknown>)
      .map((x) => String(x).trim())
      .filter(Boolean)
  }
  return []
}

/** Union ordered lists (top-level doc fields first), dropping duplicate sentences. */
function mergeExampleLists(a: string[], b: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of [...a, ...b]) {
    if (seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

/** Nested `GeneratedResult` on Firestore docs — usually a map; occasionally stored as JSON string. */
function unwrapResult(data: any): Record<string, unknown> | null {
  const r = data?.result
  if (r == null) return null
  if (typeof r === 'string') {
    try {
      const parsed = JSON.parse(r) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    } catch {
      return null
    }
    return null
  }
  if (typeof r === 'object' && !Array.isArray(r)) return r as Record<string, unknown>
  return null
}

export function normalizeRawVocabDoc(id: string, data: any): VocabItem {
  const res = unwrapResult(data)

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
  } else if (typeof res?.definition === 'string' && String(res.definition).trim()) {
    definition = String(res.definition).trim()
  } else if (Array.isArray(res?.definitions) && (res.definitions as unknown[])[0] != null) {
    definition = String((res.definitions as unknown[])[0])
  }

  const simpleDefinition: string =
    typeof data.simpleDefinition === 'string' && data.simpleDefinition.trim()
      ? data.simpleDefinition.trim()
      : typeof res?.simpleDefinition === 'string' && String(res.simpleDefinition).trim()
        ? String(res.simpleDefinition).trim()
        : definition

  const topEx = parseExamplesList(data.examples)
  const fromResultEx = parseExamplesList(res?.examples)
  const mergedExamples = mergeExampleLists(topEx, fromResultEx)
  const examples = mergedExamples.length ? mergedExamples : undefined

  let exampleSentence: string | undefined =
    typeof data.exampleSentence === 'string' && data.exampleSentence.trim()
      ? data.exampleSentence.trim()
      : typeof res?.exampleSentence === 'string' && String(res.exampleSentence).trim()
        ? String(res.exampleSentence).trim()
        : typeof data.example === 'string' && data.example.trim()
          ? data.example.trim()
          : undefined

  if (!exampleSentence && examples?.length) {
    exampleSentence = examples[0]
  }

  const wordTagsRaw = Array.isArray(data.wordTags)
    ? data.wordTags
    : Array.isArray(res?.wordTags)
      ? res.wordTags
      : undefined
  const wordTags =
    wordTagsRaw && wordTagsRaw.length
      ? wordTagsRaw.map((t: unknown) => String(t).trim()).filter(Boolean)
      : undefined

  const contrastRaw =
    data.contrastWord ?? data.contrast_word ?? res?.contrastWord ?? res?.contrast_word
  const contrastWord =
    contrastRaw && typeof contrastRaw === 'object' && contrastRaw !== null
      ? (() => {
          const o = contrastRaw as Record<string, unknown>
          const w = trimStr(o.word) ?? trimStr(o.contrast_word)
          const ex = trimStr(o.explanation) ?? trimStr(o.explanation_text)
          return w && ex ? { word: w, explanation: ex } : undefined
        })()
      : undefined

  const memoryHookRaw =
    trimStr(data.memoryHook) ??
    trimStr(data.memory_hook) ??
    trimStr(res?.memoryHook) ??
    trimStr(res?.memory_hook)

  const topSyn = Array.isArray(data.synonyms)
    ? data.synonyms.map((s: unknown) => String(s)).filter(Boolean)
    : []
  const resSyn = Array.isArray(res?.synonyms)
    ? (res.synonyms as unknown[]).map((s: unknown) => String(s)).filter(Boolean)
    : []
  const synonyms: string[] = mergeExampleLists(topSyn, resSyn)

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

  const userStackIds: string[] = Array.isArray(data.userStackIds)
    ? data.userStackIds.map((x: unknown) => String(x).trim()).filter(Boolean)
    : []

  const tags: string[] = Array.isArray(data.tags)
    ? data.tags.map((x: unknown) => String(x).trim()).filter(Boolean)
    : []

  const correctDaysCount = normalizeCorrectDaysCount(data.correctDaysCount)
  const lastIntroducedAt =
    data.lastIntroducedAt === null || data.lastIntroducedAt === undefined ? null : data.lastIntroducedAt

  const nuanceNote =
    typeof data.nuanceNote === 'string' && data.nuanceNote.trim()
      ? data.nuanceNote.trim()
      : typeof res?.nuanceNote === 'string' && String(res.nuanceNote).trim()
        ? String(res.nuanceNote).trim()
        : undefined

  const partOfSpeechRaw =
    typeof data.partOfSpeech === 'string' && data.partOfSpeech.trim()
      ? data.partOfSpeech.trim()
      : typeof res?.partOfSpeech === 'string' && String(res.partOfSpeech).trim()
        ? String(res.partOfSpeech).trim()
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
        : typeof res?.gmatUsageNote === 'string' && String(res.gmatUsageNote).trim()
          ? String(res.gmatUsageNote).trim()
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
    userStackIds,
    ...(tags.length ? { tags } : {}),
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
