import { bucketFromWord } from './learningBuckets'
import { MASTERED_MIN_SCORE, timestampToMillis } from './exposureScore'
import type { VocabItem } from './types'

const DAY_MS = 24 * 60 * 60 * 1000
const IDEAL_CENTER = 8

/** Fisher–Yates; mutates `arr`. */
function shuffleArray<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = arr[i]!
    arr[i] = arr[j]!
    arr[j] = t
  }
}

function isLearning(item: VocabItem): boolean {
  return item.exposureScore < MASTERED_MIN_SCORE
}

export type ParagraphPickPool = 'learning' | 'familiar' | 'mixed'

export type PickParagraphWordsOptions = {
  /** When set, restricts by learning bucket (excludes `new` for learning/mixed). Omit for legacy “non-mastered” pool (web). */
  pool?: ParagraphPickPool
  /** Words already used in this reading session — excluded before pool/stack rules. */
  excludeIds?: string[]
}

function filterByPool(items: VocabItem[], pool?: ParagraphPickPool): VocabItem[] {
  if (!pool) return items.filter(isLearning)
  return items.filter((w) => {
    const b = bucketFromWord(w)
    if (pool === 'learning') return b === 'learning'
    if (pool === 'familiar') return b === 'familiar'
    return b === 'learning' || b === 'familiar'
  })
}

/**
 * Prefer a user-imported stack when ≥3 eligible words share that stack; else optional lore `stackId` cohesion.
 */
function applyStackCohesion(items: VocabItem[]): VocabItem[] {
  const minCandidates = items.filter(
    (i) => i.exposureScore > 0 && timestampToMillis(i.lastSeenAt) != null,
  )
  if (!minCandidates.length) return items

  const userStackCounts = new Map<string, number>()
  for (const w of minCandidates) {
    for (const id of w.userStackIds ?? []) {
      if (!id) continue
      userStackCounts.set(id, (userStackCounts.get(id) ?? 0) + 1)
    }
  }
  let bestUser: string | null = null
  let bestUserCount = 0
  for (const [id, c] of userStackCounts) {
    if (c > bestUserCount) {
      bestUserCount = c
      bestUser = id
    }
  }
  if (bestUser && bestUserCount >= 3) {
    return items.filter((w) => (w.userStackIds ?? []).includes(bestUser!))
  }

  const noUserStacks = minCandidates.every((w) => !(w.userStackIds ?? []).length)
  if (noUserStacks) {
    const loreCounts = new Map<string, number>()
    for (const w of minCandidates) {
      const sid = typeof w.stackId === 'string' ? w.stackId.trim() : ''
      if (!sid) continue
      loreCounts.set(sid, (loreCounts.get(sid) ?? 0) + 1)
    }
    let bestLore: string | null = null
    let bestLoreCount = 0
    for (const [id, c] of loreCounts) {
      if (c > bestLoreCount) {
        bestLoreCount = c
        bestLore = id
      }
    }
    if (bestLore && bestLoreCount >= 3) {
      return items.filter((w) => (typeof w.stackId === 'string' ? w.stackId.trim() : '') === bestLore)
    }
  }

  return items
}

function rankForUpper(source: VocabItem[], nowMs: number, upper: number): VocabItem[] {
  const eligible = source.filter((i) => {
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

/**
 * Pick up to `max` words for paragraph generation.
 * Tiers: ideal score in [3, upper], prefer not seen in last 24h, then closeness to ~8.
 *
 * Pool (when set): **From Learning** = bucket `learning` only (excludes `new`);
 * **From Familiar** = `familiar`; **Mixed** = `learning` ∪ `familiar`. Mastered never matches these buckets.
 * When `pool` is omitted, uses legacy filter: all non-mastered words (`isLearning`), matching older web behavior.
 *
 * Builds a **ranked** eligible list (tier order preserved), then draws `max` words from a **shuffled pool**:
 * when there are many candidates, uses a random sliding window over the ranked list (so runs are not stuck on the
 * same top-25 slice), then Fisher–Yates shuffle and take `max`.
 */
export function pickParagraphWords(
  items: VocabItem[],
  nowMs: number,
  max: number = 5,
  options?: PickParagraphWordsOptions,
): VocabItem[] {
  const exclude = new Set(options?.excludeIds ?? [])
  const excluded = items.filter((i) => !exclude.has(i.id))
  const pooled = filterByPool(excluded, options?.pool)
  const universe = applyStackCohesion(pooled)

  const seen = new Set<string>()
  const ranked: VocabItem[] = []

  for (const w of rankForUpper(universe, nowMs, 15)) {
    if (seen.has(w.id)) continue
    seen.add(w.id)
    ranked.push(w)
  }
  for (const w of rankForUpper(universe, nowMs, 20)) {
    if (seen.has(w.id)) continue
    seen.add(w.id)
    ranked.push(w)
  }
  const fallback = universe.filter((i) => {
    if (i.exposureScore <= 0) return false
    if (timestampToMillis(i.lastSeenAt) == null) return false
    return true
  })
  fallback.sort(
    (a, b) =>
      Math.abs(a.exposureScore - IDEAL_CENTER) - Math.abs(b.exposureScore - IDEAL_CENTER),
  )
  for (const w of fallback) {
    if (seen.has(w.id)) continue
    seen.add(w.id)
    ranked.push(w)
  }

  const poolCap = Math.min(50, ranked.length)
  let pool: VocabItem[]
  if (ranked.length <= poolCap) {
    pool = ranked.slice()
  } else {
    const start = Math.floor(Math.random() * (ranked.length - poolCap + 1))
    pool = ranked.slice(start, start + poolCap)
  }
  shuffleArray(pool, Math.random)
  return pool.slice(0, max)
}
