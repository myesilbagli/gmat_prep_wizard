import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { listVocabItems } from '../lib/vocab'
import type { GeneratedResult } from '../lib/types'
import { normalizeGeneratedResultFromApi } from '../../shared/wordGeneration'
import { countDeckBuckets } from '../../shared/learningBuckets'
import { formatSessionBatchComposition, pickSessionBatchTwelve } from '../../shared/sessionPlanner'
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
import { PrimaryButton } from '../components/ui/PrimaryButton'

type GenerateState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; result: GeneratedResult }
  | { status: 'error'; message: string }

export function HomePage() {
  const [text, setText] = useState('')
  const [state, setState] = useState<GenerateState>({ status: 'idle' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [userReady, setUserReady] = useState(false)
  const user = auth.currentUser
  const [deckStats, setDeckStats] = useState<{
    total: number
    new: number
    learning: number
    familiar: number
    mastered: number
    flagged: number
    sessionWordCount: number
    sessionComposition: string
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
      const profile = await ensureUserProfileDefaults()
      const tz = profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
      const batch = pickSessionBatchTwelve(items, { nowMs: Date.now(), userTimezone: tz })
      const bc = countDeckBuckets(items)
      setDeckStats({
        total: items.length,
        new: bc.new,
        learning: bc.learning,
        familiar: bc.familiar,
        mastered: bc.mastered,
        flagged: bc.flagged,
        sessionWordCount: batch.ids.length,
        sessionComposition: formatSessionBatchComposition(batch.slots),
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
      setState({ status: 'ready', result: normalizeGeneratedResultFromApi(raw) })
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
    <div
      className="container"
      style={{
        paddingTop: 'var(--space-2xl)',
        paddingBottom: 'var(--space-3xl)',
        maxWidth: 1100,
      }}
    >
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <h1 className="text-page-title" style={{ margin: 0 }}>
          Today
        </h1>
        <p className="muted text-body-lg" style={{ margin: 'var(--space-xs) 0 0' }}>
          Your streak, daily session, and quick lookup in one place.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 'var(--space-xl)',
          marginBottom: 'var(--space-xl)',
        }}
      >
        {/* HERO: streak + Start session (the primary surface) */}
        {user ? (
          <div
            className="card"
            style={{
              padding: 'var(--card-pad-comfortable)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-lg)',
              minHeight: 240,
            }}
          >
            <div>
              <div className="muted text-label" style={{ letterSpacing: '0.08em' }}>
                STREAK
              </div>
              <div
                style={{
                  marginTop: 'var(--space-xs)',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 'var(--space-sm)',
                }}
              >
                <span
                  className="text-hero"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--accent-gradient-start), var(--accent-gradient-end))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {profileLoading ? '…' : streak ?? 0}
                </span>
                <span
                  className="text-body-lg muted"
                  style={{ fontWeight: 600 }}
                >
                  day{(streak ?? 0) === 1 ? '' : 's'}
                </span>
              </div>
              <p className="muted text-body-sm" style={{ margin: 'var(--space-xs) 0 0' }}>
                Complete a full daily session to extend your streak.
              </p>
            </div>

            <div style={{ marginTop: 'auto' }}>
              <PrimaryButton as="link" to="/session" style={{ width: '100%' }}>
                Start session
              </PrimaryButton>
              <p
                className="muted text-label"
                style={{
                  margin: 'var(--space-sm) 0 0',
                  textAlign: 'center',
                }}
              >
                {profileLoading ? '…' : sessionCount ?? 0} session
                {(sessionCount ?? 0) === 1 ? '' : 's'} completed all-time
              </p>
            </div>
          </div>
        ) : null}

        {/* DECK BREAKDOWN: visual composition, not a monospace dump */}
        <DeckBreakdownCard deckStats={deckStats} signedIn={!!user} />
      </div>

      {/* LOOKUP — secondary section */}
      <section style={{ marginTop: 'var(--space-2xl)' }}>
        <div className="muted text-label" style={{ marginBottom: 'var(--space-md)' }}>
          LOOK UP A WORD
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-md)',
            padding: 'var(--space-md) var(--space-lg)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            flexWrap: 'wrap',
          }}
        >
          <input
            placeholder="Type a word or phrase — e.g. equivocate, in light of"
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
            className="text-body"
            style={{
              flex: '1 1 240px',
              minWidth: 0,
              border: 'none',
              background: 'transparent',
              color: 'var(--text)',
              outline: 'none',
              padding: 'var(--space-2xs) 0',
              minHeight: 28,
            }}
          />
          <PrimaryButton
            onClick={generate}
            disabled={!canGenerate || state.status === 'loading' || !userReady}
            loading={state.status === 'loading'}
          >
            {state.status === 'loading' ? 'Generating…' : 'Generate Analysis'}
          </PrimaryButton>
        </div>

        {!user ? (
          <p className="muted text-body-sm" style={{ margin: 'var(--space-sm) 0 0' }}>
            Sign in to generate and save your words.
          </p>
        ) : null}

        <div
          className="card"
          style={{
            marginTop: 'var(--space-lg)',
            padding: 'var(--card-pad-comfortable)',
          }}
        >
          {state.status === 'idle' && (
            <p className="muted text-body" style={{ margin: 0 }}>
              Enter a word or phrase and tap Generate Analysis.
            </p>
          )}
          {state.status === 'loading' && <LookupLoading word={text.trim()} />}
          {state.status === 'error' && (
            <p className="text-body" style={{ margin: 0, color: 'var(--danger)' }}>
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
      </section>
    </div>
  )
}

