/**
 * Header auth + settings controls. Two surfaces, rendered side by side:
 *
 *   [ Profile (Name) ]  [ ⚙ ]
 *
 * - "Profile (Name)" — a Link to /profile. Used to be the entire popup;
 *   now it just navigates to the real profile page (identity, exam
 *   window, diagnostic stub, roadmap stub).
 *
 * - Gear icon — opens a lightweight settings popup with the quick prefs
 *   only: theme, main language, timezone, and sign out. Exam window was
 *   moved OUT of this popup into the profile page; that's the only
 *   behavior change relative to the prior popup.
 *
 * All save paths still write to users/{uid}/settings/profile via
 * src/lib/userProfile.ts → saveUserProfilePatch. Same shape, no schema
 * divergence.
 */
import { useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { Link } from 'react-router-dom'
import {
  DEFAULT_MAIN_LANGUAGE,
  MAIN_LANGUAGE_OPTIONS,
  normalizeMainLanguageCode,
} from '../../shared/languages'
import { DEFAULT_TIMEZONE } from '../../shared/userProfile'
import { signOutUser, subscribeToAuth } from '../lib/auth'
import { ensureUserProfileDefaults, saveUserProfilePatch } from '../lib/userProfile'

type Theme = 'dark' | 'light'

type AuthButtonProps = {
  theme: Theme
  setTheme: (next: Theme) => void
}

export function AuthButton({ theme, setTheme }: AuthButtonProps) {
  const [user, setUser] = useState<User | null>(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE)
  const [mainLanguage, setMainLanguage] = useState(DEFAULT_MAIN_LANGUAGE)
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => subscribeToAuth(setUser), [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (!target || !boxRef.current) return
      if (!boxRef.current.contains(target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    if (!open || !user) return
    let cancelled = false
    setLoadingProfile(true)
    void ensureUserProfileDefaults()
      .then((p) => {
        if (cancelled) return
        setTimezone(p.timezone || DEFAULT_TIMEZONE)
        setMainLanguage(normalizeMainLanguageCode(p.mainLanguage))
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingProfile(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, user])

  async function saveSettings() {
    if (!user) return
    setSaving(true)
    setSaved(false)
    try {
      await saveUserProfilePatch({
        timezone: timezone.trim() || DEFAULT_TIMEZONE,
        mainLanguage: normalizeMainLanguageCode(mainLanguage),
      })
      setSaved(true)
      window.dispatchEvent(new Event('gmat-vocab-profile-updated'))
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center' }}>
        <Link
          to="/sign-in"
          className="btn"
          style={{ textDecoration: 'none', display: 'inline-block' }}
        >
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <div
      ref={boxRef}
      style={{ position: 'relative', display: 'flex', gap: 'var(--space-xs)', alignItems: 'center' }}
    >
      <Link
        to="/profile"
        className="btn"
        style={{ textDecoration: 'none', display: 'inline-block' }}
        title={user.email ?? undefined}
      >
        Profile ({user.displayName ?? 'user'})
      </Link>
      <button
        type="button"
        className="btn"
        aria-label="Settings"
        title="Settings"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 36,
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconGear />
      </button>

      {open ? (
        <div
          className="card"
          style={{
            position: 'absolute',
            top: 'calc(100% + var(--space-xs))',
            right: 0,
            minWidth: 300,
            maxWidth: 360,
            padding: 'var(--card-pad-compact)',
            display: 'grid',
            gap: 'var(--space-md)',
            zIndex: 30,
          }}
        >
          <div className="muted text-label" style={{ letterSpacing: '0.08em' }}>
            SETTINGS
          </div>

          <div>
            <div
              className="muted text-label"
              style={{ marginBottom: 'var(--space-2xs)' }}
            >
              Theme
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setTheme('light')}
                style={{
                  flex: 1,
                  borderColor: theme === 'light' ? 'var(--text)' : undefined,
                  color: theme === 'light' ? 'var(--text)' : 'var(--muted)',
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
                }}
              >
                Dark
              </button>
            </div>
          </div>

          <div>
            <div
              className="muted text-label"
              style={{ marginBottom: 'var(--space-2xs)' }}
            >
              Main language
            </div>
            <p className="muted text-label" style={{ margin: '0 0 var(--space-2xs)' }}>
              Short gloss on cards in this language; English stays the study language.
            </p>
            <select
              className="input"
              value={mainLanguage}
              onChange={(e) => setMainLanguage(e.target.value)}
              style={{ width: '100%' }}
            >
              {MAIN_LANGUAGE_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div
              className="muted text-label"
              style={{ marginBottom: 'var(--space-2xs)' }}
            >
              Timezone
            </div>
            <input
              className="input"
              placeholder="e.g. Europe/Istanbul"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
            <button
              type="button"
              className="btn"
              onClick={() => void saveSettings()}
              disabled={saving || loadingProfile}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {saved ? (
              <span className="text-body-sm" style={{ color: 'var(--success-on-soft)' }}>
                ✓ Saved
              </span>
            ) : null}
          </div>

          <Link
            to="/profile"
            className="muted text-body-sm"
            style={{ textDecoration: 'none' }}
            onClick={() => setOpen(false)}
          >
            View full profile →
          </Link>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-md)' }}>
            <button
              className="btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await signOutUser()
                  setOpen(false)
                } finally {
                  setBusy(false)
                }
              }}
              style={{ width: '100%' }}
            >
              {busy ? 'Working…' : 'Sign out'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function IconGear() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx={12} cy={12} r={3} />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
