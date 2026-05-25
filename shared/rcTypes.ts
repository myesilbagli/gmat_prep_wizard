/**
 * RC (Reading Comprehension) generation types — web-only in v1.
 *
 * Kept in its own file rather than appended to `shared/types.ts` so that
 * RC shapes are decoupled from the vocab / session shapes that mobile depends
 * on. Renaming or restructuring an RC type should never touch a mobile import.
 */

/** Difficulty band for a single RC passage. */
export type RcDifficulty = 'easy' | 'medium' | 'hard'

/**
 * Question types we currently support. All six are valid GMAT RC question
 * categories; the prompt + validator constrain the set per request.
 *
 * @see ./verbalTaxonomy.ts — maps these generator values onto the
 *      canonical RC subtypes (Main Idea / Supporting Idea / Inference /
 *      Application / Evaluation). The taxonomy module references these
 *      values; it does not replace them.
 */
export type RcQuestionType =
  | 'main_idea'
  | 'inference'
  | 'detail'
  | 'function'
  | 'tone'
  | 'application'

/** Stage 1 request — sent to /generateRcPassage. */
export type RcPassageRequest = {
  difficulty: RcDifficulty
  /** Optional user-provided subject hint (≤120 chars after trim). */
  topic?: string
  /** Optional domain hint (e.g. "humanities", "science"); ≤80 chars. */
  domain?: string
  /** Optional client-generated nonce (≤64 chars) used to vary wording. */
  nonce?: string
}

/** Stage 1 response — returned by /generateRcPassage. */
export type RcPassageResponse = {
  /** Full passage text with `\n\n` between paragraphs. */
  passage: string
  /** Same content split; length 1–4 paragraphs. */
  paragraphs: string[]
  /** The actual subject the model settled on (echoes user topic when given). */
  topic: string
  /** Echoed from the request so callers can store the calibration used. */
  difficulty: RcDifficulty
}

/** A single multiple-choice question for an RC passage. */
export type RcQuestion = {
  type: RcQuestionType
  questionText: string
  /** Exactly 5 choices. */
  choices: string[]
  /** Index into `choices` (0-4). */
  correctIndex: 0 | 1 | 2 | 3 | 4
  /** ≥100 chars; first sentence justifies, later sentences address distractors. */
  explanation: string
}

/** Stage 2 request — sent to /generateRcQuestionSet. */
export type RcQuestionSetRequest = {
  passage: string
  paragraphs: string[]
  topic: string
  difficulty: RcDifficulty
  /** 3 for easy, 4 for medium/hard; handler enforces the pairing. */
  questionCount: 3 | 4
  nonce?: string
}

/** Stage 2 response — returned by /generateRcQuestionSet. */
export type RcQuestionSetResponse = {
  questions: RcQuestion[]
}

/**
 * Per-user attempt document stored at users/{uid}/rcAttempts/{attemptId}.
 *
 * Lifecycle:
 * - On setup, the doc is written with passage fields + `startedAt` and no `questions`.
 * - On practice page mount, `questions` is filled in via Stage 2.
 * - As the user answers, `questions[i].userAnswerIndex` and `.timeSeconds` populate.
 * - On review entry, `completedAt` is set.
 *
 * Timestamp fields are typed as `unknown` so this module can be shared between
 * the web client (Firestore JS Timestamp) and the Cloud Functions admin SDK
 * without dragging either dependency in.
 */
export type RcAttempt = {
  attemptId: string
  createdAt: unknown
  passage: string
  paragraphs: string[]
  topic: string
  difficulty: RcDifficulty
  questions: Array<
    RcQuestion & {
      userAnswerIndex?: number
      timeSeconds?: number
    }
  >
  startedAt: unknown
  completedAt?: unknown
}
