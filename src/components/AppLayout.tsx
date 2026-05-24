import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { APP_HOME } from '../lib/routes'
import { AuthButton } from './AuthButton'

type Theme = 'dark' | 'light'

/** Outlet context surfaced to all routes nested under <AppLayout />.
 *  Read it from a route with `useOutletContext<AppLayoutOutletContext>()`. */
export type AppLayoutOutletContext = {
  theme: Theme
  setTheme: (next: Theme) => void
}

export function AppLayout() {
  const location = useLocation()
  const showBack = location.pathname.startsWith('/words/')
  const [infoOpen, setInfoOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const stored = localStorage.getItem('gmat-vocab-theme')
    const next: Theme = stored === 'light' || stored === 'dark' ? stored : 'dark'
    setTheme(next)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('gmat-vocab-theme', theme)
  }, [theme])


  return (
    <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column' }}>
      {infoOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="info-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-lg)',
            background: 'var(--scrim)',
            backdropFilter: 'blur(6px)',
          }}
          onClick={() => setInfoOpen(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: 420,
              width: '100%',
              maxHeight: '85vh',
              overflow: 'auto',
              padding: 'var(--card-pad-comfortable)',
              position: 'relative',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow)',
              background: 'var(--surface)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setInfoOpen(false)}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                width: 28,
                height: 28,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--fill-muted)',
                color: 'var(--muted)',
                fontSize: 16,
                lineHeight: 1,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>
            <h2
              id="info-title"
              style={{
                margin: 0,
                marginBottom: 14,
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: -0.2,
                color: 'var(--text)',
                paddingRight: 36,
              }}
            >
              How to use GMAT Lexicon
            </h2>
            <div
              style={{
                display: 'grid',
                gap: 14,
                fontSize: 14,
                lineHeight: 1.55,
                color: 'var(--text)',
              }}
            >
              <section>
                <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>
                  Profile
                </div>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  Tap <strong>Profile</strong> in the top right to sign in, change theme, set
                  exam window + timezone, and sign out.
                </p>
              </section>
              <section>
                <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>
                  Today
                </div>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  See your <strong>streak</strong> on Today and use <strong>lookup</strong> to add
                  words. <strong>Start session</strong> runs a guided batch (up to five words:
                  learn → match → verbal quiz). Set <strong>exam window</strong> and{' '}
                  <strong>timezone</strong> under <strong>Profile</strong> (top right).
                </p>
              </section>
              <section>
                <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>
                  Learn
                </div>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  Use <strong>Deck</strong> or <strong>Paragraph</strong>. Filter by All,{' '}
                  <strong>Do Not Know</strong>, Learning, Mastered, or Flagged; narrow by Words or
                  Phrases; search by text. On each card you can change status, flag, delete, or
                  expand details. Tap <strong>Study</strong> to open a focused flashcard flow through
                  your filtered list. In <strong>Paragraph</strong>, Generate builds a short formal
                  paragraph from up to five <strong>Learning</strong> items in your current
                  filter—hover bold targets for meanings.
                </p>
              </section>
              <section>
                <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>
                  Test
                </div>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  Choose <strong>Meaning in Context</strong> or <strong>GMAT-Style Verbal</strong>,
                  pick how many questions, and begin a section. After each item you see an
                  explanation, then your score at the end.
                </p>
              </section>
            </div>
          </div>
        </div>
      )}

      <header className="app-header" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <div className="app-header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {showBack ? (
              <NavLink
                to="/words"
                style={{
                  textDecoration: 'none',
                  fontSize: 14,
                  color: 'var(--muted)',
                  padding: '6px 0',
                }}
              >
                Back
              </NavLink>
            ) : null}
            <NavLink
              to={APP_HOME}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ fontWeight: 800, letterSpacing: '-0.03em', fontSize: 18 }}>
                GMAT Lexicon
              </div>
            </NavLink>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NavLink
              to={APP_HOME}
              end
              style={({ isActive }) => ({
                textDecoration: 'none',
                padding: '8px 14px',
                fontSize: 14,
                fontWeight: 600,
                color: isActive ? 'var(--text)' : 'var(--muted)',
                borderBottom: isActive ? '2px solid var(--text)' : '2px solid transparent',
              })}
            >
              Today
            </NavLink>
            <NavLink
              to="/learn"
              style={({ isActive }) => ({
                textDecoration: 'none',
                padding: '8px 14px',
                fontSize: 14,
                fontWeight: 600,
                color: isActive ? 'var(--text)' : 'var(--muted)',
                borderBottom: isActive ? '2px solid var(--text)' : '2px solid transparent',
              })}
            >
              Learn
            </NavLink>
            <NavLink
              to="/test"
              style={({ isActive }) => ({
                textDecoration: 'none',
                padding: '8px 14px',
                fontSize: 14,
                fontWeight: 600,
                color: isActive ? 'var(--text)' : 'var(--muted)',
                borderBottom: isActive ? '2px solid var(--text)' : '2px solid transparent',
              })}
            >
              Test
            </NavLink>
            <NavLink
              to="/exam"
              style={({ isActive }) => ({
                textDecoration: 'none',
                padding: '8px 14px',
                fontSize: 14,
                fontWeight: 600,
                color: isActive ? 'var(--text)' : 'var(--muted)',
                borderBottom: isActive ? '2px solid var(--text)' : '2px solid transparent',
              })}
            >
              Exam
            </NavLink>
            <NavLink
              to="/"
              style={({ isActive }) => ({
                textDecoration: 'none',
                padding: '8px 14px',
                fontSize: 14,
                fontWeight: 600,
                color: isActive ? 'var(--text)' : 'var(--muted)',
                borderBottom: isActive ? '2px solid var(--text)' : '2px solid transparent',
              })}
            >
              About
            </NavLink>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              aria-label="How to use the app"
              onClick={() => setInfoOpen(true)}
              style={{
                padding: '6px 10px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'color-mix(in srgb, var(--surface) 70%, transparent)',
                color: 'var(--muted)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              How to Use?
            </button>
            <AuthButton />
          </div>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        <Outlet context={{ theme, setTheme } satisfies AppLayoutOutletContext} />
      </main>
    </div>
  )
}
