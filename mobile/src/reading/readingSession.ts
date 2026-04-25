import type { VocabItem } from '@shared/types'

export type ReadingLengthMode = 'quick' | 'focused' | 'timed'
export type ReadingPoolMode = 'learning' | 'familiar' | 'mixed'

export type ReadingSessionConfig = {
  length: ReadingLengthMode
  pool: ReadingPoolMode
  /** Client-trimmed; omit when blank */
  theme?: string
}

export type ParagraphPart =
  | { kind: 'text'; value: string }
  | { kind: 'target'; text: string }

export type ReadingPassageEntry = {
  parts: ParagraphPart[]
  picked: VocabItem[]
  readingStartedAt?: number
  readingEndedAt?: number
  domain?: string
  difficulty?: string
}

/** Shared state for Practice → Reading → Review (in-memory only in v1). */
export type ReadingSession = {
  config: ReadingSessionConfig
  totalPassages: number
  currentIndex: number
  passages: ReadingPassageEntry[]
  usedWordIds: string[]
}

export function createReadingSession(config: ReadingSessionConfig): ReadingSession {
  const totalPassages = config.length === 'focused' ? 3 : 1
  return {
    config,
    totalPassages,
    currentIndex: 0,
    passages: [],
    usedWordIds: [],
  }
}
