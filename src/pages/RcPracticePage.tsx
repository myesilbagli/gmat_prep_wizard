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
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { McqOption } from '../components/ui/McqOption'
import { Alert } from '../components/ui/Alert'
import { GenerationLoader } from '../components/GenerationLoader'
import { RC_LOADING_MESSAGES } from '../lib/loadingMessages'

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
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      <header
        style={{
          padding: 'var(--space-md) var(--space-lg)',
          background: 'var(--header-bg)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-md)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      >
        <button
          type="button"
          className="btn text-body-sm"
          onClick={() => navigate('/exam')}
          style={{
            background: 'transparent',
            padding: 'var(--space-2xs) var(--space-md)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--muted)',
            fontWeight: 600,
          }}
        >
          Exit
        </button>
        <div className="text-body" style={{ fontWeight: 700 }}>
          Reading Comprehension · {attempt?.difficulty ?? '…'}
        </div>
        <div className="muted text-body-sm">
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
            padding: 'var(--space-2xl)',
            overflowY: 'auto',
            borderLeft: '1px solid var(--border)',
            background: 'var(--fill-subtle)',
          }}
        >
          {phase === 'loading-attempt' && <CenteredMessage>Loading attempt…</CenteredMessage>}
          {phase === 'fatal-load-error' && (
            <CenteredMessage>
              <Alert variant="error" style={{ maxWidth: 360 }}>
                <strong>Couldn't load attempt.</strong>
                <div style={{ marginTop: 'var(--space-xs)' }}>{error}</div>
              </Alert>
              <div style={{ marginTop: 'var(--space-lg)' }}>
                <PrimaryButton onClick={() => navigate('/exam/rc/setup')}>
                  Back to setup
                </PrimaryButton>
              </div>
            </CenteredMessage>
          )}
          {phase === 'loading-questions' && (
            <GenerationLoader
              title="Generating your questions"
              messages={RC_LOADING_MESSAGES}
            />
          )}
          {phase === 'questions-error-retry' && (
            <CenteredMessage>
              <Alert variant="error" style={{ maxWidth: 360 }}>
                <strong>Couldn't generate questions.</strong>
                <div style={{ marginTop: 'var(--space-xs)' }}>{error}</div>
              </Alert>
              <div style={{ marginTop: 'var(--space-lg)' }}>
                <PrimaryButton onClick={onRetryQuestions}>Retry</PrimaryButton>
              </div>
            </CenteredMessage>
          )}
          {phase === 'questions-error-fatal' && generatingNewPassage && (
            <GenerationLoader
              title="Generating a new passage"
              messages={RC_LOADING_MESSAGES}
            />
          )}
          {phase === 'questions-error-fatal' && !generatingNewPassage && (
            <CenteredMessage>
              <Alert variant="error" style={{ maxWidth: 360 }}>
                <strong>Couldn't generate questions for this passage.</strong>
                <div style={{ marginTop: 'var(--space-xs)' }}>{error}</div>
              </Alert>
              <div
                style={{
                  marginTop: 'var(--space-lg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-sm)',
                  alignItems: 'center',
                }}
              >
                <PrimaryButton onClick={onGenerateNewPassage}>
                  Generate new passage
                </PrimaryButton>
                <button
                  type="button"
                  className="btn text-body"
                  onClick={() => navigate('/exam/rc/setup')}
                  style={{
                    background: 'transparent',
                    color: 'var(--muted)',
                    padding: 'var(--space-sm) var(--space-lg)',
                    borderRadius: 'var(--radius-md)',
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
        padding: 'var(--space-2xl)',
        overflowY: 'auto',
        background: 'var(--fill-subtle)',
      }}
    >
      <div className="muted text-label" style={{ marginBottom: 'var(--space-md)' }}>
        Passage
      </div>
      {paragraphs.length === 0 ? (
        <div className="muted text-body">Loading passage…</div>
      ) : (
        paragraphs.map((p, i) => (
          <p
            key={i}
            className="text-body-lg"
            style={{
              margin: '0 0 var(--space-lg)',
              lineHeight: 'var(--leading-relaxed)',
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
        className="muted text-label"
        style={{
          marginBottom: 'var(--space-md)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {QUESTION_TYPE_LABELS[question.type] ?? question.type}
      </div>
      <h2
        className="text-card-title"
        style={{ margin: '0 0 var(--space-lg)' }}
      >
        {question.questionText}
      </h2>
      <div role="radiogroup" style={{ display: 'grid', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
        {question.choices.map((choice, i) => {
          const selected = selectedIndex === i
          return (
            <McqOption
              key={i}
              label={choice}
              letter={String.fromCharCode(65 + i)}
              state={selected ? 'selected' : 'default'}
              onClick={() => onSelect(i)}
              disabled={isSubmitting}
            />
          )
        })}
      </div>
      {error ? (
        <Alert variant="error" style={{ marginBottom: 'var(--space-md)' }}>
          {error}
        </Alert>
      ) : null}
      <PrimaryButton
        onClick={onNext}
        disabled={selectedIndex == null || isSubmitting}
        loading={isSubmitting}
      >
        {isSubmitting ? 'Saving…' : isLast ? 'Finish' : 'Next'}
      </PrimaryButton>
    </div>
  )
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 'var(--space-4xl) var(--space-xl)',
        color: 'var(--text)',
      }}
    >
      {children}
    </div>
  )
}
