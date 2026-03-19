import { onRequest } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'
import * as admin from 'firebase-admin'
import OpenAI from 'openai'
import 'dotenv/config'

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

type GeneratedResult = {
  definition: string
  simpleDefinition: string
  exampleSentence?: string
  synonyms?: string[]
  nuanceNote?: string
  gmatUsageNote?: string

  // keep extra detail too
  definitions?: string[]
  examples?: string[]
}

type QuizMode = 'meaning' | 'gmat'

type QuizQuestion = {
  itemId: string
  questionText: string
  options: string[]
  correctIndex: number
  explanation: string
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

function inferType(text: string): 'word' | 'phrase' {
  return text.includes(' ') ? 'phrase' : 'word'
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

async function handleGenerate(body: any, ipKey: string, res: any) {
  // Back-compat: accept both { text } and { word } from older clients.
  const rawText = body?.text ?? body?.word
  const text = normalizeText(rawText)
  const type = inferType(text)

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
  const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini'

  const prompt = [
    `You are a GMAT verbal tutor.`,
    `Return a JSON object ONLY (no markdown) with keys:`,
    `"definition": string (clear, full definition; 1-2 sentences),`,
    `"simpleDefinition": string (short, easy; 2-6 words),`,
    `"exampleSentence": string (one natural, serious sentence),`,
    `"synonyms": string[] (2-4 good synonyms),`,
    `"nuanceNote": string (subtle shade/trap; 1-2 sentences),`,
    `"gmatUsageNote": string (how it appears in formal GMAT contexts; 1-2 sentences),`,
    `"definitions": string[] (optional: 2-4 concise definitions),`,
    `"examples": string[] (optional: 2-3 extra example sentences),`,
    ``,
    `Text: ${text}`,
    `Type: ${type}`,
  ]
    .filter(Boolean)
    .join('\n')

  const completion = await openai.responses.create({
    model,
    input: prompt,
    temperature: 0.4,
    max_output_tokens: 450,
  })

  const outputText = completion.output_text?.trim() ?? ''
  let parsed: GeneratedResult | null = null
  try {
    parsed = JSON.parse(outputText) as GeneratedResult
  } catch {
    const start = outputText.indexOf('{')
    const end = outputText.lastIndexOf('}')
    if (start >= 0 && end > start) {
      parsed = JSON.parse(outputText.slice(start, end + 1)) as GeneratedResult
    }
  }

  if (!parsed) {
    res.status(502).json({ error: 'AI response was not valid JSON' })
    return
  }

  res.status(200).json(parsed)
}

function normalizeParagraphItems(body: any): { text: string; type: 'word' | 'phrase' }[] {
  const raw = Array.isArray(body?.items) ? body.items : []
  const items = raw
    .map((x: any) => {
      const text = normalizeText(x?.text)
      const type: 'word' | 'phrase' =
        x?.type === 'phrase' || x?.type === 'word' ? x.type : inferType(text)
      return { text, type }
    })
    .slice(0, 5)

  if (!items.length) throw new Error('items must be a non-empty array')
  if (items.length > 5) throw new Error('items must contain at most 5 entries')
  return items
}

function parseJsonFromOutputText<T>(outputText: string): T | null {
  const t = outputText.trim()
  if (!t) return null
  try {
    return JSON.parse(t) as T
  } catch {
    const start = t.indexOf('{')
    const end = t.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1)) as T
      } catch {
        return null
      }
    }
    return null
  }
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

async function handleGenerateParagraph(body: any, uid: string, res: any) {
  const items = normalizeParagraphItems(body)
  const targets = items.map((it) => it.text)

  const openai = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') })
  const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini'

  const basePrompt = [
    `You are a GMAT verbal tutor.`,
    `Write ONE coherent, formal paragraph (about 80-140 words).`,
    `You MUST use each target exactly once, spelled exactly as provided (case and spacing).`,
    `Do NOT add quotes or brackets around targets.`,
    `CRITICAL: Targets must appear ONLY as {"kind":"target","text":"..."} parts, never inside any {"kind":"text","value":"..."} string.`,
    `So: split the paragraph into parts that interleave text and targets in reading order.`,
    `Return JSON ONLY (no markdown) with shape:`,
    `{"parts":[{"kind":"text","value":"..."},{"kind":"target","text":"<exact target>"}...]}`,
    ``,
    `Targets (use each exactly once):`,
    ...targets.map((t, i) => `${i + 1}. ${t}`),
  ].join('\n')

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
    const prompt = extra ? `${basePrompt}\n\n${extra}` : basePrompt
    const completion = await openai.responses.create({
      model,
      input: prompt,
      temperature: 0.5,
      max_output_tokens: 700,
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

async function handleGenerateQuiz(body: any, uid: string, res: any) {
  const rawMode = body?.mode
  const mode: QuizMode = rawMode === 'gmat' ? 'gmat' : 'meaning'

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

  const modeDescription =
    mode === 'meaning'
      ? 'meaning questions that ask for the correct definition of the word or phrase'
      : 'GMAT-style questions (sentence completion or meaning-in-context) that use the word or phrase in a short sentence'

  const prompt = [
    'You are a GMAT verbal tutor.',
    'You will receive a list of vocabulary items and must create multiple-choice quiz questions.',
    'Return JSON ONLY with the shape: { "questions": QuizQuestion[] } where QuizQuestion = { itemId: string, questionText: string, options: string[4], correctIndex: number, explanation: string }.',
    'Do NOT include any markdown, comments, or extra keys.',
    '',
    `Quiz mode: ${mode}`,
    `Mode description: ${modeDescription}.`,
    '',
    'Items:',
    ...limitedItems.map(
      (it, idx) =>
        `${idx + 1}. id=${it.id}; text=${it.text}; definition=${it.definition || 'N/A'}`,
    ),
    '',
    'Rules:',
    '- Create exactly one question per item in the same order.',
    '- For "meaning" mode, ask directly for the best definition.',
    '- For "gmat" mode, write a short, realistic GMAT-style sentence or sentence-completion using the item.',
    '- Each options array must have exactly 4 short, believable options.',
    '- correctIndex must be 0, 1, 2, or 3 and point to the only correct option.',
  ].join('\n')

  const completion = await openai.responses.create({
    model,
    input: prompt,
    temperature: 0.5,
    max_output_tokens: 800,
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

  res.status(200).json({ questions: sanitized })
}

declare global {
  // eslint-disable-next-line no-var
  var __rate: Map<string, number[]> | undefined
}

