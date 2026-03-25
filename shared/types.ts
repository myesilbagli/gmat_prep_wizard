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

/** Binary lifecycle: still practicing vs done for now (legacy do_not_know/know are migrated). */
export type VocabStatus = 'learning' | 'mastered'

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
  /** Total exposures (flashcard, paragraph target, test, etc.) */
  seenCount?: number
  lastSeenAt?: unknown
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
