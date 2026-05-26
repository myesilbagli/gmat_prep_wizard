/**
 * HTTP client for /generateCrQuestion plus the 5-question parallel set
 * builder used by the CR practice flow.
 *
 * Auth + base-URL handling is reused from rcGeneration.ts (postJson is
 * exported there) so the ID token is attached automatically.
 */
import { postJson } from './rcGeneration'
import { CR_QUESTION_TYPES, type CrQuestion, type CrQuestionType } from '../../shared/crTypes'
import {
  generatorTypesForOfficialSubtype,
  type CrSubtypeKey,
} from '../../shared/verbalTaxonomy'

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
 *
 * NOTE: 'plan' and 'analysis' are generatable individually via
 * /generateCrQuestion but are intentionally NOT in this set distribution
 * yet. The learning-curve engine can request them directly; weaving them
 * into the default 5-question mix is a later decision.
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

// ---------------------------------------------------------------------------
// CR subtype drill — N questions of one official subtype
// ---------------------------------------------------------------------------

/**
 * Distribute `count` questions across the generator types under one
 * official CR subtype (cr_critique → weaken/strengthen/evaluate, etc.).
 * For subtypes with a single generator type (Plan, Analysis), every
 * question is that type. For multi-child subtypes (Construction,
 * Critique), the distribution round-robins through the child types
 * after a small jitter so a 10-question drill looks like a realistic
 * mix rather than [w, s, e, w, s, e, w, s, e, w].
 */
export function distributeCrDrillTypes(
  subtype: CrSubtypeKey,
  count: number,
): CrQuestionType[] {
  const childTypesRaw = generatorTypesForOfficialSubtype(subtype) as CrQuestionType[]
  if (childTypesRaw.length === 0) {
    throw new Error(`No CR generator types under subtype ${subtype}`)
  }
  const validChild = childTypesRaw.filter((t) =>
    (CR_QUESTION_TYPES as readonly string[]).includes(t),
  ) as CrQuestionType[]
  if (validChild.length === 0) {
    throw new Error(`Subtype ${subtype} has no valid child generator types`)
  }
  if (validChild.length === 1) {
    return Array.from({ length: count }, () => validChild[0])
  }
  // Multi-child: start at a random offset, then round-robin. This gives
  // every child type roughly even representation without strict cycles.
  const offset = Math.floor(Math.random() * validChild.length)
  const out: CrQuestionType[] = []
  for (let i = 0; i < count; i += 1) {
    out.push(validChild[(i + offset) % validChild.length])
  }
  // Light shuffle inside groups so the order isn't predictable.
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

/**
 * Generate `count` CR questions for one official subtype, in parallel,
 * with a single retry pass for individually-failed questions. Mirrors
 * the resilience pattern of generateCrSet — partial failures get one
 * retry, then we throw a structured error rather than returning a
 * partial drill.
 */
export async function generateCrSubtypeDrill(args: {
  subtype: CrSubtypeKey
  count: number
}): Promise<CrQuestion[]> {
  const { subtype, count } = args
  const types = distributeCrDrillTypes(subtype, count)

  const first = await Promise.allSettled(types.map((t) => generateCrQuestion(t)))
  const results: (CrQuestion | null)[] = first.map((r) =>
    r.status === 'fulfilled' ? r.value : null,
  )
  const retryIdx: number[] = []
  for (let i = 0; i < first.length; i += 1) {
    if (first[i].status === 'rejected') retryIdx.push(i)
  }

  if (retryIdx.length > 0) {
    const retry = await Promise.allSettled(
      retryIdx.map((i) => generateCrQuestion(types[i])),
    )
    for (let k = 0; k < retryIdx.length; k += 1) {
      const r = retry[k]
      if (r.status === 'fulfilled') results[retryIdx[k]] = r.value
    }
  }

  const stillMissing: number[] = []
  for (let i = 0; i < results.length; i += 1) {
    if (results[i] == null) stillMissing.push(i)
  }
  if (stillMissing.length > 0) {
    const failedTypes = stillMissing.map((i) => types[i])
    const err: CrSetGenerationError = {
      message: `Couldn't generate ${stillMissing.length} of ${count} drill questions (${failedTypes.join(', ')}). Try again.`,
      failedTypes,
    }
    throw err
  }

  return results as CrQuestion[]
}
