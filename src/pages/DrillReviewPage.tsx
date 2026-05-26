import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { RcAttempt } from '../../shared/rcTypes'
import type { CrAttempt } from '../../shared/crTypes'
import {
  ALL_VERBAL_SUBTYPES,
  type VerbalSubtypeKey,
} from '../../shared/verbalTaxonomy'
import { getRcAttempt } from '../lib/rcAttempts'
import { getCrAttempt } from '../lib/crAttempts'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { McqOption } from '../components/ui/McqOption'
import { Alert } from '../components/ui/Alert'
import { StatBlock } from '../components/ui/StatBlock'
import { renderInlineBold } from '../lib/inlineBold'

export function DrillReviewPage() {
  const { section: rawSection, attemptId: rawId } = useParams<{
    section: string
    attemptId: string
  }>()
  const navigate = useNavigate()
  const section = rawSection === 'rc' || rawSection === 'cr' ? rawSection : null
  const attemptId = rawId ?? ''

  const [rcAttempt, setRcAttempt] = useState<RcAttempt | null>(null)
  const [crAttempt, setCrAttempt] = useState<CrAttempt | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!section || !attemptId) {
      setError('Missing drill id.')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        if (section === 'rc') {
          const a = await getRcAttempt(attemptId)
          if (cancelled) return
          if (!a) { setError('Drill not found.'); return }
          setRcAttempt(a)
        } else {
          const a = await getCrAttempt(attemptId)
          if (cancelled) return
          if (!a) { setError('Drill not found.'); return }
          setCrAttempt(a)
        }
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load drill.')
      }
    })()
    return () => { cancelled = true }
  }, [section, attemptId])

  const stats = useMemo(() => {
    if (section === 'rc' && rcAttempt) {
      let correct = 0
      let total = 0
      let totalSeconds = 0
      let answered = 0
      for (const q of rcAttempt.questions) {
        total += 1
        if (typeof q.userAnswerIndex === 'number') answered += 1
        if (typeof q.userAnswerIndex === 'number' && q.userAnswerIndex === q.correctIndex) correct += 1
        if (typeof q.timeSeconds === 'number') totalSeconds += q.timeSeconds
      }
      return { correct, total, totalSeconds, avgSeconds: answered > 0 ? Math.round(totalSeconds / answered) : 0 }
    }
    if (section === 'cr' && crAttempt) {
      const total = crAttempt.questions.length
      const correct = crAttempt.score
      const totalSeconds = crAttempt.totalTimeSeconds
      return { correct, total, totalSeconds, avgSeconds: total > 0 ? Math.round(totalSeconds / total) : 0 }
    }
    return null
  }, [section, rcAttempt, crAttempt])

  const drillSubtypeKey: VerbalSubtypeKey | null = useMemo(() => {
    const raw = section === 'rc' ? rcAttempt?.drillSubtype : crAttempt?.drillSubtype
    if (raw && raw in ALL_VERBAL_SUBTYPES) return raw as VerbalSubtypeKey
    return null
  }, [section, rcAttempt, crAttempt])

  if (error) {
    return (
      <div className="container" style={{ paddingTop: 'var(--space-3xl)', paddingBottom: 'var(--space-3xl)' }}>
        <h1 className="text-page-title" style={{ margin: 0 }}>Drill review</h1>
        <Alert variant="error" style={{ marginTop: 'var(--space-lg)' }}>{error}</Alert>
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <PrimaryButton onClick={() => navigate('/test')}>Back to practice</PrimaryButton>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="container" style={{ paddingTop: 'var(--space-3xl)', paddingBottom: 'var(--space-3xl)' }}>
        <div className="muted">Loading…</div>
      </div>
    )
  }

  const subtypeLabel = drillSubtypeKey ? ALL_VERBAL_SUBTYPES[drillSubtypeKey].label : 'Drill'
  const sectionTitle = section === 'rc' ? 'Reading Comprehension' : 'Critical Reasoning'
  const accuracyPct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0

  return (
    <div
      className="container"
      style={{ paddingTop: 'var(--space-2xl)', paddingBottom: 'var(--space-4xl)', maxWidth: 880 }}
    >
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="muted text-label" style={{ marginBottom: 'var(--space-2xs)' }}>
          {sectionTitle}
        </div>
        <h1 className="text-page-title" style={{ margin: 0 }}>
          {subtypeLabel} drill — review
        </h1>
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
        <StatBlock label="Score" value={`${stats.correct} / ${stats.total}`} />
        <StatBlock label="Accuracy" value={`${accuracyPct}%`} />
        <StatBlock label="Total time" value={formatSeconds(stats.totalSeconds)} />
        <StatBlock label="Avg / question" value={formatSeconds(stats.avgSeconds)} />
      </div>

      <div className="muted text-label" style={{ marginBottom: 'var(--space-md)' }}>
        Questions (in order)
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
        {section === 'rc' && rcAttempt
          ? rcAttempt.questions.map((q, i) => {
              const userIdx = typeof q.userAnswerIndex === 'number' ? q.userAnswerIndex : null
              const isCorrect = userIdx != null && userIdx === q.correctIndex
              return (
                <ReviewCard
                  key={i}
                  index={i}
                  total={rcAttempt.questions.length}
                  typeLabel={q.type}
                  isCorrect={isCorrect}
                  userIdx={userIdx}
                  unanswered={userIdx == null}
                  stem={q.questionText}
                  choices={q.choices}
                  correctIndex={q.correctIndex}
                  explanation={q.explanation}
                  seconds={typeof q.timeSeconds === 'number' ? q.timeSeconds : null}
                />
              )
            })
          : null}
        {section === 'cr' && crAttempt
          ? crAttempt.questions.map((q, i) => {
              const userIdx = q.userAnswerIndex
              return (
                <ReviewCard
                  key={i}
                  index={i}
                  total={crAttempt.questions.length}
                  typeLabel={q.questionType}
                  isCorrect={q.isCorrect}
                  userIdx={userIdx}
                  unanswered={userIdx == null}
                  argument={q.argument}
                  stem={q.questionStem}
                  choices={q.choices}
                  correctIndex={q.correctIndex}
                  explanation={q.explanation}
                  seconds={q.timeSeconds}
                />
              )
            })
          : null}
      </div>

      <div
        style={{
          marginTop: 'var(--space-2xl)',
          display: 'flex',
          gap: 'var(--space-md)',
          flexWrap: 'wrap',
        }}
      >
        <PrimaryButton onClick={() => navigate('/test')}>Back to practice</PrimaryButton>
        {drillSubtypeKey ? (
          <button
            type="button"
            className="btn text-body"
            onClick={() => navigate(`/test/drill/${drillSubtypeKey}`)}
            style={{
              padding: 'var(--space-md) var(--space-xl)',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              background: 'transparent',
              color: 'var(--muted)',
            }}
          >
            Drill this subtype again
          </button>
        ) : null}
      </div>
    </div>
  )
}

