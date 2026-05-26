import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ALL_VERBAL_SUBTYPES,
  type CrSubtypeKey,
  type VerbalSubtypeKey,
} from '../../shared/verbalTaxonomy'
import type { RcDifficulty } from '../../shared/rcTypes'
import { generateRcSubtypeDrill } from '../lib/rcGeneration'
import { createRcDrillAttempt } from '../lib/rcAttempts'
import { generateCrSubtypeDrill } from '../lib/crGeneration'
import { createCrDrillAttempt } from '../lib/crAttempts'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { SelectableTile } from '../components/ui/SelectableTile'
import { Alert } from '../components/ui/Alert'
import { GenerationLoader } from '../components/GenerationLoader'
import {
  CR_LOADING_MESSAGES,
  RC_LOADING_MESSAGES,
} from '../lib/loadingMessages'

const DRILL_COUNT = 10

const RC_DIFFICULTY_OPTIONS: Array<{ value: RcDifficulty; label: string; description: string }> = [
  { value: 'easy', label: 'Easy', description: 'Direct prose, single-step inferences.' },
  { value: 'medium', label: 'Medium', description: 'Moderate vocabulary; some two-step inferences.' },
  { value: 'hard', label: 'Hard', description: 'Dense vocabulary, layered argument, subtle inferences.' },
]

function isValidSubtypeKey(k: string): k is VerbalSubtypeKey {
  return k in ALL_VERBAL_SUBTYPES
}

export function DrillSetupPage() {
  const { subtypeKey: rawKey } = useParams<{ subtypeKey: string }>()
  const navigate = useNavigate()
  const subtypeKey = rawKey && isValidSubtypeKey(rawKey) ? rawKey : null

  const [difficulty, setDifficulty] = useState<RcDifficulty>('medium')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!subtypeKey) {
    return (
      <div
        className="container"
        style={{ paddingTop: 'var(--space-2xl)', paddingBottom: 'var(--space-3xl)' }}
      >
        <Alert variant="error">Unknown subtype.</Alert>
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <PrimaryButton onClick={() => navigate('/test')}>Back to practice</PrimaryButton>
        </div>
      </div>
    )
  }

  const subtype = ALL_VERBAL_SUBTYPES[subtypeKey]
  const section = subtype.section
  const sectionTitle = section === 'rc' ? 'Reading Comprehension' : 'Critical Reasoning'

  async function onStart() {
    if (!subtypeKey) return
    setError(null)
    setSubmitting(true)
    try {
      if (subtype.section === 'rc') {
        const drill = await generateRcSubtypeDrill({
          subtype: subtypeKey,
          difficulty,
          count: DRILL_COUNT,
        })
        const attemptId = await createRcDrillAttempt({
          drillSubtype: subtypeKey,
          difficulty,
          drill,
        })
        navigate(`/test/drill/run/rc/${attemptId}`)
      } else {
        const questions = await generateCrSubtypeDrill({
          subtype: subtypeKey as CrSubtypeKey,
          count: DRILL_COUNT,
        })
        const attemptId = await createCrDrillAttempt({
          drillSubtype: subtypeKey,
          questions,
        })
        navigate(`/test/drill/run/cr/${attemptId}`)
      }
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: unknown }).message)
          : 'Failed to start drill.'
      setError(msg)
      setSubmitting(false)
    }
  }

  return (
    <div
      className="container"
      style={{ paddingTop: 'var(--space-2xl)', paddingBottom: 'var(--space-3xl)', maxWidth: 720 }}
    >
      <button
        type="button"
        className="btn text-body-sm"
        onClick={() => navigate('/test')}
        style={{
          background: 'transparent',
          color: 'var(--muted)',
          padding: '0',
          marginBottom: 'var(--space-md)',
          fontWeight: 600,
        }}
      >
        ← Practice
      </button>
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <div className="muted text-label" style={{ marginBottom: 'var(--space-2xs)' }}>
          {sectionTitle}
        </div>
        <h1 className="text-page-title" style={{ margin: 0 }}>
          {subtype.label} drill
        </h1>
        <p className="muted text-body-lg" style={{ margin: 'var(--space-xs) 0 0' }}>
          {DRILL_COUNT} questions, all targeting{' '}
          <strong>{subtype.label.toLowerCase()}</strong>.
          {section === 'rc' ? ' Split across ~3 short passages.' : ''}
        </p>
      </div>

      {submitting ? (
        <div className="card" style={{ padding: 'var(--card-pad-comfortable)' }}>
          <GenerationLoader
            title="Generating your drill"
            messages={section === 'rc' ? RC_LOADING_MESSAGES : CR_LOADING_MESSAGES}
          />
        </div>
      ) : (
        <div
          className="card"
          style={{
            padding: 'var(--card-pad-comfortable)',
            display: 'grid',
            gap: 'var(--space-xl)',
          }}
        >
          {section === 'rc' ? (
            <div>
              <div className="muted text-label" style={{ marginBottom: 'var(--space-xs)' }}>
                Difficulty
              </div>
              <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
                {RC_DIFFICULTY_OPTIONS.map((opt) => (
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
          ) : (
            <p className="muted text-body-sm" style={{ margin: 0 }}>
              CR drills run untimed. Time per question is recorded so you can pace yourself.
            </p>
          )}

          {error ? <Alert variant="error">{error}</Alert> : null}

          <div>
            <PrimaryButton onClick={onStart}>Start drill</PrimaryButton>
          </div>
        </div>
      )}
    </div>
  )
}
