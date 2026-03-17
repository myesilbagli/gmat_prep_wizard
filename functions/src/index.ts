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
  definitions: string[]
  examples: string[]
  synonyms: string[]
  antonyms: string[]
  notes: string
}

function normalizeWord(word: unknown): string {
  if (typeof word !== 'string') throw new Error('word must be a string')
  const w = word.trim()
  if (!w) throw new Error('word is required')
  if (w.length > 64) throw new Error('word is too long')
  if (!/^[a-zA-Z-']+$/.test(w)) throw new Error('word contains invalid characters')
  return w.toLowerCase()
}

function normalizeContext(context: unknown): string | undefined {
  if (context == null) return undefined
  if (typeof context !== 'string') throw new Error('context must be a string')
  const c = context.trim()
  if (!c) return undefined
  if (c.length > 400) throw new Error('context is too long')
  return c
}

export const api = onRequest(async (req, res) => {
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

  if (!req.url?.startsWith('/generate')) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  try {
    const token = getBearerToken(req.headers.authorization)
    if (!token) {
      res.status(401).json({ error: 'Missing Authorization bearer token' })
      return
    }

    // Verify Firebase ID token
    await admin.auth().verifyIdToken(token)

    const word = normalizeWord((req.body as any)?.word)
    const context = normalizeContext((req.body as any)?.context)

    // Basic per-IP rate limiting (best-effort, in-memory)
    // (For stronger limits/cost controls, store counters in Firestore/Redis.)
    const key = `${req.ip ?? 'unknown'}:${word}`
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
      `"definitions": string[] (2-4 concise definitions),`,
      `"examples": string[] (2-4 GMAT-style example sentences),`,
      `"synonyms": string[] (5-10),`,
      `"antonyms": string[] (3-8),`,
      `"notes": string (usage notes, common traps, nuance; 1-4 sentences).`,
      ``,
      `Word: ${word}`,
      context ? `Context: ${context}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    const completion = await openai.responses.create({
      model,
      input: prompt,
      temperature: 0.4,
      max_output_tokens: 450,
    })

    const text = completion.output_text?.trim() ?? ''
    let parsed: GeneratedResult | null = null
    try {
      parsed = JSON.parse(text) as GeneratedResult
    } catch {
      // Fall back: attempt to extract JSON substring
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      if (start >= 0 && end > start) {
        parsed = JSON.parse(text.slice(start, end + 1)) as GeneratedResult
      }
    }

    if (!parsed) {
      res.status(502).json({ error: 'AI response was not valid JSON' })
      return
    }

    res.status(200).json(parsed)
  } catch (e) {
    res.status(400).json({
      error: e instanceof Error ? e.message : 'Unknown error',
    })
  }
})

declare global {
  // eslint-disable-next-line no-var
  var __rate: Map<string, number[]> | undefined
}

