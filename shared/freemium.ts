/** Lexicon Free vs Pro — limits and catalog (stack modules live under `shared/stacks/`). */

import { CANONICAL_STACK_ORDER } from './canonicalStacks'

export const FREE_MAX_SAVED_WORDS = 50
export const FREE_MAX_SESSION_STARTS_PER_DAY = 3

/** Free tier can open these stack ids (first three LoreLabs packs). */
export const FREE_BASIC_STACK_IDS = [
  'stack_arg_architecture',
  'stack_academic_register',
  'stack_discriminator',
] as const

export type WordStackTier = 'basic' | 'pro'

export type WordStackDefinition = {
  id: string
  title: string
  description: string
  tier: WordStackTier
  /** Words in the pack (`shared/stacks/{id}.ts` / glossary). */
  wordCount: number
}

/** Word counts aligned with `data/gmat_vocab_stacks.json`. */
const STACK_WORD_COUNTS: Record<string, number> = {
  stack_arg_architecture: 80,
  stack_academic_register: 65,
  stack_discriminator: 78,
  stack_tone_stance: 47,
  stack_business_policy: 62,
  stack_science: 42,
  stack_advanced_reserve: 59,
}

/** Stack metadata; word lists live in `shared/stacks/*.ts`. */
export const WORD_STACK_CATALOG: WordStackDefinition[] = CANONICAL_STACK_ORDER.map(
  (row, idx) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    tier: idx < 3 ? ('basic' as const) : ('pro' as const),
    wordCount: STACK_WORD_COUNTS[row.id] ?? 0,
  }),
)

export function isFreeBasicStackId(stackId: string): boolean {
  return (FREE_BASIC_STACK_IDS as readonly string[]).includes(stackId)
}

export function canAccessStack(stackId: string, isPro: boolean): boolean {
  if (isPro) return true
  return isFreeBasicStackId(stackId)
}
