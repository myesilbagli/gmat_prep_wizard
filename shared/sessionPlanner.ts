import type { VocabItem } from './types'

const REVIEW = 5
const NEW = 5
const QUIZ = 5

/** Learning words, lowest seenCount first (then updatedAt via list order if tied). */
export function pickReviewWords(items: VocabItem[], max: number = REVIEW): VocabItem[] {
  const pool = items.filter((it) => it.status === 'learning')
  pool.sort((a, b) => (a.seenCount ?? 0) - (b.seenCount ?? 0))
  return pool.slice(0, Math.min(max, pool.length))
}

/** Words never seen in deck (seenCount === 0), excluding words already used in review. */
export function pickNewWords(
  items: VocabItem[],
  max: number = NEW,
  excludeIds: ReadonlySet<string> = new Set(),
): VocabItem[] {
  const pool = items.filter(
    (it) => (it.seenCount ?? 0) === 0 && !excludeIds.has(it.id),
  )
  return pool.slice(0, Math.min(max, pool.length))
}

/** Quiz ids: mix words from this session first, then other learning words (shuffled). */
export function pickQuizItemIds(
  sessionWordIds: string[],
  items: VocabItem[],
  max: number = QUIZ,
): string[] {
  const sessionSet = new Set(sessionWordIds)
  const learning = items.filter((it) => it.status === 'learning')
  const fromSession = learning.filter((it) => sessionSet.has(it.id))
  const other = learning.filter((it) => !sessionSet.has(it.id))
  for (let i = other.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[other[i], other[j]] = [other[j], other[i]]
  }
  const ordered = [...fromSession, ...other]
  return ordered.slice(0, Math.min(max, ordered.length)).map((it) => it.id)
}

export function sessionTotalSteps(
  reviewCount: number,
  newCount: number,
  quizCount: number,
): number {
  return reviewCount + newCount + quizCount
}

export { REVIEW, NEW, QUIZ }
