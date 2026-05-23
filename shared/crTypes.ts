/**
 * Critical Reasoning (CR) demo types. Mirrors the shape conventions of
 * shared/rcTypes.ts but for the single-question CR endpoint.
 *
 * Scope: pure backend demo, no storage / no client lib yet. These types
 * exist so the function handler and any future client share one source of
 * truth on the request/response shape.
 */

export type CrQuestionType =
  | 'assumption'
  | 'strengthen'
  | 'weaken'
  | 'evaluate'
  | 'inference'
  | 'explain'

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
  /** Always 5 questions. */
  questions: CrAttemptQuestion[]
}
