import { useEffect, useMemo, useState } from 'react'
import type { VocabItem, VocabStatus } from '../lib/vocab'
import {
  listVocabItems,
  toggleVocabFlagged,
  updateVocabStatus,
  deleteVocabItem,
} from '../lib/vocab'
import { auth } from '../lib/firebase'
import {
  IconChevronLeft,
  IconChevronRight,
  IconFlag,
  IconSearch,
  IconTrash,
} from '../components/Icons'

type Filter = 'all' | 'do_not_know' | 'learning' | 'know' | 'flagged'
type ViewMode = 'list' | 'flashcards' | 'paragraph'

type ParagraphPart =
  | { kind: 'text'; value: string }
  | { kind: 'target'; text: string }

type ParagraphResponse = { parts: ParagraphPart[] }

const isDev = import.meta.env.DEV

export function LearnPage() {
  const [items, setItems] = useState<VocabItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [flashIndex, setFlashIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [paraState, setParaState] = useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready'; parts: ParagraphPart[]; picked: VocabItem[] }
    | { status: 'error'; message: string }
  >({ status: 'idle' })

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (filter === 'do_not_know' && item.status !== 'do_not_know') return false
      if (filter === 'learning' && item.status !== 'learning') return false
      if (filter === 'know' && item.status !== 'know') return false
      if (filter === 'flagged' && !item.flagged) return false
      if (q && !item.text.toLowerCase().includes(q)) return false
      return true
    })
  }, [items, filter, query])

  // Count based on the filter toggle only (independent from search query).
  const wordsInFilterCount = useMemo(() => {
    return items.filter((item) => {
      if (filter === 'do_not_know') return item.status === 'do_not_know'
      if (filter === 'learning') return item.status === 'learning'
      if (filter === 'know') return item.status === 'know'
      if (filter === 'flagged') return item.flagged
      return true
    }).length
  }, [items, filter])

  const flashItem =
    viewMode === 'flashcards' &&
    filtered.length > 0 &&
    flashIndex >= 0 &&
    flashIndex < filtered.length
      ? filtered[flashIndex]
      : null

  useEffect(() => {
    if (viewMode !== 'flashcards' || filtered.length === 0) return
    const n = filtered.length
    function onKeyDown(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      if (el?.closest('input, textarea, [contenteditable="true"]')) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setFlashIndex((i) => (i === 0 ? n - 1 : i - 1))
        setShowAnswer(false)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setFlashIndex((i) => (i + 1) % n)
        setShowAnswer(false)
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        setShowAnswer((v) => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [viewMode, filtered.length])

  async function handleStatusChange(id: string, status: VocabStatus) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, status } : it)),
    )
    try {
      await updateVocabStatus({ id, status })
    } catch {
      // best-effort: reload list on failure
      const next = await listVocabItems()
      setItems(next)
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

  function pickLearningItems(): VocabItem[] {
    const pool = items.filter(
      (it) => it.status === 'learning' || it.status === 'do_not_know',
    )
    if (pool.length <= 5) return pool
    const copy = [...pool]
    // Fisher–Yates shuffle
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy.slice(0, 5)
  }

  async function generateParagraph() {
    setParaState({ status: 'loading' })
    try {
      const picked = pickLearningItems()
      if (isDev) {
        fetch('http://127.0.0.1:7471/ingest/77952ae0-e8f1-433e-b4e8-713bdadce68f', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a01660' },
          body: JSON.stringify({
            sessionId: 'a01660',
            runId: 'pre-fix',
            hypothesisId: 'H1',
            location: 'src/pages/LearnPage.tsx:generateParagraph:pick',
            message: 'Picked learning items',
            data: {
              pickedCount: picked.length,
              pickedTextTypes: picked.map((p) => ({
                textType: typeof p.text,
                textPreview: String(p.text).slice(0, 40),
                status: p.status,
                type: p.type,
              })),
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {})
      }
      if (!picked.length) {
        setParaState({
          status: 'error',
          message: 'No Learning / Do Not Know items found yet.',
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

      if (isDev) {
        fetch('http://127.0.0.1:7471/ingest/77952ae0-e8f1-433e-b4e8-713bdadce68f', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a01660' },
          body: JSON.stringify({
            sessionId: 'a01660',
            runId: 'pre-fix',
            hypothesisId: 'H2',
            location: 'src/pages/LearnPage.tsx:generateParagraph:request',
            message: 'About to request generateParagraph',
            data: {
              baseUrl,
              endpoint,
              itemsCount: payload.items.length,
              itemTextTypes: payload.items.map((i) => ({
                textType: typeof i.text,
                textPreview: String(i.text).slice(0, 40),
                type: i.type,
              })),
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {})
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
        if (isDev) {
          fetch('http://127.0.0.1:7471/ingest/77952ae0-e8f1-433e-b4e8-713bdadce68f', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a01660' },
            body: JSON.stringify({
              sessionId: 'a01660',
              runId: 'pre-fix',
              hypothesisId: 'H3',
              location: 'src/pages/LearnPage.tsx:generateParagraph:response',
              message: 'generateParagraph non-OK response',
              data: {
                status: res.status,
                statusText: res.statusText,
                bodyPreview: String(errText).slice(0, 300),
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {})
        }
        throw new Error(errText || `Request failed (${res.status})`)
      }

      const jsonText = await res.text()
      if (isDev) {
        fetch('http://127.0.0.1:7471/ingest/77952ae0-e8f1-433e-b4e8-713bdadce68f', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a01660' },
          body: JSON.stringify({
            sessionId: 'a01660',
            runId: 'pre-fix',
            hypothesisId: 'H4',
            location: 'src/pages/LearnPage.tsx:generateParagraph:response',
            message: 'generateParagraph OK response',
            data: { status: res.status, bodyPreview: String(jsonText).slice(0, 300) },
            timestamp: Date.now(),
          }),
        }).catch(() => {})
      }

      const json = JSON.parse(jsonText) as ParagraphResponse
      if (!json || !Array.isArray(json.parts)) {
        throw new Error('Bad response from server')
      }
      if (isDev) {
        fetch('http://127.0.0.1:7471/ingest/77952ae0-e8f1-433e-b4e8-713bdadce68f', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a01660' },
          body: JSON.stringify({
            sessionId: 'a01660',
            runId: 'pre-fix',
            hypothesisId: 'H5',
            location: 'src/pages/LearnPage.tsx:generateParagraph:parsed',
            message: 'Parsed paragraph response parts summary',
            data: {
              partsCount: json.parts.length,
              head: json.parts.slice(0, 12),
              tail: json.parts.slice(Math.max(0, json.parts.length - 12)),
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {})
      }
      setParaState({ status: 'ready', parts: json.parts, picked })
    } catch (e) {
      setParaState({
        status: 'error',
        message: e instanceof Error ? e.message : 'Failed to generate paragraph',
      })
    }
  }

  return (
    <div className="container" style={{ paddingBottom: 18 }}>
      {/* #region agent log */}
      <style>{`
        .paraWordWrap { position: relative; display: inline-block; }
        .paraTooltip {
          position: absolute;
          left: 0;
          top: calc(100% + 8px);
          background: rgba(17, 24, 39, 0.98);
          border: 1px solid rgba(255,255,255,0.14);
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          line-height: 1.45;
          color: rgba(255,255,255,0.95);
          text-align: center;
          width: min(280px, 85vw);
          max-width: 85vw;
          box-shadow: 0 14px 40px rgba(0,0,0,0.5);
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
      {/* #endregion agent log */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.3 }}>
          My Learning Path
        </h1>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 15 }}>
          Refine your GMAT vocabulary with targeted study sessions.
        </p>
      </div>

      <div
        className="card"
        style={{
          padding: 14,
          marginBottom: 16,
          display: 'grid',
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
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
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <FilterChip
              label="All"
              active={filter === 'all'}
              onClick={() => setFilter('all')}
            />
            <FilterChip
              label="Do Not Know"
              active={filter === 'do_not_know'}
              onClick={() => setFilter('do_not_know')}
            />
            <FilterChip
              label="Learning"
              active={filter === 'learning'}
              onClick={() => setFilter('learning')}
            />
            <FilterChip
              label="Know"
              active={filter === 'know'}
              onClick={() => setFilter('know')}
            />
            <FilterChip
              label="Flagged"
              active={filter === 'flagged'}
              onClick={() => setFilter('flagged')}
              icon={<IconFlag style={{ marginRight: 4 }} />}
            />
            {!loading ? (
              <span className="muted" style={{ fontSize: 12, marginLeft: 4 }}>
                {wordsInFilterCount} word{wordsInFilterCount === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              gap: 6,
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              className="btn"
              onClick={() => {
                setViewMode('list')
                setShowAnswer(false)
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                border: viewMode === 'list'
                  ? '1px solid var(--accent-gradient-end)'
                  : '1px solid var(--border)',
                background: viewMode === 'list'
                  ? 'rgba(99, 102, 241, 0.18)'
                  : 'rgba(255,255,255,0.04)',
                fontSize: 12,
              }}
            >
              List view
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setViewMode('flashcards')
                setFlashIndex(0)
                setShowAnswer(false)
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                border: viewMode === 'flashcards'
                  ? '1px solid var(--accent-gradient-end)'
                  : '1px solid var(--border)',
                background: viewMode === 'flashcards'
                  ? 'rgba(99, 102, 241, 0.18)'
                  : 'rgba(255,255,255,0.04)',
                fontSize: 12,
              }}
            >
              Flashcards
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setViewMode('paragraph')
                setShowAnswer(false)
                setParaState({ status: 'idle' })
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                border: viewMode === 'paragraph'
                  ? '1px solid var(--accent-gradient-end)'
                  : '1px solid var(--border)',
                background: viewMode === 'paragraph'
                  ? 'rgba(99, 102, 241, 0.18)'
                  : 'rgba(255,255,255,0.04)',
                fontSize: 12,
              }}
            >
              Paragraph
            </button>
          </div>
        </div>
      </div>

      {loading && <div className="muted">Loading items…</div>}
      {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}

      {viewMode === 'flashcards' ? (
        <div style={{ marginTop: 8 }}>
          {filtered.length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>
              No items match this filter for flashcards.
            </div>
          ) : flashItem ? (
            <>
              <p className="muted" style={{ fontSize: 12, marginBottom: 14, opacity: 0.85 }}>
                Tip: ← → to move · Space or Enter to reveal
              </p>
              <FlashcardView
                key={flashItem.id}
                item={flashItem}
                index={flashIndex}
                total={filtered.length}
                showAnswer={showAnswer}
                onToggleAnswer={() => setShowAnswer((v) => !v)}
                onNext={() => {
                  setFlashIndex((i) => (i + 1) % filtered.length)
                  setShowAnswer(false)
                }}
                onPrev={() => {
                  setFlashIndex((i) =>
                    i === 0 ? (filtered.length > 0 ? filtered.length - 1 : 0) : i - 1,
                  )
                  setShowAnswer(false)
                }}
                onChangeStatus={handleStatusChange}
                onToggleFlagged={handleToggleFlagged}
              />
            </>
          ) : null}
        </div>
      ) : viewMode === 'paragraph' ? (
        <div
          className="card"
          style={{ padding: 18, marginTop: 8, overflow: 'visible' }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Paragraph practice</div>
            <span className="muted" style={{ fontSize: 12 }}>
              Uses 5 random items from Do Not Know + Learning
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
              Click “Generate paragraph” to create a GMAT-style paragraph using words you’re learning.
              Hover the <strong>bold</strong> words to see meanings.
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map((item) => (
            <VocabCard
              key={item.id}
              item={item}
              onChangeStatus={handleStatusChange}
              onToggleFlagged={handleToggleFlagged}
            />
          ))}
          {!loading && !error && filtered.length === 0 && (
            <div className="muted" style={{ fontSize: 13 }}>
              No items match this filter.
            </div>
          )}
        </div>
      )}
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

  useEffect(() => {
    if (!isDev) return
    const targets = props.parts
      .filter((p) => p.kind === 'target')
      .map((p) => (p as { text: string }).text)
    const mismatches = targets
      .map((t) => ({
        text: t,
        normalized: String(t).trim().toLowerCase(),
        hasMeaning: meaningByTextLower.has(String(t).trim().toLowerCase()),
      }))
      .filter((x) => !x.hasMeaning)
    fetch('http://127.0.0.1:7471/ingest/77952ae0-e8f1-433e-b4e8-713bdadce68f', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a01660' },
      body: JSON.stringify({
        sessionId: 'a01660',
        runId: 'pre-fix',
        hypothesisId: 'H6',
        location: 'src/pages/LearnPage.tsx:ParagraphText:effect',
        message: 'Paragraph render diagnostics',
        data: {
          pickedKeys: [...meaningByTextLower.keys()],
          targets,
          targetsCount: targets.length,
          mismatches,
          partsHead: props.parts.slice(0, 12),
          partsTail: props.parts.slice(Math.max(0, props.parts.length - 12)),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
  }, [props.parts, props.picked, meaningByTextLower])

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
    <button
      type="button"
      onClick={props.onClick}
      className="btn"
      style={{
        padding: '6px 10px',
        borderRadius: 999,
        border: props.active
          ? '1px solid var(--accent-gradient-end)'
          : '1px solid var(--border)',
        background: props.active
          ? 'rgba(99, 102, 241, 0.18)'
          : 'rgba(255,255,255,0.04)',
        fontSize: 12,
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      {props.icon}
      {props.label}
    </button>
  )
}

function VocabCard(props: {
  item: VocabItem
  onChangeStatus: (id: string, status: VocabStatus) => void
  onToggleFlagged: (id: string, flagged: boolean) => void
}) {
  const { item } = props
  const [open, setOpen] = useState(false)

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

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <StatusChip
          label="Do Not Know"
          active={item.status === 'do_not_know'}
          onClick={() => props.onChangeStatus(item.id, 'do_not_know')}
        />
        <StatusChip
          label="Learning"
          active={item.status === 'learning'}
          onClick={() => props.onChangeStatus(item.id, 'learning')}
        />
        <StatusChip
          label="Know"
          active={item.status === 'know'}
          onClick={() => props.onChangeStatus(item.id, 'know')}
        />
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
          {item.exampleSentence && (
            <DetailRow label="Example" value={item.exampleSentence} />
          )}
          {item.synonyms.length > 0 && (
            <DetailRow label="Synonyms" value={item.synonyms.join(', ')} />
          )}
          {item.nuanceNote && <DetailRow label="Nuance" value={item.nuanceNote} />}
          {item.gmatUsageNote && (
            <DetailRow label="GMAT usage" value={item.gmatUsageNote} />
          )}
        </div>
      )}
    </div>
  )
}

function flashStatusBtnClass(status: VocabStatus, current: VocabStatus) {
  const active = current === status
  if (active) return 'learnFlashStatusBtn learnFlashStatusBtn--active'
  if (status === 'do_not_know') return 'learnFlashStatusBtn learnFlashStatusBtn--risk'
  if (status === 'know') return 'learnFlashStatusBtn learnFlashStatusBtn--safe'
  return 'learnFlashStatusBtn'
}

function FlashcardView(props: {
  item: VocabItem
  index: number
  total: number
  showAnswer: boolean
  onToggleAnswer: () => void
  onNext: () => void
  onPrev: () => void
  onChangeStatus: (id: string, status: VocabStatus) => void
  onToggleFlagged: (id: string, flagged: boolean) => void
}) {
  const { item } = props
  const [detailsOpen, setDetailsOpen] = useState(false)

  useEffect(() => {
    setDetailsOpen(false)
  }, [item.id])

  const simple = (item.simpleDefinition || '').trim()
  const full = (item.definition || '').trim()
  const primaryDef = simple || full || '—'
  const showFullDefinitionInDetail = Boolean(full && full !== primaryDef)
  const hasExtras =
    Boolean(item.exampleSentence) ||
    (item.synonyms?.length ?? 0) > 0 ||
    Boolean(item.nuanceNote) ||
    Boolean(item.gmatUsageNote)

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
                      {item.exampleSentence && (
                        <DetailRow label="Example" value={item.exampleSentence} />
                      )}
                      {item.synonyms.length > 0 && (
                        <DetailRow label="Synonyms" value={item.synonyms.join(', ')} />
                      )}
                      {item.nuanceNote && <DetailRow label="Nuance" value={item.nuanceNote} />}
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

        <div className="learnFlashStatusRow">
          <button
            type="button"
            className={flashStatusBtnClass('do_not_know', item.status)}
            onClick={() => props.onChangeStatus(item.id, 'do_not_know')}
          >
            Do Not Know
          </button>
          <button
            type="button"
            className={flashStatusBtnClass('learning', item.status)}
            onClick={() => props.onChangeStatus(item.id, 'learning')}
          >
            Learning
          </button>
          <button
            type="button"
            className={flashStatusBtnClass('know', item.status)}
            onClick={() => props.onChangeStatus(item.id, 'know')}
          >
            Know
          </button>
        </div>
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

function StatusChip(props: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="btn"
      style={{
        padding: '6px 10px',
        borderRadius: 999,
        border: props.active
          ? '1px solid var(--accent-gradient-end)'
          : '1px solid var(--border)',
        background: props.active
          ? 'rgba(99, 102, 241, 0.18)'
          : 'rgba(255,255,255,0.04)',
        fontSize: 12,
      }}
    >
      {props.label}
    </button>
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

