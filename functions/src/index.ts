import { onRequest } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'
import * as admin from 'firebase-admin'
import OpenAI from 'openai'
import 'dotenv/config'
import type { GeneratedResult as ApiGeneratedResult } from '../../shared/types'
import {
  buildEnglishGmCardPrompt,
  buildLearnerGmCardPrompt,
  inferGmTermType,
} from '../../shared/generateGmCardPrompt'
import { parseJsonFromOutputText } from '../../shared/parseOpenAiJson'
import { validateGeneratedResult } from '../../shared/wordGeneration'
import type { RcDifficulty, RcQuestionType } from '../../shared/rcTypes'
import type { CrQuestionType } from '../../shared/crTypes'
import type { DiagnosticSection } from '../../shared/diagnosticTypes'

setGlobalOptions({ region: 'us-central1' })

admin.initializeApp()

function corsHeaders(origin: string | undefined) {
  const allowOrigin = origin ?? '*'
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '3600',
  }
}

function getBearerToken(authorizationHeader: string | undefined) {
  if (!authorizationHeader) return null
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

/**
 * Path only (no query/hash), without trailing slash. Used so the vocab card
 * endpoint matches ONLY `/generate` — not `/generateRcPassage`, which also
 * begins with the string "/generate" under naive startsWith routing.
 */
function requestPathOnly(raw: string | undefined): string {
  const u = raw ?? '/'
  const noQuery = u.split('?')[0].split('#')[0]
  if (noQuery.length > 1 && noQuery.endsWith('/')) {
    return noQuery.slice(0, -1)
  }
  return noQuery || '/'
}

/** Express / Cloud Run may set `originalUrl` (full path) while `url` is relative to a mount. */
function inferRequestPath(req: { url?: string; originalUrl?: string }): string {
  const o = req.originalUrl
  if (typeof o === 'string' && o.length > 0) return o
  const u = req.url
  if (typeof u === 'string' && u.length > 0) return u
  return '/'
}

/** Final URL segment for POST routing (decoded). Works with arbitrary gateway prefixes. */
function pathRouteBasename(pathOnly: string): string {
  const noTrailing =
    pathOnly.length > 1 && pathOnly.endsWith('/') ? pathOnly.slice(0, -1) : pathOnly
  const idx = noTrailing.lastIndexOf('/')
  const seg = idx >= 0 ? noTrailing.slice(idx + 1) : noTrailing
  try {
    return decodeURIComponent(seg)
  } catch {
    return seg
  }
}

type QuizMode = 'context' | 'verbal'

type QuizQuestion = {
  itemId: string
  questionText: string
  options: string[]
  correctIndex: number
  explanation: string
}

/** Randomize A–D so the correct answer is not always option A (models often bias to index 0). */
function shuffleQuizOptions(q: QuizQuestion): QuizQuestion {
  const opts = q.options
  if (!Array.isArray(opts) || opts.length !== 4) return q
  let correct = q.correctIndex
  if (correct < 0 || correct > 3 || !Number.isInteger(correct)) correct = 0

  const perm: number[] = [0, 1, 2, 3]
  for (let i = 3; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[perm[i], perm[j]] = [perm[j], perm[i]]
  }

  const newOptions = perm.map((oldIdx) => opts[oldIdx])
  const newCorrectIndex = perm.findIndex((oldIdx) => oldIdx === correct)
  return {
    ...q,
    options: newOptions,
    correctIndex: newCorrectIndex >= 0 ? newCorrectIndex : 0,
  }
}

type ParagraphPart =
  | { kind: 'text'; value: string }
  | { kind: 'target'; text: string }

type ParagraphResponse = { parts: ParagraphPart[] }

function normalizeText(text: unknown): string {
  if (typeof text !== 'string') throw new Error('text must be a string')
  const t = text.trim().replace(/\s+/g, ' ')
  if (!t) throw new Error('text is required')
  if (t.length > 120) throw new Error('text is too long')
  // Allow letters, spaces, apostrophes, and hyphens for phrases.
  if (!/^[a-zA-Z\s-']+$/.test(t)) throw new Error('text contains invalid characters')
  return t
}

export const api = onRequest(
  { secrets: ['OPENAI_API_KEY'], timeoutSeconds: 300, memory: '512MiB' },
  async (req, res) => {
    const origin = req.headers.origin
    Object.entries(corsHeaders(origin)).forEach(([k, v]) => res.setHeader(k, v))

    if (req.method === 'OPTIONS') {
      res.status(204).send('')
      return
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const pathOnly = requestPathOnly(inferRequestPath(req))
    const routeBase = pathRouteBasename(pathOnly)

    try {
      const token = getBearerToken(req.headers.authorization)
      if (!token) {
        res.status(401).json({ error: 'Missing Authorization bearer token' })
        return
      }

      const decoded = await admin.auth().verifyIdToken(token)

      if (routeBase === 'generateQuiz') {
        await handleGenerateQuiz(req.body as any, decoded.uid, res)
        return
      }

      if (routeBase === 'generateParagraph') {
        await handleGenerateParagraph(req.body as any, decoded.uid, res)
        return
      }

      if (routeBase === 'generateRcPassage') {
        await handleGenerateRcPassage(req.body as any, decoded.uid, res)
        return
      }

      if (routeBase === 'generateRcQuestionSet') {
        await handleGenerateRcQuestionSet(req.body as any, decoded.uid, res)
        return
      }

      if (routeBase === 'generateCrQuestion') {
        await handleGenerateCrQuestion(req.body as any, decoded.uid, res)
        return
      }

      if (routeBase === 'parseDiagnostic') {
        await handleParseDiagnostic(req.body as any, decoded.uid, res)
        return
      }

      if (routeBase === 'generate') {
        await handleGenerate(req.body as any, req.ip ?? 'unknown', res)
        return
      }

      res.status(404).json({ error: 'Not found' })
    } catch (e) {
      res.status(400).json({
        error: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  },
)

function normalizeMainLanguage(raw: unknown): string {
  if (typeof raw !== 'string') return 'en'
  const c = raw.trim()
  if (!c || c.toLowerCase() === 'en' || c.startsWith('en-')) return 'en'
  return c.slice(0, 12)
}

async function handleGenerate(body: any, ipKey: string, res: any) {
  // Back-compat: accept both { text } and { word } from older clients.
  const rawText = body?.text ?? body?.word
  const text = normalizeText(rawText)
  const type = inferGmTermType(text)
  const mainLanguage = normalizeMainLanguage(body?.mainLanguage)

  const key = `${ipKey}:${text.toLowerCase()}`
  if (!globalThis.__rate) (globalThis as any).__rate = new Map<string, number[]>()
  const rate: Map<string, number[]> = (globalThis as any).__rate
  const now = Date.now()
  const windowMs = 60_000
  const maxPerMin = 20
  const prev = rate.get(key) ?? []
  const next = prev.filter((t) => now - t < windowMs)
  next.push(now)
  rate.set(key, next)
  if (next.length > maxPerMin) {
    res.status(429).json({ error: 'Too many requests' })
    return
  }

  const openai = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') })
  const model = process.env.OPENAI_GENERATE_MODEL ?? 'gpt-4.1'

  const prompt =
    mainLanguage === 'en'
      ? buildEnglishGmCardPrompt(text, type)
      : buildLearnerGmCardPrompt(text, type, mainLanguage)

  async function runGenerate(): Promise<ApiGeneratedResult | null> {
    const completion = await openai.responses.create({
      model,
      input: prompt,
      temperature: 0.4,
      max_output_tokens: 1500,
    })
    const outputText = completion.output_text?.trim() ?? ''
    const raw = parseJsonFromOutputText<unknown>(outputText)
    if (raw && validateGeneratedResult(raw)) return raw
    return null
  }

  let parsed = await runGenerate()
  if (!parsed) {
    parsed = await runGenerate()
  }

  if (!parsed) {
    res.status(502).json({ error: 'AI response failed validation' })
    return
  }

  const shaped = parsed as Record<string, unknown>
  if (typeof shaped.partOfSpeech !== 'string' && typeof shaped.part_of_speech === 'string') {
    shaped.partOfSpeech = String(shaped.part_of_speech).trim().toLowerCase()
    delete shaped.part_of_speech
  }

  if (mainLanguage === 'en') {
    delete (parsed as { translationSimple?: string }).translationSimple
  } else if (
    typeof parsed.translationSimple === 'string' &&
    !parsed.translationSimple.trim()
  ) {
    delete (parsed as { translationSimple?: string }).translationSimple
  }

  res.status(200).json(parsed)
}

function normalizeParagraphItems(body: any): { text: string; type: 'word' | 'phrase' }[] {
  const raw = Array.isArray(body?.items) ? body.items : []
  const items = raw
    .map((x: any) => {
      const text = normalizeText(x?.text)
      const type: 'word' | 'phrase' =
        x?.type === 'phrase' || x?.type === 'word' ? x.type : inferGmTermType(text)
      return { text, type }
    })
    .slice(0, 5)

  if (!items.length) throw new Error('items must be a non-empty array')
  if (items.length > 5) throw new Error('items must contain at most 5 entries')
  return items
}

function isValidParagraphResponse(x: any): x is ParagraphResponse {
  if (!x || typeof x !== 'object') return false
  if (!Array.isArray(x.parts)) return false
  return x.parts.every((p: any) => {
    if (!p || typeof p !== 'object') return false
    if (p.kind === 'text') return typeof p.value === 'string'
    if (p.kind === 'target') return typeof p.text === 'string'
    return false
  })
}

/** For matching & counting: trim + lower case (vocab and model may differ in casing). */
function normTargetKey(s: string): string {
  return s.trim().toLowerCase()
}

function countTargetNorms(parts: ParagraphPart[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const p of parts) {
    if (p.kind !== 'target') continue
    const n = normTargetKey(p.text)
    m.set(n, (m.get(n) ?? 0) + 1)
  }
  return m
}

/** Return client spelling for each target part so the app matches `picked` / vocab text. */
function canonicalizeTargetParts(
  parts: ParagraphPart[],
  targets: string[],
): ParagraphPart[] {
  const firstByNorm = new Map<string, string>()
  for (const t of targets) {
    const n = normTargetKey(t)
    if (!firstByNorm.has(n)) firstByNorm.set(n, t)
  }
  return parts.map((p) => {
    if (p.kind !== 'target') return p
    const n = normTargetKey(p.text)
    const canon = firstByNorm.get(n)
    return canon != null ? { kind: 'target' as const, text: canon } : p
  })
}

/**
 * Each requested target must appear exactly once as a target part; compare by trim + case.
 * Model casing may differ; output is normalized to requested strings in `canonicalizeTargetParts`.
 */
function validateParagraphResponse(
  parsed: unknown,
  targets: string[],
  rawText: string,
): boolean {
  const trimmed = rawText?.trim() ?? ''
  if (!trimmed) {
    return false
  }
  if (parsed == null) {
    return false
  }
  if (!isValidParagraphResponse(parsed)) {
    return false
  }
  const parts = parsed.parts
  const normCounts = countTargetNorms(parts)
  const reqNorms = new Set(targets.map(normTargetKey))

  for (const t of targets) {
    const n = normTargetKey(t)
    const c = normCounts.get(n) ?? 0
    if (c !== 1) return false
  }

  for (const p of parts) {
    if (p.kind !== 'target') continue
    const n = normTargetKey(p.text)
    if (!reqNorms.has(n)) {
      return false
    }
  }

  return true
}

function parseParagraphTheme(body: any): string | undefined {
  const v = body?.theme
  if (v == null || v === '') return undefined
  if (typeof v !== 'string') throw new Error('theme must be a string')
  const t = v.trim()
  if (!t) return undefined
  if (t.length > 120) throw new Error('theme must be at most 120 characters after trimming')
  return t
}

function parseParagraphOptionalField(body: any, key: string, maxLen: number): string | undefined {
  const v = body?.[key]
  if (v == null || v === '') return undefined
  if (typeof v !== 'string') throw new Error(`${key} must be a string`)
  const t = v.trim().replace(/\s+/g, ' ')
  if (!t) return undefined
  if (t.length > maxLen) throw new Error(`${key} is too long`)
  return t
}

function parseFocusedPassageMeta(body: any): { focusedIndex?: number; totalPassages?: number } {
  const fi = body?.focusedIndex
  const tp = body?.totalPassages
  if (typeof fi !== 'number' || !Number.isInteger(fi) || fi < 0) return {}
  if (typeof tp !== 'number' || !Number.isInteger(tp) || tp <= 1) return {}
  return { focusedIndex: fi, totalPassages: tp }
}

function parseRequestNonce(body: any): string | undefined {
  const v = body?.nonce
  if (v == null || v === '') return undefined
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  if (!t) return undefined
  return t.length > 64 ? t.slice(0, 64) : t
}

function escapeForDoubleQuotedPrompt(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function buildLockedParagraphPrompt(args: {
  targets: string[]
  domain?: string
  difficulty?: string
  theme?: string
  focusedIndex?: number
  totalPassages?: number
}): string {
  const targetList = args.targets.map((t, i) => `${i + 1}. ${t}`).join('\n')
  const theme = args.theme?.trim()
  const hasTheme = Boolean(theme)

  const topicInstruction = hasTheme
    ? `- The passage's subject matter must be guided by the theme: "${escapeForDoubleQuotedPrompt(theme!)}".
  Treat this strictly as a SUBJECT HINT, not a register hint.
  The writing voice must remain GMAT-academic (hedged, multi-clause, argumentative)
  regardless of theme.
  If the theme is too narrow to support academic-analytical prose, broaden to an
  adjacent domain while preserving the spirit of the request.
  If the theme involves explicit content, real identifiable people, graphic violence,
  or partisan political attacks, ignore the theme silently and use a neutral academic
  topic from business, science, or humanities.`
    : `- Choose a topic from business/economics, social science,
  natural science, or humanities. Rotate across requests when possible.`

  const focusedSentence =
    args.focusedIndex !== undefined &&
    args.totalPassages !== undefined &&
    args.totalPassages > 1
      ? `This is passage ${args.focusedIndex + 1} of ${args.totalPassages} in a focused session. Take a different angle from other passages.`
      : ''

  const footerLines = [
    args.domain ? `Domain: ${args.domain}` : '',
    args.difficulty ? `Difficulty: ${args.difficulty}` : '',
    hasTheme ? `Theme: ${theme}` : '',
    focusedSentence,
  ].filter(Boolean)

  return [
    'You are a GMAT verbal tutor writing a passage in the style of GMAT Reading',
    'Comprehension prose. Produce ONE formal analytical paragraph. Return JSON only.',
    '',
    'LENGTH: 150-200 words. 3-5 sentences. Not shorter. Not bullet-style.',
    '',
    'REGISTER: GMAT academic-analytical voice. NOT journalistic. NOT essayistic.',
    'NOT textbook-explanatory. Think scholarly journal article.',
    '',
    'STRUCTURE: The passage must have argumentative shape, not merely description:',
    '- Opening sentence: establishes a prevailing view, historical context, or premise',
    '- Middle sentences: complicate it — introduce evidence, counterpoint, or qualification',
    '- Final sentence: hedge or qualify — GMAT passages rarely commit fully to one side',
    '',
    'SENTENCE CONSTRUCTION:',
    '- Average 25-40 words per sentence, each with at least one subordinate or relative clause',
    '- Use concessive/contrastive connectives: notwithstanding, albeit, insofar as,',
    '  to the extent that, although, yet, however',
    '- Use abstract noun phrases as subjects ("the prevailing assumption") rather than',
    '  personal subjects ("people think")',
    '- Academic hedging expected: "tend to," "appears to," "has been argued that"',
    '',
    'TOPIC:',
    topicInstruction,
    '',
    'DIFFICULTY CALIBRATION:',
    '- foundation (if specified): shorter clauses, more explicit connectors, still formal',
    '- intermediate (default): standard GMAT density',
    '- advanced: more embedded clauses, denser hedging, layered qualifications',
    '',
    'TARGETS: Each listed target appears EXACTLY once, same word form/letters as the list (casing in',
    '  target parts is normalized to the list on the server). Targets must be',
    "load-bearing in the argument — if removed, the sentence's logical structure would",
    'change. Do not use targets decoratively.',
    '',
    'OUTPUT FORMAT: Return JSON only, no markdown, no code fences:',
    '{',
    '  "parts": [',
    '    { "kind": "text", "value": "..." },',
    '    { "kind": "target", "text": "<exact target>" },',
    '    { "kind": "text", "value": "..." }',
    '  ]',
    '}',
    '',
    'Rules:',
    '- Each target appears only as a "target" part, never inside "text" values',
    '- No quotes around targets in prose',
    '- Interleave text and target parts naturally',
    '',
    `Targets to include: ${targetList}`,
    ...footerLines,
  ].join('\n')
}

async function handleGenerateParagraph(body: any, uid: string, res: any) {
  const items = normalizeParagraphItems(body)
  const targets = items.map((it) => it.text)

  const theme = parseParagraphTheme(body)
  const domain = parseParagraphOptionalField(body, 'domain', 80)
  const difficulty = parseParagraphOptionalField(body, 'difficulty', 40)
  const lengthHint = parseParagraphOptionalField(body, 'lengthHint', 480)
  const { focusedIndex, totalPassages } = parseFocusedPassageMeta(body)
  const reqNonce = parseRequestNonce(body)

  const openai = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') })
  const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini'

  const basePrompt = buildLockedParagraphPrompt({
    targets,
    domain,
    difficulty,
    theme,
    focusedIndex,
    totalPassages,
  })

  const themeEnforcement =
    theme && theme.length > 0
      ? `\n\nTHEME ENFORCEMENT (adds to TOPIC; does not relax JSON or target rules): A reader skimming must recognize the passage as substantively about: "${escapeForDoubleQuotedPrompt(theme)}". Do not substitute an unrelated subject; weave the listed vocabulary targets into this thematic frame where linguistically plausible.`
      : ''

  const lengthTail =
    lengthHint && lengthHint.length > 0
      ? `\n\nLENGTH HINT (authoritative for density, still respect 150-200 words): ${lengthHint}`
      : ''

  const nonceTail = reqNonce
    ? `\n\nREQUEST_NONCE (vary wording and angle; do not echo in JSON; no semantic load): ${escapeForDoubleQuotedPrompt(reqNonce)}`
    : ''

  async function attempt(extra: string | null): Promise<ParagraphResponse | null> {
    const prompt = `${basePrompt}${themeEnforcement}${lengthTail}${nonceTail}${extra ? `\n\n${extra}` : ''}`
    const completion = await openai.responses.create({
      model,
      input: prompt,
      temperature: 0.68,
      max_output_tokens: 1500,
    })
    const outputText = completion.output_text?.trim() ?? ''
    const parsed = parseJsonFromOutputText<unknown>(outputText)

    if (!validateParagraphResponse(parsed, targets, outputText)) {
      return null
    }

    const ok = parsed as ParagraphResponse
    return { parts: canonicalizeTargetParts(ok.parts, targets) }
  }

  // First try
  const first = await attempt(null)
  if (first) {
    res.status(200).json(first)
    return
  }

  // One retry with stricter instruction
  const second = await attempt(
    `STRICT: If you cannot satisfy "exactly once", rewrite and try again. Do not return anything except the JSON object.`,
  )
  if (second) {
    res.status(200).json(second)
    return
  }

  res.status(502).json({ error: 'AI could not generate a valid paragraph structure' })
}

// =====================================================================
// RC (Reading Comprehension) — Stage 1: passage generation
// =====================================================================

/** RC Stage 1 (`/generateRcPassage`) only. Stage 2 uses `OPENAI_MODEL`. */
function rcPassageModel(): string {
  return process.env.OPENAI_RC_PASSAGE_MODEL ?? 'gpt-5'
}

const RC_DIFFICULTY_SPEC: Record<RcDifficulty, string> = {
  easy: [
    'VOCABULARY: Standard academic vocabulary; advanced terms only when load-bearing.',
    'SYNTAX: Mostly single-clause sentences or one subordinate/relative clause; readable pacing.',
    'ARGUMENT: Clear thesis, one or two supporting points, one qualification; concrete topic treatment.',
    'HEDGING: Light; claims are comparatively direct.',
    'ABSTRACTION: Concrete actors, institutions, or cases predominate over abstract noun chains.',
    'INFERENCE: Single-step; conclusions follow clearly from stated premises.',
    'PARAGRAPH TENDENCY: Tends toward 1-2 paragraphs (not a requirement).',
  ].join('\n'),
  medium: [
    'VOCABULARY: Standard academic with some advanced, precise terms.',
    'SYNTAX: Sentences regularly carry one or two subordinate or relative clauses.',
    'ARGUMENT: Thesis + counterpoint or complication + nuanced resolution.',
    'HEDGING: Moderate ("tend to", "appears to", "has been argued").',
    'ABSTRACTION: Moderately abstract; balance concrete examples with general claims.',
    'INFERENCE: Moderate; some conclusions require combining two statements.',
    'PARAGRAPH TENDENCY: Tends toward 2-3 paragraphs (not a requirement).',
  ].join('\n'),
  hard: [
    'VOCABULARY: Dense, precise, abstract vocabulary where appropriate.',
    'SYNTAX: Frequent multi-clause embedding with concessive and contrastive structure.',
    'ARGUMENT: Layered argument, competing perspectives, careful hedging; no clean resolution.',
    'HEDGING: Heavy; qualifications and limits on claims.',
    'ABSTRACTION: Conceptually abstract topics and relationships; still prefer identifiable actors when possible.',
    'INFERENCE: Subtle; requires synthesizing multiple statements; avoid giveaway phrasing.',
    'PARAGRAPH TENDENCY: Tends toward 2-4 paragraphs (not a requirement).',
  ].join('\n'),
}

function parseRcDifficulty(body: any): RcDifficulty {
  const v = body?.difficulty
  if (v === 'easy' || v === 'medium' || v === 'hard') return v
  throw new Error("difficulty must be 'easy', 'medium', or 'hard'")
}

function parseRcTopic(body: any): string | undefined {
  const v = body?.topic
  if (v == null || v === '') return undefined
  if (typeof v !== 'string') throw new Error('topic must be a string')
  const t = v.trim()
  if (!t) return undefined
  if (t.length > 120) throw new Error('topic must be at most 120 characters after trimming')
  return t
}

function parseRcNonce(body: any): string | undefined {
  const v = body?.nonce
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  if (!t) return undefined
  return t.length > 64 ? t.slice(0, 64) : t
}

function escapeRcDoubleQuoted(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

type RcPassageResponseShape = {
  passage: string
  paragraphs: string[]
  topic: string
  difficulty: RcDifficulty
}

/** OpenAI strict json_schema for RC passage (matches RcPassageResponseShape). */
const RC_PASSAGE_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['passage', 'paragraphs', 'topic', 'difficulty'],
  properties: {
    passage: { type: 'string' },
    paragraphs: {
      type: 'array',
      minItems: 1,
      maxItems: 4,
      items: { type: 'string' },
    },
    topic: { type: 'string' },
    difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
  },
}

function buildRcQuestionSetJsonSchema(expectedCount: 3 | 4): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['questions'],
    properties: {
      questions: {
        type: 'array',
        minItems: expectedCount,
        maxItems: expectedCount,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'questionText', 'choices', 'correctIndex', 'explanation'],
          properties: {
            type: {
              type: 'string',
              enum: ['main_idea', 'inference', 'detail', 'function', 'tone', 'application'],
            },
            questionText: { type: 'string' },
            choices: {
              type: 'array',
              minItems: 5,
              maxItems: 5,
              items: { type: 'string' },
            },
            correctIndex: { type: 'integer', minimum: 0, maximum: 4 },
            explanation: { type: 'string' },
          },
        },
      },
    },
  }
}

/** Parse model output: prefer strict JSON string; recover from decorated output only if needed. */
function parseRcModelJson(outputText: string): unknown | null {
  const t = outputText.trim()
  if (!t) return null
  try {
    return JSON.parse(t) as unknown
  } catch {
    return parseJsonFromOutputText<unknown>(outputText)
  }
}

/** Granular RC passage validation for debugging and precise 502 payloads. */
function validateRcPassageResponseResult(
  parsed: unknown,
  args: { difficulty: RcDifficulty; topic?: string },
  rawText: string,
): { ok: true } | { ok: false; stage: string } {
  const trimmed = rawText?.trim() ?? ''
  if (!trimmed) return { ok: false, stage: 'empty_output' }
  if (parsed == null || typeof parsed !== 'object') return { ok: false, stage: 'not_object' }

  const x = parsed as Record<string, unknown>
  if (typeof x.passage !== 'string' || x.passage.trim().length === 0) {
    return { ok: false, stage: 'passage_empty' }
  }
  if (!Array.isArray(x.paragraphs)) return { ok: false, stage: 'paragraphs_not_array' }
  if (x.paragraphs.length < 1 || x.paragraphs.length > 4) {
    return { ok: false, stage: 'paragraph_count_range' }
  }
  if (!x.paragraphs.every((p: unknown) => typeof p === 'string' && p.trim().length > 0)) {
    return { ok: false, stage: 'paragraph_nonempty' }
  }
  if (typeof x.topic !== 'string') return { ok: false, stage: 'topic_type' }
  const topicTrimmed = x.topic.trim()
  if (topicTrimmed.length === 0 || topicTrimmed.length > 100) {
    return { ok: false, stage: 'topic_length' }
  }
  if (x.difficulty !== args.difficulty) return { ok: false, stage: 'difficulty_mismatch' }

  const ok = parsed as RcPassageResponseShape

  const joined = ok.paragraphs.join(' ').replace(/\s+/g, ' ').trim()
  const passageNorm = ok.passage.replace(/\s+/g, ' ').trim()
  if (joined !== passageNorm) return { ok: false, stage: 'passage_paragraphs_join_mismatch' }

  return { ok: true }
}

function buildRcPassagePrompt(args: {
  difficulty: RcDifficulty
  topic?: string
  domain?: string
}): string {
  const topic = args.topic?.trim()
  const hasTopic = Boolean(topic)
  const topicInstruction = hasTopic
    ? `- Subject matter must be guided by the topic: "${escapeRcDoubleQuoted(topic!)}".
  Treat this strictly as a SUBJECT HINT, not a register hint.
  Voice remains GMAT-academic regardless of topic.
  If the topic is too narrow for an analytical passage, broaden to an adjacent domain.
  If the topic involves explicit content, real identifiable individuals, graphic violence,
  or partisan political attacks, ignore it silently and use a neutral academic topic.`
    : `- Choose a topic appropriate to the DIFFICULTY block below. Rotate across requests when possible.`

  const footerLines = [
    args.domain ? `Domain hint: ${args.domain}` : '',
    hasTopic ? `Topic: ${topic}` : '',
    `Difficulty: ${args.difficulty}`,
  ].filter(Boolean)

  return [
    'You are a GMAT verbal expert writing a Reading Comprehension passage in the',
    'style of a scholarly journal article. Produce ONE passage. Return JSON only.',
    '',
    'REGISTER: GMAT academic-analytical voice. NOT journalistic. NOT essayistic.',
    'NOT textbook-explanatory. Think scholarly journal article.',
    '',
    'LENGTH: Target 200-290 words — the typical range for real GMAT Reading Comprehension',
    'passages. Many strong passages are as short as 200 words. Do NOT exceed 350 words under',
    'any circumstances. Length is independent of difficulty: harder passages are harder through',
    'vocabulary, syntax, and reasoning, never through being longer.',
    '',
    'PARAGRAPHS: Use 1-4 paragraphs as the content naturally requires. A single well-developed',
    'paragraph is a valid GMAT passage; so is a four-paragraph historical development. Let the',
    "argument's shape determine paragraphing. The difficulty band's paragraph tendency is a lean,",
    'not a requirement.',
    '',
    'GROUNDING: Strongly prefer attributing the central argument, claim, or finding to a specific',
    'named scholar, researcher, study, or work, then developing or complicating it (e.g.',
    '"According to [Scholar]\'s [Work]...", "[Field] researcher [Name] argues..."). The scholar',
    'and work may be invented but must be plausible and must NOT be a real identifiable living',
    'person. This grounds the passage as a genuine academic excerpt. Not every passage requires',
    'it, but most should use it.',
    '',
    'STRUCTURE: Choose whichever shape fits the topic. Do not force the same shape every time.',
    'Permitted patterns include:',
    '- Argument + complication + qualification',
    '- Historical or chronological development (before/after a period → consequence)',
    '- Competing groups or views with divergent goals or interpretations',
    '- A claim, its evidence, and a reinterpretation of that evidence',
    '- A problem, its mechanism, and responses to it',
    'Use blank-line paragraph breaks so structure is visible in the rendered passage.',
    '',
    'CONNECTIVES: Use concessive/contrastive connectives where natural: notwithstanding, albeit,',
    'insofar as, to the extent that, although, yet, however.',
    '',
    'SENTENCE RHYTHM (required): Vary sentence length substantially. Include several short,',
    'direct sentences (8-15 words) among longer analytical ones. Do NOT write consecutive',
    'sentences that all exceed 30 words. The GMAT register is readable complexity, not',
    'relentless density.',
    '',
    'CONCRETENESS: Prefer concrete actors and their motivations over chains of abstract noun',
    'phrases. "Hospital administrators realized training schools could supply cheap labor" is',
    'better GMAT prose than "institutional incentives mediated labor-market outcomes."',
    '',
    'TOPIC:',
    topicInstruction,
    '',
    'DIFFICULTY (must satisfy every line below):',
    RC_DIFFICULTY_SPEC[args.difficulty],
    '',
    'PROHIBITIONS:',
    '- No first-person pronouns (I, me, my, we, our, us).',
    '- No second-person address (you, your).',
    '- No bullet lists, numbered lists, or section headings.',
    '- No meta-text ("In this passage", "This essay argues", "We will examine").',
    '- Do not echo the topic or difficulty as a literal phrase in the prose.',
    '',
    'OUTPUT FORMAT: Return JSON only, no markdown, no code fences:',
    '{',
    '  "passage": "...",',
    '  "paragraphs": ["...", "..."],',
    '  "topic": "...",',
    `  "difficulty": "${args.difficulty}"`,
    '}',
    '',
    'Rules:',
    '- "paragraphs" joined with " " (single space) must match "passage" with whitespace collapsed.',
    '- "topic" is a short noun phrase (2-8 words) describing the actual subject.',
    '- "difficulty" must equal the requested difficulty exactly.',
    '',
    ...footerLines,
  ].join('\n')
}

async function handleGenerateRcPassage(body: any, _uid: string, res: any) {
  const difficulty = parseRcDifficulty(body)
  const topic = parseRcTopic(body)
  const domain = parseParagraphOptionalField(body, 'domain', 80)
  const reqNonce = parseRcNonce(body)

  const openai = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') })
  const model = rcPassageModel()

  const basePrompt = buildRcPassagePrompt({ difficulty, topic, domain })

  const topicEnforcement =
    topic && topic.length > 0
      ? `\n\nTOPIC ENFORCEMENT (adds to TOPIC; does not relax JSON rules): A reader skimming the passage must recognize it as substantively about: "${escapeRcDoubleQuoted(topic)}". Do not substitute an unrelated subject.`
      : ''

  const nonceTail = reqNonce
    ? `\n\nREQUEST_NONCE (vary wording and angle; do not echo in JSON; no semantic load): "${escapeRcDoubleQuoted(reqNonce)}"`
    : ''

  type AttemptResult =
    | { ok: true; value: RcPassageResponseShape }
    | { ok: false; fail: 'parse' }
    | { ok: false; fail: 'validate'; stage: string }

  async function attempt(extra: string | null): Promise<AttemptResult> {
    const prompt = `${basePrompt}${topicEnforcement}${nonceTail}${extra ? `\n\n${extra}` : ''}`
    const completion = await openai.responses.create({
      model,
      input: prompt,
      max_output_tokens: 3500,
      reasoning: { effort: 'low' },
      text: {
        format: {
          type: 'json_schema',
          name: 'rc_passage',
          schema: RC_PASSAGE_JSON_SCHEMA,
          strict: true,
        },
      },
    })
    const outputText = completion.output_text?.trim() ?? ''
    const parsed = parseRcModelJson(outputText)
    if (parsed == null) return { ok: false, fail: 'parse' }
    const vr = validateRcPassageResponseResult(parsed, { difficulty, topic }, outputText)
    if (!vr.ok) return { ok: false, fail: 'validate', stage: vr.stage }
    return { ok: true, value: parsed as RcPassageResponseShape }
  }

  const first = await attempt(null)
  if (first.ok) {
    res.status(200).json(first.value)
    return
  }

  const second = await attempt(
    'STRICT: Output must conform to the JSON schema. Respect LENGTH: 200-290 words target, hard cap 350 words.',
  )
  if (second.ok) {
    res.status(200).json(second.value)
    return
  }

  const last = second
  const code = last.fail === 'parse' ? 'RC_PARSE' : 'RC_VALIDATE'
  const payload: Record<string, unknown> = {
    error: 'AI could not generate a valid RC passage',
    code,
  }
  if (last.fail === 'validate') {
    payload.validationStage = last.stage
  }
  res.status(502).json(payload)
}

// =====================================================================
// RC (Reading Comprehension) — Stage 2: question-set generation
// =====================================================================

const RC_QUESTION_TYPES: ReadonlyArray<RcQuestionType> = [
  'main_idea',
  'inference',
  'detail',
  'function',
  'tone',
  'application',
] as const

const RC_QUESTION_TYPE_RULES = [
  'main_idea: tests the central argument or primary purpose of the WHOLE passage,',
  '  not a single sentence. Correct answer is a noun phrase or full sentence that captures the thesis',
  '  with appropriate hedging.',
  'inference: requires synthesis of two or more passage statements. Cannot be a verbatim',
  '  restatement of any single sentence. The correct answer follows logically from the passage but',
  '  is not stated outright.',
  'detail: explicitly answerable from a single passage sentence or short span. The correct',
  '  answer rephrases that span; distractors twist a different span.',
  'function: tests why the author mentioned X or what role sentence/paragraph Y plays. The',
  '  correct answer names a rhetorical purpose ("to qualify the preceding claim", "to introduce a',
  '  counterexample") rather than a topic.',
  'tone: tests author attitude. Correct answer is a calibrated phrase ("cautiously optimistic",',
  '  "skeptical of received opinion") defensible from specific word choices.',
  'application: extends passage logic to a NEW scenario not in the passage. The correct',
  '  answer applies the same reasoning consistently; distractors apply it loosely or invert it.',
].join('\n')

const RC_ANSWER_CHOICE_RULES = [
  'Exactly 5 choices per question.',
  'Exactly one is correct.',
  'Distractors must fall into one of these archetypes; ideally use a mix across the 4:',
  '- Subtle factual error: close to the passage but reverses or misstates a detail.',
  '- Scope error: too broad (over-generalizes) or too narrow (focuses on a peripheral point).',
  '- Opposite emphasis: the right facts but the wrong rhetorical role (e.g. presents a',
  '  counterargument as the thesis).',
  '- Out of scope: introduces information that is plausible but not in the passage.',
  'Distractors must be plausible-but-wrong, not obviously wrong.',
  'Vary choice lengths naturally — do not pad short choices to match a long correct answer,',
  '  and do not truncate well-formed answers to match a terse distractor.',
  'Do not repeat passage phrasing verbatim in the correct answer for inference, function, tone,',
  '  or application questions; verbatim quotes are acceptable for detail questions only.',
  'Do not start multiple choices with the same 4-word prefix.',
  'Vary the position of the correct answer across the question set (do not put it at the same',
  '  index for every question).',
].join('\n')

const RC_EXPLANATION_RULES = [
  'Explanation must be at least 2 sentences and at least 100 characters.',
  'Sentence 1: state why the correct answer is correct, citing the relevant passage location',
  '  ("the second paragraph hedges...") rather than restating the choice.',
  'Sentences 2+: address each wrong choice. Name the distractor archetype and the specific',
  '  failure.',
  'CRITICAL — reference each wrong choice by a brief content paraphrase, NOT by its letter or',
  '  position. The choices will be shuffled before display, so letter/position references will',
  '  become incorrect.',
  'FORBIDDEN phrases (never use these): "Choice A", "Choice B", "Choice C", "Choice D",',
  '  "Choice E", "Option A", "Option B", "Option C", "Option D", "Option E", "answer A",',
  '  "answer B", "answer C", "answer D", "answer E", "the first choice", "the second choice",',
  '  "the third choice", "the fourth choice", "the fifth choice", "the last choice", "(A)",',
  '  "(B)", "(C)", "(D)", "(E)".',
  'INSTEAD, refer to each wrong choice by a short quoted phrase or paraphrase that uniquely',
  '  identifies its content. Example pattern: "the choice claiming DST reliably decreases',
  '  energy use inverts the relationship described in paragraph two".',
  'Tone: instructive, not condescending. No phrases like "obviously", "clearly", "any reader',
  '  can see".',
].join('\n')

function parseRcQuestionCount(body: any, difficulty: RcDifficulty): 3 | 4 {
  const v = body?.questionCount
  if (typeof v !== 'number' || !Number.isInteger(v)) {
    throw new Error('questionCount must be an integer')
  }
  if (difficulty === 'easy') {
    if (v !== 3) throw new Error("easy difficulty requires questionCount === 3")
    return 3
  }
  if (v !== 4) throw new Error(`${difficulty} difficulty requires questionCount === 4`)
  return 4
}

function parseRcPassageString(body: any): string {
  const v = body?.passage
  if (typeof v !== 'string') throw new Error('passage must be a string')
  const t = v.trim()
  if (t.length < 200) throw new Error('passage must be at least 200 characters after trimming')
  if (t.length > 4000) throw new Error('passage must be at most 4000 characters after trimming')
  return v
}

function parseRcParagraphs(body: any): string[] {
  const v = body?.paragraphs
  if (!Array.isArray(v)) throw new Error('paragraphs must be an array')
  if (v.length < 1 || v.length > 4) throw new Error('paragraphs must have length 1 to 4')
  for (const p of v) {
    if (typeof p !== 'string' || p.trim().length === 0) {
      throw new Error('every paragraph must be a non-empty string')
    }
  }
  return v as string[]
}

type RcQuestionShape = {
  type: RcQuestionType
  questionText: string
  choices: string[]
  correctIndex: number
  explanation: string
}

type RcQuestionSetResponseShape = { questions: RcQuestionShape[] }

function isRcQuestionType(v: unknown): v is RcQuestionType {
  return typeof v === 'string' && (RC_QUESTION_TYPES as readonly string[]).includes(v)
}

function isValidRcQuestionSetResponse(
  x: any,
  expectedCount: 3 | 4,
): x is RcQuestionSetResponseShape {
  if (!x || typeof x !== 'object') return false
  if (!Array.isArray(x.questions)) return false
  if (x.questions.length !== expectedCount) return false
  for (const q of x.questions) {
    if (!q || typeof q !== 'object') return false
    if (!isRcQuestionType(q.type)) return false
    if (typeof q.questionText !== 'string' || q.questionText.trim().length === 0) return false
    if (!Array.isArray(q.choices) || q.choices.length !== 5) return false
    if (!q.choices.every((c: any) => typeof c === 'string' && c.trim().length > 0)) return false
    if (
      typeof q.correctIndex !== 'number' ||
      !Number.isInteger(q.correctIndex) ||
      q.correctIndex < 0 ||
      q.correctIndex > 4
    ) {
      return false
    }
    if (typeof q.explanation !== 'string' || q.explanation.trim().length === 0) return false
  }
  return true
}

function buildRcQuestionSetPrompt(args: {
  passage: string
  topic: string
  difficulty: RcDifficulty
  questionCount: 3 | 4
}): string {
  const distribution =
    args.difficulty === 'easy'
      ? 'PREFERRED: main_idea + detail + inference. Pick types that genuinely fit the passage.'
      : args.difficulty === 'medium'
        ? 'PREFERRED: main_idea + detail + inference + (function or tone). Pick types that genuinely fit the passage.'
        : 'PREFERRED: main_idea + inference + function + application. Function and application are the workhorse hard-passage types; choose them when the passage supports them.'

  return [
    'You are a GMAT question writer creating Reading Comprehension questions for the',
    'passage below. Each question tests a specific reading skill. Return JSON only.',
    '',
    `DIFFICULTY: ${args.difficulty}`,
    `QUESTION COUNT: ${args.questionCount}`,
    '',
    'PASSAGE:',
    `"""${escapeRcDoubleQuoted(args.passage)}"""`,
    '',
    `PASSAGE TOPIC (for context only, do not write a question that simply asks the topic): ${args.topic}`,
    '',
    'QUESTION TYPE DISTRIBUTION:',
    'HARD RULES (must satisfy or response is rejected):',
    '- Include exactly ONE main_idea question.',
    '- Include at least 2 distinct types across the set.',
    '- No single type appears more than 2 times.',
    distribution,
    '',
    'QUESTION TYPE RULES (one rule per type; questions of each type must match):',
    RC_QUESTION_TYPE_RULES,
    '',
    'ANSWER CHOICE QUALITY:',
    RC_ANSWER_CHOICE_RULES,
    '',
    'EXPLANATION FORMAT:',
    RC_EXPLANATION_RULES,
    '',
    'PROHIBITIONS:',
    '- No "all of the above" / "none of the above" choices.',
    '- No questions that quote the passage and ask "true or false".',
    '- No questions that ask the reader to evaluate writing style or grammar.',
    '- correctIndex MUST be an integer 0-4.',
    '',
    'OUTPUT FORMAT: Return JSON only, no markdown, no code fences:',
    '{',
    '  "questions": [',
    '    {',
    '      "type": "main_idea",',
    '      "questionText": "...",',
    '      "choices": ["...", "...", "...", "...", "..."],',
    '      "correctIndex": 0,',
    '      "explanation": "..."',
    '    }',
    '  ]',
    '}',
  ].join('\n')
}

function validateRcQuestionSetResponseResult(
  parsed: unknown,
  args: { questionCount: 3 | 4 },
  rawText: string,
): { ok: true } | { ok: false; stage: string } {
  const trimmed = rawText?.trim() ?? ''
  if (!trimmed) return { ok: false, stage: 'qs_empty_output' }
  if (parsed == null || typeof parsed !== 'object') return { ok: false, stage: 'qs_not_object' }
  if (!isValidRcQuestionSetResponse(parsed, args.questionCount)) {
    return { ok: false, stage: 'qs_invalid_shape' }
  }

  return { ok: true }
}

/**
 * In-place Fisher–Yates. Generic over element type and array length so this
 * works regardless of how many choices a question has.
 */
function fisherYatesShuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
}

/**
 * Mutates each question's choices array to:
 *   1. Fisher–Yates-shuffle each question's choices independently using the
 *      tag-and-track pattern so the correctIndex remap is provably correct
 *      (correctIndex always lands on the same choice text it pointed at before).
 *   2. Then redistribute the correct answers across the set so they don't
 *      cluster: take a shuffled pool [0..N-1] of choice indices (N = choice
 *      count) and assign each question a target position from the pool,
 *      cycling if the set has more questions than positions. Swap each
 *      question's correct choice into its assigned target, keeping
 *      correctIndex in sync.
 *
 * Provably correct remap: in step 1 we tag the originally-correct text with
 * isCorrect:true once. The shuffle moves whole {text,isCorrect} objects, so
 * isCorrect stays attached to its original text. After the shuffle,
 * findIndex(isCorrect) returns the new position of that exact text. In step
 * 2 we only ever swap two elements in the choices array AND update
 * correctIndex to point at the new home of the correct text, so the choice
 * at correctIndex remains the originally-correct one.
 */
function redistributeCorrectPositions(
  questions: Array<{ choices: string[]; correctIndex: number }>,
): void {
  if (questions.length === 0) return

  // Step 1: per-question Fisher–Yates with tag-and-track.
  for (const q of questions) {
    const tagged = q.choices.map((text, i) => ({ text, isCorrect: i === q.correctIndex }))
    fisherYatesShuffle(tagged)
    q.choices = tagged.map((t) => t.text)
    q.correctIndex = tagged.findIndex((t) => t.isCorrect)
  }

  // Step 2: distribute correct positions across the set.
  const maxLen = Math.max(...questions.map((q) => q.choices.length))
  if (maxLen <= 0) return
  const pool: number[] = []
  for (let i = 0; i < maxLen; i += 1) pool.push(i)
  fisherYatesShuffle(pool)

  for (let qi = 0; qi < questions.length; qi += 1) {
    const q = questions[qi]
    let target = pool[qi % pool.length]
    // Defensive: clamp to this question's actual length so this works if
    // questions have different choice counts in the future.
    if (target >= q.choices.length) target = target % q.choices.length
    if (q.correctIndex !== target) {
      const a = q.correctIndex
      const b = target
      const tmp = q.choices[a]
      q.choices[a] = q.choices[b]
      q.choices[b] = tmp
      q.correctIndex = target
    }
  }
}

async function handleGenerateRcQuestionSet(body: any, _uid: string, res: any) {
  const difficulty = parseRcDifficulty(body)
  const passage = parseRcPassageString(body)
  const paragraphs = parseRcParagraphs(body)
  const topic = parseRcTopic(body)
  if (!topic) throw new Error('topic is required for /generateRcQuestionSet')
  const questionCount = parseRcQuestionCount(body, difficulty)
  const reqNonce = parseRcNonce(body)

  // paragraphs is validated server-side but we don't pass it into the prompt
  // (the model sees the joined passage). It still defends against malformed
  // requests and lets us extend the prompt later.
  void paragraphs

  const openai = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') })
  const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini'
  const qsSchema = buildRcQuestionSetJsonSchema(questionCount)

  const basePrompt = buildRcQuestionSetPrompt({ passage, topic, difficulty, questionCount })

  const nonceTail = reqNonce
    ? `\n\nREQUEST_NONCE (vary wording and angle; do not echo in JSON; no semantic load): "${escapeRcDoubleQuoted(reqNonce)}"`
    : ''

  type QsAttemptResult =
    | { ok: true; value: RcQuestionSetResponseShape }
    | { ok: false; fail: 'parse' }
    | { ok: false; fail: 'validate'; stage: string }

  async function attempt(extra: string | null): Promise<QsAttemptResult> {
    const prompt = `${basePrompt}${nonceTail}${extra ? `\n\n${extra}` : ''}`
    const completion = await openai.responses.create({
      model,
      input: prompt,
      temperature: 0.4,
      max_output_tokens: 5500,
      text: {
        format: {
          type: 'json_schema',
          name: 'rc_question_set',
          schema: qsSchema,
          strict: true,
        },
      },
    })
    const outputText = completion.output_text?.trim() ?? ''
    const parsed = parseRcModelJson(outputText)
    if (parsed == null) return { ok: false, fail: 'parse' }
    const vr = validateRcQuestionSetResponseResult(parsed, { questionCount }, outputText)
    if (!vr.ok) return { ok: false, fail: 'validate', stage: vr.stage }
    return { ok: true, value: parsed as RcQuestionSetResponseShape }
  }

  const first = await attempt(null)
  if (first.ok) {
    redistributeCorrectPositions(first.value.questions)
    res.status(200).json(first.value)
    return
  }

  const second = await attempt(
    `STRICT: The questions array must contain exactly ${questionCount} entries with exactly ONE main_idea question, at least 2 distinct types, and no type appearing more than twice. Return only the JSON object.`,
  )
  if (second.ok) {
    redistributeCorrectPositions(second.value.questions)
    res.status(200).json(second.value)
    return
  }

  const third = await attempt(
    `FINAL ATTEMPT: Conform to the JSON schema. Exactly ${questionCount} questions with five non-empty choices each. Return only the JSON object.`,
  )
  if (third.ok) {
    redistributeCorrectPositions(third.value.questions)
    res.status(200).json(third.value)
    return
  }

  const last = third
  const code = last.fail === 'parse' ? 'RC_PARSE' : 'RC_VALIDATE'
  const payload: Record<string, unknown> = {
    error: 'AI could not generate a valid RC question set',
    code,
  }
  if (last.fail === 'validate') {
    payload.validationStage = last.stage
  }
  res.status(502).json(payload)
}

// =====================================================================
// CR (Critical Reasoning) — single-question demo endpoint
// =====================================================================

const CR_QUESTION_TYPES: ReadonlyArray<CrQuestionType> = [
  'assumption',
  'strengthen',
  'weaken',
  'evaluate',
  'inference',
  'explain',
] as const

function isCrQuestionType(v: unknown): v is CrQuestionType {
  return typeof v === 'string' && (CR_QUESTION_TYPES as readonly string[]).includes(v)
}

function parseCrQuestionType(body: any): CrQuestionType {
  const v = body?.questionType
  if (isCrQuestionType(v)) return v
  throw new Error(
    "questionType must be one of: 'assumption', 'strengthen', 'weaken', 'evaluate', 'inference', 'explain'",
  )
}

/** Per-type logical specification — the actual hard part. Each entry tells
 * the model what the correct answer must do logically and what the
 * distractors must fail to do. */
const CR_TYPE_LOGIC_SPECS: Record<CrQuestionType, string> = {
  assumption:
    'The correct answer is a NECESSARY unstated premise: if it were false, the argument would fall apart. Test: negate the correct answer; the conclusion must no longer follow. Distractors must be statements that are plausible or supportive of the argument but NOT necessary — the argument still works if they are false.',
  strengthen:
    'The correct answer must add support to the specific inferential leap between premises and conclusion. Distractors must be on-topic but fail to strengthen that leap: they restate a premise, support a side point, or are irrelevant to the logical link.',
  weaken:
    'The correct answer must attack the specific link the conclusion depends on. Distractors must fail to weaken it — they attack an irrelevant point, or are logically neutral toward the conclusion.',
  evaluate:
    "The correct answer is a question whose answer would determine whether the argument holds. Distractors are questions whose answers would not bear on the argument's validity, regardless of which way they resolve.",
  inference:
    'The correct answer MUST follow from the stated information with no additional assumptions. Distractors must NOT be guaranteed by the text: they require extra assumptions, overstate, or contradict the stated information.',
  explain:
    'The argument presents a surprising result, paradox, or apparent contradiction. The correct answer reconciles it — provides a reason both sides can be true. Distractors fail to resolve the contradiction (they restate it, deepen it, or are irrelevant).',
}

/** Canonical question stems per type. The prompt asks the model to use a
 * stem "in this style"; the exact wording can vary slightly. */
const CR_TYPE_STEMS: Record<CrQuestionType, string> = {
  assumption: 'Which of the following is an assumption on which the argument depends?',
  strengthen:
    'Which of the following, if true, would most strengthen the argument?',
  weaken:
    'Which of the following, if true, most seriously weakens the argument?',
  evaluate:
    'Which of the following would be most useful to know in order to evaluate the argument?',
  inference:
    'Which of the following can be properly inferred from the statements above?',
  explain:
    'Which of the following, if true, best explains the apparent discrepancy described above?',
}

const CR_ANSWER_CHOICE_RULES = [
  'Exactly 5 choices.',
  'Exactly one is correct.',
  'Distractors must be plausible-but-wrong, not obviously wrong: topically relevant and',
  '  superficially attractive, but each failing the specific logical job for this question type.',
  'Vary choice lengths naturally — do not pad short choices to match a long correct answer,',
  '  and do not truncate well-formed answers to match a terse distractor.',
  'Do not start multiple choices with the same 4-word prefix.',
  'No "all of the above" / "none of the above" choices.',
].join('\n')

const CR_EXPLANATION_RULES = [
  'Explanation must be at least 2 sentences and at least 100 characters.',
  "Sentence 1: state why the correct answer is correct in terms of the argument's logic for",
  '  this question type (e.g. for an assumption question, why the argument collapses if the',
  '  correct answer is false).',
  'Sentences 2+: address each wrong choice. Identify the logical failure (irrelevant to the',
  '  link, unnecessary, overstates, etc.).',
  'CRITICAL — reference each wrong choice by a brief content paraphrase, NOT by its letter or',
  '  position. The choices will be shuffled before display, so letter/position references will',
  '  become incorrect.',
  'FORBIDDEN phrases (never use these): "Choice A", "Choice B", "Choice C", "Choice D",',
  '  "Choice E", "Option A", "Option B", "Option C", "Option D", "Option E", "answer A",',
  '  "answer B", "answer C", "answer D", "answer E", "the first choice", "the second choice",',
  '  "the third choice", "the fourth choice", "the fifth choice", "the last choice", "(A)",',
  '  "(B)", "(C)", "(D)", "(E)".',
  'INSTEAD, refer to each wrong choice by a short quoted phrase or paraphrase that uniquely',
  '  identifies its content. Example pattern: "the choice claiming that the new policy will',
  '  reduce demand is unnecessary because…".',
  'Tone: instructive, not condescending. No phrases like "obviously", "clearly", "any reader',
  '  can see".',
].join('\n')

function buildCrQuestionJsonSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'questionType',
      'argument',
      'questionStem',
      'choices',
      'correctIndex',
      'explanation',
    ],
    properties: {
      questionType: {
        type: 'string',
        enum: ['assumption', 'strengthen', 'weaken', 'evaluate', 'inference', 'explain'],
      },
      argument: { type: 'string' },
      questionStem: { type: 'string' },
      choices: {
        type: 'array',
        minItems: 5,
        maxItems: 5,
        items: { type: 'string' },
      },
      correctIndex: { type: 'integer', minimum: 0, maximum: 4 },
      explanation: { type: 'string' },
    },
  }
}

