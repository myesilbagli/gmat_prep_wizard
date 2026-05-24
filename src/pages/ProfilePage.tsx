/**
 * Profile page (/profile) — identity + study context + quick settings,
 * organized as four tabs at the top of the page:
 *
 *   Profile     — identity card + exam window
 *   Diagnostic  — empty-state CTA or computed weakness profile
 *   Roadmap     — coming-soon stub
 *   Settings    — theme / main language / timezone / sign out (used to
 *                 live in the header gear popup that has now been
 *                 removed; this tab is the single canonical home for
 *                 those controls)
 *
 * Data wiring unchanged:
 * - Exam window → users/{uid}/settings/profile.examTarget via
 *   saveExamTarget (src/lib/userProfile.ts).
 * - Theme → setTheme from AppLayout's outlet context; AppLayout
 *   persists to localStorage.
 * - Language / timezone → saveUserProfilePatch — same shape, same
 *   field names, no schema divergence.
 * - Sign out → signOutUser from src/lib/auth.ts.
 * - Diagnostic → users/{uid}/diagnostic/*, unchanged from the
 *   diagnostic intake build.
 */
import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { Link, useOutletContext } from 'react-router-dom'
import { signOutUser, subscribeToAuth } from '../lib/auth'
import {
  ensureUserProfileDefaults,
  saveExamTarget,
  saveUserProfilePatch,
} from '../lib/userProfile'
import {
  DEFAULT_TIMEZONE,
  type ExamPart,
  type ExamTarget,
} from '../../shared/userProfile'
import {
  DEFAULT_MAIN_LANGUAGE,
  MAIN_LANGUAGE_OPTIONS,
  normalizeMainLanguageCode,
} from '../../shared/languages'
import { getLatestDiagnostic } from '../lib/diagnostic'
import type { DiagnosticDoc } from '../../shared/diagnosticTypes'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { Alert } from '../components/ui/Alert'
import { DiagnosticWeaknessProfile } from '../components/DiagnosticWeaknessProfile'
import type { AppLayoutOutletContext } from '../components/AppLayout'

