/**
 * GMAT Official Diagnostic — parsed rows + stored doc shape.
 *
 * The Official Diagnostic produces a "Question Performance and Time
 * Management" table per section. Columns vary slightly:
 *
 *   Verbal:        Question, Response Time, Performance, Question Type, Fundamental Skills
 *   Quant:         Question, Response Time, Performance, Content Domain, Question Type, Fundamental Skills
 *   Data Insights: Question, Response Time, Performance, Content Domain, Question Type   (no Fundamental Skills)
 *
 * Missing columns are stored as null on the row so every row has the
 * same shape regardless of which section it came from.
 *
 * The user uploads section screenshots → OpenAI vision parses each
 * into rows → the user verifies/edits → a DiagnosticDoc is committed
 * to users/{uid}/diagnostic/{id}.
 */

export type DiagnosticSection = 'verbal' | 'quant' | 'di'

export type DiagnosticPerformance = 'correct' | 'incorrect'

export type DiagnosticRow = {
  /** Section this row was parsed from. Carried per-row so a single doc
   *  can hold all three sections without an outer per-section split. */
  section: DiagnosticSection
  /** Question number as printed in the table (typically 1..N). */
  question: number
  /** Response time in minutes (decimal, e.g. 2.49). */
  responseTimeMinutes: number
  performance: DiagnosticPerformance
  /** e.g. Verbal: 'Critical Reasoning' | 'Reading Comprehension' */
  questionType: string
  /** Quant: 'Algebra' | 'Arithmetic'; DI: 'Math Related' | 'Non-Math Related'; Verbal: null. */
  contentDomain: string | null
  /** Verbal: 'Identify Inferred Idea' | 'Identify Stated Idea' | 'Plan/Construct' | 'Analysis/Critique';
   *  Quant: 'Value/Order/Factors' | 'Equal/Unequal/ALG' | 'Rates/Ratios/Percent' | 'Counting/Sets/Series/Prob/Stats';
   *  DI: null. */
  fundamentalSkill: string | null
}

/** Server response from /parseDiagnostic. The rows come back with the
 *  same section the request specified — the function fills it. */
export type DiagnosticParseResponse = {
  rows: DiagnosticRow[]
}

/** Stored at users/{uid}/diagnostic/{id}. Self-contained: every row
 *  carries its section, so analytics / weakness profile read this one
 *  doc and don't need to join anything. */
export type DiagnosticDoc = {
  diagnosticId: string
  createdAt?: unknown
  /** Snapshot of the user's exam window at the time of submission.
   *  Null if the user hasn't set an exam window. */
  examMonth: number | null
  examYear: number | null
  /** Rows the user VERIFIED — not the raw parse. Order is preserved. */
  rows: DiagnosticRow[]
}

/** Suggested values per section — used by the verify UI as datalist
 *  hints and by the parse prompt as the canonical enums to read into. */
export const VERBAL_QUESTION_TYPES = [
  'Critical Reasoning',
  'Reading Comprehension',
] as const

export const VERBAL_FUNDAMENTAL_SKILLS = [
  'Identify Inferred Idea',
  'Identify Stated Idea',
  'Plan/Construct',
  'Analysis/Critique',
] as const

export const QUANT_CONTENT_DOMAINS = ['Algebra', 'Arithmetic'] as const

export const QUANT_FUNDAMENTAL_SKILLS = [
  'Value/Order/Factors',
  'Equal/Unequal/ALG',
  'Rates/Ratios/Percent',
  'Counting/Sets/Series/Prob/Stats',
] as const

export const DI_QUESTION_TYPES = [
  'Data Sufficiency',
  'Two-part analysis',
  'Graphs and Tables',
  'Multi-source reasoning',
] as const

export const DI_CONTENT_DOMAINS = ['Math Related', 'Non-Math Related'] as const

export const ALL_DIAGNOSTIC_SECTIONS: ReadonlyArray<DiagnosticSection> = [
  'verbal',
  'quant',
  'di',
] as const

export const DIAGNOSTIC_SECTION_LABELS: Record<DiagnosticSection, string> = {
  verbal: 'Verbal',
  quant: 'Quant',
  di: 'Data Insights',
}
