import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AuthButton } from './AuthButton'

type Theme = 'dark' | 'light'

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
            padding: 16,
            background: 'rgba(0,0,0,0.6)',
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
              padding: 20,
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
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.06)',
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
                  See your <strong>streak</strong>, set a fuzzy <strong>exam window</strong> and
                  timezone, and tap <strong>Start session</strong> for the daily review → new →
                  quiz flow. Below that, <strong>lookup</strong> a word or phrase (e.g.{' '}
                  <em>obdurate</em>) and tap Generate to add definitions and examples to your deck.
                </p>
              </section>
              <section>
                <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>
                  Learn
                </div>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  Filter by All, Learning, Mastered, or Flagged; narrow by Words or Phrases.
                  Search by text. Mark each word <strong>Learning</strong> or{' '}
                  <strong>Mastered</strong>. On each card you can change status, flag, delete,
                  or expand details. Switch to <strong>Flashcards</strong> to study one card at
                  a time. Switch to <strong>Paragraph</strong> and tap Generate paragraph: the
                  app picks up to 5 random <strong>Learning</strong> words, builds a short
                  paragraph, and bolds those words—hover a bold word to see its meaning.
                </p>
              </section>
              <section>
                <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>
                  Test
                </div>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  Choose Meaning or GMAT-style, pick 5 or 10 questions, and run the quiz.
                  After finishing you get a score and can review the correct answers.
                </p>
              </section>
            </div>
          </div>
        </div>
      )}

      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          padding: '12px 16px',
          backdropFilter: 'blur(10px)',
          background: 'var(--header-bg)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            maxWidth: 980,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
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
              to="/"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ fontWeight: 700, letterSpacing: -0.2, fontSize: 17 }}>
                GMAT Lexicon
              </div>
            </NavLink>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
            <AuthButton theme={theme} setTheme={setTheme} />
          </div>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
    </div>
  )
}
