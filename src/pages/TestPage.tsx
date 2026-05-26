import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ALL_CR_SUBTYPE_KEYS,
  ALL_RC_SUBTYPE_KEYS,
  CR_SUBTYPES,
  RC_SUBTYPES,
  type CrSubtypeKey,
  type RcSubtypeKey,
  type VerbalSubtypeKey,
} from '../../shared/verbalTaxonomy'
import { listRcAttempts } from '../lib/rcAttempts'
import { listCrAttempts } from '../lib/crAttempts'
import {
  computeSubtypeAccuracy,
  sectionAccuracy,
  type SubtypeAccuracyMap,
  type SubtypeAccuracyStats,
} from '../lib/subtypeAccuracy'
import { Alert } from '../components/ui/Alert'

/**
 * Practice hub. Section → category → subtype tree with the user's
 * cross-attempt accuracy per row and a "Drill 10" action per subtype.
 *
 * Replaces the old vocab quiz UI that used to live at /test. The
 * /generateQuiz endpoint and QuizMode shared type are untouched —
 * mobile still uses them.
 */
export function TestPage() {
  const navigate = useNavigate()
  const [accuracy, setAccuracy] = useState<SubtypeAccuracyMap | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [rcAttempts, crAttempts] = await Promise.all([
          listRcAttempts(),
          listCrAttempts(),
        ])
        if (cancelled) return
        setAccuracy(computeSubtypeAccuracy({ rcAttempts, crAttempts }))
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load accuracy.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function onDrill(subtypeKey: VerbalSubtypeKey) {
    navigate(`/test/drill/${subtypeKey}`)
  }

  return (
    <div
      className="container"
      style={{
        paddingTop: 'var(--space-2xl)',
        paddingBottom: 'var(--space-4xl)',
        maxWidth: 880,
      }}
    >
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <h1 className="text-page-title" style={{ margin: 0 }}>
          Practice
        </h1>
        <p className="muted text-body-lg" style={{ margin: 'var(--space-xs) 0 0' }}>
          Drill individual GMAT verbal subtypes. Accuracy reflects every attempt — exam sets and drills.
        </p>
      </div>

      {error && (
        <Alert variant="error" style={{ marginBottom: 'var(--space-xl)' }}>
          {error}
        </Alert>
      )}

      <SectionBlock title="Verbal">
        <CategoryRow
          title="Reading Comprehension"
          overall={
            accuracy
              ? sectionAccuracy(accuracy, ALL_RC_SUBTYPE_KEYS)
              : null
          }
          loading={loading}
        />
        <SubtypeList
          subtypeKeys={ALL_RC_SUBTYPE_KEYS}
          subtypes={RC_SUBTYPES}
          accuracy={accuracy}
          loading={loading}
          onDrill={onDrill}
        />

        <CategoryRow
          title="Critical Reasoning"
          overall={
            accuracy
              ? sectionAccuracy(accuracy, ALL_CR_SUBTYPE_KEYS)
              : null
          }
          loading={loading}
        />
        <SubtypeList
          subtypeKeys={ALL_CR_SUBTYPE_KEYS}
          subtypes={CR_SUBTYPES}
          accuracy={accuracy}
          loading={loading}
          onDrill={onDrill}
        />
      </SectionBlock>

      <SectionBlock title="Quant">
        <ComingSoonRow />
      </SectionBlock>

      <SectionBlock title="Data Insights">
        <ComingSoonRow />
      </SectionBlock>
    </div>
  )
}

function SectionBlock({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 'var(--space-2xl)' }}>
      <div
        className="muted text-label"
        style={{
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 'var(--space-sm)',
        }}
      >
        {title}
      </div>
      <div
        className="card"
        style={{
          padding: 'var(--card-pad-comfortable)',
          display: 'grid',
          gap: 'var(--space-md)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function CategoryRow({
  title,
  overall,
  loading,
}: {
  title: string
  overall: SubtypeAccuracyStats | null
  loading: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 'var(--space-md)',
        paddingTop: 'var(--space-2xs)',
      }}
    >
      <span
        className="text-body"
        style={{ fontWeight: 700 }}
      >
        {title}
      </span>
      <span className="muted text-body-sm">
        {loading ? 'Loading…' : formatAccuracy(overall)}
      </span>
    </div>
  )
}

function SubtypeList<K extends RcSubtypeKey | CrSubtypeKey>({
  subtypeKeys,
  subtypes,
  accuracy,
  loading,
  onDrill,
}: {
  subtypeKeys: ReadonlyArray<K>
  subtypes: Record<K, { label: string }>
  accuracy: SubtypeAccuracyMap | null
  loading: boolean
  onDrill: (k: VerbalSubtypeKey) => void
}) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-2xs)' }}>
      {subtypeKeys.map((k) => {
        const stats = accuracy ? accuracy[k] : null
        return (
          <div
            key={k}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto',
              alignItems: 'center',
              gap: 'var(--space-md)',
              padding: 'var(--space-sm) var(--space-md)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--fill-subtle)',
              border: '1px solid var(--border)',
            }}
          >
            <span className="text-body" style={{ fontWeight: 600 }}>
              {subtypes[k].label}
            </span>
            <span className="muted text-body-sm">
              {loading
                ? '…'
                : stats && stats.total > 0
                  ? formatAccuracy(stats)
                  : 'Not practiced'}
            </span>
            <button
              type="button"
              className="btn"
              onClick={() => onDrill(k)}
              style={{
                padding: 'var(--space-2xs) var(--space-md)',
                background: 'var(--accent-soft, var(--selection-fill))',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-pill)',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Drill 10
            </button>
          </div>
        )
      })}
    </div>
  )
}

function ComingSoonRow() {
  return (
    <div
      style={{
        padding: 'var(--space-md) var(--space-md)',
        color: 'var(--muted)',
        fontStyle: 'italic',
      }}
    >
      Coming soon.
    </div>
  )
}

function formatAccuracy(stats: SubtypeAccuracyStats | null): string {
  if (!stats || stats.total === 0) return 'Not practiced'
  const pct = Math.round((stats.accuracy ?? 0) * 100)
  return `${pct}%  (${stats.correct}/${stats.total})`
}
