import type { ContrastWord, GeneratedResult } from '../../shared/types'

export type { GeneratedResult }

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
  /** @deprecated Prefer `examples` on new cards. */
  exampleSentence?: string
  synonyms?: string[]
  nuanceNote?: string
  /** @deprecated Not written on new generates. */
  gmatUsageNote?: string
  examples?: string[]
  wordTags?: string[]
  contrastWord?: ContrastWord
  memoryHook?: string
  /** Short meanings keyed by language code (e.g. `tr`). */
  translations?: Record<string, string>
  // Back-compat (older docs)
  note?: string
  status?: 'learning' | 'mastered' | 'do_not_know' | 'know'
  flagged?: boolean
  exposureScore?: number
  lastSeenAt?: unknown
  lastAnsweredAt?: unknown
  lastCorrect?: boolean | null
  wordSource?: 'lookup' | 'word_stack' | 'onboarding'
}

