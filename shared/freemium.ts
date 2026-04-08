/** Lexicon Free vs Pro — limits and catalog (stack content wiring comes later). */

export const FREE_MAX_SAVED_WORDS = 50
export const FREE_MAX_SESSION_STARTS_PER_DAY = 3
export const BASIC_STACK_WORD_COUNT = 50

/** The two basic stacks free users can open (full word lists ship in a later release). */
export const FREE_BASIC_STACK_IDS = ['stack_gmat_core_50', 'stack_verbal_essentials_50'] as const

export type WordStackTier = 'basic' | 'pro'

export type WordStackDefinition = {
  id: string
  title: string
  description: string
  tier: WordStackTier
  /** Planned size; basic stacks are 50 words each for the free tier. */
  wordCount: number
}

/** Placeholder catalog — replace with real stack content when stacks ship. */
export const WORD_STACK_CATALOG: WordStackDefinition[] = [
  {
    id: 'stack_gmat_core_50',
    title: 'GMAT Core 50',
    description: 'High-frequency GMAT vocabulary — free tier stack A.',
    tier: 'basic',
    wordCount: BASIC_STACK_WORD_COUNT,
  },
  {
    id: 'stack_verbal_essentials_50',
    title: 'Verbal Essentials 50',
    description: 'Reading & critical reasoning terms — free tier stack B.',
    tier: 'basic',
    wordCount: BASIC_STACK_WORD_COUNT,
  },
  {
    id: 'stack_quant_bridge_50',
    title: 'Quant Bridge 50',
    description: 'Math-forward wording and qualifiers.',
    tier: 'pro',
    wordCount: BASIC_STACK_WORD_COUNT,
  },
  {
    id: 'stack_argument_50',
    title: 'Argument & Tone 50',
    description: 'Strengthen/weaken and attitude vocabulary.',
    tier: 'pro',
    wordCount: BASIC_STACK_WORD_COUNT,
  },
  {
    id: 'stack_formal_academic_50',
    title: 'Formal Academic 50',
    description: 'Dense academic and journal-style usage.',
    tier: 'pro',
    wordCount: BASIC_STACK_WORD_COUNT,
  },
]

export function isFreeBasicStackId(stackId: string): boolean {
  return (FREE_BASIC_STACK_IDS as readonly string[]).includes(stackId)
}

export function canAccessStack(stackId: string, isPro: boolean): boolean {
  if (isPro) return true
  return isFreeBasicStackId(stackId)
}