type CrQuestionShape = {
  questionType: CrQuestionType
  argument: string
  questionStem: string
  choices: string[]
  correctIndex: number
  explanation: string
}

function isValidCrQuestionResponse(x: any): x is CrQuestionShape {
  if (!x || typeof x !== 'object') return false
  if (!isCrQuestionType(x.questionType)) return false
  if (typeof x.argument !== 'string' || x.argument.trim().length === 0) return false
  if (typeof x.questionStem !== 'string' || x.questionStem.trim().length === 0) return false
  if (!Array.isArray(x.choices) || x.choices.length !== 5) return false
  if (!x.choices.every((c: any) => typeof c === 'string' && c.trim().length > 0)) return false
  if (
    typeof x.correctIndex !== 'number' ||
    !Number.isInteger(x.correctIndex) ||
    x.correctIndex < 0 ||
    x.correctIndex > 4
  ) {
    return false
  }
  if (typeof x.explanation !== 'string' || x.explanation.trim().length === 0) return false
  return true
}

function validateCrQuestionResponseResult(
  parsed: unknown,
  rawText: string,
): { ok: true } | { ok: false; stage: string } {
  const trimmed = rawText?.trim() ?? ''
  if (!trimmed) return { ok: false, stage: 'cr_empty_output' }
  if (parsed == null || typeof parsed !== 'object') return { ok: false, stage: 'cr_not_object' }
  if (!isValidCrQuestionResponse(parsed)) return { ok: false, stage: 'cr_invalid_shape' }
  return { ok: true }
}