type Tab = 'profile' | 'diagnostic' | 'roadmap' | 'settings'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'profile', label: 'Profile' },
  { id: 'diagnostic', label: 'Diagnostic' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'settings', label: 'Settings' },
]

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
  const { theme, setTheme } = useOutletContext<AppLayoutOutletContext>()
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  useEffect(
    () =>
      subscribeToAuth((u) => {
        setUser(u)
        setAuthReady(true)
      }),
    [],
  )

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

  return (
    <div
      className="container"
      style={{
        paddingTop: 'var(--space-2xl)',
        paddingBottom: 'var(--space-3xl)',
        maxWidth: 880,
      }}
    >
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <h1 className="text-page-title" style={{ margin: 0 }}>
          Profile
        </h1>
        <p className="muted text-body-lg" style={{ margin: 'var(--space-xs) 0 0' }}>
          Your identity, study context, and preferences.
        </p>
      </div>

      <TabBar active={activeTab} onChange={setActiveTab} />

      {activeTab === 'profile' ? <ProfileTab user={user} /> : null}
      {activeTab === 'diagnostic' ? <DiagnosticTab user={user} /> : null}
      {activeTab === 'roadmap' ? <RoadmapTab /> : null}
      {activeTab === 'settings' ? (
        <SettingsTab user={user} theme={theme} setTheme={setTheme} />
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: 'var(--space-md)',
        borderBottom: '1px solid var(--border)',
        marginBottom: 'var(--space-xl)',
        overflowX: 'auto',
      }}
    >
      {TABS.map((t) => {
        const isActive = t.id === active
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            style={{
              padding: 'var(--space-sm) var(--space-2xs)',
              marginBottom: -1,
              border: 'none',
              background: 'transparent',
              color: isActive ? 'var(--text)' : 'var(--muted)',
              fontFamily: 'inherit',
              fontSize: 'var(--text-body-size)',
              fontWeight: isActive ? 700 : 500,
              cursor: 'pointer',
              borderBottom: isActive ? '2px solid var(--text)' : '2px solid transparent',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Profile tab — identity + exam window
// ---------------------------------------------------------------------------

function ProfileTab({ user }: { user: User | null }) {
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [examYear, setExamYear] = useState(new Date().getFullYear())
  const [examMonth, setExamMonth] = useState(1)
  const [examPart, setExamPart] = useState<ExamPart>('mid')
  const [hasExam, setHasExam] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

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

  const years = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() + i)
  const initials = getInitials(user?.displayName, user?.email)

  return (
    <>
      {/* Identity */}
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

      {/* Exam window */}
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
    </>
  )
}

// ---------------------------------------------------------------------------
// Diagnostic tab — empty CTA or weakness profile
// ---------------------------------------------------------------------------

function DiagnosticTab({ user }: { user: User | null }) {
  const [doc, setDoc] = useState<DiagnosticDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setDoc(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void getLatestDiagnostic()
      .then((d) => {
        if (cancelled) return
        setDoc(d)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load diagnostic.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  return (
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
        {doc ? (
          <Link
            to="/profile/diagnostic"
            className="muted text-body-sm"
            style={{ textDecoration: 'none' }}
          >
            Re-do diagnostic →
          </Link>
        ) : null}
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {loading ? <div className="muted text-body-sm">Loading…</div> : null}

      {!loading && doc == null ? (
        <>
          <p className="muted text-body" style={{ margin: 0 }}>
            Add your GMAT diagnostic results to get a personalized study roadmap. We'll
            use your section scores to weight which RC, CR, and vocab work to surface
            first.
          </p>
          <div>
            <PrimaryButton as="link" to="/profile/diagnostic">
              Add diagnostic
            </PrimaryButton>
          </div>
        </>
      ) : null}

      {doc ? <DiagnosticWeaknessProfile doc={doc} /> : null}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Roadmap tab — stub
// ---------------------------------------------------------------------------

function RoadmapTab() {
  return (
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
  )
}

// ---------------------------------------------------------------------------
// Settings tab — theme / language / timezone / sign out
// ---------------------------------------------------------------------------

function SettingsTab({
  user,
  theme,
  setTheme,
}: {
  user: User | null
  theme: 'dark' | 'light'
  setTheme: (next: 'dark' | 'light') => void
}) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signOutBusy, setSignOutBusy] = useState(false)
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE)
  const [mainLanguage, setMainLanguage] = useState(DEFAULT_MAIN_LANGUAGE)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)
    void ensureUserProfileDefaults()
      .then((p) => {
        if (cancelled) return
        setTimezone(p.timezone || DEFAULT_TIMEZONE)
        setMainLanguage(normalizeMainLanguageCode(p.mainLanguage))
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load settings.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  async function saveSettings() {
    if (!user) return
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await saveUserProfilePatch({
        timezone: timezone.trim() || DEFAULT_TIMEZONE,
        mainLanguage: normalizeMainLanguageCode(mainLanguage),
      })
      setSaved(true)
      window.dispatchEvent(new Event('gmat-vocab-profile-updated'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  async function onSignOut() {
    setSignOutBusy(true)
    try {
      await signOutUser()
    } finally {
      setSignOutBusy(false)
    }
  }

  return (
    <section
      className="card"
      style={{
        padding: 'var(--card-pad-comfortable)',
        marginBottom: 'var(--space-xl)',
        display: 'grid',
        gap: 'var(--space-lg)',
      }}
    >
      <div className="muted text-label" style={{ letterSpacing: '0.08em' }}>
        SETTINGS
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div>
        <div className="muted text-label" style={{ marginBottom: 'var(--space-xs)' }}>
          Theme
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-xs)', maxWidth: 320 }}>
          <button
            type="button"
            className="btn"
            onClick={() => setTheme('light')}
            style={{
              flex: 1,
              borderColor: theme === 'light' ? 'var(--text)' : undefined,
              color: theme === 'light' ? 'var(--text)' : 'var(--muted)',
              fontWeight: theme === 'light' ? 700 : 500,
            }}
          >
            Light
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setTheme('dark')}
            style={{
              flex: 1,
              borderColor: theme === 'dark' ? 'var(--text)' : undefined,
              color: theme === 'dark' ? 'var(--text)' : 'var(--muted)',
              fontWeight: theme === 'dark' ? 700 : 500,
            }}
          >
            Dark
          </button>
        </div>
      </div>

      <div>
        <div className="muted text-label" style={{ marginBottom: 'var(--space-xs)' }}>
          Main language
        </div>
        <p className="muted text-body-sm" style={{ margin: '0 0 var(--space-xs)' }}>
          Short gloss on cards in this language; English stays the study language.
        </p>
        <select
          className="input"
          value={mainLanguage}
          onChange={(e) => {
            setMainLanguage(e.target.value)
            setSaved(false)
          }}
          disabled={loading || saving}
          style={{ maxWidth: 320 }}
        >
          {MAIN_LANGUAGE_OPTIONS.map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="muted text-label" style={{ marginBottom: 'var(--space-xs)' }}>
          Timezone
        </div>
        <p className="muted text-body-sm" style={{ margin: '0 0 var(--space-xs)' }}>
          Used to compute your daily streak window. Example: Europe/Istanbul.
        </p>
        <input
          className="input"
          placeholder="e.g. Europe/Istanbul"
          value={timezone}
          onChange={(e) => {
            setTimezone(e.target.value)
            setSaved(false)
          }}
          disabled={loading || saving}
          style={{ maxWidth: 320 }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-md)',
          flexWrap: 'wrap',
        }}
      >
        <PrimaryButton
          onClick={() => void saveSettings()}
          disabled={saving || loading}
          loading={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </PrimaryButton>
        {saved ? (
          <span className="text-body-sm" style={{ color: 'var(--success-on-soft)' }}>
            ✓ Saved
          </span>
        ) : null}
      </div>

      <div
        style={{
          borderTop: '1px solid var(--border)',
          paddingTop: 'var(--space-lg)',
        }}
      >
        <div
          className="muted text-label"
          style={{ marginBottom: 'var(--space-xs)', letterSpacing: '0.08em' }}
        >
          ACCOUNT
        </div>
        <p className="muted text-body-sm" style={{ margin: '0 0 var(--space-md)' }}>
          Sign out of this device. Your data stays in the cloud.
        </p>
        <button
          type="button"
          className="btn"
          onClick={() => void onSignOut()}
          disabled={signOutBusy}
          style={{
            padding: 'var(--space-sm) var(--space-lg)',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
          }}
        >
          {signOutBusy ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
