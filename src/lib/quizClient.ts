import { shuffleQuizQuestions } from '../../shared/quizShuffle'
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

/** One batch of meaning MCQs; client-shuffles options for correct answer position. */
export async function fetchMeaningQuestionsForBatch(itemIds: string[]): Promise<QuizQuestion[]> {
  if (itemIds.length === 0) return []
  const raw = await fetchMeaningQuestions(itemIds, itemIds.length)
  return shuffleQuizQuestions(raw)
}