function buildCrPrompt(args: { questionType: CrQuestionType }): string {
  const { questionType } = args
  return [
    'You are a GMAT verbal expert writing a Critical Reasoning question. Return JSON only.',
    '',
    'ARGUMENT LENGTH: 50-100 words. Real GMAT CR arguments are short, tight prose —',
    'typically one short paragraph. Do NOT write a passage. Do not add background, framing,',
    'or scene-setting beyond what the logic requires.',
    '',
    'CONCRETENESS / REALISM: Use concrete actors and scenarios — a publisher, a consultant,',
    'a city council, a researcher, a dealer; business, science, public-policy, or everyday',
    'domains. Plausible, modern, ground-level scenarios. No vague abstractions. No fictional',
    'names of real living people.',
    '',
    `QUESTION TYPE: ${questionType}`,
    '',
    'LOGICAL SPECIFICATION (must satisfy):',
    CR_TYPE_LOGIC_SPECS[questionType],
    '',
    `QUESTION STEM: use a stem in this style: "${CR_TYPE_STEMS[questionType]}". Phrasing may`,
    'vary slightly to fit the argument, but the role of the stem must match the type above.',
    '',
    'CONSTRUCTION ORDER (do not skip):',
    "1. First, identify the argument's core logical gap — the unstated link between the",
    '   premises and the conclusion.',
    "2. Then construct the correct answer so that it satisfies the question type's logical",
    '   role on that specific gap.',
    '3. Then construct four distractors that are topically relevant and superficially',
    '   plausible but each fail the logical job — by being unnecessary, irrelevant to the',
    '   link, or true-but-not-doing-the-work.',
    '',
    'SELF-CHECK (do before finalizing):',
    `- Does the correct answer satisfy the logical test for ${questionType}?`,
    '- For each distractor, confirm it FAILS that test.',
    '- The correct answer must be unambiguously the best; no distractor should also satisfy',
    '  the logical relationship.',
    '',
    'ANSWER CHOICE QUALITY:',
    CR_ANSWER_CHOICE_RULES,
    '',
    'EXPLANATION FORMAT:',
    CR_EXPLANATION_RULES,
    '',
    'PROHIBITIONS:',
    '- No "all of the above" / "none of the above" choices.',
    '- No questions about grammar or writing style.',
    '- correctIndex MUST be an integer 0-4.',
    '',
    'OUTPUT FORMAT: Return JSON only, no markdown, no code fences:',
    '{',
    `  "questionType": "${questionType}",`,
    '  "argument": "...",',
    '  "questionStem": "...",',
    '  "choices": ["...", "...", "...", "...", "..."],',
    '  "correctIndex": 0,',
    '  "explanation": "..."',
    '}',
  ].join('\n')
}

