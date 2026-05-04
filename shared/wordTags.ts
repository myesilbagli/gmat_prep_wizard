import type { VocabItem } from './types'

/**
 * Reserved value persisted into `VocabItem.tags` to mark a word the user has
 * declared they already know. Known words are excluded from session pickers
 * (see `shared/sessionPlanner.ts`) and counted separately by
 * `countDeckBuckets` (see `shared/learningBuckets.ts`).
 *
 * All `'known'` references in the codebase MUST go through this constant —
 * never inline the string literal.
 */
export const WORD_TAG_KNOWN = 'known' as const

export type ReservedWordTag = typeof WORD_TAG_KNOWN

/** True iff the word carries the reserved `'known'` tag. */
export function isKnownWord(w: Pick<VocabItem, 'tags'>): boolean {
  return Array.isArray(w.tags) && w.tags.includes(WORD_TAG_KNOWN)
}
