import type { GeneratedResult } from './types'

export type StackLevelBand = 'foundation' | 'intermediate' | 'advanced'

/** One row after LLM generation + promotion (production TS). */
export type StackPackRow = {
  text: string
  stackPosition: number
  level: StackLevelBand
  result: GeneratedResult
}