async function handleGenerateCrQuestion(body: any, _uid: string, res: any) {
  const questionType = parseCrQuestionType(body)
  const reqNonce = parseRcNonce(body)

  const openai = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') })
  const model = process.env.OPENAI_CR_MODEL ?? 'gpt-5'
  const reasoningEffort = ((process.env.OPENAI_CR_REASONING_EFFORT ?? 'medium') as
    | 'low'
    | 'medium'
    | 'high')
  const schema = buildCrQuestionJsonSchema()
  const basePrompt = buildCrPrompt({ questionType })

  const nonceTail = reqNonce
    ? `\n\nREQUEST_NONCE (vary scenario and angle; do not echo in JSON; no semantic load): "${escapeRcDoubleQuoted(reqNonce)}"`
    : ''

  type CrAttemptResult =
    | { ok: true; value: CrQuestionShape }
    | { ok: false; fail: 'parse' }
    | { ok: false; fail: 'validate'; stage: string }

  async function attempt(extra: string | null): Promise<CrAttemptResult> {
    const prompt = `${basePrompt}${nonceTail}${extra ? `\n\n${extra}` : ''}`
    const completion = await openai.responses.create({
      model,
      input: prompt,
      // 8000 leaves headroom for GPT-5 medium-effort reasoning tokens (which
      // count against this budget) plus the JSON output. First test at 2500
      // returned empty output_text on every attempt — reasoning ate the
      // whole budget. See plan iteration 1.
      max_output_tokens: 8000,
      reasoning: { effort: reasoningEffort },
      text: {
        format: {
          type: 'json_schema',
          name: 'cr_question',
          schema,
          strict: true,
        },
      },
    })
    const outputText = completion.output_text?.trim() ?? ''
    const parsed = parseRcModelJson(outputText)
    if (parsed == null) return { ok: false, fail: 'parse' }
    const vr = validateCrQuestionResponseResult(parsed, outputText)
    if (!vr.ok) return { ok: false, fail: 'validate', stage: vr.stage }
    return { ok: true, value: parsed as CrQuestionShape }
  }

  const first = await attempt(null)
  if (first.ok) {
    redistributeCorrectPositions([first.value])
    res.status(200).json(first.value)
    return
  }

  const second = await attempt(
    `STRICT: Conform exactly to the JSON schema. Argument 50-100 words. Five non-empty choices. questionType must be "${questionType}". Return only the JSON object.`,
  )
  if (second.ok) {
    redistributeCorrectPositions([second.value])
    res.status(200).json(second.value)
    return
  }

  const third = await attempt(
    `FINAL ATTEMPT: Return only the JSON object matching the schema. questionType: "${questionType}".`,
  )
  if (third.ok) {
    redistributeCorrectPositions([third.value])
    res.status(200).json(third.value)
    return
  }

  const last = third
  const code = last.fail === 'parse' ? 'CR_PARSE' : 'CR_VALIDATE'
  const payload: Record<string, unknown> = {
    error: 'AI could not generate a valid CR question',
    code,
  }
  if (last.fail === 'validate') {
    payload.validationStage = last.stage
  }
  res.status(502).json(payload)
}

