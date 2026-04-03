import type { VocabItem } from './types'

const DEFAULT_BATCH = 5

/** Words eligible for the daily batch: learning, or flagged mastered (review). */
export function isEligibleForSessionBatch(item: VocabItem): boolean {
  if (item.status === 'learning') return true
  if (item.status === 'mastered' && item.flagged) return true
  return false
}

function compareBatchPriority(a: VocabItem, b: VocabItem): number {
  if (a.flagged !== b.flagged) return a.flagged ? -1 : 1
  const aw = a.lastSessionSwipe === 'weak' ? 0 : 1
  const bw = b.lastSessionSwipe === 'weak' ? 0 : 1
  if (aw !== bw) return aw - bw
  const as = a.seenCount ?? 0
  const bs = b.seenCount ?? 0
  if (as !== bs) return as - bs
  return a.id.localeCompare(b.id)
}

/**
 * One mixed batch: flagged + weak-priority + low exposure first, then fill with remaining learning.
 */
export function pickSessionBatchFive(items: VocabItem[], max: number = DEFAULT_BATCH): VocabItem[] {
  const pool = items.filter(isEligibleForSessionBatch)
  pool.sort(compareBatchPriority)
  return pool.slice(0, Math.min(max, pool.length))
}

export { DEFAULT_BATCH as SESSION_BATCH_SIZE }
