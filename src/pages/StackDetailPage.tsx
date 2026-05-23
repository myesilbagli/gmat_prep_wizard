/**
 * Curated stack detail + import surface. Lists every word in the stack
 * with per-row "I know it" / "Study it" actions that import the word
 * into users/{uid}/words via saveWordFromStackImport (which calls
 * saveWord with source: 'stack'). This matches mobile's triage
 * semantics: 'I know it' tags the word with WORD_TAG_KNOWN, 'Study it'
 * imports without that tag. Either way, dedup is by textLower.
 *
 * Already-saved words show a 'Saved' badge instead of action buttons.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { WORD_STACK_CATALOG } from '../../shared/freemium'
import { getWordsForStack } from '../../shared/wordStackContent'
import { isCanonicalStackId } from '../../shared/canonicalStacks'
import { WORD_TAG_KNOWN } from '../../shared/wordTags'
import { auth } from '../lib/firebase'
import { saveWordFromStackImport, fetchSavedTextSet, stackWordKey } from '../lib/wordStacks'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { Alert } from '../components/ui/Alert'

type SavedState = {
  /** Set of textLower already saved (across the user's whole pool). */
  keys: Set<string>
  /** Per-word imports done this session, so we can show 'Known' vs 'Saved'
   *  on rows that were imported via this triage flow without re-reading. */
  knownThisSession: Set<string>
}

export function StackDetailPage() {
  const { stackId: rawId } = useParams<{ stackId: string }>()
  const stackId = rawId ?? ''
  const navigate = useNavigate()

  const stackMeta = useMemo(
    () => WORD_STACK_CATALOG.find((s) => s.id === stackId) ?? null,
    [stackId],
  )
  const words = useMemo(() => getWordsForStack(stackId), [stackId])

  const [saved, setSaved] = useState<SavedState>({
    keys: new Set(),
    knownThisSession: new Set(),
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** textLower → 'pending' | undefined while a save is in flight. */
  const [pending, setPending] = useState<Record<string, true>>({})

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setError(null)
      if (!user) {
        setSaved({ keys: new Set(), knownThisSession: new Set() })
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const keys = await fetchSavedTextSet()
        setSaved({ keys, knownThisSession: new Set() })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load your saved words.')
      } finally {
        setLoading(false)
      }
    })
    return () => unsub()
  }, [])

  if (!isCanonicalStackId(stackId) || !stackMeta) {
    return (
      <div
        className="container"
        style={{ paddingTop: 'var(--space-3xl)', paddingBottom: 'var(--space-3xl)' }}
      >
        <Alert variant="error">
          Unknown stack id.{' '}
          <Link to="/learn/stacks" style={{ color: 'inherit' }}>
            Back to stacks
          </Link>
        </Alert>
      </div>
    )
  }

  async function importWord(text: string, markKnown: boolean) {
    const key = stackWordKey(text)
    if (pending[key] || saved.keys.has(key)) return
    if (!auth.currentUser) {
      setError('Sign in to save words.')
      return
    }
    setPending((p) => ({ ...p, [key]: true }))
    try {
      const idx = words.indexOf(text)
      await saveWordFromStackImport({
        text,
        stackId,
        stackPosition: idx < 0 ? 0 : idx,
        markKnown,
      })
      setSaved((s) => {
        const keys = new Set(s.keys)
        keys.add(key)
        const knownThisSession = new Set(s.knownThisSession)
        if (markKnown) knownThisSession.add(key)
        return { keys, knownThisSession }
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save word.')
    } finally {
      setPending((p) => {
        const next = { ...p }
        delete next[key]
        return next
      })
    }
  }

  const savedCount = useMemo(
    () => words.reduce((acc, w) => (saved.keys.has(stackWordKey(w)) ? acc + 1 : acc), 0),
    [words, saved.keys],
  )

  return (
    <div
      className="container"
      style={{
        paddingTop: 'var(--space-2xl)',
        paddingBottom: 'var(--space-3xl)',
        maxWidth: 880,
      }}
    >
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <Link
          to="/learn/stacks"
          className="muted text-body-sm"
          style={{ textDecoration: 'none' }}
        >
          ← All stacks
        </Link>
        <h1 className="text-page-title" style={{ margin: 'var(--space-xs) 0 0' }}>
          {stackMeta.title}
        </h1>
        <p className="muted text-body-lg" style={{ margin: 'var(--space-xs) 0 0' }}>
          {stackMeta.description}
        </p>
        <div
          style={{
            marginTop: 'var(--space-md)',
            display: 'flex',
            gap: 'var(--space-md)',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span className="muted text-label">{words.length} words</span>
          <span
            className="text-label"
            style={{ color: savedCount > 0 ? 'var(--success-on-soft)' : 'var(--muted)' }}
          >
            {savedCount} / {words.length} saved
          </span>
        </div>
      </div>

      {error ? (
        <Alert variant="error" style={{ marginBottom: 'var(--space-lg)' }}>
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <div className="muted">Loading…</div>
      ) : (
        <div
          className="card"
          style={{
            padding: 'var(--card-pad-compact)',
            display: 'grid',
            gap: 'var(--space-xs)',
          }}
        >
          {words.map((text, i) => {
            const key = stackWordKey(text)
            const isSaved = saved.keys.has(key)
            const wasMarkedKnown = saved.knownThisSession.has(key)
            const isPending = !!pending[key]
            return (
              <div
                key={`${text}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-md)',
                  padding: 'var(--space-md) var(--space-md)',
                  borderBottom: i < words.length - 1 ? '1px solid var(--border)' : 'none',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-sm)' }}>
                  <span className="text-body" style={{ fontWeight: 600 }}>
                    {text}
                  </span>
                  <span className="muted text-label">#{i + 1}</span>
                </div>
                {isSaved ? (
                  <span
                    className="text-label"
                    style={{
                      padding: '2px var(--space-xs)',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--success-soft)',
                      color: 'var(--success-on-soft)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {wasMarkedKnown ? `✓ ${WORD_TAG_KNOWN}` : '✓ Saved'}
                  </span>
                ) : (
                  <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                    <button
                      type="button"
                      className="btn text-body-sm"
                      onClick={() => void importWord(text, true)}
                      disabled={isPending}
                      style={{
                        padding: 'var(--space-2xs) var(--space-md)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--muted)',
                        fontWeight: 600,
                      }}
                    >
                      {isPending ? 'Saving…' : 'I know it'}
                    </button>
                    <button
                      type="button"
                      className="btn text-body-sm"
                      onClick={() => void importWord(text, false)}
                      disabled={isPending}
                      style={{
                        padding: 'var(--space-2xs) var(--space-md)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--selection-fill)',
                        color: 'var(--text)',
                        fontWeight: 600,
                      }}
                    >
                      {isPending ? 'Saving…' : 'Study it'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div
        style={{
          marginTop: 'var(--space-2xl)',
          display: 'flex',
          gap: 'var(--space-md)',
          flexWrap: 'wrap',
        }}
      >
        <PrimaryButton as="link" to="/learn">
          Open My Words
        </PrimaryButton>
        <button
          type="button"
          className="btn text-body"
          onClick={() => navigate('/learn/stacks')}
          style={{
            padding: 'var(--space-md) var(--space-xl)',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            background: 'transparent',
            color: 'var(--muted)',
          }}
        >
          Back to stacks
        </button>
      </div>
    </div>
  )
}