// =====================================================================
// Diagnostic — vision parse of GMAT Official Diagnostic screenshots
// =====================================================================
//
// User uploads a section screenshot; OpenAI vision returns a structured
// array of rows. STRUCTURAL validation only — the user verifies semantic
// correctness in the UI before commit. Same lesson as RC/CR: brittle
// content validators cause 502s with no recovery.

const DIAGNOSTIC_SECTIONS: ReadonlyArray<DiagnosticSection> = ['verbal', 'quant', 'di'] as const

function isDiagnosticSection(v: unknown): v is DiagnosticSection {
  return typeof v === 'string' && (DIAGNOSTIC_SECTIONS as readonly string[]).includes(v)
}

function parseDiagnosticSection(body: any): DiagnosticSection {
  const v = body?.section
  if (isDiagnosticSection(v)) return v
  throw new Error("section must be one of: 'verbal', 'quant', 'di'")
}

function parseDiagnosticImageBase64(body: any): string {
  const v = body?.imageBase64
  if (typeof v !== 'string' || v.trim().length === 0) {
    throw new Error('imageBase64 must be a non-empty string')
  }
  // Strip data URL prefix if the caller included it; we add our own.
  const cleaned = v.replace(/^data:[^;]+;base64,/, '')
  if (cleaned.length < 100) throw new Error('imageBase64 looks too small to be an image')
  if (cleaned.length > 8_000_000) throw new Error('imageBase64 is too large (>~6 MB decoded)')
  return cleaned
}

