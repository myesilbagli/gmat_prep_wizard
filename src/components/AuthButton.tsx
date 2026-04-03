import { useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { MAIN_LANGUAGE_OPTIONS, DEFAULT_MAIN_LANGUAGE, normalizeMainLanguageCode } from '../../shared/languages'
import type { ExamPart, ExamTarget } from '../../shared/userProfile'
import { DEFAULT_TIMEZONE } from '../../shared/userProfile'
import { signInWithGoogle, signOutUser, subscribeToAuth } from '../lib/auth'
import { ensureUserProfileDefaults, saveExamTarget, saveUserProfilePatch } from '../lib/userProfile'

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
  const [examYear, setExamYear] = useState(new Date().getFullYear())
  const [examMonth, setExamMonth] = useState(1)
  const [examPart, setExamPart] = useState<ExamPart>('mid')
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
        if (p.examTarget) {
          setExamYear(p.examTarget.year)
          setExamMonth(p.examTarget.month)
          setExamPart(p.examTarget.part)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingProfile(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, user])

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const years = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() + i)

  async function saveProfileSettings() {
    if (!user) return
    setSaving(true)
    setSaved(false)
    try {
      await saveUserProfilePatch({
        timezone: timezone.trim() || DEFAULT_TIMEZONE,
        mainLanguage: normalizeMainLanguageCode(mainLanguage),
      })
      const target: ExamTarget = { year: examYear, month: examMonth, part: examPart }
      await saveExamTarget(target)
      setSaved(true)
      window.dispatchEvent(new Event('gmat-vocab-profile-updated'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button
        className="btn"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        title={user?.email ?? undefined}
      >
        {user ? `Profile (${user.displayName ?? 'user'})` : 'Profile'}
      </button>
      {open ? (
        <div
          className="card"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: 300,
            maxWidth: 360,
            padding: 14,
            display: 'grid',
            gap: 12,
            zIndex: 30,
          }}
        >
          {!user ? (
            <button
              className="btn btnPrimary"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await signInWithGoogle()
                  setOpen(false)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? 'Signing in…' : 'Sign in with Google'}
            </button>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>SETTINGS</div>
              <div style={{ display: 'flex', gap: 8 }}>
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

              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginTop: 4 }}>
                MAIN LANGUAGE
              </div>
              <p className="muted" style={{ margin: '0 0 8px', fontSize: 12, lineHeight: 1.45 }}>
                Short gloss on cards in this language; English stays the study language.
              </p>
              <select
                className="input"
                value={mainLanguage}
                onChange={(e) => setMainLanguage(e.target.value)}
                style={{ width: '100%', marginBottom: 4 }}
              >
                {MAIN_LANGUAGE_OPTIONS.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>

              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginTop: 12 }}>
                EXAM WINDOW
              </div>
              {loadingProfile ? <div className="muted">Loading profile…</div> : null}
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    className="input"
                    value={examMonth}
                    onChange={(e) => setExamMonth(Number(e.target.value))}
                    style={{ minWidth: 84 }}
                  >
                    {monthNames.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input"
                    value={examYear}
                    onChange={(e) => setExamYear(Number(e.target.value))}
                    style={{ minWidth: 92 }}
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input"
                    value={examPart}
                    onChange={(e) => setExamPart(e.target.value as ExamPart)}
                    style={{ minWidth: 110 }}
                  >
                    <option value="early">Early</option>
                    <option value="mid">Mid</option>
                    <option value="late">Late</option>
                  </select>
                </div>
                <input
                  className="input"
                  placeholder="Timezone (e.g. Europe/Istanbul)"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void saveProfileSettings()}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Save profile'}
                  </button>
                  {saved ? <span className="muted" style={{ fontSize: 12 }}>Saved</span> : null}
                </div>
              </div>

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
              >
                {busy ? 'Working…' : 'Sign out'}
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

