import type { SwipeSignal } from './sessionQuiz'

/** One row per word when finishing the daily session (MCQ outcome drives exposure score). */
export type SessionWordOutcome = {
  id: string
  swipe: SwipeSignal
  mcqCorrect: boolean
}