function parseDiagnosticImageMimeType(body: any): string {
  const v = body?.imageMimeType
  if (typeof v !== 'string' || !v) return 'image/png'
  const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  if (!allowed.includes(v)) return 'image/png'
  return v
}

function buildDiagnosticParseSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['rows'],
    properties: {
      rows: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'question',
            'responseTimeMinutes',
            'performance',
            'questionType',
            'contentDomain',
            'fundamentalSkill',
          ],
          properties: {
            question: { type: 'integer', minimum: 1, maximum: 50 },
            responseTimeMinutes: { type: 'number', minimum: 0, maximum: 30 },
            performance: { type: 'string', enum: ['correct', 'incorrect'] },
            questionType: { type: 'string' },
            contentDomain: { type: ['string', 'null'] },
            fundamentalSkill: { type: ['string', 'null'] },
          },
        },
      },
    },
  }
}

function buildDiagnosticParsePrompt(section: DiagnosticSection): string {
  const sectionLabel =
    section === 'verbal' ? 'Verbal' : section === 'quant' ? 'Quant' : 'Data Insights'

  const columnSpec =
    section === 'verbal'
      ? [
          'COLUMNS (Verbal):',
          '- Question: integer (1..N)',
          '- Response Time: decimal minutes (e.g. 2.49)',
          '- Performance: "Correct" or "Incorrect" — read the WORD, not the color',
          '- Question Type: one of "Critical Reasoning", "Reading Comprehension"',
          '- Fundamental Skills: one of "Identify Inferred Idea", "Identify Stated Idea",',
          '  "Plan/Construct", "Analysis/Critique"',
          '- Verbal has NO Content Domain column — return contentDomain: null on every row',
        ].join('\n')
      : section === 'quant'
        ? [
            'COLUMNS (Quant):',
            '- Question: integer (1..N)',
            '- Response Time: decimal minutes',
            '- Performance: "Correct" or "Incorrect"',
            '- Content Domain: one of "Algebra", "Arithmetic"',
            '- Question Type: the column immediately to the right of Content Domain',
            '- Fundamental Skills: one of "Value/Order/Factors", "Equal/Unequal/ALG",',
            '  "Rates/Ratios/Percent", "Counting/Sets/Series/Prob/Stats"',
          ].join('\n')
        : [
            'COLUMNS (Data Insights):',
            '- Question: integer (1..N)',
            '- Response Time: decimal minutes',
            '- Performance: "Correct" or "Incorrect"',
            '- Content Domain: one of "Math Related", "Non-Math Related"',
            '- Question Type: one of "Data Sufficiency", "Two-part analysis", "Graphs and Tables",',
            '  "Multi-source reasoning"',
            '- DI has NO Fundamental Skills column — return fundamentalSkill: null on every row',
          ].join('\n')

  return [
    `You are parsing a GMAT Official Diagnostic screenshot for the ${sectionLabel} section.`,
    'The screenshot shows a "Question Performance and Time Management" table.',
    '',
    columnSpec,
    '',
    'INSTRUCTIONS:',
    '- Read the table row by row, in the order it appears.',
    '- Return EVERY row. Do not skip rows or merge cells.',
    '- Map any column the section does not have to null (contentDomain for Verbal,',
    '  fundamentalSkill for DI).',
    '- Performance: read the text "Correct" or "Incorrect". Output lowercase "correct" or',
    '  "incorrect". The cell may be color-coded (red for Incorrect) — trust the WORD.',
    '- Response Time is in minutes (decimal). If you see "2:30" interpret as 2.5.',
    '- Trim whitespace in string fields. Preserve case as printed (e.g. "Identify Inferred Idea").',
    '- If a row is partially unreadable, still emit it with your best reading; the user will',
    '  verify and fix.',
    '',
    'Return JSON only (no markdown, no code fences), matching the supplied JSON schema.',
  ].join('\n')
}

