import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { Link, useNavigate } from 'react-router-dom'
import {
  mapAuthError,
  sendPasswordReset,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  subscribeToAuth,
} from '../lib/auth'
import { BOOK_IMG, LP, landingBtnGhost, landingBtnPrimary, landingInputStyle } from '../lib/landingPalette'
import { APP_HOME } from '../lib/routes'

export function SignInPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [appleBusy, setAppleBusy] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)

  useEffect(() => subscribeToAuth(setUser), [])

  useEffect(() => {
    if (user) navigate(APP_HOME, { replace: true })
  }, [user, navigate])

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signInWithEmail(email, password)
      navigate(APP_HOME, { replace: true })
    } catch (err) {
      setError(mapAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError(null)
    setGoogleBusy(true)
    try {
      await signInWithGoogle()
      navigate(APP_HOME, { replace: true })
    } catch (err) {
      setError(mapAuthError(err))
    } finally {
      setGoogleBusy(false)
    }
  }

  async function handleApple() {
    setError(null)
    setAppleBusy(true)
    try {
      await signInWithApple()
      navigate(APP_HOME, { replace: true })
    } catch (err) {
      setError(mapAuthError(err))
    } finally {
      setAppleBusy(false)
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResetSent(false)
    if (!email.trim()) {
      setError('Enter your email to reset your password.')
      return
    }
    setResetBusy(true)
    try {
      await sendPasswordReset(email)
      setResetSent(true)
    } catch (err) {
      setError(mapAuthError(err))
    } finally {
      setResetBusy(false)
    }
  }

  const btnPrimary = landingBtnPrimary()
  const btnGhost = landingBtnGhost()
  const inputStyle = landingInputStyle()

  return (
    <div className="landing-page" style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column' }}>
      <div
        className="landing-aurora"
        style={{ width: 480, height: 480, top: -140, left: -120, background: LP.primary }}
      />
      <div
        className="landing-aurora"
        style={{ width: 520, height: 520, top: '35%', right: -120, background: LP.tertiary }}
      />

      <header
        className="landing-glass"
        style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${LP.borderLight}`,
          background: 'rgba(45, 52, 73, 0.55)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div style={{ maxWidth: 440, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/" style={{ fontWeight: 800, color: LP.text, textDecoration: 'none', fontSize: 18 }}>
            ← GMAT Lexicon
          </Link>
          <Link to="/sign-up" className="landing-link" style={{ fontWeight: 600, fontSize: 14 }}>
            Sign up
          </Link>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', position: 'relative', zIndex: 1 }}>
        <div
          className="landing-glass"
          style={{
            width: '100%',
            maxWidth: 420,
            borderRadius: 16,
            border: `1px solid ${LP.borderLight}`,
            background: 'rgba(23, 31, 51, 0.75)',
            padding: '36px 28px',
            boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
          }}
        >
          <div
            style={{
              width: '100%',
              height: 120,
              borderRadius: 12,
              marginBottom: 24,
              overflow: 'hidden',
              opacity: 0.35,
              border: `1px solid ${LP.borderLight}`,
            }}
          >
            <img src={BOOK_IMG} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>

          <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800, color: LP.text }}>Sign in</h1>
          <p style={{ margin: '0 0 24px', color: LP.muted, fontSize: 15, lineHeight: 1.5 }}>
            {forgotMode ? 'We will email you a link to reset your password.' : 'Use email or continue with Google or Apple.'}
          </p>

          {error ? (
            <p style={{ margin: '0 0 16px', color: '#f87171', fontSize: 14, lineHeight: 1.45 }}>{error}</p>
          ) : null}
          {resetSent ? (
            <p style={{ margin: '0 0 16px', color: LP.tertiary, fontSize: 14 }}>Check your inbox for reset instructions.</p>
          ) : null}

          {!forgotMode ? (
            <>
              <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
                <button
                  type="button"
                  style={{ ...btnPrimary, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: googleBusy ? 0.75 : 1 }}
                  onClick={() => void handleGoogle()}
                  disabled={googleBusy || appleBusy || loading}
                >
                  {googleBusy ? 'Opening Google…' : 'Continue with Google'}
                </button>
                <button
                  type="button"
                  style={{
                    ...landingBtnGhost(),
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    background: '#000',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    opacity: appleBusy ? 0.75 : 1,
                  }}
                  onClick={() => void handleApple()}
                  disabled={googleBusy || appleBusy || loading}
                >
                  {appleBusy ? 'Opening Apple…' : 'Continue with Apple'}
                </button>
              </div>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <span style={{ color: LP.muted, fontSize: 12 }}>or with email</span>
              </div>
              <form onSubmit={handleEmailSignIn} style={{ display: 'grid', gap: 14 }}>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                />
                <button
                  type="submit"
                  style={{ ...btnPrimary, width: '100%', padding: '14px', fontSize: 16 }}
                  disabled={loading || !email.trim() || !password}
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
              <button
                type="button"
                onClick={() => {
                  setForgotMode(true)
                  setError(null)
                  setResetSent(false)
                }}
                style={{
                  marginTop: 14,
                  background: 'none',
                  border: 'none',
                  color: LP.primary,
                  cursor: 'pointer',
                  fontSize: 14,
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                Forgot password?
              </button>
            </>
          ) : (
            <form onSubmit={handleReset} style={{ display: 'grid', gap: 14 }}>
              <input
                type="email"
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
              <button type="submit" style={{ ...btnPrimary, width: '100%', padding: '14px' }} disabled={resetBusy}>
                {resetBusy ? 'Sending…' : 'Send reset link'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForgotMode(false)
                  setError(null)
                  setResetSent(false)
                }}
                style={{ ...btnGhost, width: '100%' }}
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
