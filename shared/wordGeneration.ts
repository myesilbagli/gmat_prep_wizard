import type { ContrastWord, GeneratedResult, PartOfSpeech } from './types'

/** Allowed `wordTags` values from the /generate prompt. */
export const WORD_TAG_ALLOWLIST = [
  'formal',
  'neutral',
  'informal',
  'positive',
  'negative',
  'pejorative',
  'academic',
  'literary',
  'archaic',
  'legal',
  'clinical',
  'elevated',
] as const

export type WordTag = (typeof WORD_TAG_ALLOWLIST)[number]

const ALLOW = new Set<string>(WORD_TAG_ALLOWLIST)

const POS_ALLOW = new Set<string>([
  'noun',
  'verb',
  'adjective',
  'adverb',
  'preposition',
  'conjunction',
  'phrase',
])

function countWords(s: string): number {
  const t = s.trim()
  if (!t) return 0
  return t.split(/\s+/).length
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x.trim().length > 0
}

function isContrastWord(x: unknown): x is ContrastWord {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return isNonEmptyString(o.word) && isNonEmptyString(o.explanation)
}

/** Server-side validation for /generate JSON before returning to clients. */
export function validateGeneratedResult(parsed: unknown): parsed is GeneratedResult {
  if (!parsed || typeof parsed !== 'object') return false
  const o = parsed as Record<string, unknown>

  if (!isNonEmptyString(o.definition)) return false
  const defW = countWords(String(o.definition))
  /** Loose bands aligned with “roughly 40 words” prompt guidance */
  if (defW < 12 || defW > 110) return false

  if (!isNonEmptyString(o.simpleDefinition)) return false
  const simpleW = countWords(String(o.simpleDefinition))
  if (simpleW < 2 || simpleW > 6) return false

  const rawPos =
    typeof o.partOfSpeech === 'string'
      ? o.partOfSpeech.trim().toLowerCase()
      : typeof o.part_of_speech === 'string'
        ? String(o.part_of_speech).trim().toLowerCase()
        : ''
  if (!POS_ALLOW.has(rawPos)) return false

  if (!Array.isArray(o.examples) || o.examples.length !== 2) return false
  for (const ex of o.examples) {
    if (!isNonEmptyString(ex)) return false
    const w = countWords(String(ex))
    /** ~25 words/sentence guidance */
    if (w < 12 || w > 55) return false
  }

  if (!Array.isArray(o.synonyms) || o.synonyms.length < 2) return false
  for (const s of o.synonyms) {
    if (!isNonEmptyString(s)) return false
  }

  if (!Array.isArray(o.wordTags) || o.wordTags.length === 0 || o.wordTags.length > 3) return false
  for (const t of o.wordTags) {
    if (typeof t !== 'string' || !ALLOW.has(t.trim())) return false
  }

  if (!isContrastWord(o.contrastWord)) return false
  const cxW = countWords(String(o.contrastWord.explanation))
  /** ~50 words */
  if (cxW < 22 || cxW > 100) return false

  if (!isNonEmptyString(o.nuanceNote)) return false
  const nnW = countWords(String(o.nuanceNote))
  /** ~50 words */
  if (nnW < 18 || nnW > 100) return false

  if (!isNonEmptyString(o.memoryHook)) return false
  const mhW = countWords(String(o.memoryHook))
  /** ~40 words */
  if (mhW < 14 || mhW > 90) return false

  return true
}

