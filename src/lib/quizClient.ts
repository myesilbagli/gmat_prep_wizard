import { auth } from './firebase'
import type { QuizQuestion } from '../../shared/types'

async function getToken(): Promise<string> {
  const t = await auth.currentUser?.getIdToken()
  if (!t) throw new Error('Please sign in first.')
  return t
}

export async function fetchMeaningQuestions(
  itemIds: string[],
  count?: number,
): Promise<QuizQuestion[]> {
  const baseUrl =
    (import.meta.env.VITE_FUNCTIONS_BASE_URL as string | undefined) ?? ''
  if (!baseUrl) throw new Error('Missing VITE_FUNCTIONS_BASE_URL')
  const res = await fetch(`${baseUrl}/generateQuiz`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await getToken()}`,
    },
    body: JSON.stringify({
      itemIds,
      mode: 'meaning' as const,
      count: count ?? itemIds.length,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Quiz request failed (${res.status})`)
  }
  const json = (await res.json()) as { questions?: QuizQuestion[] }
  if (!json.questions?.length) throw new Error('No questions returned.')
  return json.questions
}

/** Load all meaning MCQs for a session up front (parallel batches) — no per-step latency. */
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
    reviewIds.length > 0 ? fetchMeaningQuestions(reviewIds, reviewIds.length) : Promise.resolve([] as QuizQuestion[]),
    newIds.length > 0 ? fetchMeaningQuestions(newIds, newIds.length) : Promise.resolve([] as QuizQuestion[]),
    quizIds.length > 0 ? fetchMeaningQuestions(quizIds, quizIds.length) : Promise.resolve([] as QuizQuestion[]),
  ])
  return { review, newWords, quiz }
}
