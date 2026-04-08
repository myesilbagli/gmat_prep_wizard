import { Link } from 'react-router-dom'
import { LP } from '../lib/landingPalette'

export function LegalPageLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string
  lastUpdated: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: LP.bg,
        color: LP.text,
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        lineHeight: 1.6,
      }}
    >
      <header
        style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${LP.borderLight}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <Link
          to="/"
          style={{
            color: LP.primary,
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          ← GMAT Lexicon
        </Link>
      </header>
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 64px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5, margin: '0 0 8px' }}>{title}</h1>
        <p style={{ color: LP.muted, fontSize: 14, margin: '0 0 32px' }}>Last updated: {lastUpdated}</p>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            fontSize: 15,
            color: LP.muted,
          }}
        >
          {children}
        </div>
      </main>
    </div>
  )
}

export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: LP.text, margin: '0 0 10px' }}>{heading}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </section>
  )
}

export function LegalP({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: 0 }}>{children}</p>
}

export function LegalUl({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 22 }}>
      {items.map((t) => (
        <li key={t} style={{ marginBottom: 6 }}>
          {t}
        </li>
      ))}
    </ul>
  )
}
