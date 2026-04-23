import type { VocabStatus } from './types'

/** Score at or above this value is stored as `mastered`. */
export const MASTERED_MIN_SCORE = 20

export const DELTA_SHOWN = 1
export const DELTA_QUIZ_CORRECT = 2
export const DELTA_QUIZ_WRONG = -1
export const MIN_SCORE = 0

export function applyDelta(current: number, delta: number): number {
  return Math.max(MIN_SCORE, current + delta)
}

export function statusFromExposureScore(score: number): VocabStatus {
  return score >= MASTERED_MIN_SCORE ? 'mastered' : 'learning'
}

export type ExposureBand = 'unfamiliar' | 'developing' | 'solid' | 'strong'

/** UI-only bands; raw score remains the source of truth. */
export function exposureBand(score: number): ExposureBand {
  if (score <= 3) return 'unfamiliar'
  if (score <= 9) return 'developing'
  if (score <= 19) return 'solid'
  return 'strong'
}

/** Parse Firestore Timestamp, Date, or millis for sorting. */
export function timestampToMillis(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'object' && value !== null && 'toMillis' in value && typeof (value as { toMillis: () => number }).toMillis === 'function') {
    try {
      return (value as { toMillis: () => number }).toMillis()
    } catch {
      return null
    }
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const s = (value as { seconds?: number }).seconds
    if (typeof s === 'number') return s * 1000
  }
  return null
}
