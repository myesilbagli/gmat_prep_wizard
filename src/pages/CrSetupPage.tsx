import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CrTimerMode } from '../../shared/crTypes'
import { generateCrSet, type CrSetGenerationError } from '../lib/crGeneration'
import { createCrAttempt } from '../lib/crAttempts'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { SelectableTile } from '../components/ui/SelectableTile'
import { Alert } from '../components/ui/Alert'

const TIMER_OPTIONS: Array<{ value: CrTimerMode; label: string; description: string }> = [
  {
    value: '10min',
    label: '10 minutes',
    description: 'Real GMAT pace — 2 minutes per question. Auto-submits at 0.',
  },
  {
    value: 'none',
    label: 'No timer',
    description: 'No pressure, no auto-submit. Time per question is still recorded.',
  },
  {
    value: '5min',
    label: '5 minutes',
    description: 'Speed drill. Hard pace. Auto-submits at 0.',
  },
]

export function CrSetupPage() {
  const navigate = useNavigate()
  const [timerMode, setTimerMode] = useState<CrTimerMode>('10min')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onStart() {
    setError(null)
    setSubmitting(true)
    try {
      const questions = await generateCrSet()
      const attemptId = await createCrAttempt(questions, timerMode)
      navigate(`/exam/cr/practice/${attemptId}`)
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as CrSetGenerationError).message)
          : 'Failed to start practice set.'
      setError(msg)
      setSubmitting(false)
    }
  }

  return (
    <div
      className="container"
      style={{ paddingTop: 'var(--space-2xl)', paddingBottom: 'var(--space-3xl)', maxWidth: 720 }}
    >
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <h1 className="text-page-title" style={{ margin: 0 }}>
          Critical Reasoning
        </h1>
        <p className="muted text-body-lg" style={{ margin: 'var(--space-xs) 0 0' }}>
          5 questions across the common GMAT CR types (weaken, strengthen, assumption,
          inference / explain, occasionally evaluate). Pick a timer mode and start.
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
            Timer mode
          </div>
          <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
            {TIMER_OPTIONS.map((opt) => (
              <SelectableTile
                key={opt.value}
                layout="tile"
                label={opt.label}
                sublabel={opt.description}
                selected={timerMode === opt.value}
                disabled={submitting}
                onClick={() => setTimerMode(opt.value)}
              />
            ))}
          </div>
        </div>

        {error ? <Alert variant="error">{error}</Alert> : null}

        <div>
          <PrimaryButton onClick={onStart} disabled={submitting} loading={submitting}>
            {submitting ? 'Generating 5 questions…' : 'Start set'}
          </PrimaryButton>
          <p className="muted text-body-sm" style={{ margin: 'var(--space-sm) 0 0' }}>
            All 5 questions are generated in parallel (~30–60 s total, not 5× that).
          </p>
        </div>
      </div>
    </div>
  )
}
