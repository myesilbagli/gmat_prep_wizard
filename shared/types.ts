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
  /** Short main-sense gloss in the user's main language (when not English); stored under `translations[lang]`. */
  translationSimple?: string
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
  /** Short meanings keyed by main language code (e.g. `tr`); English stays in `definition` / `simpleDefinition`. */
  translations?: Record<string, string>
  status: VocabStatus
  flagged: boolean
  /** Total exposures (flashcard, paragraph target, test, etc.) */
  seenCount?: number
  /** Consecutive sessions with a correct meaning MCQ (session-level). */
  meaningQuizStreak?: number
  /** Last daily session swipe signal (for next-session batch priority). */
  lastSessionSwipe?: 'weak' | 'strong'
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
