import { useEffect, useState, type CSSProperties } from 'react'
import type { User } from 'firebase/auth'
import { Link } from 'react-router-dom'
import { AuthButton } from '../components/AuthButton'
import { LandingHeroWordDeck } from '../components/LandingHeroWordDeck'
import { subscribeToAuth } from '../lib/auth'
import { BOOK_IMG, LP } from '../lib/landingPalette'
import { APP_HOME } from '../lib/routes'

type Theme = 'dark' | 'light'

/**
 * Marketing landing for GMAT Lexicon (aligned with Stitch export: landing.html / landing.png).
 */
export function LandingPage() {
  const [theme, setTheme] = useState<Theme>('dark')
  const [user, setUser] = useState<User | null>(null)
  useEffect(() => {
    const stored = localStorage.getItem('gmat-vocab-theme')
    const next: Theme = stored === 'light' || stored === 'dark' ? stored : 'dark'
    setTheme(next)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('gmat-vocab-theme', theme)
  }, [theme])

  useEffect(() => subscribeToAuth(setUser), [])

  const btnPrimary: CSSProperties = {
    border: 'none',
    borderRadius: 12,
    padding: '10px 22px',
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
    background: LP.primaryContainer,
    color: LP.onPrimary,
    boxShadow: '0 0 20px rgba(128, 131, 255, 0.3)',
    transition: 'transform 0.2s, filter 0.2s',
  }

  const btnGhost: CSSProperties = {
    border: `1px solid ${LP.borderLight}`,
    borderRadius: 12,
    padding: '10px 22px',
    fontWeight: 600,
    fontSize: 15,
    cursor: 'pointer',
    background: 'rgba(45, 52, 73, 0.4)',
    color: LP.text,
    transition: 'background 0.2s',
  }

  return (
    <div className="landing-page" style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh' }}>
      <div
        className="landing-aurora"
        style={{ width: 500, height: 500, top: -160, left: -160, background: LP.primary }}
      />
      <div
        className="landing-aurora"
        style={{ width: 600, height: 600, top: '38%', right: -160, background: LP.tertiary }}
      />

      <header
        className="landing-header-fixed"
        style={{
          position: 'fixed',
          top: 0,
          zIndex: 50,
          width: '100%',
          height: 80,
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <Link to="/" style={{ fontSize: 22, fontWeight: 800, color: LP.text, letterSpacing: '-0.03em', textDecoration: 'none' }}>
            GMAT Lexicon
          </Link>
          <nav className="landing-nav-center" aria-label="Primary">
            <a className="landing-link" href="#curriculum" style={{ fontWeight: 600 }}>
              Curriculum
            </a>
            <a className="landing-link" href="#methodology">
              Methodology
            </a>
            <a className="landing-link" href="#pricing">
              Pricing
            </a>
            <a className="landing-link" href="#resources">
              Resources
            </a>
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            {user ? (
              <>
                <Link to={APP_HOME} style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                  Open app
                </Link>
                <AuthButton />
              </>
            ) : (
              <>
                <Link to="/sign-in" style={{ ...btnGhost, border: 'none', background: 'transparent', color: LP.primary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                  Sign in
                </Link>
                <Link to="/sign-up" style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main style={{ position: 'relative', zIndex: 1, flex: 1 }}>
        {/* Hero */}
        <section style={{ padding: '176px 24px 96px', maxWidth: 1280, margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 48,
              alignItems: 'center',
              overflow: 'visible',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
              <h1
                style={{
                  fontSize: 'clamp(2.25rem, 5vw, 3.75rem)',
                  fontWeight: 800,
                  lineHeight: 1.1,
                  margin: 0,
                  letterSpacing: '-0.03em',
                }}
              >
                Master GMAT Verbal with{' '}
                <span style={{ color: LP.primary, fontStyle: 'italic', fontFamily: 'var(--font-academic), Georgia, serif' }}>Precision</span>
              </h1>
              <p style={{ fontSize: 'clamp(1.05rem, 2vw, 1.25rem)', color: LP.muted, lineHeight: 1.65, margin: 0, maxWidth: 520 }}>
                The elite vocabulary tool for high-achieving students. Build, study, and test your lexicon with AI-powered analysis designed for
                700+ scorers.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, paddingTop: 8 }}>
                <Link to="/sign-up" style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-flex', padding: '16px 28px', fontSize: 17 }}>
                  Start learning
                </Link>
                <Link
                  to="/sign-in"
                  style={{ ...btnGhost, padding: '16px 28px', fontSize: 17, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                  className="landing-glass"
                >
                  Log in
                </Link>
              </div>
            </div>

            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'visible',
                padding: '8px 0 16px',
              }}
            >
              <LandingHeroWordDeck />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="curriculum" style={{ padding: '56px 24px 96px', background: 'rgba(19, 27, 46, 0.35)' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 28,
              }}
            >
              {[
                {
                  icon: 'psychology',
                  title: 'Save & Analyze',
                  body: 'Leverage AI-driven depth to understand word nuances, etymology, and contextual usage in high-complexity texts.',
                },
                {
                  icon: 'calendar_today',
                  title: 'Daily Sessions',
                  body: 'Disciplined spaced-repetition schedules that adapt to your mastery level, ensuring zero knowledge decay.',
                },
                {
                  icon: 'quiz',
                  title: 'Realistic Testing',
                  body: 'GMAT-style assessment modules that mimic the exact linguistic traps used by the official examiners.',
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="landing-glass"
                  style={{
                    borderRadius: 16,
                    border: `1px solid ${LP.borderLight}`,
                    background: 'rgba(34, 42, 61, 0.45)',
                    padding: 36,
                    transition: 'transform 0.35s, border-color 0.35s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-6px)'
                    e.currentTarget.style.borderColor = 'rgba(79, 219, 200, 0.25)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.borderColor = LP.borderLight
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 12,
                      background: f.icon === 'calendar_today' ? 'rgba(79, 219, 200, 0.12)' : 'rgba(192, 193, 255, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 22,
                    }}
                  >
                    <span className="landing-icon" style={{ fontSize: 28, color: f.icon === 'calendar_today' ? LP.tertiary : LP.primary }}>
                      {f.icon}
                    </span>
                  </div>
                  <h3 style={{ margin: '0 0 14px', fontSize: 22, fontWeight: 700 }}>{f.title}</h3>
                  <p style={{ margin: 0, color: LP.muted, lineHeight: 1.65, fontSize: 15 }}>{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Process */}
        <section id="methodology" style={{ padding: '96px 24px', maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <span style={{ color: LP.tertiary, fontWeight: 700, letterSpacing: '0.2em', fontSize: 13, textTransform: 'uppercase' }}>The Process</span>
            <h2 style={{ margin: '16px 0 0', fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', fontWeight: 700 }}>Architecting Your Vocabulary</h2>
          </div>
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {[
              { n: '01', t: 'Lookup a word', d: 'Identify complex vocabulary during your reading or practice.' },
              { n: '02', t: 'Save to your deck', d: 'Instantly categorize and tag words for specialized review.' },
              { n: '03', t: 'Study Sessions', d: 'Engage in focus-driven active recall exercises daily.' },
              { n: '04', t: 'Test Knowledge', d: 'Validate mastery with high-stakes simulated testing.' },
            ].map((step) => (
              <div
                key={step.n}
                className="landing-glass"
                style={{
                  position: 'relative',
                  zIndex: 1,
                  textAlign: 'center',
                  padding: 28,
                  borderRadius: 16,
                  border: `1px solid ${LP.borderLight}`,
                  background: 'rgba(23, 31, 51, 0.65)',
                }}
              >
                <div style={{ fontSize: 36, fontWeight: 900, color: 'rgba(70, 69, 84, 0.35)', marginBottom: 12 }}>{step.n}</div>
                <h4 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700 }}>{step.t}</h4>
                <p style={{ margin: 0, fontSize: 14, color: LP.muted, lineHeight: 1.55 }}>{step.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Comparison */}
        <section style={{ padding: '96px 24px', background: LP.surfaceLowest }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 56, alignItems: 'stretch' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 48, alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                <h2 style={{ margin: 0, fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', fontWeight: 700, lineHeight: 1.15 }}>
                  The Intentional Approach vs. Generic Apps
                </h2>
                {[
                  {
                    title: 'Depth over Breadth',
                    body: "We don't give you 5000 random words. We give you the 800 critical words with full semantic mapping.",
                  },
                  {
                    title: 'Contextual Integrity',
                    body: 'Learn how words shift meaning in the specific “GMAT academic tone” often found in Reading Comprehension.',
                  },
                  {
                    title: 'No Gamification Fluff',
                    body: 'No streaks, no badges, no noise. Just a pure, focused environment for cognitive expansion.',
                  },
                ].map((item) => (
                  <div key={item.title} style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                    <span className="landing-icon" style={{ color: LP.tertiary, marginTop: 2, fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                    <div>
                      <h5 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>{item.title}</h5>
                      <p style={{ margin: 0, color: LP.muted, lineHeight: 1.6, fontSize: 15 }}>{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ position: 'relative', minHeight: 420, width: '100%' }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 16,
                    overflow: 'hidden',
                    background: `linear-gradient(to bottom right, rgba(128, 131, 255, 0.25), rgba(79, 219, 200, 0.2))`,
                  }}
                >
                  <img src={BOOK_IMG} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.65 }} />
                </div>
                <div
                  className="landing-glass"
                  style={{
                    position: 'absolute',
                    bottom: -12,
                    left: -8,
                    maxWidth: 300,
                    padding: 24,
                    borderRadius: 14,
                    border: `1px solid ${LP.outline}`,
                    background: 'rgba(45, 52, 73, 0.88)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
                  }}
                >
                  <p style={{ margin: 0, fontSize: 17, fontStyle: 'italic', color: LP.primary, lineHeight: 1.45, fontFamily: 'Manrope, var(--sans)' }}>
                    “The only platform that understands the linguistic nuance required for the 99th percentile.”
                  </p>
                  <p style={{ margin: '16px 0 0', fontWeight: 700, fontSize: 14 }}>— Dr. Aris Thorne, GMAT Faculty</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing & Resources (anchors) */}
        <section id="pricing" style={{ padding: '64px 24px 48px', maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Pricing</h2>
          <p style={{ color: LP.muted, margin: 0, lineHeight: 1.6 }}>
            Plans are tied to your account in the app. Open Lexicon to see current options and start your prep.
          </p>
          <Link to={APP_HOME} style={{ ...btnPrimary, marginTop: 20, display: 'inline-flex', textDecoration: 'none' }}>
            View in app
          </Link>
        </section>
        <section id="resources" style={{ padding: '0 24px 80px', maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Resources</h2>
          <p style={{ color: LP.muted, margin: 0, lineHeight: 1.6 }}>Guides and release notes live alongside the product—check the app after you sign in.</p>
        </section>

        {/* Final CTA */}
        <section style={{ padding: '0 24px 96px' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                inset: -4,
                borderRadius: 18,
                background: `linear-gradient(90deg, ${LP.primary}, ${LP.tertiary})`,
                opacity: 0.22,
                filter: 'blur(8px)',
              }}
            />
            <div
              className="landing-glass"
              style={{
                position: 'relative',
                borderRadius: 16,
                border: `1px solid ${LP.borderLight}`,
                background: LP.surface,
                padding: '48px 32px',
                textAlign: 'center',
              }}
            >
              <h2 style={{ margin: '0 0 16px', fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', fontWeight: 700, lineHeight: 1.15 }}>
                Ready to elevate your verbal performance?
              </h2>
              <p style={{ margin: '0 auto 28px', maxWidth: 520, color: LP.muted, fontSize: 18, lineHeight: 1.6 }}>
                Join the ranks of top-tier MBA candidates who utilize Lexicon as their secret weapon for mastery.
              </p>
              {user ? (
                <Link to={APP_HOME} style={{ ...btnPrimary, padding: '16px 40px', borderRadius: 999, fontSize: 18, textDecoration: 'none', display: 'inline-flex' }}>
                  Open app
                </Link>
              ) : (
                <Link to="/sign-up" style={{ ...btnPrimary, padding: '16px 40px', borderRadius: 999, fontSize: 18, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                  Sign up now
                </Link>
              )}
              <div
                style={{
                  marginTop: 36,
                  paddingTop: 28,
                  borderTop: `1px solid ${LP.borderLight}`,
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 36,
                  flexWrap: 'wrap',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  color: LP.muted,
                  textTransform: 'uppercase',
                }}
              >
                <span>Precision</span>
                <span>Focus</span>
                <span>Mastery</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer style={{ position: 'relative', zIndex: 1, borderTop: `1px solid ${LP.borderLight}`, padding: '40px 24px', background: LP.bg }}>
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 24, fontSize: 14, color: LP.muted }}>
            <Link className="landing-link" to="/privacy">
              Privacy Policy
            </Link>
            <Link className="landing-link" to="/terms">
              Terms of Service
            </Link>
            <a className="landing-link" href="#" onClick={(e) => e.preventDefault()} style={{ cursor: 'default' }}>
              Cookie Settings
            </a>
            <a className="landing-link" href="#" onClick={(e) => e.preventDefault()} style={{ cursor: 'default' }}>
              Contact Faculty
            </a>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: LP.muted, opacity: 0.85, maxWidth: 520 }}>
            © {new Date().getFullYear()} GMAT Lexicon. The intellectual sanctuary for advanced preparation.
          </p>
        </div>
      </footer>
    </div>
  )
}
