import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { RcAttempt, RcQuestion, RcQuestionType } from '../../shared/rcTypes'
import {
  createRcAttempt,
  getRcAttempt,
  markRcAttemptComplete,
  recordQuestionAnswer,
  updateRcAttemptQuestions,
} from '../lib/rcAttempts'
import { generateRcPassage, generateRcQuestionSet } from '../lib/rcGeneration'

type PracticePhase =
  | 'loading-attempt'
  | 'loading-questions'
  | 'questions-error-retry'
  | 'questions-error-fatal'
  | 'reading'
  | 'submitting'
  | 'done'
  | 'fatal-load-error'

const QUESTION_TYPE_LABELS: Record<RcQuestionType, string> = {
  main_idea: 'Main idea',
  inference: 'Inference',
  detail: 'Detail',
  function: 'Function',
  tone: 'Tone',
  application: 'Application',
}

export function RcPracticePage() {
  const { attemptId: rawId } = useParams<{ attemptId: string }>()
  const attemptId = rawId ?? ''
  const navigate = useNavigate()

  const [attempt, setAttempt] = useState<RcAttempt | null>(null)
  const [questions, setQuestions] = useState<RcQuestion[] | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [phase, setPhase] = useState<PracticePhase>('loading-attempt')
  const [error, setError] = useState<string | null>(null)
  const [, setQuestionGenAttempts] = useState(0)
  const [generatingNewPassage, setGeneratingNewPassage] = useState(false)
  const questionStartedAtRef = useRef<number>(Date.now())

  // Hydrate the attempt doc on mount.
  useEffect(() => {
    if (!attemptId) {
      setPhase('fatal-load-error')
      setError('Missing attempt id.')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const a = await getRcAttempt(attemptId)
        if (cancelled) return
        if (!a) {
          setPhase('fatal-load-error')
          setError('Attempt not found.')
          return
        }
        setAttempt(a)
        if (a.questions && a.questions.length > 0) {
          setQuestions(a.questions as RcQuestion[])
          setCurrentIndex(0)
          questionStartedAtRef.current = Date.now()
          setPhase('reading')
        } else {
          setPhase('loading-questions')
        }
      } catch (e) {
        if (cancelled) return
        setPhase('fatal-load-error')
        setError(e instanceof Error ? e.message : 'Failed to load attempt.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [attemptId])

  // Whenever we enter loading-questions, fire Stage 2.
  useEffect(() => {
    if (phase !== 'loading-questions' || !attempt) return
    let cancelled = false
    ;(async () => {
      try {
        const expectedCount: 3 | 4 = attempt.difficulty === 'easy' ? 3 : 4
        const resp = await generateRcQuestionSet({
          passage: attempt.passage,
          paragraphs: attempt.paragraphs,
          topic: attempt.topic,
          difficulty: attempt.difficulty,
          questionCount: expectedCount,
        })
        if (cancelled) return
        await updateRcAttemptQuestions(attemptId, resp.questions)
        if (cancelled) return
        setQuestions(resp.questions)
        setCurrentIndex(0)
        questionStartedAtRef.current = Date.now()
        setError(null)
        setPhase('reading')
      } catch (e) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : 'Failed to generate questions.'
        setError(message)
        setQuestionGenAttempts((n) => {
          const next = n + 1
          setPhase(next >= 2 ? 'questions-error-fatal' : 'questions-error-retry')
          return next
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [phase, attempt, attemptId])

  function onRetryQuestions() {
    setError(null)
    setPhase('loading-questions')
  }

  async function onGenerateNewPassage() {
    if (!attempt) return
    setGeneratingNewPassage(true)
    setError(null)
    try {
      const passage = await generateRcPassage({
        difficulty: attempt.difficulty,
        topic: attempt.topic,
      })
      const newAttemptId = await createRcAttempt(passage)
      navigate(`/exam/rc/practice/${newAttemptId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start a new passage.')
      setGeneratingNewPassage(false)
    }
  }

  async function onNext() {
    if (!questions || selectedIndex == null || phase !== 'reading') return
    setPhase('submitting')
    const elapsedSeconds = Math.max(0, Math.round((Date.now() - questionStartedAtRef.current) / 1000))
    try {
      await recordQuestionAnswer(attemptId, currentIndex, selectedIndex, elapsedSeconds)
      const isLast = currentIndex >= questions.length - 1
      if (isLast) {
        await markRcAttemptComplete(attemptId)
        setPhase('done')
        navigate(`/exam/rc/review/${attemptId}`)
        return
      }
      setCurrentIndex((i) => i + 1)
      setSelectedIndex(null)
      questionStartedAtRef.current = Date.now()
      setPhase('reading')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save your answer.')
      setPhase('reading')
    }
  }

  const passageText = attempt?.passage ?? ''
  const currentQuestion = questions?.[currentIndex] ?? null
  const totalQuestions = questions?.length ?? (attempt?.difficulty === 'easy' ? 3 : 4)

  return (
    <div
      style={{
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg, #0A0A0F)',
        color: 'var(--text)',
      }}
    >
      <header
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          type="button"
          className="btn"
          onClick={() => navigate('/exam')}
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--muted)',
            padding: '6px 12px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Exit
        </button>
        <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: -0.2 }}>
          Reading Comprehension · {attempt?.difficulty ?? '…'}
        </div>
        <div className="muted" style={{ fontSize: 13 }}>
          {questions ? `Question ${currentIndex + 1} / ${totalQuestions}` : `1 / ${totalQuestions}`}
        </div>
      </header>

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 0,
          minHeight: 0,
        }}
      >
        <PassagePane passage={passageText} />
        <div
          style={{
            padding: 24,
            overflowY: 'auto',
            borderLeft: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.01)',
          }}
        >
          {phase === 'loading-attempt' && <CenteredMessage>Loading attempt…</CenteredMessage>}
          {phase === 'fatal-load-error' && (
            <CenteredMessage tone="error">
              <strong>Couldn't load attempt.</strong>
              <div style={{ marginTop: 8, fontSize: 13 }}>{error}</div>
              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => navigate('/exam/rc/setup')}
                  style={primaryButtonStyle()}
                >
                  Back to setup
                </button>
              </div>
            </CenteredMessage>
          )}
          {phase === 'loading-questions' && (
            <CenteredMessage>
              Generating questions…
              <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                Stage 2 typically takes 5-9 seconds.
              </div>
            </CenteredMessage>
          )}
          {phase === 'questions-error-retry' && (
            <CenteredMessage tone="error">
              <strong>Couldn't generate questions.</strong>
              <div style={{ marginTop: 8, fontSize: 13 }}>{error}</div>
              <div style={{ marginTop: 16 }}>
                <button type="button" className="btn" onClick={onRetryQuestions} style={primaryButtonStyle()}>
                  Retry
                </button>
              </div>
            </CenteredMessage>
          )}
          {phase === 'questions-error-fatal' && (
            <CenteredMessage tone="error">
              <strong>Couldn't generate questions for this passage.</strong>
              <div style={{ marginTop: 8, fontSize: 13 }}>{error}</div>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={onGenerateNewPassage}
                  disabled={generatingNewPassage}
                  style={primaryButtonStyle(generatingNewPassage)}
                >
                  {generatingNewPassage ? 'Generating new passage…' : 'Generate new passage'}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => navigate('/exam/rc/setup')}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--muted)',
                    padding: '10px 16px',
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  Back to setup
                </button>
              </div>
            </CenteredMessage>
          )}
          {(phase === 'reading' || phase === 'submitting') && currentQuestion ? (
            <QuestionPane
              question={currentQuestion}
              selectedIndex={selectedIndex}
              onSelect={(i) => phase === 'reading' && setSelectedIndex(i)}
              onNext={onNext}
              isSubmitting={phase === 'submitting'}
              isLast={!!questions && currentIndex >= questions.length - 1}
              error={error}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function PassagePane({ passage }: { passage: string }) {
  const paragraphs = useMemo(
    () => passage.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
    [passage],
  )
  return (
    <div
      style={{
        padding: 24,
        overflowY: 'auto',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
        Passage
      </div>
      {paragraphs.length === 0 ? (
        <div className="muted" style={{ fontSize: 14 }}>Loading passage…</div>
      ) : (
        paragraphs.map((p, i) => (
          <p
            key={i}
            style={{
              margin: '0 0 16px',
              fontSize: 15,
              lineHeight: 1.7,
              color: 'var(--text)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {p}
          </p>
        ))
      )}
    </div>
  )
}

type QuestionPaneProps = {
  question: RcQuestion
  selectedIndex: number | null
  onSelect: (i: number) => void
  onNext: () => void
  isSubmitting: boolean
  isLast: boolean
  error: string | null
}

function QuestionPane({
  question,
  selectedIndex,
  onSelect,
  onNext,
  isSubmitting,
  isLast,
  error,
}: QuestionPaneProps) {
  return (
    <div>
      <div
        className="muted"
        style={{
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 12,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        }}
      >
        {QUESTION_TYPE_LABELS[question.type] ?? question.type}
      </div>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, lineHeight: 1.4, marginBottom: 16 }}>
        {question.questionText}
      </h2>
      <div role="radiogroup" style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
        {question.choices.map((choice, i) => {
          const selected = selectedIndex === i
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(i)}
              disabled={isSubmitting}
              className="btn"
              style={{
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 10,
                border: selected
                  ? '2px solid var(--accent-gradient-end)'
                  : '1px solid var(--border)',
                background: selected ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255,255,255,0.03)',
                color: 'var(--text)',
                fontSize: 14,
                lineHeight: 1.45,
                cursor: isSubmitting ? 'progress' : 'pointer',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <span
                aria-hidden
                style={{
                  flex: '0 0 auto',
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  border: '1px solid var(--border)',
                  background: selected ? 'var(--accent-gradient-end)' : 'transparent',
                  color: selected ? '#fff' : 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  marginTop: 1,
                }}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span style={{ flex: 1 }}>{choice}</span>
            </button>
          )
        })}
      </div>
      {error ? (
        <div
          role="alert"
          style={{
            padding: 10,
            borderRadius: 8,
            border: '1px solid rgba(239, 68, 68, 0.4)',
            background: 'rgba(239, 68, 68, 0.08)',
            color: '#FCA5A5',
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      ) : null}
      <button
        type="button"
        className="btn"
        onClick={onNext}
        disabled={selectedIndex == null || isSubmitting}
        style={primaryButtonStyle(selectedIndex == null || isSubmitting)}
      >
        {isSubmitting ? 'Saving…' : isLast ? 'Finish' : 'Next'}
      </button>
    </div>
  )
}

function CenteredMessage({
  children,
  tone,
}: {
  children: React.ReactNode
  tone?: 'error'
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '40px 20px',
        color: tone === 'error' ? '#FCA5A5' : 'var(--text)',
      }}
    >
      {children}
    </div>
  )
}

function primaryButtonStyle(disabled = false): React.CSSProperties {
  return {
    padding: '12px 20px',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 15,
    background: disabled ? 'rgba(99,102,241,0.4)' : 'var(--accent-gradient-end, #6366f1)',
    color: '#fff',
    border: '1px solid transparent',
    cursor: disabled ? 'default' : 'pointer',
  }
}
