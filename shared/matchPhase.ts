import type { VocabItem } from './types'

/** Gloss line for definition match rows (same source priority as MCQ). */
export function getMatchGloss(item: VocabItem): string {
  const s = item.simpleDefinition?.trim()
  const d = item.definition?.trim()
  return s || d || '—'
}

/** Fisher–Yates shuffle (copy). */
export function shuffleIndices(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function shuffledCopy<T>(items: readonly T[]): T[] {
  const idx = shuffleIndices(items.length)
  return idx.map((i) => items[i]!)
}
