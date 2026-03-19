import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { getWord } from '../lib/words'
import type { WordDoc } from '../lib/types'

export function WordDetailPage() {
  const { wordId } = useParams()
  const [loading, setLoading] = useState(true)
  const [row, setRow] = useState<{ id: string; data: WordDoc } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!wordId) return
    const unsub = onAuthStateChanged(auth, async (user) => {
      setError(null)
      setRow(null)
      if (!user) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const r = await getWord(wordId)
        setRow(r)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    })
    return () => unsub()
  }, [wordId])

  return (
    <div className="container" style={{ paddingBottom: 18 }}>
      <div className="card" style={{ padding: 16 }}>
        {loading ? <div className="muted">Loading…</div> : null}
        {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}
        {!loading && !error && auth.currentUser == null ? (
          <div className="muted">Sign in to view this word.</div>
        ) : null}
        {!loading && !error && auth.currentUser != null && row == null ? (
          <div className="muted">Not found.</div>
        ) : null}
        {row ? <WordDetailView data={row.data} /> : null}
      </div>
    </div>
  )
}

function WordDetailView({ data }: { data: WordDoc }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.4 }}>
          {data.word}
        </div>
        <div className="muted" style={{ fontSize: 13 }}>
          Source: {data.source}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <Block title="Definitions" items={data.result.definitions ?? []} />
        <Block title="Examples" items={data.result.examples ?? []} />
        <Block title="Synonyms" items={data.result.synonyms ?? []} inline />
        <Block title="Antonyms" items={data.result.antonyms ?? []} inline />
        {data.result.nuanceNote || data.result.gmatUsageNote ? (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              Notes
            </div>
            <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>
              {[data.result.nuanceNote, data.result.gmatUsageNote]
                .filter(Boolean)
                .join('\n\n')}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Block(props: { title: string; items: string[]; inline?: boolean }) {
  const items = (props.items ?? []).filter(Boolean)
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
        {props.title}
      </div>
      {items.length === 0 ? (
        <div className="muted" style={{ fontSize: 13 }}>
          —
        </div>
      ) : props.inline ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {items.map((x, i) => (
            <span
              key={`${x}-${i}`}
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 13,
                padding: '6px 10px',
                borderRadius: 999,
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              {x}
            </span>
          ))}
        </div>
      ) : (
        <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
          {items.map((x, i) => (
            <li key={`${x}-${i}`} className="muted">
              {x}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

