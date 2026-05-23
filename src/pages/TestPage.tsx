import { useEffect, useMemo, useState } from 'react'
import { MASTERED_MIN_SCORE } from '../../shared/exposureScore'
import type { QuizMode } from '../../shared/types'
import { applyQuizAnswerExposure, listVocabItems, type VocabItem } from '../lib/vocab'
import { IconPlay } from '../components/Icons'
import { SelectableTile } from '../components/ui/SelectableTile'
import { McqOption } from '../components/ui/McqOption'
import { StatBlock } from '../components/ui/StatBlock'

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
    const active = items.filter((i) => i.exposureScore < MASTERED_MIN_SCORE)
    return shuffle(active).slice(0, count)
  }, [items, count])

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
    const q = questions[currentIndex]
    if (q) {
      const correct = quizPicked === q.correctIndex
      void applyQuizAnswerExposure(q.itemId, correct).catch(() => {})
    }
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
    <div
      className="container"
      style={{ paddingTop: 'var(--space-2xl)', paddingBottom: 'var(--space-3xl)' }}
    >
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <h1 className="text-page-title" style={{ margin: 0 }}>
          GMAT practice
        </h1>
        <p className="muted text-body-lg" style={{ margin: 'var(--space-xs) 0 0' }}>
          Exam-style verbal questions from your deck. Learning items first; mastered words fill
          when needed.
        </p>
      </div>

      <div
        className="card"
        style={{
          padding: 'var(--card-pad-comfortable)',
          marginBottom: 'var(--space-xl)',
          display: 'grid',
          gap: 'var(--space-xl)',
        }}
      >
        <div>
          <div className="muted text-label" style={{ marginBottom: 'var(--space-xs)' }}>
            Section type
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <SelectableTile
              layout="tile"
              label="Meaning in Context"
              sublabel="Formal stems: blanks, usage, and meaning in analytical passages."
              selected={mode === 'context'}
              onClick={() => setMode('context')}
            />
            <SelectableTile
              layout="tile"
              label="GMAT-Style Verbal"
              sublabel="Sentence completion and verbal reasoning–style vocabulary."
              selected={mode === 'verbal'}
              onClick={() => setMode('verbal')}
            />
          </div>
        </div>

        <div>
          <div className="muted text-label" style={{ marginBottom: 'var(--space-xs)' }}>
            Number of questions
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
            {[5, 10, 20, 50].map((n) => (
              <SelectableTile
                key={n}
                layout="pill"
                label={String(n)}
                selected={count === n}
                onClick={() => setCount(n)}
                style={{ width: 'auto', display: 'inline-flex', alignItems: 'center' }}
              />
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
              gap: 'var(--space-xs)',
            }}
          >
            <IconPlay style={{ flexShrink: 0 }} />
            {starting ? 'Starting…' : 'Begin section'}
          </button>
          <p className="muted text-body-sm" style={{ margin: 'var(--space-sm) 0 0' }}>
            Estimated duration: ~{estimatedMinutes} minute{estimatedMinutes === 1 ? '' : 's'}
          </p>
        </div>

        {loadingItems && (
          <p className="muted text-body-sm" style={{ margin: 0 }}>
            Loading saved items…
          </p>
        )}
        {loadError && (
          <p className="text-body-sm" style={{ margin: 0, color: 'var(--danger)' }}>{loadError}</p>
        )}
        {quizError && (
          <p className="text-body-sm" style={{ margin: 0, color: 'var(--danger)' }}>{quizError}</p>
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
            gap: 'var(--space-md)',
            marginTop: 'var(--space-xs)',
          }}
        >
          <div
            className="card"
            style={{ padding: 'var(--card-pad-compact)', textAlign: 'center' }}
          >
            <StatBlock label="Previous accuracy" value="—" />
          </div>
          <div
            className="card"
            style={{ padding: 'var(--card-pad-compact)', textAlign: 'center' }}
          >
            <StatBlock label="Daily streak" value="—" />
          </div>
          <div
            className="card"
            style={{ padding: 'var(--card-pad-compact)', textAlign: 'center' }}
          >
            <StatBlock label="Words mastered" value="—" />
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
    <div
      className="card"
      style={{ padding: 'var(--card-pad-compact)', display: 'grid', gap: 'var(--space-md)' }}
    >
      <div className="muted text-body-sm">
        Question {index + 1} of {total}
      </div>
      <div className="text-body" style={{ fontWeight: 600, lineHeight: 'var(--leading-normal)' }}>
        {question.questionText}
      </div>
      {runSub === 'mcq' ? (
        <div style={{ display: 'grid', gap: 'var(--space-xs)' }}>
          {question.options.map((opt, i) => (
            <McqOption
              key={i}
              label={opt}
              letter={String.fromCharCode(65 + i)}
              onClick={() => props.onPickOption(i)}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
          <div className="text-body">
            {quizPicked === question.correctIndex ? (
              <span style={{ fontWeight: 700, color: 'var(--success)' }}>Correct.</span>
            ) : (
              <span>
                <span style={{ fontWeight: 700 }}>Incorrect.</span> Correct:{' '}
                <span style={{ fontWeight: 700 }}>{question.options[question.correctIndex]}</span>
              </span>
            )}
          </div>
          <div className="muted text-body">{question.explanation}</div>
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
    <div
      className="card"
      style={{
        padding: 'var(--card-pad-compact)',
        marginTop: 'var(--space-md)',
        display: 'grid',
        gap: 'var(--space-md)',
      }}
    >
      <div>
        <div style={{ fontWeight: 600 }}>Section complete</div>
        <div className="muted text-body-sm">
          Score: {correctCount} / {total}
        </div>
      </div>

      <button type="button" className="btn btnPrimary" onClick={props.onRestart}>
        New section
      </button>

      <div style={{ fontWeight: 600, marginTop: 'var(--space-2xs)' }}>Review</div>
      <div style={{ display: 'grid', gap: 'var(--space-xs)' }}>
        {questions.map((q, idx) => {
          const userAnswer = answers[idx]
          const correct = userAnswer === q.correctIndex
          return (
            <div
              key={idx}
              className="text-body-sm"
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-sm)',
              }}
            >
              <div style={{ fontWeight: 600 }}>{q.questionText}</div>
              <div className="muted" style={{ marginTop: 'var(--space-2xs)' }}>
                Your answer:{' '}
                {userAnswer != null ? q.options[userAnswer] ?? '—' : '—'} (
                {correct ? 'correct' : 'incorrect'})
              </div>
              <div className="muted">
                Correct answer: {q.options[q.correctIndex] ?? '—'}
              </div>
              <div className="muted" style={{ marginTop: 'var(--space-2xs)' }}>
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
