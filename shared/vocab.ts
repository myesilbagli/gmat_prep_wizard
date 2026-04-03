import { normalizeMainLanguageCode } from './languages'
import type { GeneratedResult, VocabItem, VocabStatus } from './types'

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

  const exampleSentence =
    typeof data.exampleSentence === 'string' && data.exampleSentence.trim()
      ? data.exampleSentence.trim()
      : typeof data.result?.exampleSentence === 'string' && data.result.exampleSentence.trim()
        ? data.result.exampleSentence.trim()
        : undefined

  const synonyms: string[] = Array.isArray(data.synonyms)
    ? data.synonyms.map((s: unknown) => String(s)).filter(Boolean)
    : Array.isArray(data.result?.synonyms)
      ? data.result.synonyms.map((s: unknown) => String(s)).filter(Boolean)
      : []

  const status = mapRawStatusToVocabStatus(data.status)

  const seenCount =
    typeof data.seenCount === 'number' && Number.isFinite(data.seenCount)
      ? Math.max(0, Math.floor(data.seenCount))
      : 0

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

  return {
    id,
    text,
    textLower: typeof data.textLower === 'string' ? data.textLower : text.toLowerCase(),
    type,
    definition,
    simpleDefinition,
    exampleSentence,
    synonyms,
    nuanceNote: typeof data.nuanceNote === 'string' ? data.nuanceNote : undefined,
    gmatUsageNote: typeof data.gmatUsageNote === 'string' ? data.gmatUsageNote : undefined,
    translations,
    status,
    flagged: Boolean(data.flagged),
    seenCount,
    ...(meaningQuizStreak !== undefined ? { meaningQuizStreak } : {}),
    ...(lastSessionSwipe !== undefined ? { lastSessionSwipe } : {}),
    lastSeenAt: data.lastSeenAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

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
