/**
 * Profile page (/profile) — identity + study context.
 *
 * Replaces the data-heavy popup that used to conflate quick settings
 * (theme / language / timezone / sign-out, which stay in the header
 * popup) with profile context (exam window, plus the upcoming
 * diagnostic + roadmap surfaces).
 *
 * Data: exam window reads/writes the existing
 *   users/{uid}/settings/profile.examTarget
 * shape via the existing src/lib/userProfile.ts helpers (saveExamTarget
 * + ensureUserProfileDefaults). No new collection, no schema divergence.
 * The diagnostic + roadmap sections are stubs for the next build —
 * placeholders only, no Firestore reads/writes for those today.
 */
import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { Link } from 'react-router-dom'
import { subscribeToAuth } from '../lib/auth'
import {
  ensureUserProfileDefaults,
  saveExamTarget,
} from '../lib/userProfile'
import type { ExamPart, ExamTarget } from '../../shared/userProfile'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { Alert } from '../components/ui/Alert'

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [examYear, setExamYear] = useState(new Date().getFullYear())
  const [examMonth, setExamMonth] = useState(1)
  const [examPart, setExamPart] = useState<ExamPart>('mid')
  const [hasExam, setHasExam] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(
    () =>
      subscribeToAuth((u) => {
        setUser(u)
        setAuthReady(true)
      }),
    [],
  )

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoadingProfile(true)
    void ensureUserProfileDefaults()
      .then((p) => {
        if (cancelled) return
        if (p.examTarget) {
          setExamYear(p.examTarget.year)
          setExamMonth(p.examTarget.month)
          setExamPart(p.examTarget.part)
          setHasExam(true)
        }
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load profile.')
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  async function saveExamWindow() {
    if (!user) return
    setSaving(true)
    setSaveStatus('idle')
    setError(null)
    try {
      const target: ExamTarget = { year: examYear, month: examMonth, part: examPart }
      await saveExamTarget(target)
      setHasExam(true)
      setSaveStatus('saved')
      window.dispatchEvent(new Event('gmat-vocab-profile-updated'))
    } catch (e) {
      setSaveStatus('error')
      setError(e instanceof Error ? e.message : 'Failed to save exam window.')
    } finally {
      setSaving(false)
    }
  }

  if (authReady && !user) {
    return (
      <div
        className="container"
        style={{
          paddingTop: 'var(--space-3xl)',
          paddingBottom: 'var(--space-3xl)',
          maxWidth: 720,
        }}
      >
        <h1 className="text-page-title" style={{ margin: 0 }}>
          Profile
        </h1>
        <Alert variant="info" style={{ marginTop: 'var(--space-lg)' }}>
          Sign in to view your profile.
          <div style={{ marginTop: 'var(--space-sm)' }}>
            <Link
              to="/sign-in"
              className="text-body"
              style={{ color: 'var(--accent-gradient-end)', fontWeight: 600 }}
            >
              Sign in →
            </Link>
          </div>
        </Alert>
      </div>
    )
  }

  const years = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() + i)
  const initials = getInitials(user?.displayName, user?.email)

  return (
    <div
      className="container"
      style={{
        paddingTop: 'var(--space-2xl)',
        paddingBottom: 'var(--space-3xl)',
        maxWidth: 880,
      }}
    >
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <h1 className="text-page-title" style={{ margin: 0 }}>
          Profile
        </h1>
        <p className="muted text-body-lg" style={{ margin: 'var(--space-xs) 0 0' }}>
          Your identity and study context. Quick settings (theme, language, timezone) live
          in the gear icon up in the header.
        </p>
      </div>

      {/* IDENTITY */}
      <div
        className="card"
        style={{
          padding: 'var(--card-pad-comfortable)',
          marginBottom: 'var(--space-xl)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-lg)',
        }}
      >
        <div
          aria-hidden
          style={{
            width: 56,
            height: 56,
            borderRadius: 'var(--radius-pill)',
            background:
              'linear-gradient(135deg, var(--accent-gradient-start), var(--accent-gradient-end))',
            color: 'var(--on-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ display: 'grid', gap: 'var(--space-2xs)', minWidth: 0 }}>
          <div
            className="text-title"
            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {user?.displayName ?? 'GMAT Lexicon user'}
          </div>
          <div
            className="muted text-body-sm"
            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {user?.email ?? '—'}
          </div>
        </div>
      </div>

      {error ? (
        <Alert variant="error" style={{ marginBottom: 'var(--space-lg)' }}>
          {error}
        </Alert>
      ) : null}

      {/* EXAM WINDOW */}
      <section
        className="card"
        style={{
          padding: 'var(--card-pad-comfortable)',
          marginBottom: 'var(--space-xl)',
          display: 'grid',
          gap: 'var(--space-md)',
        }}
      >
        <div>
          <div className="muted text-label" style={{ letterSpacing: '0.08em' }}>
            EXAM WINDOW
          </div>
          <p className="muted text-body-sm" style={{ margin: 'var(--space-xs) 0 0' }}>
            When are you planning to take the GMAT? Pick a month and a window — we'll use
            this to pace your study roadmap.
            {hasExam ? null : (
              <>
                {' '}
                <span style={{ color: 'var(--text)' }}>Not set yet.</span>
              </>
            )}
          </p>
        </div>

        {loadingProfile ? (
          <div className="muted text-body-sm">Loading…</div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 'var(--space-sm)',
            }}
          >
            <label style={{ display: 'grid', gap: 'var(--space-2xs)' }}>
              <span className="muted text-label">Month</span>
              <select
                className="input"
                value={examMonth}
                onChange={(e) => {
                  setExamMonth(Number(e.target.value))
                  setSaveStatus('idle')
                }}
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 'var(--space-2xs)' }}>
              <span className="muted text-label">Year</span>
              <select
                className="input"
                value={examYear}
                onChange={(e) => {
                  setExamYear(Number(e.target.value))
                  setSaveStatus('idle')
                }}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 'var(--space-2xs)' }}>
              <span className="muted text-label">Window</span>
              <select
                className="input"
                value={examPart}
                onChange={(e) => {
                  setExamPart(e.target.value as ExamPart)
                  setSaveStatus('idle')
                }}
              >
                <option value="early">Early in month</option>
                <option value="mid">Mid month</option>
                <option value="late">Late in month</option>
              </select>
            </label>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-md)',
            flexWrap: 'wrap',
          }}
        >
          <PrimaryButton
            onClick={() => void saveExamWindow()}
            disabled={saving || loadingProfile}
            loading={saving}
          >
            {saving ? 'Saving…' : hasExam ? 'Update exam window' : 'Save exam window'}
          </PrimaryButton>
          {saveStatus === 'saved' ? (
            <span className="text-body-sm" style={{ color: 'var(--success-on-soft)' }}>
              ✓ Saved
            </span>
          ) : null}
        </div>
      </section>

      {/* DIAGNOSTIC (stubbed for next build) */}
      <section
        className="card"
        style={{
          padding: 'var(--card-pad-comfortable)',
          marginBottom: 'var(--space-xl)',
          display: 'grid',
          gap: 'var(--space-md)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-sm)',
            flexWrap: 'wrap',
          }}
        >
          <div className="muted text-label" style={{ letterSpacing: '0.08em' }}>
            DIAGNOSTIC
          </div>
          <span
            className="text-label"
            style={{
              padding: '2px var(--space-xs)',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--fill-subtle)',
              color: 'var(--muted)',
              border: '1px dashed var(--border)',
              textTransform: 'uppercase',
            }}
          >
            Coming soon
          </span>
        </div>
        <p className="muted text-body" style={{ margin: 0 }}>
          Add your GMAT diagnostic results to get a personalized study roadmap. We'll use
          your section scores to weight which RC, CR, and vocab work to surface first.
        </p>
        <div>
          <button
            type="button"
            className="btn"
            disabled
            style={{
              padding: 'var(--space-md) var(--space-xl)',
              borderRadius: 'var(--radius-pill)',
              fontWeight: 700,
              background: 'var(--fill-subtle)',
              color: 'var(--muted)',
              cursor: 'not-allowed',
              border: '1px solid var(--border)',
            }}
          >
            Add diagnostic
          </button>
        </div>
      </section>

      {/* STUDY ROADMAP (stubbed for next build) */}
      <section
        className="card"
        style={{
          padding: 'var(--card-pad-comfortable)',
          marginBottom: 'var(--space-xl)',
          display: 'grid',
          gap: 'var(--space-md)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-sm)',
            flexWrap: 'wrap',
          }}
        >
          <div className="muted text-label" style={{ letterSpacing: '0.08em' }}>
            STUDY ROADMAP
          </div>
          <span
            className="text-label"
            style={{
              padding: '2px var(--space-xs)',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--fill-subtle)',
              color: 'var(--muted)',
              border: '1px dashed var(--border)',
              textTransform: 'uppercase',
            }}
          >
            Coming soon
          </span>
        </div>
        <p className="muted text-body" style={{ margin: 0 }}>
          Once a diagnostic is on file and your exam window is set, we'll generate a
          week-by-week plan here — what to study, in what order, and how much time to
          spend on each section.
        </p>
      </section>
    </div>
  )
}

function getInitials(displayName?: string | null, email?: string | null): string {
  const source = (displayName ?? '').trim() || (email ?? '').trim() || ''
  if (!source) return '?'
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  if (parts.length === 0) return source[0]?.toUpperCase() ?? '?'
  const first = parts[0][0] ?? ''
  const second = parts.length > 1 ? parts[1][0] ?? '' : ''
  const out = (first + second).toUpperCase()
  return out || '?'
}
