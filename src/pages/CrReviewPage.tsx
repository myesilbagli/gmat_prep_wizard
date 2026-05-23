import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { CrAttempt, CrAttemptQuestion, CrQuestionType } from '../../shared/crTypes'
import { getCrAttempt } from '../lib/crAttempts'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { McqOption } from '../components/ui/McqOption'
import { Alert } from '../components/ui/Alert'
import { StatBlock } from '../components/ui/StatBlock'
import {
  PASSAGE_LINE_HEIGHT,
  PASSAGE_MEASURE,
  PASSAGE_PARAGRAPH_GAP,
  getPassageFontSize,
} from '../lib/passageTypography'

const QUESTION_TYPE_LABEL: Record<CrQuestionType, string> = {
  assumption: 'Assumption',
  strengthen: 'Strengthen',
  weaken: 'Weaken',
  evaluate: 'Evaluate',
  inference: 'Inference',
  explain: 'Explain',
}

export function CrReviewPage() {
  const { attemptId: rawId } = useParams<{ attemptId: string }>()
  const attemptId = rawId ?? ''
  const navigate = useNavigate()
  const [attempt, setAttempt] = useState<CrAttempt | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!attemptId) {
      setError('Missing attempt id.')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const a = await getCrAttempt(attemptId)
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

  const perTypeStats = useMemo(() => {
    if (!attempt) return null
    const buckets = new Map<CrQuestionType, { correct: number; total: number; seconds: number }>()
    for (const q of attempt.questions) {
      const b = buckets.get(q.questionType) ?? { correct: 0, total: 0, seconds: 0 }
      b.total += 1
      if (q.isCorrect) b.correct += 1
      b.seconds += q.timeSeconds || 0
      buckets.set(q.questionType, b)
    }
    return Array.from(buckets.entries()).map(([t, b]) => ({
      type: t,
      correct: b.correct,
      total: b.total,
      seconds: b.seconds,
    }))
  }, [attempt])

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

  const score = attempt.score
  const total = attempt.questions.length
  const totalTime = attempt.totalTimeSeconds

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
          Critical Reasoning · {timerLabel(attempt.timerMode)}
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
        <StatBlock label="Score" value={`${score} / ${total}`} />
        <StatBlock
          label="Accuracy"
          value={`${Math.round((score / Math.max(1, total)) * 100)}%`}
        />
        <StatBlock label="Total time" value={formatSeconds(totalTime)} />
        <StatBlock
          label="Avg / question"
          value={formatSeconds(Math.round(totalTime / Math.max(1, total)))}
        />
      </div>

      {perTypeStats && perTypeStats.length > 0 ? (
        <div
          className="card"
          style={{
            padding: 'var(--card-pad-comfortable)',
            marginBottom: 'var(--space-xl)',
            display: 'grid',
            gap: 'var(--space-md)',
          }}
        >
          <div className="muted text-label">By type</div>
          <div style={{ display: 'grid', gap: 'var(--space-xs)' }}>
            {perTypeStats.map((s) => (
              <div
                key={s.type}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 'var(--space-md)',
                  padding: 'var(--space-xs) 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span className="text-body" style={{ fontWeight: 600 }}>
                  {QUESTION_TYPE_LABEL[s.type]}
                </span>
                <span className="muted text-body-sm">
                  {s.correct} / {s.total} · {formatSeconds(s.seconds)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="muted text-label" style={{ marginBottom: 'var(--space-md)' }}>
        Questions (in order)
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
        {attempt.questions.map((q, i) => (
          <ReviewQuestionCard key={i} index={i} total={total} q={q} />
        ))}
      </div>

      <div
        style={{
          marginTop: 'var(--space-2xl)',
          display: 'flex',
          gap: 'var(--space-md)',
          flexWrap: 'wrap',
        }}
      >
        <PrimaryButton onClick={() => navigate('/exam/cr/setup')}>New set</PrimaryButton>
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

function ReviewQuestionCard({
  index,
  total,
  q,
}: {
  index: number
  total: number
  q: CrAttemptQuestion
}) {
  const userIdx = q.userAnswerIndex
  const isCorrect = q.isCorrect
  const wasAnswered = userIdx != null

  return (
    <div
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
          Question {index + 1} of {total}
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
          {QUESTION_TYPE_LABEL[q.questionType]}
        </span>
        <CorrectnessChip
          state={!wasAnswered ? 'unanswered' : isCorrect ? 'correct' : 'wrong'}
        />
        <span className="muted text-label">{formatSeconds(q.timeSeconds)}</span>
      </div>

      <div style={{ maxWidth: PASSAGE_MEASURE }}>
        <p
          style={{
            margin: `0 0 ${PASSAGE_PARAGRAPH_GAP}`,
            fontSize: getPassageFontSize(q.argument),
            lineHeight: PASSAGE_LINE_HEIGHT,
            color: 'var(--text)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {q.argument}
        </p>
      </div>

      <div className="text-section" style={{ fontWeight: 600 }}>
        {q.questionStem}
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
                      style={{ marginLeft: 'var(--space-xs)', fontStyle: 'italic' }}
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
      Unanswered
    </span>
  )
}

function timerLabel(mode: CrAttempt['timerMode']): string {
  if (mode === '10min') return '10-minute set'
  if (mode === '5min') return '5-minute speed drill'
  return 'untimed'
}

function formatSeconds(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return '0s'
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r === 0 ? `${m}m` : `${m}m ${r}s`
}
