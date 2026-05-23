/**
 * HTTP client for /generateCrQuestion plus the 5-question parallel set
 * builder used by the CR practice flow.
 *
 * Auth + base-URL handling is reused from rcGeneration.ts (postJson is
 * exported there) so the ID token is attached automatically.
 */
import { postJson } from './rcGeneration'
import type { CrQuestion, CrQuestionType } from '../../shared/crTypes'

function buildNonce(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 16)
  }
  return Math.random().toString(36).slice(2, 18)
}

/** Single-question generation. Thin wrapper around postJson. */
export async function generateCrQuestion(
  questionType: CrQuestionType,
  nonce: string = buildNonce(),
): Promise<CrQuestion> {
  return postJson<CrQuestion>('/generateCrQuestion', { questionType, nonce })
}

/**
 * Build a 5-type list following real GMAT CR frequency.
 *
 *   Slot 1: random of {weaken, strengthen}
 *   Slot 2: random of {weaken, strengthen}
 *   Slot 3: assumption
 *   Slot 4: random of {inference, explain}
 *   Slot 5 (flex): weighted random
 *     ~50% {weaken, strengthen}, ~25% assumption,
 *     ~20% {inference, explain}, ~5% evaluate
 *
 * Then Fisher–Yates shuffle so the sequence isn't predictable.
 */
export function buildCrSetTypes(): CrQuestionType[] {
  const ws = (): CrQuestionType => (Math.random() < 0.5 ? 'weaken' : 'strengthen')
  const ie = (): CrQuestionType => (Math.random() < 0.5 ? 'inference' : 'explain')

  const types: CrQuestionType[] = [ws(), ws(), 'assumption', ie(), pickSlot5()]

  // Fisher–Yates shuffle.
  for (let i = types.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = types[i]
    types[i] = types[j]
    types[j] = tmp
  }
  return types
}

function pickSlot5(): CrQuestionType {
  const r = Math.random()
  if (r < 0.5) return Math.random() < 0.5 ? 'weaken' : 'strengthen'
  if (r < 0.75) return 'assumption'
  if (r < 0.95) return Math.random() < 0.5 ? 'inference' : 'explain'
  return 'evaluate'
}

export type CrSetGenerationError = {
  message: string
  failedTypes: CrQuestionType[]
}

/**
 * Generate a full 5-question set in parallel. If any of the 5 fails, retry
 * just the failed ones once (also in parallel). If a question still can't be
 * generated after the retry, throw a structured error so the caller can
 * surface it to the user — never return a partial set, never start a broken
 * practice flow.
 *
 * Returned questions are paired with their requested type (which is also on
 * the question object itself; the model echoes it back).
 */
export async function generateCrSet(): Promise<CrQuestion[]> {
  const types = buildCrSetTypes()

  const firstPass = await Promise.allSettled(types.map((t) => generateCrQuestion(t)))

  // Collect successes by their original index; gather indices that need a retry.
  const results: (CrQuestion | null)[] = firstPass.map((r) =>
    r.status === 'fulfilled' ? r.value : null,
  )
  const retryIdx: number[] = []
  for (let i = 0; i < firstPass.length; i += 1) {
    if (firstPass[i].status === 'rejected') retryIdx.push(i)
  }

  if (retryIdx.length > 0) {
    const retryPass = await Promise.allSettled(
      retryIdx.map((i) => generateCrQuestion(types[i])),
    )
    for (let k = 0; k < retryIdx.length; k += 1) {
      const idx = retryIdx[k]
      const r = retryPass[k]
      if (r.status === 'fulfilled') results[idx] = r.value
      // else: leave as null; we'll error out below.
    }
  }

  const stillMissing: number[] = []
  for (let i = 0; i < results.length; i += 1) {
    if (results[i] == null) stillMissing.push(i)
  }
  if (stillMissing.length > 0) {
    const failedTypes = stillMissing.map((i) => types[i])
    const err: CrSetGenerationError = {
      message: `Couldn't generate ${stillMissing.length} of 5 questions (${failedTypes.join(', ')}) after one retry. Try again.`,
      failedTypes,
    }
    throw err
  }

  return results as CrQuestion[]
}
