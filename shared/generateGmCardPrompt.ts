import type { StackLevelBand } from './stackPackTypes'
import { WORD_TAG_ALLOWLIST } from './wordGeneration'

const tagList = WORD_TAG_ALLOWLIST.join(', ')

export function inferGmTermType(text: string): 'word' | 'phrase' {
  return text.includes(' ') ? 'phrase' : 'word'
}

/**
 * English-only `/generate` + stack CLI — GMAT RC/CR-style card spec.
 * Lengths are guidance only (validator uses loose bands).
 */
export function buildEnglishGmCardPrompt(
  text: string,
  type: 'word' | 'phrase',
  opts?: { curriculumLevel?: StackLevelBand },
): string {
  const bandLine = opts?.curriculumLevel
    ? `Curriculum difficulty band (for calibrating examples): ${opts.curriculumLevel}.`
    : ''

  return [
    bandLine,
    `You are a GMAT verbal tutor creating a study card. Quality matters more than length.`,
    `Return a single JSON object ONLY (no markdown, no code fences) with exactly these keys:`,
    ``,
    `"definition": string — precise, full definition. 1-2 sentences. Must capture the GMAT-relevant sense specifically, not every dictionary sense. Aim for roughly 40 words; prioritize clarity over hitting an exact count.`,
    ``,
    `"simpleDefinition": string — 2-6 word gloss using plain everyday vocabulary. Must NOT share content words with "definition". If definition says "scholarly examination," simple definition should not reuse "scholarly" or "examination". Use common words only.`,
    ``,
    `"partOfSpeech": string — one of: "noun" | "verb" | "adjective" | "adverb" | "preposition" | "conjunction" | "phrase". If Term type below is "phrase", set partOfSpeech to "phrase" so it matches.`,
    ``,
    `"examples": string[] — exactly two sentences written in GMAT register; aim for roughly 25 words each (natural length beats exact counting):`,
    `  First: A dense sentence that could appear in a GMAT RC passage. Formal, multi-clause, uses subordinate or relative clauses. Academic or analytical subject matter.`,
    `  Second: A sentence that could appear in a GMAT CR argument stem. Contains a logical relationship (cause, concession, contrast, or condition) explicitly marked by connectives (although, because, insofar as, despite, etc.).`,
    `  Do not use casual, journalistic, or conversational phrasing. No "She was very...". No "I think..."`,
    ``,
    `"synonyms": string[] — 2-4 synonyms. Prioritize words a GMAT test-taker would encounter, not obscure literary alternatives.`,
    ``,
    `"wordTags": string[] — 1 to 3 tags chosen ONLY from this list: ${tagList}.`,
    ``,
    `"contrastWord": object with "word" (single contrast term) and "explanation" (2-3 sentences; aim for roughly 50 words). The contrast must be a near-synonym or commonly confused word — NOT a direct antonym. Pick a word that GMAT uses as an answer-choice distractor. The explanation must cite the specific distinction a test-taker would miss.`,
    ``,
    `"nuanceNote": string — 1-2 sentences; aim for roughly 50 words. Identify a specific GMAT trap: either (a) the answer-choice distractor this word is paired with, (b) a register or connotation GMAT relies on, or (c) a scope/precision edge that matters for RC or CR. Must reference GMAT context explicitly, not generic English usage.`,
    ``,
    `"memoryHook": string — aim for roughly 40 words. Provide a genuinely useful association: (a) etymological root that reveals current meaning, (b) a vivid GMAT-context example of the word in use, or (c) a clear distinction from a commonly confused word. Do not use forced sound-alikes unless the phonetic link genuinely aids recall. If no strong hook exists, use option (b) — do not invent weak mnemonics.`,
    ``,
    `Do not include "exampleSentence", "gmatUsageNote", or "definitions" — clients ignore extras.`,
    `All output in English.`,
    ``,
    `Term: ${text}`,
    `Term type: ${type}`,
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Non-English learner: same card fields in English plus `translationSimple` in the learner language.
 */
export function buildLearnerGmCardPrompt(
  text: string,
  type: 'word' | 'phrase',
  mainLanguage: string,
  opts?: { curriculumLevel?: StackLevelBand },
): string {
  const bandLine = opts?.curriculumLevel
    ? `Curriculum difficulty band (for calibrating examples): ${opts.curriculumLevel}.`
    : ''

  return [
    bandLine,
    `You are a GMAT verbal tutor creating a study card. Quality matters more than length.`,
    `Return a single JSON object ONLY (no markdown, no code fences) with exactly these keys:`,
    ``,
    `"definition": string — precise, full definition. 1-2 sentences. GMAT-relevant sense only. Aim for roughly 40 words.`,
    ``,
    `"simpleDefinition": string — 2-6 word gloss using plain everyday English vocabulary. Must NOT share content words with "definition". Use common words only.`,
    ``,
    `"partOfSpeech": string — one of: "noun" | "verb" | "adjective" | "adverb" | "preposition" | "conjunction" | "phrase". If Term type below is "phrase", set partOfSpeech to "phrase".`,
    ``,
    `"examples": string[] — exactly two sentences, GMAT register; aim for roughly 25 words each:`,
    `  First: A dense sentence that could appear in a GMAT RC passage (formal, multi-clause).`,
    `  Second: A sentence that could appear in a GMAT CR stem (logical connective marked: although, because, insofar as, despite, etc.).`,
    `  Do not use casual or journalistic phrasing.`,
    ``,
    `"synonyms": string[] — 2-4 synonyms test-takers would see on GMAT.`,
    ``,
    `"wordTags": string[] — 1 to 3 tags chosen ONLY from this list: ${tagList}.`,
    ``,
    `"contrastWord": object with "word" and "explanation" (2-3 sentences; aim for roughly 50 words). Near-synonym / distractor only — NOT a direct antonym. Explain the distinction a test-taker would miss.`,
    ``,
    `"nuanceNote": string — aim for roughly 50 words; a specific GMAT trap (distractor pairing, register, or RC/CR scope). Must mention GMAT context.`,
    ``,
    `"memoryHook": string — aim for roughly 40 words; follow the same association rules as English-only cards.`,
    ``,
    `"translationSimple": string — 2-8 words glossing the main sense in the learner's language (${mainLanguage}). Natural ${mainLanguage} only in this field.`,
    ``,
    `Do not include "exampleSentence", "gmatUsageNote", or "definitions" — clients ignore extras.`,
    `All card content except "translationSimple" must be in English (GMAT study language).`,
    ``,
    `Term: ${text}`,
    `Term type: ${type}`,
  ]
    .filter(Boolean)
    .join('\n')
}
