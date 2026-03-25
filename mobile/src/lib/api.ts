import type { GeneratedResult, QuizMode, QuizQuestion, VocabItem } from '@shared/types'
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

export async function generateWord(text: string): Promise<GeneratedResult> {
  const baseUrl = requireFunctionsBaseUrl()
  const res = await fetch(`${baseUrl}/generate`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ text: text.trim() }),
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

/** Parallel prefetch — all session MCQs before the user advances (no per-step API wait). */
export async function prefetchSessionMeaningQuestions(params: {
  reviewIds: string[]
  newIds: string[]
  quizIds: string[]
}): Promise<{
  review: QuizQuestion[]
  newWords: QuizQuestion[]
  quiz: QuizQuestion[]
}> {
  const { reviewIds, newIds, quizIds } = params
  const [review, newWords, quiz] = await Promise.all([
    reviewIds.length > 0 ? generateQuiz(reviewIds, 'meaning', reviewIds.length) : Promise.resolve([] as QuizQuestion[]),
    newIds.length > 0 ? generateQuiz(newIds, 'meaning', newIds.length) : Promise.resolve([] as QuizQuestion[]),
    quizIds.length > 0 ? generateQuiz(quizIds, 'meaning', quizIds.length) : Promise.resolve([] as QuizQuestion[]),
  ])
  return { review, newWords, quiz }
}
