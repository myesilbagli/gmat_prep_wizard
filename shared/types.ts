export type GeneratedResult = {
  definition: string
  simpleDefinition: string
  exampleSentence?: string
  synonyms?: string[]
  nuanceNote?: string
  gmatUsageNote?: string
  definitions?: string[]
  examples?: string[]
  antonyms?: string[]
}

export type VocabStatus = 'do_not_know' | 'learning' | 'know'

export type VocabItem = {
  id: string
  text: string
  textLower?: string
  type: 'word' | 'phrase'
  definition: string
  simpleDefinition: string
  exampleSentence?: string
  synonyms: string[]
  nuanceNote?: string
  gmatUsageNote?: string
  status: VocabStatus
  flagged: boolean
  createdAt?: unknown
  updatedAt?: unknown
}

export type QuizMode = 'meaning' | 'gmat'

export type QuizQuestion = {
  itemId: string
  questionText: string
  options: string[]
  correctIndex: number
  explanation: string
}
