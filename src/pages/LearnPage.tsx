import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { useSearchParams } from 'react-router-dom'
import { bucketFromWord } from '../../shared/learningBuckets'
import { pickParagraphWords } from '../../shared/paragraphPicker'
import { DEFAULT_MAIN_LANGUAGE, normalizeMainLanguageCode } from '../../shared/languages'
import type { VocabItem } from '../../shared/types'
import { normalizeGeneratedResultFromApi } from '../../shared/wordGeneration'
import { getNativeGloss } from '../../shared/vocab'
import {
  applyParagraphExposure,
  deleteVocabItem,
  listVocabItems,
  recordWordExposure,
  toggleVocabFlagged,
} from '../lib/vocab'
import { auth } from '../lib/firebase'
import { saveWord } from '../lib/words'
import { ensureUserProfileDefaults } from '../lib/userProfile'
import {
  IconChevronLeft,
  IconChevronRight,
  IconFlag,
  IconSearch,
  IconTrash,
} from '../components/Icons'
import { SelectableTile } from '../components/ui/SelectableTile'

type Filter = 'all' | 'new' | 'learning' | 'familiar' | 'mastered'

type ParagraphPart =
  | { kind: 'text'; value: string }
  | { kind: 'target'; text: string }

type ParagraphResponse = { parts: ParagraphPart[] }

