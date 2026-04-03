import type { GeneratedResult, QuizMode, QuizQuestion, VocabItem } from '@shared/types'
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
  return (await res.json()) as GeneratedResult
}

export async function generateParagraph(items: VocabItem[]) {
  const baseUrl = requireFunctionsBaseUrl()
  const res = await fetch(`${baseUrl}/generateParagraph`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      items: items.map((it) => ({
        text: it.text,
        type: it.type,
        definition: it.definition,
        simpleDefinition: it.simpleDefinition,
      })),
    }),
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
  const raw = await generateQuiz(itemIds, 'meaning', itemIds.length)
  return shuffleQuizQuestions(raw)
}
