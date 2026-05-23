/**
 * Curated word-stack browse page. Lists the 7 stacks from
 * WORD_STACK_CATALOG (shared/freemium.ts), shows title, description,
 * word count, tier badge, and a per-stack "X / Y saved" counter so the
 * user can see progress at a glance.
 *
 * Tier gating is informational on web (no paywall enforcement here —
 * that's mobile's job today). Users can still navigate into pro stacks
 * and import; if you want to introduce paywall enforcement on web later,
 * add it at the action layer in StackDetailPage.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { WORD_STACK_CATALOG } from '../../shared/freemium'
import { getWordsForStack } from '../../shared/wordStackContent'
import { auth } from '../lib/firebase'
import { fetchSavedTextSet, stackWordKey } from '../lib/wordStacks'
import { Alert } from '../components/ui/Alert'

export function StackBrowsePage() {
  const [savedKeys, setSavedKeys] = useState<Set<string> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setError(null)
      if (!user) {
        setSavedKeys(new Set())
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const keys = await fetchSavedTextSet()
        setSavedKeys(keys)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load your saved words.')
        setSavedKeys(new Set())
      } finally {
        setLoading(false)
      }
    })
    return () => unsub()
  }, [])

  const totalWordsAcross = useMemo(
    () => WORD_STACK_CATALOG.reduce((acc, s) => acc + s.wordCount, 0),
    [],
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
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <h1 className="text-page-title" style={{ margin: 0 }}>
          Word stacks
        </h1>
        <p className="muted text-body-lg" style={{ margin: 'var(--space-xs) 0 0' }}>
          Curated vocabulary collections. Tap a stack to browse and import its words
          into your personal pool. {WORD_STACK_CATALOG.length} stacks, {totalWordsAcross}{' '}
          words total.
        </p>
      </div>

      {!auth.currentUser && !loading ? (
        <Alert variant="info" style={{ marginBottom: 'var(--space-lg)' }}>
          Sign in to save words from a stack into your personal pool.
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="error" style={{ marginBottom: 'var(--space-lg)' }}>
          {error}
        </Alert>
      ) : null}

      <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
        {WORD_STACK_CATALOG.map((stack) => {
          const words = getWordsForStack(stack.id)
          const savedInStack =
            savedKeys == null
              ? 0
              : words.reduce(
                  (acc, w) => (savedKeys.has(stackWordKey(w)) ? acc + 1 : acc),
                  0,
                )
          return (
            <Link
              key={stack.id}
              to={`/learn/stacks/${stack.id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div
                className="card"
                style={{
                  padding: 'var(--card-pad-comfortable)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-md)',
                  cursor: 'pointer',
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
                  <h2 className="text-title" style={{ margin: 0 }}>
                    {stack.title}
                  </h2>
                  <span
                    className="text-label"
                    style={{
                      padding: '2px var(--space-xs)',
                      borderRadius: 'var(--radius-pill)',
                      background:
                        stack.tier === 'pro'
                          ? 'var(--selection-fill)'
                          : 'var(--fill-subtle)',
                      color:
                        stack.tier === 'pro'
                          ? 'color-mix(in srgb, var(--accent-gradient-end) 75%, var(--text))'
                          : 'var(--muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {stack.tier === 'pro' ? 'Pro' : 'Basic'}
                  </span>
                </div>
                <p className="muted text-body" style={{ margin: 0 }}>
                  {stack.description}
                </p>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-sm)',
                  }}
                >
                  <span className="muted text-label">
                    {stack.wordCount} words
                  </span>
                  {savedKeys != null ? (
                    <span
                      className="text-label"
                      style={{
                        color: savedInStack > 0 ? 'var(--success-on-soft)' : 'var(--muted)',
                      }}
                    >
                      {savedInStack} / {words.length} saved
                    </span>
                  ) : null}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
