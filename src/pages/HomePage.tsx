import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { Link } from 'react-router-dom'
import { auth } from '../lib/firebase'
import { listVocabItems } from '../lib/vocab'
import type { GeneratedResult } from '../lib/types'
import {
  DEFAULT_MAIN_LANGUAGE,
  getMainLanguageLabel,
  normalizeMainLanguageCode,
} from '../../shared/languages'
import { saveWord } from '../lib/words'
import { ensureUserProfileDefaults } from '../lib/userProfile'
import {
  IconBook,
  IconBookmark,
  IconLightbulb,
  IconQuote,
  IconStar,
} from '../components/Icons'

type GenerateState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; result: GeneratedResult }
  | { status: 'error'; message: string }

function emptyResult(): GeneratedResult {
  return {
    definition: '',
    simpleDefinition: '',
    exampleSentence: '',
    synonyms: [],
    nuanceNote: '',
    gmatUsageNote: '',
    definitions: [],
    examples: [],
  }
}

function pickTrimmedString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t || undefined
}

/** Merge `/generate` JSON; some models return `translation_simple` instead of `translationSimple`. */
function normalizeGenerateResultFromApi(raw: unknown): GeneratedResult {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const merged = { ...emptyResult(), ...o } as GeneratedResult
  const gloss =
    pickTrimmedString(o.translationSimple) ??
    pickTrimmedString(o.translation_simple) ??
    pickTrimmedString((o.result as Record<string, unknown> | undefined)?.translationSimple) ??
    pickTrimmedString((o.result as Record<string, unknown> | undefined)?.translation_simple)
  if (gloss) merged.translationSimple = gloss
  return merged
}

