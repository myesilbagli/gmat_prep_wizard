import { PrimaryButton } from '../components/ui/PrimaryButton'

export function ExamHubPage() {
  return (
    <div className="container" style={{ paddingTop: 'var(--space-2xl)', paddingBottom: 'var(--space-3xl)' }}>
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <h1 className="text-page-title" style={{ margin: 0 }}>
          Exam practice
        </h1>
        <p className="muted text-body-lg" style={{ margin: 'var(--space-xs) 0 0' }}>
          GMAT-style sections. Pick a mode to generate a fresh attempt.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-lg)',
        }}
      >
        <ExamHubCard
          title="Reading Comprehension"
          description="A scholarly-tone passage with 3-4 multiple-choice questions across main idea, inference, detail, function, tone, and application."
          ctaLabel="Start →"
          to="/exam/rc/setup"
          available
        />
        <ExamHubCard
          title="Critical Reasoning"
          description="5-question timed set. Argument-based questions: assumptions, weakenings, strengthenings, paradoxes, and inference."
          ctaLabel="Start →"
          to="/exam/cr/setup"
          available
        />
      </div>
    </div>
  )
}

type ExamHubCardProps = {
  title: string
  description: string
  ctaLabel: string
  to?: string
  available?: boolean
}

function ExamHubCard({ title, description, ctaLabel, to, available }: ExamHubCardProps) {
  const baseStyle: React.CSSProperties = {
    padding: 'var(--card-pad-comfortable)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-md)',
    background: available ? 'var(--selection-fill)' : 'var(--fill-subtle)',
    opacity: available ? 1 : 0.6,
  }
  return (
    <div className="card" style={baseStyle}>
      <div>
        <h2 className="text-title" style={{ margin: 0 }}>
          {title}
        </h2>
        <p className="muted text-body" style={{ margin: 'var(--space-xs) 0 0' }}>
          {description}
        </p>
      </div>
      <div style={{ marginTop: 'auto' }}>
        {available && to ? (
          <PrimaryButton as="link" to={to}>
            {ctaLabel}
          </PrimaryButton>
        ) : (
          <span
            className="muted text-body"
            style={{
              display: 'inline-block',
              padding: 'var(--space-sm) var(--space-lg)',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              border: '1px solid var(--border)',
              background: 'var(--fill-subtle)',
            }}
          >
            {ctaLabel}
          </span>
        )}
      </div>
    </div>
  )
}
