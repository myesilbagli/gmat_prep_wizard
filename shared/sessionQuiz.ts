import type { QuizQuestion } from './types'

export type SwipeSignal = 'weak' | 'strong'

/** Weak-swiped items first, then strong; unknown itemIds last (stable). */
export function orderQuestionsBySwipeWeakFirst(
  questions: QuizQuestion[],
  swipeById: Map<string, SwipeSignal>,
): QuizQuestion[] {
  const rank = (id: string): number => {
    const s = swipeById.get(id)
    if (s === 'weak') return 0
    if (s === 'strong') return 1
    return 2
  }
  return [...questions].sort((a, b) => {
    const d = rank(a.itemId) - rank(b.itemId)
    return d !== 0 ? d : 0
  })
}