/**
 * Visual deck breakdown — replaces the previous monospace "New 177 / Learning
 * 71 / …" dump. Renders a segmented progress bar (one segment per bucket),
 * a colored-dot legend with counts, and a callout for today's session size
 * and composition. Uses only existing tokens.
 */
function DeckBreakdownCard({
  deckStats,
  signedIn,
}: {
  deckStats: {
    total: number
    new: number
    learning: number
    familiar: number
    mastered: number
    flagged: number
    sessionWordCount: number
    sessionComposition: string
  } | null
  signedIn: boolean
}) {
  if (!signedIn) {
    return (
      <div
        className="card"
        style={{
          padding: 'var(--card-pad-comfortable)',
          minHeight: 240,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)',
        }}
      >
        <div className="muted text-label" style={{ letterSpacing: '0.08em' }}>
          YOUR DECK
        </div>
        <p className="muted text-body" style={{ margin: 0 }}>
          Sign in to track your saved words.
        </p>
      </div>
    )
  }

  if (!deckStats) {
    return (
      <div
        className="card"
        style={{
          padding: 'var(--card-pad-comfortable)',
          minHeight: 240,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)',
        }}
      >
        <div className="muted text-label" style={{ letterSpacing: '0.08em' }}>
          YOUR DECK
        </div>
        <p className="muted text-body" style={{ margin: 0 }}>
          Loading deck…
        </p>
      </div>
    )
  }

  const total = deckStats.total
  const segments: Array<{
    key: 'new' | 'learning' | 'familiar' | 'mastered'
    label: string
    count: number
    color: string
  }> = [
    { key: 'new', label: 'New', count: deckStats.new, color: 'var(--fill-muted)' },
    {
      key: 'learning',
      label: 'Learning',
      count: deckStats.learning,
      color: 'var(--accent-gradient-end)',
    },
    {
      key: 'familiar',
      label: 'Familiar',
      count: deckStats.familiar,
      color: 'var(--accent-gradient-start)',
    },
    {
      key: 'mastered',
      label: 'Mastered',
      count: deckStats.mastered,
      color: 'var(--success)',
    },
  ]

  return (
    <div
      className="card"
      style={{
        padding: 'var(--card-pad-comfortable)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-lg)',
        minHeight: 240,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 'var(--space-sm)',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div className="muted text-label" style={{ letterSpacing: '0.08em' }}>
            YOUR DECK
          </div>
          <div
            style={{
              marginTop: 'var(--space-xs)',
              display: 'flex',
              alignItems: 'baseline',
              gap: 'var(--space-sm)',
            }}
          >
            <span className="text-headword">{total}</span>
            <span className="muted text-body-sm">word{total === 1 ? '' : 's'}</span>
          </div>
        </div>
        {deckStats.flagged > 0 ? (
          <span
            className="text-label"
            style={{
              padding: '2px var(--space-xs)',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--selection-fill)',
              color: 'color-mix(in srgb, var(--accent-gradient-end) 75%, var(--text))',
              textTransform: 'uppercase',
            }}
          >
            ★ {deckStats.flagged} flagged
          </span>
        ) : null}
      </div>

      {total > 0 ? (
        <>
          {/* Segmented composition bar */}
          <div
            aria-label="Deck composition"
            style={{
              display: 'flex',
              height: 10,
              width: '100%',
              borderRadius: 'var(--radius-pill)',
              overflow: 'hidden',
              border: '1px solid var(--border)',
              background: 'var(--fill-subtle)',
            }}
          >
            {segments.map((s) =>
              s.count > 0 ? (
                <div
                  key={s.key}
                  title={`${s.label}: ${s.count}`}
                  style={{
                    width: `${(s.count / total) * 100}%`,
                    background: s.color,
                  }}
                />
              ) : null,
            )}
          </div>

          {/* Legend with counts */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 'var(--space-sm) var(--space-md)',
            }}
          >
            {segments.map((s) => (
              <div
                key={s.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-xs)',
                  minWidth: 0,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 'var(--radius-pill)',
                    background: s.color,
                    flexShrink: 0,
                  }}
                />
                <span className="muted text-label">{s.label}</span>
                <span
                  className="text-body"
                  style={{ marginLeft: 'auto', fontWeight: 700 }}
                >
                  {s.count}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="muted text-body" style={{ margin: 0 }}>
          Save your first words below to see your deck breakdown.
        </p>
      )}

      {/* Today's session callout */}
      <div
        style={{
          marginTop: 'auto',
          paddingTop: 'var(--space-md)',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div className="muted text-label" style={{ letterSpacing: '0.08em' }}>
          TODAY&apos;S SESSION
        </div>
        <div
          style={{
            marginTop: 'var(--space-2xs)',
            display: 'flex',
            alignItems: 'baseline',
            gap: 'var(--space-sm)',
          }}
        >
          <span className="text-title">{deckStats.sessionWordCount}</span>
          <span className="muted text-body-sm">
            word{deckStats.sessionWordCount === 1 ? '' : 's'}
          </span>
        </div>
        {deckStats.sessionComposition ? (
          <p
            className="muted text-body-sm"
            style={{ margin: 'var(--space-2xs) 0 0' }}
          >
            {deckStats.sessionComposition}
          </p>
        ) : null}
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
  const twoExamples = result.examples?.length === 2 ? result.examples : null
  const exampleSentence =
    twoExamples == null
      ? (result.exampleSentence?.trim() || result.examples?.[0]?.trim() || '')
      : ''
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
          <div className="text-headword-emphasis" style={{ color: 'var(--text)' }}>
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

      {twoExamples ? (
        <>
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
                Example (academic)
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
                {twoExamples[0]}
              </p>
            </div>
          </div>
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
                Example (argument)
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
                {twoExamples[1]}
              </p>
            </div>
          </div>
        </>
      ) : exampleSentence ? (
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
      ) : null}

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
                className="text-body-sm"
                style={{
                  padding: 'var(--space-2xs) var(--space-md)',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--border)',
                  background: 'var(--fill-subtle)',
                  color: 'var(--muted)',
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {result.wordTags && result.wordTags.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--muted)',
              marginBottom: 8,
            }}
          >
            Tags
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {result.wordTags.map((t, i) => (
              <span
                key={`${t}-${i}`}
                className="text-label"
                style={{
                  padding: 'var(--space-2xs) var(--space-md)',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--border)',
                  background: 'var(--selection-fill)',
                  color: 'var(--text)',
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {result.contrastWord?.word && result.contrastWord.explanation ? (
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--muted)',
              marginBottom: 6,
            }}
          >
            Contrast
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text)' }}>{result.contrastWord.word}</strong>
            {' — '}
            {result.contrastWord.explanation}
          </p>
        </div>
      ) : null}

      {result.memoryHook ? (
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
              Memory hook
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
              {result.memoryHook}
            </p>
          </div>
        </div>
      ) : null}

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
