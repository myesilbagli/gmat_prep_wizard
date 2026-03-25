import type { VocabItem, VocabStatus } from './types'

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
    status,
    flagged: Boolean(data.flagged),
    seenCount,
    lastSeenAt: data.lastSeenAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}