export function HomePage() {
  const [text, setText] = useState('')
  const [state, setState] = useState<GenerateState>({ status: 'idle' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [userReady, setUserReady] = useState(false)
  const user = auth.currentUser
  const [deckStats, setDeckStats] = useState<{
    total: number
    learning: number
    mastered: number
    flagged: number
  } | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [streak, setStreak] = useState<number | null>(null)
  const [sessionCount, setSessionCount] = useState<number | null>(null)
  const [mainLanguage, setMainLanguage] = useState(DEFAULT_MAIN_LANGUAGE)

  async function loadDeckStats() {
    if (!auth.currentUser) {
      setDeckStats(null)
      return
    }
    try {
      const items = await listVocabItems()
      setDeckStats({
        total: items.length,
        learning: items.filter((i) => i.status === 'learning').length,
        mastered: items.filter((i) => i.status === 'mastered').length,
        flagged: items.filter((i) => i.flagged).length,
      })
    } catch {
      setDeckStats(null)
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUserReady(true)
      void loadDeckStats()
      if (u) {
        setProfileLoading(true)
        void ensureUserProfileDefaults()
          .then((p) => {
            setStreak(p.streakCurrent)
            setSessionCount(p.sessionCount)
            setMainLanguage(normalizeMainLanguageCode(p.mainLanguage))
          })
          .catch(() => {})
          .finally(() => setProfileLoading(false))
      } else {
        setStreak(null)
        setSessionCount(null)
        setMainLanguage(DEFAULT_MAIN_LANGUAGE)
      }
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const reload = () => {
      void ensureUserProfileDefaults()
        .then((p) => setMainLanguage(normalizeMainLanguageCode(p.mainLanguage)))
        .catch(() => {})
    }
    window.addEventListener('gmat-vocab-profile-updated', reload)
    return () => window.removeEventListener('gmat-vocab-profile-updated', reload)
  }, [])
  const canGenerate = useMemo(() => text.trim().length > 0, [text])

  async function generate() {
    setState({ status: 'loading' })
    setSaved(false)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('Please sign in first.')

      const baseUrl =
        (import.meta.env.VITE_FUNCTIONS_BASE_URL as string | undefined) ?? ''
      if (!baseUrl) throw new Error('Missing VITE_FUNCTIONS_BASE_URL')

      const profile = await ensureUserProfileDefaults()
      const lang = normalizeMainLanguageCode(profile.mainLanguage)
      setMainLanguage(lang)

      const res = await fetch(`${baseUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: text.trim(), mainLanguage: lang }),
      })

      if (!res.ok) {
        const resText = await res.text().catch(() => '')
        throw new Error(resText || `Request failed (${res.status})`)
      }

      const raw = await res.json()
      setState({ status: 'ready', result: normalizeGenerateResultFromApi(raw) })
    } catch (e) {
      setState({
        status: 'error',
        message: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  }

  async function save() {
    if (state.status !== 'ready') return
    setSaving(true)
    try {
      const trimmed = text.trim()
      const type = trimmed.includes(' ') ? 'phrase' : 'word'
      const profile = await ensureUserProfileDefaults()
      const lang = normalizeMainLanguageCode(profile.mainLanguage)
      setMainLanguage(lang)
      await saveWord({ text: trimmed, type, result: state.result, mainLanguage: lang })
      setSaved(true)
      setState({
        status: 'ready',
        result: state.result,
      })
      void loadDeckStats()
    } catch (e) {
      setState({
        status: 'error',
        message: e instanceof Error ? e.message : 'Unknown error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.3 }}>
          Today
        </h1>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 15 }}>
          Your streak, daily session, and quick lookup in one place.
        </p>
      </div>

      {user && (
        <div
          className="card"
          style={{
            padding: 18,
            marginBottom: 20,
            display: 'grid',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <div>
              <div className="muted" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6 }}>
                STREAK
              </div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>
                {profileLoading ? '…' : streak ?? 0}{' '}
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>
                  day{(streak ?? 0) === 1 ? '' : 's'}
                </span>
              </div>
              <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
                Complete a full daily session to extend your streak.
              </p>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                Sessions completed: {profileLoading ? '…' : sessionCount ?? 0}
              </p>
            </div>
            <div style={{ marginLeft: 'auto', width: '100%', maxWidth: 280 }}>
              <Link
                to="/session"
                className="btn btnPrimary"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '14px 18px',
                  fontSize: 16,
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Start session
              </Link>
            </div>
          </div>

        </div>
      )}

      {deckStats ? (
        <div
          className="card"
          style={{
            padding: 16,
            marginBottom: 20,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
            Your deck
          </span>
          <span style={{ fontSize: 13 }}>
            {deckStats.total} total · {deckStats.learning} learning · {deckStats.mastered}{' '}
            mastered · {deckStats.flagged} flagged
          </span>
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 14 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            borderRadius: 14,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <input
            className="input"
            placeholder="Lookup & Generate"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              if (saved) setSaved(false)
            }}
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                canGenerate &&
                state.status !== 'loading' &&
                userReady
              ) {
                e.preventDefault()
                void generate()
              }
            }}
            autoCapitalize="none"
            autoCorrect="off"
            style={{
              border: 'none',
              background: 'transparent',
              minHeight: 28,
              padding: '4px 0',
              flex: 1,
            }}
          />
          <button
            type="button"
            className="btn btnPrimary"
            onClick={generate}
            disabled={!canGenerate || state.status === 'loading' || !userReady}
            style={{ padding: '8px 12px', fontSize: 13 }}
          >
            {state.status === 'loading' ? 'Generating…' : 'Generate Analysis'}
          </button>
        </div>

        {!user ? (
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            Sign in to generate and save your words.
          </p>
        ) : null}
      </div>

      <div style={{ height: 24 }} />

      <div className="card" style={{ padding: 20 }}>
        {state.status === 'idle' && (
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            Enter a word or phrase and tap Generate Analysis.
          </p>
        )}
        {state.status === 'loading' && (
          <LookupLoading word={text.trim()} />
        )}
        {state.status === 'error' && (
          <p style={{ margin: 0, color: 'var(--danger)', fontSize: 14 }}>
            {state.message}
          </p>
        )}
        {state.status === 'ready' && (
          <WordAnalysisCard
            word={text.trim()}
            result={state.result}
            mainLanguage={mainLanguage}
            onSave={save}
            saving={saving}
            saved={saved}
          />
        )}
      </div>
    </div>
  )
}

function LookupLoading({ word }: { word: string }) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="lookupLoadingDot" />
        <p className="muted" style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
          Generating analysis{word ? ` for "${word}"` : ''}...
        </p>
      </div>
      <div className="lookupSkeleton" style={{ width: '34%' }} />
      <div className="lookupSkeleton" style={{ width: '100%' }} />
      <div className="lookupSkeleton" style={{ width: '92%' }} />
      <div className="lookupSkeleton" style={{ width: '76%' }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div className="lookupSkeleton" style={{ width: 88, borderRadius: 999 }} />
        <div className="lookupSkeleton" style={{ width: 96, borderRadius: 999 }} />
        <div className="lookupSkeleton" style={{ width: 78, borderRadius: 999 }} />
      </div>
    </div>
  )
}

function WordAnalysisCard({
  word,
  result,
  mainLanguage,
  onSave,
  saving,
  saved,
}: {
  word: string
  result: GeneratedResult
  mainLanguage: string
  onSave: () => void
  saving: boolean
  saved: boolean
}) {
  const typeLabel = word.includes(' ') ? 'PHRASE' : 'WORD'
  const exampleSentence = result.exampleSentence ?? ''
  const wordRegex = new RegExp(`\\b(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi')
  const nativeGloss = result.translationSimple?.trim() ?? ''
  const languageTitle = (() => {
    const full = getMainLanguageLabel(mainLanguage)
    const cut = full.indexOf(' (')
    return cut >= 0 ? full.slice(0, cut) : full
  })()

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div
            className="muted"
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            {typeLabel}
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: -0.3,
              color: 'var(--text)',
            }}
          >
            {word}
          </div>
        </div>
        <button
          type="button"
          className="btn btnPrimary"
          onClick={onSave}
          disabled={saving || saved}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
          }}
        >
          <IconBookmark style={{ flexShrink: 0 }} />
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </button>
      </div>

      {(result.simpleDefinition || result.definition) && (
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 2 }}>
            <IconBook />
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--muted)',
                marginBottom: 4,
              }}
            >
              Simple definition
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
              {result.simpleDefinition || result.definition}
            </p>
          </div>
        </div>
      )}

      {result.definition && result.definition !== result.simpleDefinition && (
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--muted)',
              marginBottom: 6,
            }}
          >
            Definition
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            {result.definition}
          </p>
        </div>
      )}

      {exampleSentence && (
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 2 }}>
            <IconQuote />
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--muted)',
                marginBottom: 4,
              }}
            >
              Example
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
              {exampleSentence.split(wordRegex).map((part, i) =>
                i % 2 === 1 ? (
                  <strong key={i} style={{ color: 'var(--text)' }}>
                    {part}
                  </strong>
                ) : (
                  <span key={i}>{part}</span>
                ),
              )}
            </p>
          </div>
        </div>
      )}

      {result.synonyms && result.synonyms.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--muted)',
              marginBottom: 8,
            }}
          >
            Synonyms
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {result.synonyms.map((s, i) => (
              <span
                key={`${s}-${i}`}
                style={{
                  fontSize: 13,
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'var(--muted)',
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {nativeGloss ? (
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 2 }}>
            <IconBook />
          </div>
          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--text)',
                letterSpacing: -0.2,
                marginBottom: 6,
              }}
            >
              {languageTitle}
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--muted)',
                marginBottom: 6,
              }}
            >
              Meaning
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 15,
                lineHeight: 1.55,
                color: 'var(--text)',
              }}
            >
              {nativeGloss}
            </p>
          </div>
        </div>
      ) : null}

      {result.nuanceNote && (
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 2 }}>
            <IconLightbulb />
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--muted)',
                marginBottom: 4,
              }}
            >
              Nuance note
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
              {result.nuanceNote}
            </p>
          </div>
        </div>
      )}

      {result.gmatUsageNote && (
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 2 }}>
            <IconStar />
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--muted)',
                marginBottom: 4,
              }}
            >
              GMAT usage note
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
              {result.gmatUsageNote}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