function ReviewCard(props: {
  index: number
  total: number
  typeLabel: string
  isCorrect: boolean
  userIdx: number | null
  unanswered: boolean
  stem: string
  choices: string[]
  correctIndex: number
  explanation: string
  seconds: number | null
  /** CR only. */
  argument?: string
}) {
  const { index, total, typeLabel, isCorrect, userIdx, unanswered, stem, choices, correctIndex, explanation, seconds, argument } = props
  return (
    <div
      className="card"
      style={{ padding: 'var(--card-pad-comfortable)', display: 'grid', gap: 'var(--space-md)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
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
          {typeLabel}
        </span>
        <CorrectnessChip state={unanswered ? 'unanswered' : isCorrect ? 'correct' : 'wrong'} />
        {typeof seconds === 'number' ? (
          <span className="muted text-label">{formatSeconds(seconds)}</span>
        ) : null}
      </div>

      {argument ? (
        <p
          style={{
            margin: 0,
            color: 'var(--text)',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}
        >
          {renderInlineBold(argument)}
        </p>
      ) : null}

      <div className="text-section" style={{ fontWeight: 600, lineHeight: 'var(--leading-normal)' }}>
        {stem}
      </div>
      <div style={{ display: 'grid', gap: 'var(--space-xs)' }}>
        {choices.map((c, ci) => {
          const isUser = userIdx === ci
          const isAnswer = correctIndex === ci
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
        {explanation}
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
