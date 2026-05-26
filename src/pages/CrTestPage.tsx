import { useState } from 'react'
import {
  CR_QUESTION_TYPES,
  type CrQuestion,
  type CrQuestionType,
} from '../../shared/crTypes'
import { generateCrQuestion } from '../lib/crGeneration'
import { renderInlineBold } from '../lib/inlineBold'

/**
 * Developer harness for /generateCrQuestion. Pick a question type, hit
 * Generate, inspect the returned argument + choices, reveal the key.
 * No timer, no scoring, no Firestore — just generate-and-inspect.
 */
export function CrTestPage() {
  const [type, setType] = useState<CrQuestionType>('assumption')
  const [question, setQuestion] = useState<CrQuestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setQuestion(null)
    setRevealed(false)
    try {
      const q = await generateCrQuestion(type)
      setQuestion(q)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate question')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="container"
      style={{
        paddingTop: 'var(--space-2xl)',
        paddingBottom: 'var(--space-3xl)',
        maxWidth: 800,
      }}
    >
      <h1 className="text-page-title" style={{ margin: 0 }}>
        CR generator harness
      </h1>
      <p
        className="muted text-body-sm"
        style={{ margin: 'var(--space-xs) 0 var(--space-xl)' }}
      >
        Developer tool. Pick a question type, generate one CR question on demand, and
        inspect the result. No timer, no scoring, nothing saved.
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-sm)',
          alignItems: 'center',
          marginBottom: 'var(--space-xl)',
        }}
      >
        <label htmlFor="cr-type" className="text-label">
          Type
        </label>
        <select
          id="cr-type"
          value={type}
          onChange={(e) => setType(e.target.value as CrQuestionType)}
          disabled={loading}
          style={{
            padding: 'var(--space-2xs) var(--space-sm)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: 'inherit',
          }}
        >
          {CR_QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btnPrimary"
          onClick={handleGenerate}
          disabled={loading}
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>
      </div>

      {error && (
        <p
          className="text-body-sm"
          style={{ color: 'var(--danger)', marginBottom: 'var(--space-md)' }}
        >
          {error}
        </p>
      )}

      {question && (
        <div
          className="card"
          style={{
            padding: 'var(--card-pad-comfortable)',
            display: 'grid',
            gap: 'var(--space-lg)',
          }}
        >
          <div>
            <div
              className="muted text-label"
              style={{ marginBottom: 'var(--space-xs)' }}
            >
              {question.questionType.toUpperCase()}
            </div>
            <p
              style={{
                margin: 0,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                color: 'var(--text)',
              }}
            >
              {renderInlineBold(question.argument)}
            </p>
          </div>

          <h2 className="text-card-title" style={{ margin: 0 }}>
            {question.questionStem}
          </h2>

          <ol
            style={{
              margin: 0,
              paddingLeft: 'var(--space-lg)',
              display: 'grid',
              gap: 'var(--space-xs)',
            }}
          >
            {question.choices.map((c, i) => {
              const isCorrect = revealed && i === question.correctIndex
              return (
                <li
                  key={i}
                  style={{
                    color: isCorrect ? 'var(--success, #1a7f37)' : 'var(--text)',
                    fontWeight: isCorrect ? 700 : 400,
                  }}
                >
                  {c}
                  {isCorrect ? '  ← correct' : ''}
                </li>
              )
            })}
          </ol>

          {!revealed ? (
            <button
              type="button"
              className="btn btnPrimary"
              onClick={() => setRevealed(true)}
              style={{ justifySelf: 'start' }}
            >
              Reveal answer + explanation
            </button>
          ) : (
            <div
              style={{
                borderTop: '1px solid var(--border)',
                paddingTop: 'var(--space-md)',
                display: 'grid',
                gap: 'var(--space-xs)',
              }}
            >
              <div className="text-body-sm">
                <strong>Correct (index {question.correctIndex}):</strong>{' '}
                {question.choices[question.correctIndex]}
              </div>
              <div
                className="muted text-body-sm"
                style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}
              >
                {question.explanation}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
