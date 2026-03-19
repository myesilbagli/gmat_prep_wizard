import { useEffect, useMemo, useState } from 'react'
import type { VocabItem, VocabStatus } from '../lib/vocab'
import {
  listVocabItems,
  toggleVocabFlagged,
  updateVocabStatus,
  deleteVocabItem,
} from '../lib/vocab'
import { auth } from '../lib/firebase'
import { IconFlag, IconSearch, IconTrash } from '../components/Icons'

type Filter = 'all' | 'do_not_know' | 'learning' | 'know' | 'flagged'
type ViewMode = 'list' | 'flashcards' | 'paragraph'

type ParagraphPart =
  | { kind: 'text'; value: string }
  | { kind: 'target'; text: string }

type ParagraphResponse = { parts: ParagraphPart[] }

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

  const flashItem =
    viewMode === 'flashcards' &&
    filtered.length > 0 &&
    flashIndex >= 0 &&
    flashIndex < filtered.length
      ? filtered[flashIndex]
      : null

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
      // #region agent log
      fetch('http://127.0.0.1:7471/ingest/77952ae0-e8f1-433e-b4e8-713bdadce68f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a01660'},body:JSON.stringify({sessionId:'a01660',runId:'pre-fix',hypothesisId:'H1',location:'src/pages/LearnPage.tsx:generateParagraph:pick',message:'Picked learning items',data:{pickedCount:picked.length,pickedTextTypes:picked.map(p=>({textType:typeof p.text,textPreview:String(p.text).slice(0,40),status:p.status,type:p.type}))},timestamp:Date.now()})}).catch(()=>{});
      // #endregion agent log
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

      // #region agent log
      fetch('http://127.0.0.1:7471/ingest/77952ae0-e8f1-433e-b4e8-713bdadce68f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a01660'},body:JSON.stringify({sessionId:'a01660',runId:'pre-fix',hypothesisId:'H2',location:'src/pages/LearnPage.tsx:generateParagraph:request',message:'About to request generateParagraph',data:{baseUrl,endpoint,itemsCount:payload.items.length,itemTextTypes:payload.items.map(i=>({textType:typeof i.text,textPreview:String(i.text).slice(0,40),type:i.type}))},timestamp:Date.now()})}).catch(()=>{});
      // #endregion agent log

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
        // #region agent log
        fetch('http://127.0.0.1:7471/ingest/77952ae0-e8f1-433e-b4e8-713bdadce68f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a01660'},body:JSON.stringify({sessionId:'a01660',runId:'pre-fix',hypothesisId:'H3',location:'src/pages/LearnPage.tsx:generateParagraph:response',message:'generateParagraph non-OK response',data:{status:res.status,statusText:res.statusText,bodyPreview:String(errText).slice(0,300)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion agent log
        throw new Error(errText || `Request failed (${res.status})`)
      }

      const jsonText = await res.text()
      // #region agent log
      fetch('http://127.0.0.1:7471/ingest/77952ae0-e8f1-433e-b4e8-713bdadce68f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a01660'},body:JSON.stringify({sessionId:'a01660',runId:'pre-fix',hypothesisId:'H4',location:'src/pages/LearnPage.tsx:generateParagraph:response',message:'generateParagraph OK response',data:{status:res.status,bodyPreview:String(jsonText).slice(0,300)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion agent log

      const json = JSON.parse(jsonText) as ParagraphResponse
      if (!json || !Array.isArray(json.parts)) {
        throw new Error('Bad response from server')
      }
      // #region agent log
      fetch('http://127.0.0.1:7471/ingest/77952ae0-e8f1-433e-b4e8-713bdadce68f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a01660'},body:JSON.stringify({sessionId:'a01660',runId:'pre-fix',hypothesisId:'H5',location:'src/pages/LearnPage.tsx:generateParagraph:parsed',message:'Parsed paragraph response parts summary',data:{partsCount:json.parts.length,head:json.parts.slice(0,12),tail:json.parts.slice(Math.max(0,json.parts.length-12))},timestamp:Date.now()})}).catch(()=>{});
      // #endregion agent log
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
            {viewMode === 'flashcards' && (
              <span className="muted" style={{ fontSize: 12 }}>
                {filtered.length} item{filtered.length === 1 ? '' : 's'} in deck
              </span>
            )}
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
            <FlashcardView
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

  // #region agent log
  useEffect(() => {
    const targets = props.parts
      .filter((p) => p.kind === 'target')
      .map((p) => (p as any).text as string)
    const mismatches = targets
      .map((t) => ({
        text: t,
        normalized: String(t).trim().toLowerCase(),
        hasMeaning: meaningByTextLower.has(String(t).trim().toLowerCase()),
      }))
      .filter((x) => !x.hasMeaning)
    fetch('http://127.0.0.1:7471/ingest/77952ae0-e8f1-433e-b4e8-713bdadce68f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a01660'},body:JSON.stringify({sessionId:'a01660',runId:'pre-fix',hypothesisId:'H6',location:'src/pages/LearnPage.tsx:ParagraphText:effect',message:'Paragraph render diagnostics',data:{pickedKeys:[...meaningByTextLower.keys()],targets,targetsCount:targets.length,mismatches,partsHead:props.parts.slice(0,12),partsTail:props.parts.slice(Math.max(0,props.parts.length-12))},timestamp:Date.now()})}).catch(()=>{});
  }, [props.parts, props.picked, meaningByTextLower])
  // #endregion agent log

  return (
    <div
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
  return (
    <div
      className="card"
      style={{
        padding: 16,
        display: 'grid',
        gap: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{item.text}</div>
          <div
            className="muted"
            style={{ fontSize: 11, textTransform: 'uppercase', marginTop: 2 }}
          >
            {item.type === 'phrase' ? 'Phrase' : 'Word'}
          </div>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => props.onToggleFlagged(item.id, !item.flagged)}
          style={{ fontSize: 12, padding: '6px 8px' }}
        >
          {item.flagged ? 'Unflag' : 'Flag'}
        </button>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        Card {props.index + 1} of {props.total}
      </div>

      <button
        type="button"
        className="btn btnPrimary"
        onClick={props.onToggleAnswer}
        style={{ padding: '8px 10px', fontSize: 13 }}
      >
        {props.showAnswer ? 'Hide answer' : 'Show answer'}
      </button>

      {props.showAnswer ? (
        <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
          <DetailRow
            label="Definition"
            value={item.definition || item.simpleDefinition || '—'}
          />
          <DetailRow
            label="Simple definition"
            value={item.simpleDefinition || '—'}
          />
          {item.exampleSentence && (
            <DetailRow label="Example" value={item.exampleSentence} />
          )}
          {item.synonyms.length > 0 && (
            <DetailRow label="Synonyms" value={item.synonyms.join(', ')} />
          )}
          {item.nuanceNote && (
            <DetailRow label="Nuance" value={item.nuanceNote} />
          )}
          {item.gmatUsageNote && (
            <DetailRow label="GMAT usage" value={item.gmatUsageNote} />
          )}
        </div>
      ) : (
        <div className="muted" style={{ fontSize: 13 }}>
          Tap “Show answer” to see meaning and examples.
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          marginTop: 8,
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
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="btn"
            onClick={props.onPrev}
            style={{ fontSize: 12, padding: '6px 10px' }}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn"
            onClick={props.onNext}
            style={{ fontSize: 12, padding: '6px 10px' }}
          >
            Next
          </button>
        </div>
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

