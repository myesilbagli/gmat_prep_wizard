import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { listWords } from '../lib/words'
import type { WordDoc } from '../lib/types'

type Row = { id: string; data: WordDoc }

export function MyWordsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setError(null)
      setRows([])
      if (!user) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const data = await listWords()
        setRows(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    })
    return () => unsub()
  }, [])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return rows
    return rows.filter((r) => r.data.word.includes(query))
  }, [q, rows])

  return (
    <div className="container" style={{ paddingBottom: 18 }}>
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>
            My Words
          </div>
          <span className="muted" style={{ fontSize: 13 }}>
            {rows.length} saved
          </span>
        </div>

        <div style={{ height: 10 }} />
        <input
          className="input"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div style={{ height: 12 }} />

      <div className="card" style={{ padding: 16 }}>
        {loading ? <div className="muted">Loading…</div> : null}
        {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}

        {!loading && !error && auth.currentUser == null ? (
          <div className="muted">Sign in to view your saved words.</div>
        ) : null}

        {!loading && !error && auth.currentUser != null && filtered.length === 0 ? (
          <div className="muted">No matches.</div>
        ) : null}

        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map((r) => (
            <Link
              key={r.id}
              to={`/words/${r.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div
                style={{
                  border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 12,
                  padding: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{r.data.word}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {r.data.result.definitions?.[0] ?? '—'}
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  View →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

