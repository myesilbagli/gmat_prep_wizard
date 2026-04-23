export type ContrastWord = {
  word: string
  explanation: string
}

/** LLM-generated part of speech for display and example tone. */
export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'preposition'
  | 'conjunction'
  | 'phrase'

/** Shape returned by POST /generate after validation. Legacy fields optional for old Firestore docs. */
export type GeneratedResult = {
  definition: string
  simpleDefinition: string
  partOfSpeech: PartOfSpeech
  /** Exactly two example sentences (GMAT-style); primary card content for new generates. */
  examples: string[]
  synonyms: string[]
  wordTags: string[]
  contrastWord: ContrastWord
  nuanceNote: string
  memoryHook: string
  /** @deprecated Legacy single example; prefer `examples`. */
  exampleSentence?: string
  /** @deprecated Removed from new generates; merged into nuanceNote. */
  gmatUsageNote?: string
  definitions?: string[]
  antonyms?: string[]
  /** Short main-sense gloss in the user's main language (when not English); stored under `translations[lang]`. */
  translationSimple?: string
}

/** Derived from `exposureScore` + intro / correct days; not persisted. */
export type LearningBucket = 'new' | 'learning' | 'familiar' | 'mastered'

/** Derived from `exposureScore` (>= 20 → mastered); persisted on each update. */
export type VocabStatus = 'learning' | 'mastered'

export type WordSource = 'lookup' | 'word_stack' | 'onboarding'

export type VocabItem = {
  id: string
  text: string
  textLower?: string
  type: 'word' | 'phrase'
  definition: string
  simpleDefinition: string
  /** New shape: two sentences. */
  examples?: string[]
  /** @deprecated Old docs only. */
  exampleSentence?: string
  synonyms: string[]
  wordTags?: string[]
  contrastWord?: ContrastWord
  nuanceNote?: string
  memoryHook?: string
  /** @deprecated Old docs only. */
  gmatUsageNote?: string
  /** From generated cards; optional on legacy docs. */
  partOfSpeech?: PartOfSpeech | string
  /** Short meanings keyed by main language code (e.g. `tr`); English stays in `definition` / `simpleDefinition`. */
  translations?: Record<string, string>
  status: VocabStatus
  flagged: boolean
  /** Weighted exposure count; drives `status` with `MASTERED_MIN_SCORE` in exposureScore.ts */
  exposureScore: number
  /** YYYY-MM-DD (user timezone) when MCQ was answered correctly; deduped ascending */
  correctDaysCount?: string[]
  /** Set when user completes intro in session; null/omit = not introduced */
  lastIntroducedAt?: unknown | null
  /** Total exposures (legacy); optional on old docs */
  seenCount?: number
  /** Legacy session fields; optional */
  meaningQuizStreak?: number
  lastSessionSwipe?: 'weak' | 'strong'
  /** When the word was last shown in any surface */
  lastSeenAt?: unknown
  /** When the user last answered a quiz (session MCQ, test, etc.) */
  lastAnsweredAt?: unknown
  /** Whether the most recent quiz answer was correct */
  lastCorrect?: boolean | null
  /** Where the word was first saved */
  wordSource?: WordSource
  stackId?: string | null
  stackPosition?: number | null
  createdAt?: unknown
  updatedAt?: unknown
}

/** Wire values for /generateQuiz; legacy `meaning`/`gmat` still accepted server-side. */
export type QuizMode = 'context' | 'verbal'

export type QuizQuestion = {
  itemId: string
  questionText: string
  options: string[]
  correctIndex: number
  explanation: string
}
