import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { RcAttempt, RcQuestionType } from '../../shared/rcTypes'
import { createRcAttempt, getRcAttempt } from '../lib/rcAttempts'
import { generateRcPassage } from '../lib/rcGeneration'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { McqOption } from '../components/ui/McqOption'
import { Alert } from '../components/ui/Alert'
import { StatBlock } from '../components/ui/StatBlock'
import { GenerationLoader } from '../components/GenerationLoader'
import { RC_LOADING_MESSAGES } from '../lib/loadingMessages'

const QUESTION_TYPE_LABELS: Record<RcQuestionType, string> = {
  main_idea: 'Main idea',
  inference: 'Inference',
  detail: 'Detail',
  function: 'Function',
  tone: 'Tone',
  application: 'Application',
}

export function RcReviewPage() {
  const { attemptId: rawId } = useParams<{ attemptId: string }>()
  const attemptId = rawId ?? ''
  const navigate = useNavigate()
  const [attempt, setAttempt] = useState<RcAttempt | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [practicingAgain, setPracticingAgain] = useState(false)

  useEffect(() => {
    if (!attemptId) {
      setError('Missing attempt id.')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const a = await getRcAttempt(attemptId)
        if (cancelled) return
        if (!a) {
          setError('Attempt not found.')
          return
        }
        setAttempt(a)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load attempt.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [attemptId])

  const stats = useMemo(() => {
    const qs = attempt?.questions ?? []
    let correct = 0
    let totalSeconds = 0
    let answered = 0
    for (const q of qs) {
      if (typeof q.userAnswerIndex === 'number') answered += 1
      if (typeof q.userAnswerIndex === 'number' && q.userAnswerIndex === q.correctIndex) {
        correct += 1
      }
      if (typeof q.timeSeconds === 'number') totalSeconds += q.timeSeconds
    }
    const total = qs.length
    const avgSeconds = answered > 0 ? Math.round(totalSeconds / answered) : 0
    return { correct, total, totalSeconds, avgSeconds }
  }, [attempt])

  async function onPracticeAgain() {
    if (!attempt) return
    setPracticingAgain(true)
    setError(null)
    try {
      const passage = await generateRcPassage({
        difficulty: attempt.difficulty,
        topic: attempt.topic,
      })
      const newAttemptId = await createRcAttempt(passage)
      navigate(`/exam/rc/practice/${newAttemptId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start a new practice.')
      setPracticingAgain(false)
    }
  }

  if (error) {
    return (
      <div
        className="container"
        style={{ paddingTop: 'var(--space-3xl)', paddingBottom: 'var(--space-3xl)' }}
      >
        <h1 className="text-headword" style={{ margin: 0 }}>
          Review
        </h1>
        <Alert variant="error" style={{ marginTop: 'var(--space-lg)' }}>
          {error}
        </Alert>
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <PrimaryButton onClick={() => navigate('/exam')}>Back to exam hub</PrimaryButton>
        </div>
      </div>
    )
  }

  if (!attempt) {
    return (
      <div
        className="container"
        style={{ paddingTop: 'var(--space-3xl)', paddingBottom: 'var(--space-3xl)' }}
      >
        <div className="muted">Loading…</div>
      </div>
    )
  }

  if (practicingAgain) {
    return (
      <div
        className="container"
        style={{ paddingTop: 'var(--space-3xl)', paddingBottom: 'var(--space-3xl)', maxWidth: 720 }}
      >
        <div className="card" style={{ padding: 'var(--card-pad-comfortable)' }}>
          <GenerationLoader
            title="Generating a new passage"
            messages={RC_LOADING_MESSAGES}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className="container"
      style={{ paddingTop: 'var(--space-2xl)', paddingBottom: 'var(--space-4xl)', maxWidth: 880 }}
    >
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <h1 className="text-page-title" style={{ margin: 0 }}>
          Review
        </h1>
        <p className="muted text-body" style={{ margin: 'var(--space-xs) 0 0' }}>
          {attempt.topic} · {attempt.difficulty}
        </p>
      </div>

      <div
        className="card"
        style={{
          padding: 'var(--card-pad-comfortable)',
          marginBottom: 'var(--space-xl)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 'var(--space-md)',
        }}
      >
        <StatBlock label="Accuracy" value={`${stats.correct} / ${stats.total}`} />
        <StatBlock label="Avg / question" value={formatSeconds(stats.avgSeconds)} />
        <StatBlock label="Total time" value={formatSeconds(stats.totalSeconds)} />
      </div>

      <div className="muted text-label" style={{ marginBottom: 'var(--space-md)' }}>
        Questions (in order)
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
        {attempt.questions.map((q, i) => {
          const userIdx = typeof q.userAnswerIndex === 'number' ? q.userAnswerIndex : null
          const isCorrect = userIdx != null && userIdx === q.correctIndex
          return (
            <div
              key={i}
              className="card"
              style={{
                padding: 'var(--card-pad-comfortable)',
                display: 'grid',
                gap: 'var(--space-md)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-sm)',
                  flexWrap: 'wrap',
                }}
              >
                <span className="muted text-label">
                  Question {i + 1} of {attempt.questions.length}
                </span>
                <span
                  className="text-label"
                  style={{
                    padding: '2px var(--space-xs)',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--selection-fill)',
                    color: 'color-mix(in srgb, var(--accent-gradient-end) 75%, var(--text))',
                    textTransform: 'uppercase',
                  }}
                >
                  {QUESTION_TYPE_LABELS[q.type] ?? q.type}
                </span>
                <CorrectnessChip
                  state={userIdx == null ? 'unanswered' : isCorrect ? 'correct' : 'wrong'}
                />
                {typeof q.timeSeconds === 'number' ? (
                  <span className="muted text-label">{formatSeconds(q.timeSeconds)}</span>
                ) : null}
              </div>
              <div
                className="text-section"
                style={{ fontWeight: 600, lineHeight: 'var(--leading-normal)' }}
              >
                {q.questionText}
              </div>
              <div style={{ display: 'grid', gap: 'var(--space-xs)' }}>
                {q.choices.map((c, ci) => {
                  const isUser = userIdx === ci
                  const isAnswer = q.correctIndex === ci
                  const state = isAnswer ? 'correct' : isUser ? 'incorrect' : 'default'
                  return (
                    <McqOption
                      key={ci}
                      letter={String.fromCharCode(65 + ci)}
                      state={state}
                      disabled
                      label={
                        <span>
                          {c}
                          {isUser && !isAnswer ? (
                            <span
                              className="muted text-body-sm"
                              style={{
                                marginLeft: 'var(--space-xs)',
                                fontStyle: 'italic',
                              }}
                            >
                              your answer
                            </span>
                          ) : null}
                          {isAnswer ? (
                            <span
                              className="text-body-sm"
                              style={{
                                marginLeft: 'var(--space-xs)',
                                color: 'var(--success-on-soft)',
                                fontWeight: 600,
                              }}
                            >
                              correct
                            </span>
                          ) : null}
                        </span>
                      }
                    />
                  )
                })}
              </div>
              <div
                className="text-body-sm"
                style={{
                  lineHeight: 'var(--leading-relaxed)',
                  color: 'var(--muted)',
                  background: 'var(--fill-subtle)',
                  padding: 'var(--space-md) var(--space-lg)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                }}
              >
                {q.explanation}
              </div>
            </div>
          )
        })}
      </div>

      <div
        style={{
          marginTop: 'var(--space-2xl)',
          display: 'flex',
          gap: 'var(--space-md)',
          flexWrap: 'wrap',
        }}
      >
        <PrimaryButton
          onClick={onPracticeAgain}
          disabled={practicingAgain}
          loading={practicingAgain}
        >
          {practicingAgain ? 'Generating…' : 'Practice again'}
        </PrimaryButton>
        <button
          type="button"
          className="btn text-body"
          onClick={() => navigate('/exam')}
          style={{
            padding: 'var(--space-md) var(--space-xl)',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            background: 'transparent',
            color: 'var(--muted)',
          }}
        >
          Back to exam hub
        </button>
      </div>
    </div>
  )
}

function CorrectnessChip({ state }: { state: 'correct' | 'wrong' | 'unanswered' }) {
  if (state === 'correct') {
    return (
      <span
        className="text-label"
        style={{
          padding: '2px var(--space-xs)',
          borderRadius: 'var(--radius-pill)',
          background: 'var(--success-soft)',
          color: 'var(--success-on-soft)',
          textTransform: 'uppercase',
        }}
      >
        ✓ Correct
      </span>
    )
  }
  if (state === 'wrong') {
    return (
      <span
        className="text-label"
        style={{
          padding: '2px var(--space-xs)',
          borderRadius: 'var(--radius-pill)',
          background: 'var(--danger-soft)',
          color: 'var(--danger-text)',
          textTransform: 'uppercase',
        }}
      >
        ✗ Incorrect
      </span>
    )
  }
  return (
    <span
      className="muted text-label"
      style={{
        padding: '2px var(--space-xs)',
        borderRadius: 'var(--radius-pill)',
        border: '1px solid var(--border)',
        textTransform: 'uppercase',
      }}
    >
      Skipped
    </span>
  )
}

function formatSeconds(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return '0s'
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r === 0 ? `${m}m` : `${m}m ${r}s`
}
