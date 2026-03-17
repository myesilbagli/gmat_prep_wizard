export type GeneratedResult = {
  definitions: string[]
  examples: string[]
  synonyms: string[]
  antonyms: string[]
  notes: string
}

export type WordDoc = {
  word: string
  createdAt: unknown
  updatedAt: unknown
  source: 'gpt'
  result: GeneratedResult
  tags: string[]
  difficulty?: number
}

