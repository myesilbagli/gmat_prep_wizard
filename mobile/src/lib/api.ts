import type { GeneratedResult, QuizMode, QuizQuestion, VocabItem } from '@shared/types'
import { normalizeGeneratedResultFromApi } from '@shared/wordGeneration'
import { shuffleQuizQuestions } from '@shared/quizShuffle'
import { auth } from './firebase'
import { requireFunctionsBaseUrl } from './env'

async function authHeaders() {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Please sign in first.')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

export async function generateWord(text: string, mainLanguage?: string): Promise<GeneratedResult> {
  const baseUrl = requireFunctionsBaseUrl()
  const res = await fetch(`${baseUrl}/generate`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ text: text.trim(), mainLanguage: mainLanguage ?? 'en' }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(err || `Request failed (${res.status})`)
  }
  return normalizeGeneratedResultFromApi(await res.json())
}

export type GenerateParagraphOptions = {
  domain?: string
  difficulty?: string
  lengthHint?: string
  theme?: string
  focusedIndex?: number
  totalPassages?: number
}

export async function generateParagraph(items: VocabItem[], options?: GenerateParagraphOptions) {
  const payload: Record<string, unknown> = {
    items: items.map((it) => ({
      text: it.text,
      type: it.type,
      definition: it.definition,
      simpleDefinition: it.simpleDefinition,
    })),
  }
  if (options?.domain?.trim()) payload.domain = options.domain.trim()
  if (options?.difficulty?.trim()) payload.difficulty = options.difficulty.trim()
  if (options?.lengthHint?.trim()) payload.lengthHint = options.lengthHint.trim()
  if (options?.theme?.trim()) payload.theme = options.theme.trim()
  if (typeof options?.focusedIndex === 'number' && Number.isInteger(options.focusedIndex)) {
    payload.focusedIndex = options.focusedIndex
  }
  if (typeof options?.totalPassages === 'number' && Number.isInteger(options.totalPassages)) {
    payload.totalPassages = options.totalPassages
  }

  const baseUrl = requireFunctionsBaseUrl()
  const res = await fetch(`${baseUrl}/generateParagraph`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(err || `Request failed (${res.status})`)
  }
  return (await res.json()) as {
    parts: Array<{ kind: 'text'; value: string } | { kind: 'target'; text: string }>
  }
}

export async function generateQuiz(itemIds: string[], mode: QuizMode, count: number) {
  const baseUrl = requireFunctionsBaseUrl()
  const res = await fetch(`${baseUrl}/generateQuiz`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ itemIds, mode, count }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(err || `Request failed (${res.status})`)
  }
  const data = (await res.json()) as { questions?: QuizQuestion[] }
  return data.questions ?? []
}

/** One batch of meaning MCQs; client-shuffles options for correct answer position. */
export async function fetchMeaningQuestionsForBatch(itemIds: string[]): Promise<QuizQuestion[]> {
  if (itemIds.length === 0) return []
  const raw = await generateQuiz(itemIds, 'context', itemIds.length)
  return shuffleQuizQuestions(raw)
}