export function LearnPage() {
  const [searchParams] = useSearchParams()
  const [items, setItems] = useState<VocabItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('learning')
  const [query, setQuery] = useState('')
  const [studyOpen, setStudyOpen] = useState(false)
  const [studyIndex, setStudyIndex] = useState(0)
  const [studyShowAnswer, setStudyShowAnswer] = useState(false)
  const [mainLanguage, setMainLanguage] = useState(DEFAULT_MAIN_LANGUAGE)
  const [paraState, setParaState] = useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready'; parts: ParagraphPart[]; picked: VocabItem[] }
    | { status: 'error'; message: string }
  >({ status: 'idle' })
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const next = await listVocabItems()
        if (!cancelled) setItems(next)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load items')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setMainLanguage(DEFAULT_MAIN_LANGUAGE)
        return
      }
      void ensureUserProfileDefaults()
        .then((p) => setMainLanguage(normalizeMainLanguageCode(p.mainLanguage)))
        .catch(() => {})
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

  useEffect(() => {
    const f = searchParams.get('filter')
    if (f === 'learning' || f === 'mastered' || f === 'all' || f === 'new' || f === 'familiar') {
      setFilter(f)
    }
  }, [searchParams])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (filter !== 'all' && bucketFromWord(item) !== filter) return false
      if (q && !item.text.toLowerCase().includes(q)) return false
      return true
    })
  }, [items, filter, query])

  const wordsInFilterCount = useMemo(() => {
    return items.filter((item) => filter === 'all' || bucketFromWord(item) === filter).length
  }, [items, filter])

  const studyItem =
    studyOpen && filtered.length > 0 && studyIndex >= 0 && studyIndex < filtered.length
      ? filtered[studyIndex]
      : null

  useEffect(() => {
    if (!studyOpen || filtered.length === 0) return
    const n = filtered.length
    function onKeyDown(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      if (el?.closest('input, textarea, [contenteditable="true"]')) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setStudyIndex((i) => (i === 0 ? n - 1 : i - 1))
        setStudyShowAnswer(false)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setStudyIndex((i) => (i + 1) % n)
        setStudyShowAnswer(false)
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        setStudyShowAnswer((v) => !v)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setStudyOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [studyOpen, filtered.length])

  useEffect(() => {
    if (!studyOpen || !studyItem) return
    void recordWordExposure(studyItem.id).catch(() => {})
  }, [studyOpen, studyItem?.id])

  useEffect(() => {
    setParaState({ status: 'idle' })
  }, [filter, query])

  async function handleRegenerate(item: VocabItem) {
    setError(null)
    setRegeneratingId(item.id)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('Please sign in first.')
      const baseUrl = (import.meta.env.VITE_FUNCTIONS_BASE_URL as string | undefined) ?? ''
      if (!baseUrl) throw new Error('Missing VITE_FUNCTIONS_BASE_URL')
      const res = await fetch(`${baseUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: item.text.trim(), mainLanguage }),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || `Request failed (${res.status})`)
      }
      const raw = await res.json()
      const result = normalizeGeneratedResultFromApi(raw)
      await saveWord({ text: item.text, type: item.type, result, mainLanguage })
      const next = await listVocabItems()
      setItems(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Regenerate failed')
    } finally {
      setRegeneratingId(null)
    }
  }

  async function handleToggleFlagged(id: string, flagged: boolean) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, flagged } : it)),
    )
    try {
      await toggleVocabFlagged({ id, flagged })
    } catch {
      const next = await listVocabItems()
      setItems(next)
    }
  }

  async function generateParagraph() {
    setParaState({ status: 'loading' })
    try {
      const picked = pickParagraphWords(items, Date.now(), 5)
      if (!picked.length) {
        setParaState({
          status: 'error',
          message:
            'No eligible words yet. Study a few sessions first so words have exposure (score above 0).',
        })
        return
      }

      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('Please sign in first.')

      const baseUrl =
        (import.meta.env.VITE_FUNCTIONS_BASE_URL as string | undefined) ?? ''
      if (!baseUrl) throw new Error('Missing VITE_FUNCTIONS_BASE_URL')

      const endpoint = `${baseUrl}/generateParagraph`
      const payload = {
        items: picked.map((it) => ({
          text: it.text,
          type: it.type,
          definition: it.definition,
          simpleDefinition: it.simpleDefinition,
        })),
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(errText || `Request failed (${res.status})`)
      }

      const jsonText = await res.text()
      const json = JSON.parse(jsonText) as ParagraphResponse
      if (!json || !Array.isArray(json.parts)) {
        throw new Error('Bad response from server')
      }
      setParaState({ status: 'ready', parts: json.parts, picked })
      await applyParagraphExposure(picked.map((p) => p.id))
      const next = await listVocabItems()
      setItems(next)
    } catch (e) {
      setParaState({
        status: 'error',
        message: e instanceof Error ? e.message : 'Failed to generate paragraph',
      })
    }
  }

  return (
    <div className="container" style={{ paddingBottom: 'var(--space-3xl)' }}>
      <style>{`
        .paraWordWrap { position: relative; display: inline-block; }
        .paraTooltip {
          position: absolute;
          left: 0;
          top: calc(100% + var(--space-xs));
          background: var(--surface-2);
          border: 1px solid var(--border);
          padding: var(--space-sm) var(--space-md);
          border-radius: var(--radius-md);
          font-size: var(--text-body-sm-size);
          font-weight: 500;
          line-height: var(--leading-normal);
          color: var(--text);
          text-align: center;
          width: min(280px, 85vw);
          max-width: 85vw;
          box-shadow: var(--shadow);
          z-index: 50;
          pointer-events: none;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.15s ease, visibility 0.15s;
        }
        .paraWordWrap:hover .paraTooltip,
        .paraWordWrap:focus-within .paraTooltip {
          opacity: 1;
          visibility: visible;
        }
      `}</style>
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <h1 className="text-page-title" style={{ margin: 0 }}>
          Learn
        </h1>
        <p className="muted text-body-lg" style={{ margin: 'var(--space-xs) 0 0' }}>
          Browse saved vocabulary. Mastery is automatic from your exposure score (20+ = Mastered). Open
          Study on a card for a focused flashcard flow.
        </p>
      </div>

      <div
        className="card"
        style={{
          padding: 'var(--card-pad-compact)',
          marginBottom: 'var(--space-lg)',
          display: 'grid',
          gap: 'var(--space-md)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
            padding: 'var(--space-md) var(--space-lg)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <IconSearch style={{ color: 'var(--muted)', flexShrink: 0 }} />
          <input
            className="input"
            placeholder="Search words..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              flex: 1,
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 'var(--space-xs)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2xs)' }}>
            <FilterChip
              label="All"
              active={filter === 'all'}
              onClick={() => setFilter('all')}
            />
            <FilterChip
              label="New"
              active={filter === 'new'}
              onClick={() => setFilter('new')}
            />
            <FilterChip
              label="Learning"
              active={filter === 'learning'}
              onClick={() => setFilter('learning')}
            />
            <FilterChip
              label="Familiar"
              active={filter === 'familiar'}
              onClick={() => setFilter('familiar')}
            />
            <FilterChip
              label="Mastered"
              active={filter === 'mastered'}
              onClick={() => setFilter('mastered')}
            />
            {!loading ? (
              <span className="muted text-label" style={{ marginLeft: 'var(--space-2xs)' }}>
                {wordsInFilterCount} word{wordsInFilterCount === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {loading && <div className="muted">Loading items…</div>}
      {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}

      <div style={{ display: 'grid', gap: 10 }}>
        {filtered.map((item, index) => (
          <VocabCard
            key={item.id}
            item={item}
            mainLanguage={mainLanguage}
            onToggleFlagged={handleToggleFlagged}
            onRegenerate={handleRegenerate}
            regenerating={regeneratingId === item.id}
            onStudy={() => {
              setStudyIndex(index)
              setStudyShowAnswer(false)
              setStudyOpen(true)
            }}
          />
        ))}
        {!loading && !error && filtered.length === 0 && (
          <div className="muted" style={{ fontSize: 13 }}>
            No items match this filter.
          </div>
        )}
      </div>

      <div
        className="card"
        style={{
          padding: 'var(--card-pad-comfortable)',
          marginTop: 'var(--space-xs)',
          overflow: 'visible',
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Reading practice</div>
          <span className="muted" style={{ fontSize: 12 }}>
            Up to five words picked by exposure score (must have been seen in study at least once).
          </span>
        </div>

        <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btnPrimary"
            onClick={() => void generateParagraph()}
            disabled={paraState.status === 'loading' || loading}
          >
            {paraState.status === 'loading' ? 'Generating…' : 'Generate paragraph'}
          </button>
          {paraState.status === 'ready' && (
            <button
              type="button"
              className="btn"
              onClick={() => setParaState({ status: 'idle' })}
            >
              Clear
            </button>
          )}
        </div>

        {paraState.status === 'error' && (
          <div style={{ marginTop: 10, color: 'var(--danger)' }}>
            {paraState.message}
          </div>
        )}

        {paraState.status === 'loading' && <ParagraphGeneratingLoading />}

        {paraState.status === 'ready' && (
          <ParagraphText parts={paraState.parts} picked={paraState.picked} />
        )}

        {paraState.status === 'idle' && (
          <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>
            Generate a paragraph in context. Hover bold targets for meanings.
          </div>
        )}
      </div>

      {studyOpen && studyItem ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Study card"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            overflow: 'auto',
          }}
        >
          <div style={{ position: 'relative', width: '100%', maxWidth: 520 }}>
            <button
              type="button"
              className="btn"
              onClick={() => setStudyOpen(false)}
              style={{
                position: 'absolute',
                right: 0,
                top: -8,
                zIndex: 2,
                padding: '8px 14px',
                fontWeight: 700,
              }}
            >
              Close
            </button>
            <p className="muted" style={{ fontSize: 12, marginBottom: 8, opacity: 0.9 }}>
              ← → to move · Space to reveal · Esc to close
            </p>
            <FlashcardView
              key={studyItem.id}
              item={studyItem}
              mainLanguage={mainLanguage}
              index={studyIndex}
              total={filtered.length}
              showAnswer={studyShowAnswer}
              onToggleAnswer={() => setStudyShowAnswer((v) => !v)}
              onNext={() => {
                setStudyIndex((i) => (i + 1) % filtered.length)
                setStudyShowAnswer(false)
              }}
              onPrev={() => {
                setStudyIndex((i) =>
                  i === 0 ? (filtered.length > 0 ? filtered.length - 1 : 0) : i - 1,
                )
                setStudyShowAnswer(false)
              }}
              onToggleFlagged={handleToggleFlagged}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

const PARA_HINTS = [
  'Selecting vocabulary…',
  'Building context…',
  'Polishing sentences…',
] as const

function ParagraphGeneratingLoading() {
  const [hintIdx, setHintIdx] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => {
      setHintIdx((i) => (i + 1) % PARA_HINTS.length)
    }, 2000)
    return () => window.clearInterval(id)
  }, [])
  return (
    <div className="learnParaLoadingShell">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="lookupLoadingDot" />
        <p className="muted" style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
          Crafting a paragraph from your learning words…
        </p>
        <span className="muted" style={{ fontSize: 12 }}>{PARA_HINTS[hintIdx]}</span>
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

function ParagraphText(props: { parts: ParagraphPart[]; picked: VocabItem[] }) {
  const meaningByTextLower = useMemo(() => {
    const m = new Map<string, string>()
    props.picked.forEach((it) => {
      const key = it.text.trim().toLowerCase()
      const meaning = (it.simpleDefinition || it.definition || '').trim()
      if (key) m.set(key, meaning)
    })
    return m
  }, [props.picked])

  return (
    <div
      className="paragraphTextFadeIn"
      style={{
        marginTop: 12,
        fontSize: 15,
        lineHeight: 1.65,
        borderTop: '1px solid var(--border)',
        paddingTop: 12,
        overflow: 'visible',
      }}
    >
      {props.parts.map((p, idx) => {
        if (p.kind === 'text') return <span key={idx}>{p.value}</span>
        const meaning = meaningByTextLower.get(p.text.trim().toLowerCase()) ?? ''
        return (
          <strong key={idx}>
            <span
              className={meaning ? 'paraWordWrap' : undefined}
              tabIndex={meaning ? 0 : undefined}
              style={{
                cursor: meaning ? 'pointer' : 'default',
                textDecoration: meaning ? 'underline dotted' : 'none',
                textUnderlineOffset: 3,
              }}
            >
              {p.text}
              {meaning ? (
                <span className="paraTooltip" role="tooltip">
                  {meaning}
                </span>
              ) : null}
            </span>
          </strong>
        )
      })}
    </div>
  )
}

function FilterChip(props: {
  label: string
  active: boolean
  onClick: () => void
  icon?: React.ReactNode
}) {
  return (
    <SelectableTile
      layout="pill"
      label={props.label}
      selected={props.active}
      onClick={props.onClick}
      style={{ width: 'auto', display: 'inline-flex', alignItems: 'center' }}
    />
  )
}

function VocabCard(props: {
  item: VocabItem
  mainLanguage: string
  onToggleFlagged: (id: string, flagged: boolean) => void
  onRegenerate: (item: VocabItem) => void | Promise<void>
  regenerating?: boolean
  onStudy?: () => void
}) {
  const { item, mainLanguage } = props
  const [open, setOpen] = useState(false)
  const nativeLine = getNativeGloss(item, mainLanguage)

  return (
    <div
      className="card"
      style={{
        padding: 16,
        display: 'grid',
        gap: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'flex-start',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: -0.2,
              color: 'var(--text)',
            }}
          >
            {item.text}
          </div>
          <span
            className="muted"
            style={{
              display: 'inline-block',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              marginTop: 6,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            {item.type === 'phrase' ? 'PHRASE' : 'WORD'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="btn"
            onClick={() => props.onToggleFlagged(item.id, !item.flagged)}
            style={{
              padding: '8px',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: item.flagged ? 'var(--accent)' : 'var(--muted)',
            }}
            aria-label={item.flagged ? 'Unflag' : 'Flag'}
          >
            <IconFlag />
          </button>
          <button
            type="button"
            className="btn"
            disabled={props.regenerating}
            onClick={() => void props.onRegenerate(item)}
            style={{
              padding: '8px 10px',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: 'var(--text)',
              fontSize: 12,
              fontWeight: 700,
            }}
            aria-label="Regenerate card"
          >
            {props.regenerating ? '…' : 'AI'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              const ok = window.confirm(
                `Delete "${item.text}" from your library? This cannot be undone.`,
              )
              if (!ok) return
              void deleteVocabItem(item.id)
            }}
            style={{
              padding: '8px',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: 'var(--danger)',
            }}
            aria-label="Delete"
          >
            <IconTrash />
          </button>
        </div>
      </div>

      <p className="muted" style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>
        {item.simpleDefinition || item.definition || 'No definition available yet.'}
      </p>
      {nativeLine ? (
        <p
          className="muted"
          style={{ fontSize: 13, lineHeight: 1.5, margin: '6px 0 0', fontStyle: 'italic', opacity: 0.92 }}
        >
          {nativeLine}
        </p>
      ) : null}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          marginTop: 8,
        }}
      >
        <span
          className="muted"
          style={{ fontSize: 12, fontWeight: 600 }}
        >
          Exposure {item.exposureScore} ·{' '}
          {bucketFromWord(item).charAt(0).toUpperCase() + bucketFromWord(item).slice(1)}
        </span>
        {props.onStudy ? (
          <button
            type="button"
            className="btn btnPrimary"
            onClick={props.onStudy}
            style={{ fontSize: 12, padding: '6px 12px' }}
          >
            Study
          </button>
        ) : null}
        <button
          type="button"
          className="btn"
          onClick={() => setOpen((v) => !v)}
          style={{ fontSize: 12, padding: '6px 12px', marginLeft: 'auto' }}
        >
          {open ? 'Hide details' : 'Show details'}
        </button>
      </div>

      {open && (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            marginTop: 4,
            paddingTop: 12,
            display: 'grid',
            gap: 8,
            fontSize: 13,
          }}
        >
          {item.definition && (
            <DetailRow label="Definition" value={item.definition} />
          )}
          {item.examples?.length === 2 ? (
            <>
              <DetailRow label="Example (academic)" value={item.examples[0]} />
              <DetailRow label="Example (argument)" value={item.examples[1]} />
            </>
          ) : item.exampleSentence ? (
            <DetailRow label="Example" value={item.exampleSentence} />
          ) : null}
          {item.synonyms.length > 0 && (
            <DetailRow label="Synonyms" value={item.synonyms.join(', ')} />
          )}
          {item.wordTags && item.wordTags.length > 0 && (
            <DetailRow label="Tags" value={item.wordTags.join(', ')} />
          )}
          {item.contrastWord?.word && item.contrastWord.explanation ? (
            <DetailRow
              label="Contrast"
              value={`${item.contrastWord.word} — ${item.contrastWord.explanation}`}
            />
          ) : null}
          {item.nuanceNote && <DetailRow label="Nuance" value={item.nuanceNote} />}
          {item.memoryHook ? <DetailRow label="Memory hook" value={item.memoryHook} /> : null}
          {item.gmatUsageNote && (
            <DetailRow label="GMAT usage" value={item.gmatUsageNote} />
          )}
        </div>
      )}
    </div>
  )
}

function FlashcardView(props: {
  item: VocabItem
  mainLanguage: string
  index: number
  total: number
  showAnswer: boolean
  onToggleAnswer: () => void
  onNext: () => void
  onPrev: () => void
  onToggleFlagged: (id: string, flagged: boolean) => void
}) {
  const { item, mainLanguage } = props
  const [detailsOpen, setDetailsOpen] = useState(false)

  useEffect(() => {
    setDetailsOpen(false)
  }, [item.id])

  const simple = (item.simpleDefinition || '').trim()
  const full = (item.definition || '').trim()
  const primaryDef = simple || full || '—'
  const nativeLine = getNativeGloss(item, mainLanguage)
  const showFullDefinitionInDetail = Boolean(full && full !== primaryDef)
  const hasExtras =
    Boolean(item.exampleSentence) ||
    (item.examples?.length ?? 0) > 0 ||
    (item.synonyms?.length ?? 0) > 0 ||
    Boolean(item.nuanceNote) ||
    Boolean(item.gmatUsageNote) ||
    Boolean(item.memoryHook) ||
    (item.wordTags?.length ?? 0) > 0 ||
    Boolean(item.contrastWord?.word)

  const progressPct = props.total > 0 ? ((props.index + 1) / props.total) * 100 : 0

  return (
    <div className="learnFlashZone">
      <div className="learnFlashAmbient" aria-hidden />
      <article className="learnFlashPremium learnFlashcardFace">
        <button
          type="button"
          className="learnFlashFlagBtn"
          onClick={() => props.onToggleFlagged(item.id, !item.flagged)}
          aria-pressed={item.flagged}
          aria-label={item.flagged ? 'Unflag' : 'Flag for review'}
        >
          <IconFlag />
        </button>

        <div className="learnFlashProgressInset">
          <div className="learnFlashProgressTrack" aria-hidden>
            <div className="learnFlashProgressFill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <p className="learnFlashEyebrow">
          Vocabulary mastery · Card {props.index + 1} / {props.total}
        </p>

        <h2 className="learnFlashWord">{item.text}</h2>
        <span className="learnFlashTypePill">
          {item.type === 'phrase' ? 'Phrase' : 'Word'}
        </span>

        <div className="learnFlashRevealBlock">
          <button
            type="button"
            className="learnFlashRevealBtn"
            onClick={props.onToggleAnswer}
          >
            {props.showAnswer ? 'Hide definition' : 'Reveal definition'}
          </button>

          {!props.showAnswer ? (
            <div className="learnFlashHintLine">
              <span className="learnFlashHintText">Tap to reveal meaning</span>
            </div>
          ) : null}

          {props.showAnswer ? (
            <div style={{ display: 'grid', gap: 12, width: '100%' }}>
              <div className="learnFlashAnswerPanel">
                <div className="muted" style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
                  {simple ? 'Simple meaning' : 'Meaning'}
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--text)' }}>
                  {primaryDef}
                </div>
                {nativeLine ? (
                  <div
                    className="muted"
                    style={{ fontSize: 14, lineHeight: 1.5, marginTop: 8, fontStyle: 'italic' }}
                  >
                    {nativeLine}
                  </div>
                ) : null}
              </div>

              {(showFullDefinitionInDetail || hasExtras) && (
                <div>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setDetailsOpen((v) => !v)}
                    style={{ fontSize: 12, padding: '8px 14px', width: '100%' }}
                  >
                    {detailsOpen ? 'Hide details' : 'More detail'}
                  </button>
                  {detailsOpen && (
                    <div
                      style={{
                        marginTop: 12,
                        display: 'grid',
                        gap: 10,
                        paddingTop: 12,
                        borderTop: '1px solid var(--border)',
                      }}
                    >
                      {showFullDefinitionInDetail && (
                        <DetailRow label="Full definition" value={full} />
                      )}
                      {item.examples?.length === 2 ? (
                        <>
                          <DetailRow label="Example (academic)" value={item.examples[0]} />
                          <DetailRow label="Example (argument)" value={item.examples[1]} />
                        </>
                      ) : item.exampleSentence ? (
                        <DetailRow label="Example" value={item.exampleSentence} />
                      ) : null}
                      {item.synonyms.length > 0 && (
                        <DetailRow label="Synonyms" value={item.synonyms.join(', ')} />
                      )}
                      {item.wordTags && item.wordTags.length > 0 && (
                        <DetailRow label="Tags" value={item.wordTags.join(', ')} />
                      )}
                      {item.contrastWord?.word && item.contrastWord.explanation ? (
                        <DetailRow
                          label="Contrast"
                          value={`${item.contrastWord.word} — ${item.contrastWord.explanation}`}
                        />
                      ) : null}
                      {item.nuanceNote && <DetailRow label="Nuance" value={item.nuanceNote} />}
                      {item.memoryHook ? (
                        <DetailRow label="Memory hook" value={item.memoryHook} />
                      ) : null}
                      {item.gmatUsageNote && (
                        <DetailRow label="GMAT usage" value={item.gmatUsageNote} />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <p className="muted" style={{ fontSize: 12, marginTop: 8, textAlign: 'center' }}>
          Exposure {item.exposureScore} ·{' '}
          {bucketFromWord(item).charAt(0).toUpperCase() + bucketFromWord(item).slice(1)}
        </p>
      </article>

      <div className="learnFlashNavRow">
        <button type="button" className="learnFlashNavBtn" onClick={props.onPrev}>
          <IconChevronLeft width={20} height={20} aria-hidden />
          Prev
        </button>
        <span className="learnFlashNavDot" aria-hidden />
        <button type="button" className="learnFlashNavBtn" onClick={props.onNext}>
          Next
          <IconChevronRight width={20} height={20} aria-hidden />
        </button>
      </div>
    </div>
  )
}

function DetailRow(props: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 12 }}>{props.label}</div>
      <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>
        {props.value}
      </div>
    </div>
  )
}

