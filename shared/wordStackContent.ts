/**
 * Stack word lists — sourced from `shared/stacks/{canonicalStackId}.ts`.
 * Pre-promotion: modules export `STACK_WORD_TEXTS` (+ `STACK_LEVELS`).
 * After `npm run promote:stacks`: modules export `STACK_PACK` with full `GeneratedResult`s.
 */
import type { GeneratedResult } from './types'
import type { StackLevelBand, StackPackRow } from './stackPackTypes'
import { stackImportPlaceholderResult } from './wordGeneration'
import * as m_stack_arg_architecture from './stacks/stack_arg_architecture'
import * as m_stack_academic_register from './stacks/stack_academic_register'
import * as m_stack_discriminator from './stacks/stack_discriminator'
import * as m_stack_tone_stance from './stacks/stack_tone_stance'
import * as m_stack_business_policy from './stacks/stack_business_policy'
import * as m_stack_science from './stacks/stack_science'
import * as m_stack_advanced_reserve from './stacks/stack_advanced_reserve'

type StackModuleExports = {
  STACK_WORD_TEXTS?: readonly string[]
  STACK_LEVELS?: readonly StackLevelBand[]
  STACK_PACK?: readonly StackPackRow[]
}

const MODULES: Record<string, StackModuleExports> = {
  stack_arg_architecture: m_stack_arg_architecture,
  stack_academic_register: m_stack_academic_register,
  stack_discriminator: m_stack_discriminator,
  stack_tone_stance: m_stack_tone_stance,
  stack_business_policy: m_stack_business_policy,
  stack_science: m_stack_science,
  stack_advanced_reserve: m_stack_advanced_reserve,
}

export const STACK_WORDS_BY_ID: Record<string, string[]> = Object.fromEntries(
  Object.entries(MODULES).map(([id, mod]) => [id, collectWords(mod)]),
)

function collectWords(mod: StackModuleExports): string[] {
  if (mod.STACK_PACK && mod.STACK_PACK.length > 0) {
    return mod.STACK_PACK.map((r) => r.text)
  }
  const t = mod.STACK_WORD_TEXTS
  return t ? [...t] : []
}

export function getWordsForStack(stackId: string): string[] {
  return STACK_WORDS_BY_ID[stackId] ?? []
}

/** Resolved card for Firestore when importing from a stack row. */
export function getStackImportResult(
  stackId: string,
  stackPosition: number,
): GeneratedResult {
  const mod = MODULES[stackId]
  const row = mod?.STACK_PACK?.find((r) => r.stackPosition === stackPosition)
  if (row?.result) return row.result
  return stackImportPlaceholderResult()
}
