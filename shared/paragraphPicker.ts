import { MASTERED_MIN_SCORE, timestampToMillis } from './exposureScore'
import type { VocabItem } from './types'

const DAY_MS = 24 * 60 * 60 * 1000
const IDEAL_CENTER = 8

function isLearning(item: VocabItem): boolean {
  return item.exposureScore < MASTERED_MIN_SCORE
}

/**
 * Pick up to `max` words for paragraph generation: learning-only, score &gt; 0, seen before.
 * Tiers: ideal score in [3, upper], prefer not seen in last 24h, then closeness to ~8.
 */
export function pickParagraphWords(items: VocabItem[], nowMs: number, max: number = 5): VocabItem[] {
  const learning = items.filter(isLearning)

  function rankForUpper(upper: number): VocabItem[] {
    const eligible = learning.filter((i) => {
      if (i.exposureScore <= 0) return false
      if (timestampToMillis(i.lastSeenAt) == null) return false
      if (i.exposureScore < 3 || i.exposureScore > upper) return false
      return true
    })
    eligible.sort((a, b) => {
      const ta = timestampToMillis(a.lastSeenAt)!
      const tb = timestampToMillis(b.lastSeenAt)!
      const recentA = nowMs - ta < DAY_MS
      const recentB = nowMs - tb < DAY_MS
      if (recentA !== recentB) return recentA ? 1 : -1
      return Math.abs(a.exposureScore - IDEAL_CENTER) - Math.abs(b.exposureScore - IDEAL_CENTER)
    })
    return eligible
  }

  const seen = new Set<string>()
  const out: VocabItem[] = []

  for (const w of rankForUpper(15)) {
    if (out.length >= max) break
    if (seen.has(w.id)) continue
    out.push(w)
    seen.add(w.id)
  }
  if (out.length < max) {
    for (const w of rankForUpper(20)) {
      if (out.length >= max) break
      if (seen.has(w.id)) continue
      out.push(w)
      seen.add(w.id)
    }
  }
  if (out.length < max) {
    const fallback = learning.filter((i) => {
      if (i.exposureScore <= 0) return false
      if (timestampToMillis(i.lastSeenAt) == null) return false
      return true
    })
    fallback.sort(
      (a, b) =>
        Math.abs(a.exposureScore - IDEAL_CENTER) - Math.abs(b.exposureScore - IDEAL_CENTER),
    )
    for (const w of fallback) {
      if (out.length >= max) break
      if (seen.has(w.id)) continue
      out.push(w)
      seen.add(w.id)
    }
  }

  return out.slice(0, max)
}
