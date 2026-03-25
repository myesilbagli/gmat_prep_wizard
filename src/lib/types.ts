export type GeneratedResult = {
  // New (preferred) structured fields
  definition: string
  simpleDefinition: string
  exampleSentence?: string
  synonyms?: string[]
  nuanceNote?: string
  gmatUsageNote?: string

  // Keep extra detail (optional) for richer displays / future use.
  definitions?: string[]
  examples?: string[]
  antonyms?: string[]
}

export type WordDoc = {
  word: string
  createdAt: unknown
  updatedAt: unknown
  source: 'gpt'
  result: GeneratedResult
  tags: string[]
  difficulty?: number
  // New fields used by the simplified vocab model.
  text?: string
  textLower?: string
  type?: 'word' | 'phrase'
  definition?: string
  simpleDefinition?: string
  exampleSentence?: string
  synonyms?: string[]
  nuanceNote?: string
  gmatUsageNote?: string
  // Back-compat (older docs)
  note?: string
  status?: 'learning' | 'mastered' | 'do_not_know' | 'know'
  flagged?: boolean
}

