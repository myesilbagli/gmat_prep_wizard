import { useEffect, useMemo, useState } from 'react'
import { listVocabItems, type VocabItem } from '../lib/vocab'
import { IconPlay } from '../components/Icons'

type QuizMode = 'meaning' | 'gmat'

type QuizQuestion = {
  itemId: string
  questionText: string
  options: string[]
  correctIndex: number
  explanation: string
}

type Phase = 'idle' | 'running' | 'finished'

export function TestPage() {
  const [items, setItems] = useState<VocabItem[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [mode, setMode] = useState<QuizMode>('meaning')
  const [count, setCount] = useState(10)
  const [phase, setPhase] = useState<Phase>('idle')
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [quizError, setQuizError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

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
    const primary = items.filter(
      (i) => i.status === 'do_not_know' || i.status === 'learning',
    )
    if (primary.length >= count) return shuffle(primary).slice(0, count)
    const secondary = items.filter((i) => i.status === 'know')
    return shuffle([...primary, ...secondary]).slice(0, count)
  }, [items, count])

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
      setPhase('running')
    } catch (e) {
      setQuizError(e instanceof Error ? e.message : 'Failed to start quiz')
    } finally {
      setStarting(false)
    }
  }

  function handleAnswer(optionIndex: number) {
    if (phase !== 'running') return
    const nextAnswers = [...answers]
    nextAnswers[currentIndex] = optionIndex
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
          Practice Session
        </h1>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 15 }}>
          Configure your session to focus on specific GMAT verbal skills and expand your
          academic lexicon.
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
            Test type
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button
              type="button"
              className="btn"
              onClick={() => setMode('meaning')}
              style={{
                padding: 16,
                textAlign: 'left',
                borderRadius: 14,
                border:
                  mode === 'meaning'
                    ? '2px solid var(--accent-gradient-end)'
                    : '1px solid var(--border)',
                background:
                  mode === 'meaning'
                    ? 'rgba(99, 102, 241, 0.12)'
                    : 'rgba(255,255,255,0.03)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                Meaning Test
              </div>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.4 }}>
                Direct word-to-definition matching. Best for rapid recall.
              </div>
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setMode('gmat')}
              style={{
                padding: 16,
                textAlign: 'left',
                borderRadius: 14,
                border:
                  mode === 'gmat'
                    ? '2px solid var(--accent-gradient-end)'
                    : '1px solid var(--border)',
                background:
                  mode === 'gmat'
                    ? 'rgba(99, 102, 241, 0.12)'
                    : 'rgba(255,255,255,0.03)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                GMAT-style Test
              </div>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.4 }}>
                Contextual usage in complex sentence structures.
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
            {starting ? 'Starting…' : 'START TEST'}
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
          selected={answers[currentIndex]}
          onAnswer={handleAnswer}
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
  selected: number | undefined
  onAnswer: (index: number) => void
}) {
  const { question, index, total, selected } = props

  return (
    <div className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div className="muted" style={{ fontSize: 13 }}>
        Question {index + 1} of {total}
      </div>
      <div style={{ fontWeight: 600 }}>{question.questionText}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {question.options.map((opt, i) => {
          const isChosen = selected === i
          const isCorrect = i === question.correctIndex
          const showFeedback = selected !== undefined
          let border = '1px solid var(--border)'
          let background = 'rgba(255,255,255,0.04)'

          if (showFeedback) {
            if (isCorrect) {
              border = '1px solid var(--accent-2)'
            } else if (isChosen) {
              border = '1px solid var(--danger)'
            }
          } else if (isChosen) {
            border = '2px solid var(--accent-gradient-end)'
            background = 'rgba(99, 102, 241, 0.12)'
          }

          return (
            <button
              key={i}
              type="button"
              disabled={showFeedback}
              onClick={() => props.onAnswer(i)}
              className="btn"
              style={{
                textAlign: 'left',
                border,
                background,
                fontSize: 14,
              }}
            >
              {opt}
            </button>
          )
        })}
      </div>
      {selected !== undefined && (
        <div className="muted" style={{ fontSize: 13 }}>
          {selected === question.correctIndex ? 'Correct.' : 'Incorrect.'}{' '}
          {question.explanation}
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
        <div style={{ fontWeight: 600 }}>Test complete</div>
        <div className="muted" style={{ fontSize: 13 }}>
          Score: {correctCount} / {total}
        </div>
      </div>

      <button type="button" className="btn btnPrimary" onClick={props.onRestart}>
        New Test
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
  if (!user) throw new Error('Please sign in to start a test.')
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

