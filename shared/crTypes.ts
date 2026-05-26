/**
 * Critical Reasoning (CR) demo types. Mirrors the shape conventions of
 * shared/rcTypes.ts but for the single-question CR endpoint.
 *
 * Scope: pure backend demo, no storage / no client lib yet. These types
 * exist so the function handler and any future client share one source of
 * truth on the request/response shape.
 */

/**
 * Fine-grained CR question types used by the generator + Firestore.
 *
 * @see ./verbalTaxonomy.ts — maps these generator values onto the
 *      canonical CR subtypes (Analysis / Construction / Critique / Plan).
 *      The taxonomy module references these values; it does not replace
 *      them. Note: 'inference' here is the CR sense (must-follow); the
 *      taxonomy module's `officialSubtypeForGeneratorType(section, type)`
 *      requires the section arg to disambiguate from the RC 'inference'.
 */
export type CrQuestionType =
  | 'assumption'
  | 'strengthen'
  | 'weaken'
  | 'evaluate'
  | 'inference'
  | 'explain'
  | 'plan'
  | 'analysis'

/**
 * Runtime list of all CR question types, in canonical display order.
 * Kept here so any frontend picker (e.g. the /cr-test dev harness) stays
 * in sync with the enum without duplicating the literal list.
 *
 * NOTE: functions/src/index.ts currently defines its own `CR_QUESTION_TYPES`
 * with the same contents. A future refactor could consolidate by importing
 * this one; both must be updated together if the enum gains a new member.
 */
export const CR_QUESTION_TYPES: ReadonlyArray<CrQuestionType> = [
  'assumption',
  'strengthen',
  'weaken',
  'evaluate',
  'inference',
  'explain',
  'plan',
  'analysis',
]

export type CrQuestion = {
  questionType: CrQuestionType
  /** ~50-90 word stimulus paragraph. */
  argument: string
  /** Question phrasing matching the type (e.g. "Which of the following is an assumption…"). */
  questionStem: string
  /** Exactly 5 choices. */
  choices: string[]
  correctIndex: 0 | 1 | 2 | 3 | 4
  /**
   * References each wrong choice by content paraphrase, never by letter.
   * This is enforced in the prompt so the server-side shuffle does not
   * break references.
   */
  explanation: string
}

export type CrQuestionRequest = {
  questionType: CrQuestionType
  /** Optional opaque string used to vary outputs across calls. Max 64 chars. */
  nonce?: string
}

/** A single CR question; one request → one question for the demo. */
export type CrQuestionResponse = CrQuestion

// ---------------------------------------------------------------------------
// Attempt storage (timed 5-question practice flow)
// ---------------------------------------------------------------------------

export type CrTimerMode = '10min' | '5min' | 'none'

/** Duration in seconds for the two countdown modes. 'none' has no deadline. */
export const CR_TIMER_DURATIONS: Record<'10min' | '5min', number> = {
  '10min': 600,
  '5min': 300,
}

/**
 * One question inside a stored attempt. Self-contained: questionType lives
 * on the question (not on a separate index) so analytics can read attempts
 * alone and group by type without joining.
 */
export type CrAttemptQuestion = CrQuestion & {
  /** Null when the timer expired or the user advanced without selecting. */
  userAnswerIndex: number | null
  isCorrect: boolean
  /** Seconds spent on this specific question. */
  timeSeconds: number
}

export type CrAttempt = {
  attemptId: string
  createdAt?: unknown
  completedAt?: unknown
  /** When the timer started (= when practice page mounted). Used to restore
   *  remaining time if the user refreshes mid-practice. */
  startedAt?: unknown
  timerMode: CrTimerMode
  /** Sum of per-question times. Filled at completion. */
  totalTimeSeconds: number
  /** Count of isCorrect=true at completion. 0 while in progress. */
  score: number
  /** Always 5 questions for exam sets; configurable (default 10) for drills. */
  questions: CrAttemptQuestion[]
  /** Tag distinguishing exam-flow timed sets from /test subtype drills.
   *  Absent (or 'set') for the existing exam attempts so legacy docs read
   *  back identically. */
  kind?: 'set' | 'drill'
  /** Drill-only: the official subtype this drill targeted (e.g.
   *  'cr_critique'). Used for accuracy aggregation. */
  drillSubtype?: string
}
