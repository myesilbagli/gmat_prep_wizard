/**
 * Reads a DiagnosticDoc and displays the weakness profile (rank by
 * accuracy ascending, with avg time and pacing flags). Used on
 * ProfilePage and on the intake page's "saved" state.
 */
import type { DiagnosticDoc } from '../../shared/diagnosticTypes'
import { DIAGNOSTIC_SECTION_LABELS } from '../../shared/diagnosticTypes'
import { computeWeaknessProfile } from '../lib/diagnostic'

export function DiagnosticWeaknessProfile({ doc }: { doc: DiagnosticDoc }) {
  const groups = computeWeaknessProfile(doc.rows)
  const totalRows = doc.rows.length
  const totalCorrect = doc.rows.filter((r) => r.performance === 'correct').length
  const overallAccuracy = totalRows > 0 ? totalCorrect / totalRows : 0
  const avgTime =
    totalRows > 0
      ? doc.rows.reduce((acc, r) => acc + (r.responseTimeMinutes || 0), 0) / totalRows
      : 0

  return (
    <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 'var(--space-md)',
        }}
      >
        <SummaryStat label="Questions" value={String(totalRows)} />
        <SummaryStat
          label="Overall accuracy"
          value={`${Math.round(overallAccuracy * 100)}%`}
          sublabel={`${totalCorrect} / ${totalRows} correct`}
        />
        <SummaryStat
          label="Avg / question"
          value={`${avgTime.toFixed(1)} min`}
          sublabel="2 min is the target pace"
        />
      </div>

      {groups.length === 0 ? (
        <p className="muted text-body-sm" style={{ margin: 0 }}>
          No groupable rows.
        </p>
      ) : (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 2fr) 80px 100px 70px 1fr',
              gap: 'var(--space-sm)',
              padding: 'var(--space-sm) var(--space-md)',
              background: 'var(--fill-subtle)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span className="muted text-label">Skill / Type</span>
            <span className="muted text-label" style={{ textAlign: 'right' }}>
              Score
            </span>
            <span className="muted text-label" style={{ textAlign: 'right' }}>
              Accuracy
            </span>
            <span className="muted text-label" style={{ textAlign: 'right' }}>
              Avg
            </span>
            <span className="muted text-label">Flags</span>
          </div>
          {groups.map((g, i) => (
            <div
              key={`${g.section}-${g.key}-${i}`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 2fr) 80px 100px 70px 1fr',
                gap: 'var(--space-sm)',
                padding: 'var(--space-md)',
                borderBottom:
                  i < groups.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'center',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  className="text-body"
                  style={{
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {g.key}
                </div>
                <div className="muted text-label">
                  {DIAGNOSTIC_SECTION_LABELS[g.section]} ·{' '}
                  {g.groupedBy === 'fundamentalSkill' ? 'skill' : 'type'}
                </div>
              </div>
              <div
                className="text-body-sm"
                style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
              >
                {g.correct}/{g.total}
              </div>
              <div style={{ textAlign: 'right' }}>
                <span
                  className="text-body"
                  style={{
                    fontWeight: 700,
                    color: accuracyColor(g.accuracy),
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {Math.round(g.accuracy * 100)}%
                </span>
              </div>
              <div
                className="text-body-sm"
                style={{
                  textAlign: 'right',
                  color: 'var(--muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {g.avgTimeMinutes.toFixed(1)}
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 'var(--space-2xs)',
                  flexWrap: 'wrap',
                }}
              >
                {g.rushedCount > 0 ? (
                  <FlagPill tone="danger" label={`Rushed × ${g.rushedCount}`} />
                ) : null}
                {g.slowCount > 0 ? (
                  <FlagPill tone="warn" label={`Slow × ${g.slowCount}`} />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="muted text-body-sm" style={{ margin: 0 }}>
        Weakest skills sit at the top. "Rushed" = answered in &lt; 1.5 min and got it wrong.
        "Slow" = answered in &gt; 2.75 min (right or wrong).
      </p>
    </div>
  )
}

function SummaryStat({
  label,
  value,
  sublabel,
}: {
  label: string
  value: string
  sublabel?: string
}) {
  return (
    <div
      style={{
        padding: 'var(--card-pad-compact)',
        border: '1px solid var(--border)',
        background: 'var(--fill-subtle)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2xs)',
      }}
    >
      <span className="muted text-label">{label}</span>
      <span className="text-title">{value}</span>
      {sublabel ? <span className="muted text-body-sm">{sublabel}</span> : null}
    </div>
  )
}

function FlagPill({ tone, label }: { tone: 'danger' | 'warn'; label: string }) {
  const background = tone === 'danger' ? 'var(--danger-soft)' : 'var(--selection-fill)'
  const color =
    tone === 'danger'
      ? 'var(--danger-text)'
      : 'color-mix(in srgb, var(--accent-gradient-end) 75%, var(--text))'
  return (
    <span
      className="text-label"
      style={{
        padding: '2px var(--space-xs)',
        borderRadius: 'var(--radius-pill)',
        background,
        color,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

function accuracyColor(accuracy: number): string {
  if (accuracy >= 0.75) return 'var(--success-on-soft)'
  if (accuracy >= 0.5) return 'var(--text)'
  return 'var(--danger-text)'
}
