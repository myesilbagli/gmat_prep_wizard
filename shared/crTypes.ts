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
