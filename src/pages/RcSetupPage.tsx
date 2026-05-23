import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { RcDifficulty } from '../../shared/rcTypes'
import { generateRcPassage } from '../lib/rcGeneration'
import { createRcAttempt } from '../lib/rcAttempts'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { SelectableTile } from '../components/ui/SelectableTile'
import { Alert } from '../components/ui/Alert'
import { GenerationLoader } from '../components/GenerationLoader'
import { RC_LOADING_MESSAGES } from '../lib/loadingMessages'

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
    <div
      className="container"
      style={{ paddingTop: 'var(--space-2xl)', paddingBottom: 'var(--space-3xl)', maxWidth: 720 }}
    >
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <h1 className="text-page-title" style={{ margin: 0 }}>
          Reading Comprehension
        </h1>
        <p className="muted text-body-lg" style={{ margin: 'var(--space-xs) 0 0' }}>
          Pick a difficulty (and optionally a topic) and we'll generate a passage with questions.
        </p>
      </div>

      {submitting ? (
        <div
          className="card"
          style={{
            padding: 'var(--card-pad-comfortable)',
            marginBottom: 'var(--space-xl)',
          }}
        >
          <GenerationLoader title="Generating your passage" messages={RC_LOADING_MESSAGES} />
        </div>
      ) : (
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
            <div
              className="muted text-label"
              style={{ marginBottom: 'var(--space-xs)' }}
            >
              Difficulty
            </div>
            <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
              {DIFFICULTY_OPTIONS.map((opt) => (
                <SelectableTile
                  key={opt.value}
                  layout="tile"
                  label={opt.label}
                  sublabel={opt.description}
                  selected={difficulty === opt.value}
                  onClick={() => setDifficulty(opt.value)}
                />
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="rc-topic"
              className="muted text-label"
              style={{ marginBottom: 'var(--space-xs)', display: 'block' }}
            >
              Topic (optional)
            </label>
            <input
              id="rc-topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. corporate governance, philosophy of science"
              maxLength={120}
              className="input"
            />
            <div className="muted text-label" style={{ marginTop: 'var(--space-xs)' }}>
              Leave blank to let the model pick. Max 120 characters.
            </div>
          </div>

          {error ? <Alert variant="error">{error}</Alert> : null}

          <div>
            <PrimaryButton onClick={onStart}>Start practice</PrimaryButton>
          </div>
        </div>
      )}
    </div>
  )
}
