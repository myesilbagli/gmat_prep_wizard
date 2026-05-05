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
import type { RcDifficulty } from '../../shared/rcTypes'

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
  { secrets: ['OPENAI_API_KEY'] },
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

    const url = req.url ?? '/'

    try {
      const token = getBearerToken(req.headers.authorization)
      if (!token) {
        res.status(401).json({ error: 'Missing Authorization bearer token' })
        return
      }

      const decoded = await admin.auth().verifyIdToken(token)

      if (url.startsWith('/generateQuiz')) {
        await handleGenerateQuiz(req.body as any, decoded.uid, res)
        return
      }

      if (url.startsWith('/generateParagraph')) {
        await handleGenerateParagraph(req.body as any, decoded.uid, res)
        return
      }

      // RC routes must come BEFORE /generate, since /generate is a prefix-match
      // catch-all in this router and would otherwise swallow them.
      if (url.startsWith('/generateRcPassage')) {
        await handleGenerateRcPassage(req.body as any, decoded.uid, res)
        return
      }

      if (url.startsWith('/generate')) {
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

function countTargets(parts: ParagraphPart[]): Map<string, number> {
  const m = new Map<string, number>()
  parts.forEach((p) => {
    if (p.kind !== 'target') return
    const k = p.text
    m.set(k, (m.get(k) ?? 0) + 1)
  })
  return m
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
    'TARGETS: Each listed target appears EXACTLY once, EXACT spelling. Targets must be',
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
  const lengthHint = parseParagraphOptionalField(body, 'lengthHint', 120)
  const { focusedIndex, totalPassages } = parseFocusedPassageMeta(body)

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

  const lengthTail =
    lengthHint && lengthHint.length > 0
      ? `\n\nLENGTH HINT (authoritative for density, still respect 150-200 words): ${lengthHint}`
      : ''

  function textPartsContainNoTargets(parts: ParagraphPart[]): boolean {
    for (const p of parts) {
      if (p.kind !== 'text') continue
      for (const t of targets) {
        if (p.value.includes(t)) return false
      }
    }
    return true
  }

  async function attempt(extra: string | null): Promise<ParagraphResponse | null> {
    const prompt = `${basePrompt}${lengthTail}${extra ? `\n\n${extra}` : ''}`
    const completion = await openai.responses.create({
      model,
      input: prompt,
      temperature: 0.5,
      max_output_tokens: 1500,
    })
    const outputText = completion.output_text?.trim() ?? ''
    const parsed = parseJsonFromOutputText<unknown>(outputText)
    if (!isValidParagraphResponse(parsed)) return null

    const counts = countTargets(parsed.parts)
    for (const t of targets) {
      if ((counts.get(t) ?? 0) !== 1) return null
    }
    // ensure no extra targets not in list (helps keep UI consistent)
    for (const [k] of counts.entries()) {
      if (!targets.includes(k)) return null
    }

    // Ensure targets are interleaved, not duplicated inside a big text blob.
    if (!textPartsContainNoTargets(parsed.parts)) return null

    return parsed
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

const RC_DIFFICULTY_SPEC: Record<RcDifficulty, string> = {
  easy: [
    'WORD COUNT: 350-380 words.',
    'PARAGRAPH COUNT: exactly 2 paragraphs.',
    'VOCABULARY: standard academic; advanced terms only when load-bearing.',
    'SENTENCE LENGTH: average 18-25 words; mix shorter and longer.',
    'TOPIC SCOPE: business cases, accessible science, social science.',
    'ARGUMENT: clear thesis + 1-2 supporting points + 1 qualification.',
  ].join('\n'),
  medium: [
    'WORD COUNT: 380-420 words.',
    'PARAGRAPH COUNT: 2-3 paragraphs.',
    'VOCABULARY: standard academic with some advanced terms.',
    'SENTENCE LENGTH: average 22-32 words; at least one sentence with two embedded clauses.',
    'TOPIC SCOPE: any GMAT-appropriate domain.',
    'ARGUMENT: thesis + multiple supporting points + counterargument + nuanced conclusion.',
  ].join('\n'),
  hard: [
    'WORD COUNT: 400-450 words.',
    'PARAGRAPH COUNT: exactly 3 paragraphs.',
    'VOCABULARY: dense academic, abstract terms, specialized when relevant.',
    'SENTENCE LENGTH: average 28-40 words with embedded clauses.',
    'TOPIC SCOPE: philosophy of science, complex policy debates, abstract economics, dense humanities.',
    'ARGUMENT: layered claims, multiple competing views, careful hedging, no clean resolution.',
  ].join('\n'),
}

const RC_WORD_COUNT_BOUNDS: Record<RcDifficulty, { min: number; max: number }> = {
  easy: { min: 333, max: 399 },
  medium: { min: 361, max: 441 },
  hard: { min: 380, max: 472 },
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

function isValidRcPassageResponse(x: any, expected: RcDifficulty): x is RcPassageResponseShape {
  if (!x || typeof x !== 'object') return false
  if (typeof x.passage !== 'string' || x.passage.trim().length === 0) return false
  if (!Array.isArray(x.paragraphs)) return false
  if (x.paragraphs.length < 2 || x.paragraphs.length > 3) return false
  if (!x.paragraphs.every((p: any) => typeof p === 'string' && p.trim().length > 0)) return false
  if (typeof x.topic !== 'string') return false
  const topicTrimmed = x.topic.trim()
  if (topicTrimmed.length === 0 || topicTrimmed.length > 100) return false
  if (x.difficulty !== expected) return false
  return true
}

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
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
    'style of a scholarly journal article. Produce ONE multi-paragraph passage. Return JSON only.',
    '',
    'REGISTER: GMAT academic-analytical voice. NOT journalistic. NOT essayistic.',
    'NOT textbook-explanatory. Think scholarly journal article.',
    '',
    'STRUCTURE:',
    '- Opening paragraph: establish a thesis, prevailing view, or central premise.',
    '- Middle paragraph(s): introduce evidence, complications, counterpoints, or qualifications.',
    '- Closing: hedge or qualify — RC passages rarely commit fully to one side.',
    '- Use blank-line paragraph breaks so structure is visible in the rendered passage.',
    '',
    'SENTENCE CONSTRUCTION:',
    '- Use concessive/contrastive connectives: notwithstanding, albeit, insofar as,',
    '  to the extent that, although, yet, however.',
    '- Prefer abstract noun-phrase subjects ("the prevailing assumption") over personal',
    '  subjects ("people think").',
    '- Academic hedging expected: "tend to", "appears to", "has been argued that".',
    '- Each paragraph must contain at least one subordinate or relative clause.',
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

/**
 * Sequential early-return guards so a future contributor can relax or add a
 * single rule without restructuring the function.
 */
function validateRcPassageResponse(
  parsed: unknown,
  args: { difficulty: RcDifficulty; topic?: string },
  rawText: string,
): boolean {
  const trimmed = rawText?.trim() ?? ''
  if (!trimmed) return false
  if (parsed == null || typeof parsed !== 'object') return false
  if (!isValidRcPassageResponse(parsed, args.difficulty)) return false

  const ok = parsed as RcPassageResponseShape

  const joined = ok.paragraphs.join(' ').replace(/\s+/g, ' ').trim()
  const passageNorm = ok.passage.replace(/\s+/g, ' ').trim()
  if (joined !== passageNorm) return false

  if (args.difficulty === 'easy' && ok.paragraphs.length !== 2) return false
  if (args.difficulty === 'hard' && ok.paragraphs.length !== 3) return false

  const wc = countWords(ok.passage)
  const bounds = RC_WORD_COUNT_BOUNDS[args.difficulty]
  if (wc < bounds.min || wc > bounds.max) return false

  if (/\b(?:I|me|my|we|our|us)\b/i.test(ok.passage)) return false
  if (/\b(?:you|your|yours)\b/i.test(ok.passage)) return false

  if (/^(in this passage|this essay|this passage|we will|let us|let's)/i.test(ok.passage.trim())) {
    return false
  }

  const lines = ok.passage.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.some((l) => /^[-*•]/.test(l) || /^\d+\.\s/.test(l))) return false

  if (
    !/\b(?:however|yet|although|notwithstanding|albeit|insofar as|to the extent that|whereas|nonetheless|nevertheless)\b/i.test(
      ok.passage,
    )
  ) {
    return false
  }

  return true
}

async function handleGenerateRcPassage(body: any, _uid: string, res: any) {
  const difficulty = parseRcDifficulty(body)
  const topic = parseRcTopic(body)
  const domain = parseParagraphOptionalField(body, 'domain', 80)
  const reqNonce = parseRcNonce(body)

  const openai = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') })
  const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini'

  const basePrompt = buildRcPassagePrompt({ difficulty, topic, domain })

  const topicEnforcement =
    topic && topic.length > 0
      ? `\n\nTOPIC ENFORCEMENT (adds to TOPIC; does not relax JSON rules): A reader skimming the passage must recognize it as substantively about: "${escapeRcDoubleQuoted(topic)}". Do not substitute an unrelated subject.`
      : ''

  const nonceTail = reqNonce
    ? `\n\nREQUEST_NONCE (vary wording and angle; do not echo in JSON; no semantic load): "${escapeRcDoubleQuoted(reqNonce)}"`
    : ''

  async function attempt(extra: string | null): Promise<RcPassageResponseShape | null> {
    const prompt = `${basePrompt}${topicEnforcement}${nonceTail}${extra ? `\n\n${extra}` : ''}`
    const completion = await openai.responses.create({
      model,
      input: prompt,
      temperature: 0.68,
      max_output_tokens: 2500,
    })
    const outputText = completion.output_text?.trim() ?? ''
    const parsed = parseJsonFromOutputText<unknown>(outputText)
    if (!validateRcPassageResponse(parsed, { difficulty, topic }, outputText)) {
      return null
    }
    return parsed as RcPassageResponseShape
  }

  const first = await attempt(null)
  if (first) {
    res.status(200).json(first)
    return
  }

  const second = await attempt(
    'STRICT: Output must satisfy every constraint in the DIFFICULTY block (word count, paragraph count, pronoun bans, no meta-text, at least one concessive connective). Return only the JSON object.',
  )
  if (second) {
    res.status(200).json(second)
    return
  }

  res.status(502).json({ error: 'AI could not generate a valid RC passage' })
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

