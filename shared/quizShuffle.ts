import type { QuizQuestion } from './types'

/** Randomize A–D so the correct answer is not always option A (models often bias to index 0). */
export function shuffleQuizQuestion(q: QuizQuestion): QuizQuestion {
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

export function shuffleQuizQuestions(questions: QuizQuestion[]): QuizQuestion[] {
  return questions.map(shuffleQuizQuestion)
}
