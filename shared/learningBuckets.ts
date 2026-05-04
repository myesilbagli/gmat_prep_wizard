import type { LearningBucket, VocabItem } from './types'
import { isKnownWord } from './wordTags'

export type DeckBucketCounts = {
  new: number
  learning: number
  familiar: number
  mastered: number
  /**
   * Words carrying the reserved `'known'` tag. Excluded from the four learning
   * buckets above to avoid double-counting; see `countDeckBuckets`.
   */
  known: number
  flagged: number
}

/** True if the word has been introduced in the v3 sense (any non-null stored timestamp). */
function hasIntroducedAt(w: VocabItem): boolean {
  return w.lastIntroducedAt != null
}

export function bucketFromWord(w: VocabItem): LearningBucket {
  if (w.exposureScore === 0 && !hasIntroducedAt(w)) return 'new'
  if (w.exposureScore >= 26 && (w.correctDaysCount?.length ?? 0) >= 3) return 'mastered'
  if (w.exposureScore >= 11) return 'familiar'
  return 'learning'
}

export function normalizeCorrectDaysCount(days: unknown): string[] {
  if (!Array.isArray(days)) return []
  const uniq = new Set<string>()
  for (const d of days) {
    if (typeof d !== 'string') continue
    const day = d.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue
    uniq.add(day)
  }
  return Array.from(uniq).sort()
}

export function pushCorrectDayIfMissing(days: string[], day: string): string[] {
  return normalizeCorrectDaysCount([...days, day])
}

export function countDeckBuckets(items: VocabItem[]): DeckBucketCounts {
  let n = 0
  let l = 0
  let f = 0
  let m = 0
  let k = 0
  let flagged = 0
  for (const i of items) {
    if (isKnownWord(i)) {
      k += 1
      // `flagged` counts all starred words regardless of known status — the two
      // are independent user intents (review priority vs session exclusion).
      if (i.flagged) flagged += 1
      continue
    }
    const b = bucketFromWord(i)
    if (b === 'new') n += 1
    else if (b === 'learning') l += 1
    else if (b === 'familiar') f += 1
    else m += 1
    // `flagged` counts all starred words regardless of known status — the two
    // are independent user intents (review priority vs session exclusion).
    if (i.flagged) flagged += 1
  }
  return { new: n, learning: l, familiar: f, mastered: m, known: k, flagged }
}
