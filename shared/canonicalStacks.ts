/**
 * Canonical stack IDs — single source for catalog, filenames, CLI, staging, and promoted TS modules.
 * Order matches `data/gmat_vocab_stacks.json` → `stacks[]`.
 */
export const CANONICAL_STACK_ORDER = [
  {
    id: 'stack_arg_architecture',
    title: 'The Argument Architecture Lexicon',
    description: 'Connectors, evidence, and argument-move vocabulary.',
  },
  {
    id: 'stack_academic_register',
    title: 'Academic Register Essentials',
    description: 'Dense academic phrasing and journal-style usage.',
  },
  {
    id: 'stack_discriminator',
    title: 'The Near-Synonym Discriminator — Sorted by Difficulty',
    description: 'Fine-grained verbal distinctions by difficulty band.',
  },
  {
    id: 'stack_tone_stance',
    title: 'Attitude, Tone & Author Stance',
    description: 'Tone, stance, and rhetorical posture.',
  },
  {
    id: 'stack_business_policy',
    title: 'Business, Economics & Policy Terrain',
    description: 'Markets, policy, and institutional vocabulary.',
  },
  {
    id: 'stack_science',
    title: 'Science & Natural-World Passages',
    description: 'Scientific reasoning and nature-passage wording.',
  },
  {
    id: 'stack_advanced_reserve',
    title: 'The Advanced & Literary Reserve',
    description: 'Rare, literary, and high-difficulty lexicon.',
  },
] as const

export type CanonicalStackId = (typeof CANONICAL_STACK_ORDER)[number]['id']

export function isCanonicalStackId(id: string): id is CanonicalStackId {
  return CANONICAL_STACK_ORDER.some((s) => s.id === id)
}
