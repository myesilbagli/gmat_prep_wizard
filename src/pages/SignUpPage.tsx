import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { Link, useNavigate } from 'react-router-dom'
import { mapAuthError, signInWithApple, signInWithGoogle, signUpWithEmail, subscribeToAuth } from '../lib/auth'
import { BOOK_IMG, LP, landingBtnGhost, landingBtnPrimary, landingInputStyle } from '../lib/landingPalette'
import { APP_HOME } from '../lib/routes'

export function SignUpPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [appleBusy, setAppleBusy] = useState(false)

  useEffect(() => subscribeToAuth(setUser), [])

  useEffect(() => {
    if (user) navigate(APP_HOME, { replace: true })
  }, [user, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password should be at least 6 characters.')
      return
    }
    setLoading(true)
    try {
      await signUpWithEmail(email, password)
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

  const btnPrimary = landingBtnPrimary()
  const inputStyle = landingInputStyle()

  return (
    <div className="landing-page" style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column' }}>
      <div
        className="landing-aurora"
        style={{ width: 480, height: 480, top: -140, right: -100, background: LP.tertiary }}
      />
      <div
        className="landing-aurora"
        style={{ width: 500, height: 500, top: '40%', left: -100, background: LP.primary }}
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
          <Link to="/sign-in" className="landing-link" style={{ fontWeight: 600, fontSize: 14 }}>
            Sign in
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

          <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800, color: LP.text }}>Create account</h1>
          <p style={{ margin: '0 0 24px', color: LP.muted, fontSize: 15, lineHeight: 1.5 }}>
            Same account works on web and mobile. You can use email or a provider below.
          </p>

          {error ? (
            <p style={{ margin: '0 0 16px', color: '#f87171', fontSize: 14, lineHeight: 1.45 }}>{error}</p>
          ) : null}

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
            <span style={{ color: LP.muted, fontSize: 12 }}>or sign up with email</span>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
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
              autoComplete="new-password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={inputStyle}
            />
            <button
              type="submit"
              style={{ ...btnPrimary, width: '100%', padding: '14px', fontSize: 16, borderRadius: 999 }}
              disabled={loading || !email.trim() || password.length < 6}
            >
              {loading ? 'Creating account…' : 'Sign up'}
            </button>
          </form>
          <p style={{ margin: '20px 0 0', textAlign: 'center', color: LP.muted, fontSize: 14 }}>
            Already have an account?{' '}
            <Link to="/sign-in" style={{ color: LP.primary, fontWeight: 600 }}>
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
