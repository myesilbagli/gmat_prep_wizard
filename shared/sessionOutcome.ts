import type { VocabItem, VocabStatus } from './types'
import type { SwipeSignal } from './sessionQuiz'

/** Consecutive sessions with a correct meaning MCQ required to mark mastered. */
export const MEANING_MASTERED_STREAK = 2

export type SessionWordOutcome = {
  id: string
  swipe: SwipeSignal
  mcqCorrect: boolean
}

/**
 * After one session: exposure + swipe hint + MCQ drives streak and mastery.
 * Matching phase does not affect streak (per product spec).
 */
export function computeWordFieldsAfterSession(
  item: VocabItem,
  swipe: SwipeSignal,
  mcqCorrect: boolean,
): {
  meaningQuizStreak: number
  status: VocabStatus
  lastSessionSwipe: SwipeSignal
} {
  const prev = item.meaningQuizStreak ?? 0
  const streak = mcqCorrect ? prev + 1 : 0
  let status: VocabStatus = item.status

  if (!mcqCorrect) {
    status = 'learning'
  } else if (item.status === 'mastered') {
    status = 'mastered'
  } else if (streak >= MEANING_MASTERED_STREAK) {
    status = 'mastered'
  } else {
    status = 'learning'
  }

  return {
    meaningQuizStreak: streak,
    status,
    lastSessionSwipe: swipe,
  }
}
