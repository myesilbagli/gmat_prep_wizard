import type { VocabItem, VocabStatus } from './types'

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

  const status: VocabStatus =
    data.status === 'do_not_know' || data.status === 'know' || data.status === 'learning'
      ? data.status
      : 'learning'

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
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}
