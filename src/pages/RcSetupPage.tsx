import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { RcDifficulty } from '../../shared/rcTypes'
import { generateRcPassage } from '../lib/rcGeneration'
import { createRcAttempt } from '../lib/rcAttempts'

const DIFFICULTY_OPTIONS: Array<{ value: RcDifficulty; label: string; description: string }> = [
  {
    value: 'easy',
    label: 'Easy',
    description:
      'Direct prose, clear argument, single-step inferences. Concrete treatment. 3 questions.',
  },
  {
    value: 'medium',
    label: 'Medium',
    description:
      'Moderate vocabulary and syntax; thesis with counterpoint and nuance. Some two-step inferences. 4 questions.',
  },
  {
    value: 'hard',
    label: 'Hard',
    description:
      'Dense vocabulary, layered competing views, heavy hedging; subtle inferences across the passage. 4 questions.',
  },
]

export function RcSetupPage() {
  const navigate = useNavigate()
  const [difficulty, setDifficulty] = useState<RcDifficulty>('medium')
  const [topic, setTopic] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onStart() {
    setError(null)
    setSubmitting(true)
    try {
      const trimmedTopic = topic.trim()
      if (trimmedTopic.length > 120) {
        throw new Error('Topic must be 120 characters or fewer.')
      }
      const passage = await generateRcPassage({
        difficulty,
        topic: trimmedTopic ? trimmedTopic : undefined,
      })
      const attemptId = await createRcAttempt(passage)
      navigate(`/exam/rc/practice/${attemptId}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to start practice.'
      setError(msg)
      setSubmitting(false)
    }
  }

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32, maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.3 }}>
          Reading Comprehension
        </h1>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 15 }}>
          Pick a difficulty (and optionally a topic) and we'll generate a passage with questions.
        </p>
      </div>

      <div
        className="card"
        style={{ padding: 20, marginBottom: 20, display: 'grid', gap: 20 }}
      >
        <div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
            Difficulty
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {DIFFICULTY_OPTIONS.map((opt) => {
              const selected = difficulty === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  className="btn"
                  onClick={() => setDifficulty(opt.value)}
                  disabled={submitting}
                  style={{
                    padding: 14,
                    textAlign: 'left',
                    borderRadius: 12,
                    border: selected
                      ? '2px solid var(--accent-gradient-end)'
                      : '1px solid var(--border)',
                    background: selected
                      ? 'rgba(99, 102, 241, 0.12)'
                      : 'rgba(255,255,255,0.03)',
                    cursor: submitting ? 'default' : 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                    {opt.label}
                  </div>
                  <div className="muted" style={{ fontSize: 13, lineHeight: 1.4 }}>
                    {opt.description}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label
            htmlFor="rc-topic"
            className="muted"
            style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'block' }}
          >
            Topic (optional)
          </label>
          <input
            id="rc-topic"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={submitting}
            placeholder="e.g. corporate governance, philosophy of science"
            maxLength={120}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.03)',
              color: 'var(--text)',
              fontSize: 14,
            }}
          />
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Leave blank to let the model pick. Max 120 characters.
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            style={{
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
        ) : null}

        <div>
          <button
            type="button"
            className="btn"
            onClick={onStart}
            disabled={submitting}
            style={{
              padding: '12px 20px',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 15,
              background: submitting ? 'rgba(99,102,241,0.4)' : 'var(--accent-gradient-end, #6366f1)',
              color: '#fff',
              border: '1px solid transparent',
              cursor: submitting ? 'progress' : 'pointer',
            }}
          >
            {submitting ? 'Generating…' : 'Start practice'}
          </button>
        </div>
      </div>
    </div>
  )
}
