import type { GeneratedResult } from './types'

export type StackLevelBand = 'foundation' | 'intermediate' | 'advanced'

/** One row after LLM generation + promotion (production TS). */
export type StackPackRow = {
  text: string
  stackPosition: number
  level: StackLevelBand
  result: GeneratedResult
  /**
   * Optional curated short glosses keyed by main language code (e.g. `tr`, `fr`, `es`).
   * Mirrors the runtime shape of `VocabItem.translations`. When a user imports this row
   * with a matching `mainLanguage`, the value is copied into `result.translationSimple`
   * so `mergeTranslationsForSave` persists `translations[lang]` on their word doc.
   */
  translations?: Record<string, string>
}
