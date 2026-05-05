import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { RcAttempt, RcQuestionType } from '../../shared/rcTypes'
import { createRcAttempt, getRcAttempt } from '../lib/rcAttempts'
import { generateRcPassage } from '../lib/rcGeneration'

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
      <div className="container" style={{ paddingTop: 32, paddingBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Review</h1>
        <div
          role="alert"
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 10,
            border: '1px solid rgba(239, 68, 68, 0.4)',
            background: 'rgba(239, 68, 68, 0.08)',
            color: '#FCA5A5',
            fontSize: 14,
          }}
        >
          {error}
        </div>
        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn"
            onClick={() => navigate('/exam')}
            style={primaryButtonStyle()}
          >
            Back to exam hub
          </button>
        </div>
      </div>
    )
  }

  if (!attempt) {
    return (
      <div className="container" style={{ paddingTop: 32, paddingBottom: 32 }}>
        <div className="muted">Loading…</div>
      </div>
    )
  }

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 48, maxWidth: 880 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.3 }}>
          Review
        </h1>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>
          {attempt.topic} · {attempt.difficulty}
        </p>
      </div>

      <div
        className="card"
        style={{
          padding: 20,
          marginBottom: 20,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
        }}
      >
        <Stat label="Accuracy" value={`${stats.correct} / ${stats.total}`} />
        <Stat label="Avg / question" value={formatSeconds(stats.avgSeconds)} />
        <Stat label="Total time" value={formatSeconds(stats.totalSeconds)} />
      </div>

      <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
        Questions (in order)
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {attempt.questions.map((q, i) => {
          const userIdx = typeof q.userAnswerIndex === 'number' ? q.userAnswerIndex : null
          const isCorrect = userIdx != null && userIdx === q.correctIndex
          return (
            <div
              key={i}
              className="card"
              style={{
                padding: 18,
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.02)',
                display: 'grid',
                gap: 12,
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
              >
                <span
                  className="muted"
                  style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}
                >
                  Question {i + 1} of {attempt.questions.length}
                </span>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'rgba(99, 102, 241, 0.16)',
                    color: '#A5B4FC',
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {QUESTION_TYPE_LABELS[q.type] ?? q.type}
                </span>
                <CorrectnessChip
                  state={userIdx == null ? 'unanswered' : isCorrect ? 'correct' : 'wrong'}
                />
                {typeof q.timeSeconds === 'number' ? (
                  <span className="muted" style={{ fontSize: 12 }}>
                    {formatSeconds(q.timeSeconds)}
                  </span>
                ) : null}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4 }}>{q.questionText}</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {q.choices.map((c, ci) => {
                  const isUser = userIdx === ci
                  const isAnswer = q.correctIndex === ci
                  return (
                    <div
                      key={ci}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: isAnswer
                          ? '2px solid #22C55E'
                          : isUser
                            ? '2px solid #EF4444'
                            : '1px solid var(--border)',
                        background: isAnswer
                          ? 'rgba(34, 197, 94, 0.08)'
                          : isUser
                            ? 'rgba(239, 68, 68, 0.06)'
                            : 'rgba(255,255,255,0.02)',
                        fontSize: 14,
                        lineHeight: 1.45,
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          flex: '0 0 auto',
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          fontWeight: 700,
                          fontSize: 11,
                          color: isAnswer ? '#fff' : isUser ? '#fff' : 'var(--muted)',
                          background: isAnswer
                            ? '#22C55E'
                            : isUser
                              ? '#EF4444'
                              : 'transparent',
                          border: isAnswer || isUser ? 'none' : '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: 1,
                        }}
                      >
                        {String.fromCharCode(65 + ci)}
                      </span>
                      <span style={{ flex: 1 }}>
                        {c}
                        {isUser && !isAnswer ? (
                          <span
                            className="muted"
                            style={{ marginLeft: 8, fontSize: 12, fontStyle: 'italic' }}
                          >
                            your answer
                          </span>
                        ) : null}
                        {isAnswer ? (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 12,
                              color: '#86EFAC',
                              fontWeight: 600,
                            }}
                          >
                            correct
                          </span>
                        ) : null}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: 'var(--muted)',
                  background: 'rgba(255,255,255,0.02)',
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                }}
              >
                {q.explanation}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn"
          onClick={onPracticeAgain}
          disabled={practicingAgain}
          style={primaryButtonStyle(practicingAgain)}
        >
          {practicingAgain ? 'Generating…' : 'Practice again'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => navigate('/exam')}
          style={{
            padding: '12px 20px',
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 14,
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--muted)',
          }}
        >
          Back to exam hub
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  )
}

function CorrectnessChip({ state }: { state: 'correct' | 'wrong' | 'unanswered' }) {
  if (state === 'correct') {
    return (
      <span
        style={{
          padding: '2px 8px',
          borderRadius: 999,
          background: 'rgba(34, 197, 94, 0.16)',
          color: '#86EFAC',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        ✓ Correct
      </span>
    )
  }
  if (state === 'wrong') {
    return (
      <span
        style={{
          padding: '2px 8px',
          borderRadius: 999,
          background: 'rgba(239, 68, 68, 0.16)',
          color: '#FCA5A5',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        ✗ Incorrect
      </span>
    )
  }
  return (
    <span
      className="muted"
      style={{
        padding: '2px 8px',
        borderRadius: 999,
        border: '1px solid var(--border)',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
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
