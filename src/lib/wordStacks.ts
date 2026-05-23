/**
 * Web-side curated stack helpers. Mirrors mobile/src/lib/words.ts
 * `saveWordFromStackImport` exactly so a word imported on web is
 * indistinguishable from the same word imported on mobile (same
 * Firestore path, same wordSource, same stackId/stackPosition, same
 * 'known' tag semantics, same GeneratedResult resolution via
 * shared/wordStackContent.ts).
 */
import { getStackImportResult } from '../../shared/wordStackContent'
import { saveWord, listWords } from './words'
import type { WordDoc } from './types'

/** Save (or upgrade) a word into users/{uid}/words from a curated stack
 *  row. Dedup is by textLower inside saveWord(); calling this twice for
 *  the same word is idempotent at the content level. The 'known' tag is
 *  only ever added, never removed (mobile parity). */
export async function saveWordFromStackImport(params: {
  text: string
  stackId: string
  stackPosition: number
  mainLanguage?: string
  markKnown?: boolean
}): Promise<{ id: string }> {
  return saveWord({
    text: params.text,
    result: getStackImportResult(
      params.stackId,
      params.stackPosition,
      params.mainLanguage,
    ),
    mainLanguage: params.mainLanguage,
    source: 'stack',
    stackId: params.stackId,
    stackPosition: params.stackPosition,
    markKnown: params.markKnown,
  })
}

/** Returns a Set<textLower> of the user's already-saved words. The browse
 *  and detail screens use this to show "Saved" badges and "N / M saved"
 *  counts without hitting Firestore once per row. Single listWords()
 *  read; the caller is responsible for caching the result. */
export async function fetchSavedTextSet(): Promise<Set<string>> {
  const rows = await listWords()
  const out = new Set<string>()
  for (const row of rows) {
    const d = row.data as WordDoc & { textLower?: string }
    const key =
      typeof d.textLower === 'string' && d.textLower
        ? d.textLower
        : typeof d.text === 'string' && d.text
          ? d.text.trim().toLowerCase()
          : typeof d.word === 'string' && d.word
            ? d.word.trim().toLowerCase()
            : ''
    if (key) out.add(key)
  }
  return out
}

/** Cheap normalizer to match how saveWord stores textLower. */
export function stackWordKey(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}
