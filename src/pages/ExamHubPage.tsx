import { Link } from 'react-router-dom'

export function ExamHubPage() {
  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.3 }}>
          Exam practice
        </h1>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 15 }}>
          GMAT-style sections. Pick a mode to generate a fresh attempt.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
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
          description="Argument-based questions: assumptions, weakenings, strengthenings, paradoxes, and inference."
          ctaLabel="Coming soon"
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
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    borderRadius: 14,
    border: '1px solid var(--border)',
    background: available ? 'rgba(99, 102, 241, 0.04)' : 'rgba(255,255,255,0.02)',
    opacity: available ? 1 : 0.6,
  }
  return (
    <div className="card" style={baseStyle}>
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: -0.2 }}>
          {title}
        </h2>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.5 }}>
          {description}
        </p>
      </div>
      <div style={{ marginTop: 'auto' }}>
        {available && to ? (
          <Link
            to={to}
            className="btn"
            style={{
              display: 'inline-block',
              padding: '10px 16px',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14,
              textDecoration: 'none',
              background: 'var(--accent-gradient-end, #6366f1)',
              color: '#fff',
              border: '1px solid transparent',
            }}
          >
            {ctaLabel}
          </Link>
        ) : (
          <span
            className="muted"
            style={{
              display: 'inline-block',
              padding: '10px 16px',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 14,
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            {ctaLabel}
          </span>
        )}
      </div>
    </div>
  )
}