async function handleParseDiagnostic(body: any, _uid: string, res: any) {
  const section = parseDiagnosticSection(body)
  const imageBase64 = parseDiagnosticImageBase64(body)
  const mimeType = parseDiagnosticImageMimeType(body)

  const openai = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') })
  const model = process.env.OPENAI_DIAGNOSTIC_MODEL ?? 'gpt-4.1'
  const schema = buildDiagnosticParseSchema()
  const prompt = buildDiagnosticParsePrompt(section)
  const dataUrl = `data:${mimeType};base64,${imageBase64}`

  type ParseAttempt =
    | { ok: true; rows: unknown[] }
    | { ok: false; fail: 'parse' }
    | { ok: false; fail: 'validate'; stage: string }

  async function attempt(extra: string | null): Promise<ParseAttempt> {
    const fullPrompt = extra ? `${prompt}\n\n${extra}` : prompt
    const completion = await openai.responses.create({
      model,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: fullPrompt },
            { type: 'input_image', image_url: dataUrl, detail: 'high' },
          ] as any,
        },
      ] as any,
      temperature: 0.1,
      max_output_tokens: 4000,
      text: {
        format: {
          type: 'json_schema',
          name: 'diagnostic_rows',
          schema,
          strict: true,
        },
      },
    })
    const outputText = completion.output_text?.trim() ?? ''
    const parsed = parseRcModelJson(outputText)
    if (parsed == null || typeof parsed !== 'object') return { ok: false, fail: 'parse' }
    const rowsAny = (parsed as { rows?: unknown }).rows
    if (!Array.isArray(rowsAny)) return { ok: false, fail: 'validate', stage: 'rows_not_array' }
    if (rowsAny.length === 0) return { ok: false, fail: 'validate', stage: 'rows_empty' }
    // Strict-mode schema guarantees per-row shape if the model returned JSON
    // at all; one defensive scan in case the model emits past-schema.
    for (let i = 0; i < rowsAny.length; i += 1) {
      const r = rowsAny[i] as Record<string, unknown> | null
      if (!r || typeof r !== 'object') {
        return { ok: false, fail: 'validate', stage: `row_${i}_not_object` }
      }
      if (typeof r.question !== 'number' || !Number.isFinite(r.question)) {
        return { ok: false, fail: 'validate', stage: `row_${i}_bad_question` }
      }
      if (
        typeof r.responseTimeMinutes !== 'number' ||
        !Number.isFinite(r.responseTimeMinutes)
      ) {
        return { ok: false, fail: 'validate', stage: `row_${i}_bad_time` }
      }
      if (r.performance !== 'correct' && r.performance !== 'incorrect') {
        return { ok: false, fail: 'validate', stage: `row_${i}_bad_performance` }
      }
      if (typeof r.questionType !== 'string' || r.questionType.trim().length === 0) {
        return { ok: false, fail: 'validate', stage: `row_${i}_bad_type` }
      }
    }
    return { ok: true, rows: rowsAny }
  }

  const first = await attempt(null)
  let final: ParseAttempt = first
  if (!first.ok) {
    const second = await attempt(
      'STRICT: Output JSON only matching the supplied schema. Include EVERY row. Performance must be lowercase "correct" or "incorrect".',
    )
    final = second
    if (!second.ok) {
      const third = await attempt(
        'FINAL ATTEMPT: Return the JSON object {"rows": [...]} with every row from the table.',
      )
      final = third
    }
  }

  if (!final.ok) {
    const code = final.fail === 'parse' ? 'DIAG_PARSE' : 'DIAG_VALIDATE'
    const payload: Record<string, unknown> = {
      error: 'Could not parse the diagnostic screenshot.',
      code,
    }
    if (final.fail === 'validate') payload.validationStage = final.stage
    res.status(502).json(payload)
    return
  }

  // Tag each row with its section so the client doesn't have to.
  const rows = final.rows.map((r) => ({ ...(r as object), section }))
  res.status(200).json({ rows })
}

