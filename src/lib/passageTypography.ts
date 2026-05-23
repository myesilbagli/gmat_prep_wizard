/**
 * Reading-panel typography helpers, shared across RC passage and CR
 * argument renders so the experience is uniform.
 *
 * Design rules (from product brief):
 *  - FIXED / stepped sizing only — no continuous fit-to-container scaling.
 *  - Comfortable reading band: 17-19 px depending on length.
 *  - Constrained measure: ~65 characters per line.
 *  - Generous leading: 1.65.
 *  - Paragraph spacing visible.
 */

/** Returns the font size in px for the passage/argument body, based on
 *  word count. Stepped, not continuous. The full band is 17-19 px.
 *
 *  - Short (< 180 words):  19 px — comfortable for short prose, including
 *    every CR argument (always 50-100 words).
 *  - Medium (180-260):     18 px — most RC passages.
 *  - Long (> 260):         17 px — keeps long RC passages from feeling
 *    overwhelming while staying inside the comfortable reading band.
 */
export function getPassageFontSize(text: string): number {
  const words = countWords(text)
  if (words < 180) return 19
  if (words <= 260) return 18
  return 17
}

function countWords(text: string): number {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(Boolean).length
}

/** Line-height for body prose. ~1.65 reads comfortably at 17-19 px. */
export const PASSAGE_LINE_HEIGHT = 1.65

/** Max characters per line. 65 ch is the middle of the 62-68 ch band
 *  recommended for body prose. */
export const PASSAGE_MEASURE = '65ch'

/** Vertical gap between paragraphs (real-GMAT panels have a clearly
 *  visible blank-line break between paragraphs). */
export const PASSAGE_PARAGRAPH_GAP = '1em'
