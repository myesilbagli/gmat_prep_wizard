import type { StackLevelBand } from '../../shared/stackPackTypes.ts'
import {
  buildEnglishGmCardPrompt,
  inferGmTermType,
} from '../../shared/generateGmCardPrompt.ts'

/** Mirrors `/generate` English path — term normalization for CLI (slightly stricter filename chars than Firebase). */
export function normalizeGenerateText(raw: unknown): string {
  if (typeof raw !== 'string') throw new Error('text must be a string')
  const t = raw.trim().replace(/\s+/g, ' ')
  if (!t) throw new Error('text is required')
  if (t.length > 120) throw new Error('text is too long')
  if (!/^[a-zA-Z\s-']+$/.test(t)) throw new Error('text contains invalid characters')
  return t
}

export function inferTermType(text: string): 'word' | 'phrase' {
  return inferGmTermType(text)
}

/** Used by `generateStacks.ts`; matches tightened `buildEnglishGmCardPrompt` + optional glossary level. */
export function buildEnglishGeneratePrompt(
  text: string,
  opts?: { curriculumLevel?: StackLevelBand },
): string {
  const type = inferGmTermType(text)
  return buildEnglishGmCardPrompt(text, type, opts)
}