function normalizeQuizMode(raw: unknown): QuizMode {
  const m = typeof raw === 'string' ? raw.toLowerCase().trim() : ''
  if (m === 'verbal' || m === 'gmat') return 'verbal'
  if (m === 'context' || m === 'meaning') return 'context'
  return 'context'
}

async function handleGenerateQuiz(body: any, uid: string, res: any) {
  const mode: QuizMode = normalizeQuizMode(body?.mode)

  const rawIds = Array.isArray(body?.itemIds) ? body.itemIds : []
  const itemIds = rawIds.map((x: unknown) => String(x)).filter(Boolean)
  const count =
    typeof body?.count === 'number' && body.count > 0 && body.count <= 50
      ? body.count
      : itemIds.length

  if (!itemIds.length) {
    res.status(400).json({ error: 'itemIds must be a non-empty array of strings' })
    return
  }

  const fs = admin.firestore()
  const itemsSnap = await fs.getAll(
    ...itemIds.map((id: string) =>
      fs.doc(`users/${uid}/words/${id}`),
    ),
  )

  const items: { id: string; text: string; definition: string }[] = []
  itemsSnap.forEach((snap, idx) => {
    if (!snap.exists) return
    const data = snap.data() as any
    const id = itemIds[idx]
    const text: string =
      typeof data.text === 'string' && data.text.trim()
        ? data.text
        : typeof (data as any).word === 'string' && (data as any).word.trim()
          ? (data as any).word
          : id
    let definition = ''
    if (typeof data.simpleDefinition === 'string' && data.simpleDefinition.trim()) {
      definition = data.simpleDefinition.trim()
    } else if (typeof data.definition === 'string' && data.definition.trim()) {
      definition = data.definition.trim()
    } else if (
      data.result &&
      typeof data.result.simpleDefinition === 'string' &&
      data.result.simpleDefinition.trim()
    ) {
      definition = String(data.result.simpleDefinition).trim()
    } else if (
      data.result &&
      typeof data.result.definition === 'string' &&
      data.result.definition.trim()
    ) {
      definition = String(data.result.definition).trim()
    } else if (data.result && Array.isArray(data.result.definitions) && data.result.definitions[0]) {
      definition = String(data.result.definitions[0])
    }
    items.push({ id, text, definition })
  })

  if (!items.length) {
    res.status(400).json({ error: 'No valid items found for provided itemIds' })
    return
  }

  const limitedItems = items.slice(0, count)

  const openai = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') })
  const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini'

  const modeBlock =
    mode === 'context'
      ? [
          'MODE: context (Meaning in Context).',
          'For each item, write a stem that feels like GMAT Verbal: one or more formal sentences (longer stems are encouraged when they improve realism).',
          'The item text may appear in the stem or be the focus of the question. Prefer sentence completion (blank) OR "which choice best captures how X is used" / meaning-in-context in an analytical passage.',
          'Avoid bare dictionary prompts ("What does X mean?") unless the stem still reads as a serious verbal item.',
        ].join('\n')
      : [
          'MODE: verbal (GMAT-Style Verbal).',
          'For each item, emphasize sentence completion, critical-reasoning-adjacent vocabulary, and analytical register.',
          'Stems may be multi-sentence when that improves realism. The item must be tested in a way that mirrors official GMAT verbal difficulty.',
        ].join('\n')

  const prompt = [
    'You are an expert GMAT Verbal content author. Generate multiple-choice questions for graduate-level vocabulary practice.',
    '',
    'OUTPUT: Return JSON ONLY. No markdown, no code fences, no commentary before or after the JSON.',
    'Shape: {"questions":[{"itemId":"string","questionText":"string","options":["a","b","c","d"],"correctIndex":0,"explanation":"string"}]}',
    'Each question object MUST have: itemId, questionText, options (exactly 4 strings), correctIndex (0-3), explanation.',
    '',
    'GLOBAL RULES:',
    '- Tone: serious, academic, exam-oriented. No casual or playful wording.',
    '- One question per vocabulary item, in the SAME ORDER as the numbered items below.',
    '- Each itemId in your output must match the id given for that position.',
    '- Exactly four options per question; exactly one is unambiguously correct.',
    '- Wrong answers must be plausible: subtle distinctions, parallel grammar, and similar register—not silly, jokey, or obviously wrong.',
    '- questionText may be long when useful; avoid artificial verbosity.',
    '- Vary stem structure across the batch (do not reuse the same template for every question).',
    '- explanation: plain text, no markdown. State why the correct option fits and briefly why the others are weaker (formal tone).',
    '- Do not include the words "Option A/B/C/D" in questionText; embed choices only in the options array.',
    '',
    modeBlock,
    '',
    'ITEMS (use definition as reference for the intended sense; do not copy it verbatim as the stem):',
    ...limitedItems.map(
      (it, idx) =>
        `${idx + 1}. id=${it.id}; text=${it.text}; definition=${it.definition || 'N/A'}`,
    ),
  ].join('\n')

  const completion = await openai.responses.create({
    model,
    input: prompt,
    temperature: 0.55,
    max_output_tokens: 2200,
  })

  const text = completion.output_text?.trim() ?? ''
  let parsed: { questions?: QuizQuestion[] } | null = null
  try {
    parsed = JSON.parse(text) as { questions?: QuizQuestion[] }
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      parsed = JSON.parse(text.slice(start, end + 1)) as { questions?: QuizQuestion[] }
    }
  }

  if (!parsed || !Array.isArray(parsed.questions) || !parsed.questions.length) {
    res.status(502).json({ error: 'AI response did not contain questions' })
    return
  }

  const sanitized: QuizQuestion[] = parsed.questions
    .map((q) => ({
      itemId: String(q.itemId ?? ''),
      questionText: String(q.questionText ?? '').trim(),
      options: Array.isArray(q.options)
        ? q.options.map((o) => String(o)).slice(0, 4)
        : [],
      correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : 0,
      explanation: String(q.explanation ?? '').trim(),
    }))
    .filter(
      (q) =>
        q.itemId &&
        q.questionText &&
        Array.isArray(q.options) &&
        q.options.length === 4,
    )

  if (!sanitized.length) {
    res.status(502).json({ error: 'AI response questions were invalid' })
    return
  }

  const shuffled = sanitized.map(shuffleQuizOptions)

  res.status(200).json({ questions: shuffled })
}

declare global {
  // eslint-disable-next-line no-var
  var __rate: Map<string, number[]> | undefined
}

