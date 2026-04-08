import { useEffect, useMemo, useState } from 'react'
import type { QuizMode } from '../../shared/types'
import { listVocabItems, recordWordExposure, type VocabItem } from '../lib/vocab'
import { IconPlay } from '../components/Icons'

type QuizQuestion = {
  itemId: string
  questionText: string
  options: string[]
  correctIndex: number
  explanation: string
}

type Phase = 'idle' | 'running' | 'finished'
type RunSub = 'mcq' | 'feedback'

export function TestPage() {
  const [items, setItems] = useState<VocabItem[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [mode, setMode] = useState<QuizMode>('context')
  const [count, setCount] = useState(10)
  const [phase, setPhase] = useState<Phase>('idle')
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [quizError, setQuizError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [runSub, setRunSub] = useState<RunSub>('mcq')
  const [quizPicked, setQuizPicked] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingItems(true)
      setLoadError(null)
      try {
        const next = await listVocabItems()
        if (!cancelled) setItems(next)
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Failed to load items')
        }
      } finally {
        if (!cancelled) setLoadingItems(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const candidateItems = useMemo(() => {
    const primary = items.filter((i) => i.status === 'learning')
    if (primary.length >= count) return shuffle(primary).slice(0, count)
    const secondary = items.filter((i) => i.status === 'mastered')
    return shuffle([...primary, ...secondary]).slice(0, count)
  }, [items, count])

  useEffect(() => {
    if (phase !== 'running' || questions.length === 0) return
    const q = questions[currentIndex]
    if (!q?.itemId) return
    void recordWordExposure(q.itemId).catch(() => {})
  }, [phase, currentIndex, questions])

  useEffect(() => {
    if (phase !== 'running') return
    setRunSub('mcq')
    setQuizPicked(null)
  }, [phase, currentIndex])

  async function startQuiz() {
    setQuizError(null)
    if (candidateItems.length === 0) {
      setQuizError('No saved items available to test yet.')
      return
    }
    setStarting(true)
    try {
      const baseUrl =
        (import.meta.env.VITE_FUNCTIONS_BASE_URL as string | undefined) ?? ''
      if (!baseUrl) throw new Error('Missing VITE_FUNCTIONS_BASE_URL')

      const res = await fetch(`${baseUrl}/generateQuiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getIdTokenOrThrow()}`,
        },
        body: JSON.stringify({
          itemIds: candidateItems.map((c) => c.id),
          mode,
          count,
        }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Quiz request failed (${res.status})`)
      }

      const json = (await res.json()) as { questions?: QuizQuestion[] }
      if (!json.questions || !Array.isArray(json.questions) || json.questions.length === 0) {
        throw new Error('Quiz response did not contain any questions.')
      }

      setQuestions(json.questions)
      setAnswers([])
      setCurrentIndex(0)
      setRunSub('mcq')
      setQuizPicked(null)
      setPhase('running')
    } catch (e) {
      setQuizError(e instanceof Error ? e.message : 'Failed to start section')
    } finally {
      setStarting(false)
    }
  }

  function handlePickOption(optionIndex: number) {
    if (phase !== 'running' || runSub !== 'mcq') return
    setQuizPicked(optionIndex)
    setRunSub('feedback')
  }

  function handleContinueAfterFeedback() {
    if (quizPicked === null || phase !== 'running') return
    const nextAnswers = [...answers]
    nextAnswers[currentIndex] = quizPicked
    setAnswers(nextAnswers)
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((i) => i + 1)
    } else {
      setPhase('finished')
    }
  }

  const currentQuestion = phase === 'running' ? questions[currentIndex] : null
  const correctCount =
    phase === 'finished'
      ? questions.reduce((acc, q, idx) => {
          const a = answers[idx]
          return acc + (a === q.correctIndex ? 1 : 0)
        }, 0)
      : 0

  const estimatedMinutes = Math.max(1, Math.ceil(count * 0.8))

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.3 }}>
          GMAT practice
        </h1>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 15 }}>
          Exam-style verbal questions from your deck. Learning items first; mastered words fill
          when needed.
        </p>
      </div>

      <div
        className="card"
        style={{
          padding: 20,
          marginBottom: 20,
          display: 'grid',
          gap: 20,
        }}
      >
        <div>
          <div
            className="muted"
            style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}
          >
            Section type
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button
              type="button"
              className="btn"
              onClick={() => setMode('context')}
              style={{
                padding: 16,
                textAlign: 'left',
                borderRadius: 14,
                border:
                  mode === 'context'
                    ? '2px solid var(--accent-gradient-end)'
                    : '1px solid var(--border)',
                background:
                  mode === 'context'
                    ? 'rgba(99, 102, 241, 0.12)'
                    : 'rgba(255,255,255,0.03)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                Meaning in Context
              </div>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.4 }}>
                Formal stems: blanks, usage, and meaning in analytical passages.
              </div>
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setMode('verbal')}
              style={{
                padding: 16,
                textAlign: 'left',
                borderRadius: 14,
                border:
                  mode === 'verbal'
                    ? '2px solid var(--accent-gradient-end)'
                    : '1px solid var(--border)',
                background:
                  mode === 'verbal'
                    ? 'rgba(99, 102, 241, 0.12)'
                    : 'rgba(255,255,255,0.03)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                GMAT-Style Verbal
              </div>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.4 }}>
                Sentence completion and verbal reasoning–style vocabulary.
              </div>
            </button>
          </div>
        </div>

        <div>
          <div
            className="muted"
            style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}
          >
            Number of questions
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[5, 10, 20, 50].map((n) => (
              <button
                key={n}
                type="button"
                className="btn"
                onClick={() => setCount(n)}
                style={{
                  padding: '10px 16px',
                  borderRadius: 999,
                  border:
                    count === n
                      ? '2px solid var(--accent-gradient-end)'
                      : '1px solid var(--border)',
                  background:
                    count === n
                      ? 'rgba(99, 102, 241, 0.18)'
                      : 'rgba(255,255,255,0.04)',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <button
            type="button"
            className="btn btnPrimary"
            disabled={starting || loadingItems}
            onClick={startQuiz}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 24px',
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            <IconPlay style={{ flexShrink: 0 }} />
            {starting ? 'Starting…' : 'Begin section'}
          </button>
          <p className="muted" style={{ margin: '10px 0 0', fontSize: 13 }}>
            Estimated duration: ~{estimatedMinutes} minute{estimatedMinutes === 1 ? '' : 's'}
          </p>
        </div>

        {loadingItems && (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Loading saved items…
          </p>
        )}
        {loadError && (
          <p style={{ margin: 0, color: 'var(--danger)', fontSize: 13 }}>{loadError}</p>
        )}
        {quizError && (
          <p style={{ margin: 0, color: 'var(--danger)', fontSize: 13 }}>{quizError}</p>
        )}
      </div>

      {phase === 'running' && currentQuestion && (
        <QuizQuestionView
          index={currentIndex}
          total={questions.length}
          question={currentQuestion}
          runSub={runSub}
          quizPicked={quizPicked}
          onPickOption={handlePickOption}
          onContinue={handleContinueAfterFeedback}
        />
      )}

      {phase === 'finished' && (
        <QuizSummary
          questions={questions}
          answers={answers}
          correctCount={correctCount}
          onRestart={() => setPhase('idle')}
        />
      )}

      {phase === 'idle' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
            marginTop: 8,
          }}
        >
          <div
            className="card"
            style={{ padding: 14, textAlign: 'center' }}
          >
            <div className="muted" style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
              Previous accuracy
            </div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>—</div>
          </div>
          <div
            className="card"
            style={{ padding: 14, textAlign: 'center' }}
          >
            <div className="muted" style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
              Daily streak
            </div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>—</div>
          </div>
          <div
            className="card"
            style={{ padding: 14, textAlign: 'center' }}
          >
            <div className="muted" style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
              Words mastered
            </div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>—</div>
          </div>
        </div>
      )}
    </div>
  )
}

function QuizQuestionView(props: {
  index: number
  total: number
  question: QuizQuestion
  runSub: RunSub
  quizPicked: number | null
  onPickOption: (index: number) => void
  onContinue: () => void
}) {
  const { question, index, total, runSub, quizPicked } = props

  return (
    <div className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div className="muted" style={{ fontSize: 13 }}>
        Question {index + 1} of {total}
      </div>
      <div style={{ fontWeight: 600, lineHeight: 1.45 }}>{question.questionText}</div>
      {runSub === 'mcq' ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {question.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => props.onPickOption(i)}
              className="btn"
              style={{
                textAlign: 'left',
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.04)',
                fontSize: 14,
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 14 }}>
            {quizPicked === question.correctIndex ? (
              <span style={{ fontWeight: 700, color: 'var(--accent-2)' }}>Correct.</span>
            ) : (
              <span>
                <span style={{ fontWeight: 700 }}>Incorrect.</span> Correct:{' '}
                <span style={{ fontWeight: 700 }}>{question.options[question.correctIndex]}</span>
              </span>
            )}
          </div>
          <div className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
            {question.explanation}
          </div>
          <button type="button" className="btn btnPrimary" onClick={props.onContinue}>
            {index + 1 < total ? 'Continue' : 'View results'}
          </button>
        </div>
      )}
    </div>
  )
}

function QuizSummary(props: {
  questions: QuizQuestion[]
  answers: number[]
  correctCount: number
  onRestart: () => void
}) {
  const { questions, answers, correctCount } = props
  const total = questions.length

  return (
    <div className="card" style={{ padding: 16, marginTop: 12, display: 'grid', gap: 12 }}>
      <div>
        <div style={{ fontWeight: 600 }}>Section complete</div>
        <div className="muted" style={{ fontSize: 13 }}>
          Score: {correctCount} / {total}
        </div>
      </div>

      <button type="button" className="btn btnPrimary" onClick={props.onRestart}>
        New section
      </button>

      <div style={{ fontWeight: 600, marginTop: 4 }}>Review</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {questions.map((q, idx) => {
          const userAnswer = answers[idx]
          const correct = userAnswer === q.correctIndex
          return (
            <div
              key={idx}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 10,
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 600 }}>{q.questionText}</div>
              <div className="muted" style={{ marginTop: 4 }}>
                Your answer:{' '}
                {userAnswer != null ? q.options[userAnswer] ?? '—' : '—'} (
                {correct ? 'correct' : 'incorrect'})
              </div>
              <div className="muted">
                Correct answer: {q.options[q.correctIndex] ?? '—'}
              </div>
              <div className="muted" style={{ marginTop: 4 }}>
                {q.explanation}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

async function getIdTokenOrThrow(): Promise<string> {
  const { auth } = await import('../lib/firebase')
  const user = auth.currentUser
  if (!user) throw new Error('Please sign in to start a section.')
  return user.getIdToken()
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