/** Placeholder card for stack imports (not LLM-generated); satisfies `GeneratedResult` for Firestore writes. */
export function stackImportPlaceholderResult(): GeneratedResult {
  return {
    definition:
      'Imported from a Lexicon word stack; this stub satisfies app storage until you run Quick Capture on Today to obtain a full tutor-style card with GMAT-shaped examples, nuance, contrast, and a memory hook aligned to formal verbal reasoning.',
    simpleDefinition: 'Imported stack term',
    partOfSpeech: 'phrase',
    examples: [
      'Although the passage relies on dense academic framing, the author’s reliance on a single unpublished study leaves the central inference vulnerable to challenges from reviewers who demand replication across independent datasets before accepting the finding.',
      'Because the stimulus treats correlation as sufficient grounds for a causal claim, the correct answer must expose a gap between the evidence offered and the conclusion drawn, whereas attractive distractors will mirror the conclusion’s vocabulary without repairing the logical leap.',
    ],
    synonyms: ['stack', 'import'],
    wordTags: ['neutral', 'academic'],
    contrastWord: {
      word: 'clarity',
      explanation:
        'Clarity names plain transparent sense, whereas this import is a thin stub without full definitional precision: on GMAT RC, “clarity” could appear as a mild tone choice while the stem tests a sharper logical move. The distractor tempts you to pick a virtue word that fits tone yet misses the argument’s structural flaw. The distinction that matters is whether your answer repairs the reasoning step the question targets rather than restating a desirable rhetorical quality.',
    },
    nuanceNote:
      'GMAT trap: answer choices may praise “rigor,” “clarity,” or “objectivity” while the task actually asks you to weaken a causal bridge or scope shift; do not pick a virtue label just because it sounds academic. Watch for RC questions that reward precision about evidence scope versus CR stems that reward isolating an alternate cause.',
    memoryHook:
      'Treat a stack import like a bookmarked flashcard front: the back is empty until Quick Capture writes a full GMAT card—two dense sentences, a distractor contrast, and a nuance note tied to real wrong-answer patterns rather than generic praise vocabulary.',
  }
}

/** Empty merge base for client preview state before API returns (merged with server result). */
export function previewEmptyGeneratedResult(): GeneratedResult {
  return {
    definition: '',
    simpleDefinition: '',
    partOfSpeech: 'noun',
    examples: ['', ''],
    synonyms: [],
    wordTags: [],
    contrastWord: { word: '', explanation: '' },
    nuanceNote: '',
    memoryHook: '',
  }
}

function pickTrimmedString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t || undefined
}

/** Merge `/generate` JSON for web/mobile clients; accepts legacy key aliases. */
export function normalizeGeneratedResultFromApi(raw: unknown): GeneratedResult {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const merged: Record<string, unknown> = { ...previewEmptyGeneratedResult(), ...o }

  /** Models occasionally emit snake_case; map onto canonical `GeneratedResult` keys. */
  const memoryHook = pickTrimmedString(o.memoryHook) ?? pickTrimmedString(o.memory_hook)
  if (memoryHook) merged.memoryHook = memoryHook

  const partOfSpeech =
    pickTrimmedString(o.partOfSpeech) ?? pickTrimmedString(o.part_of_speech)
  if (partOfSpeech) {
    merged.partOfSpeech = partOfSpeech.toLowerCase() as PartOfSpeech
  } else if (!pickTrimmedString(merged.partOfSpeech as unknown)) {
    merged.partOfSpeech = 'noun'
  }

  const nuanceNote = pickTrimmedString(o.nuanceNote) ?? pickTrimmedString(o.nuance_note)
  if (nuanceNote) merged.nuanceNote = nuanceNote

  const simpleDefinition =
    pickTrimmedString(o.simpleDefinition) ?? pickTrimmedString(o.simple_definition)
  if (simpleDefinition) merged.simpleDefinition = simpleDefinition

  if (
    (!Array.isArray(o.wordTags) || (o.wordTags as unknown[]).length === 0) &&
    Array.isArray(o.word_tags)
  ) {
    merged.wordTags = (o.word_tags as unknown[])
      .map((x) => String(x).trim())
      .filter(Boolean)
  }

  const cwRaw = o.contrastWord ?? o.contrast_word
  if (cwRaw && typeof cwRaw === 'object') {
    const c = cwRaw as Record<string, unknown>
    const w = pickTrimmedString(c.word)
    const ex = pickTrimmedString(c.explanation)
    if (w && ex) merged.contrastWord = { word: w, explanation: ex }
  }

  const gloss =
    pickTrimmedString(o.translationSimple) ??
    pickTrimmedString(o.translation_simple) ??
    pickTrimmedString((o.result as Record<string, unknown> | undefined)?.translationSimple) ??
    pickTrimmedString((o.result as Record<string, unknown> | undefined)?.translation_simple)
  if (gloss) merged.translationSimple = gloss

  return merged as GeneratedResult
}
