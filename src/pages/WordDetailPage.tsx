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
  const r = data.result
  const headword = (data.text ?? data.word).trim()
  const examples =
    data.examples?.length === 2
      ? data.examples
      : Array.isArray(r.examples) && r.examples.length === 2
        ? r.examples
        : []
  const synonyms = (data.synonyms ?? r.synonyms ?? []).filter(Boolean) as string[]
  const tags = (data.wordTags ?? r.wordTags ?? []).filter(Boolean) as string[]
  const contrast = data.contrastWord ?? r.contrastWord
  const memoryHook = (data.memoryHook ?? r.memoryHook)?.trim()

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.4 }}>
          {headword}
        </div>
        <div className="muted" style={{ fontSize: 13 }}>
          Source: {data.source}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {(data.simpleDefinition || data.definition || r.simpleDefinition || r.definition) && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Meaning</div>
            <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>
              {(data.simpleDefinition || r.simpleDefinition || data.definition || r.definition) ?? ''}
            </div>
            {data.definition &&
            r.definition &&
            data.definition.trim() !== (data.simpleDefinition || r.simpleDefinition || '').trim() ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Full definition</div>
                <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>
                  {data.definition}
                </div>
              </div>
            ) : null}
          </div>
        )}
        {examples.length === 2 ? (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Examples</div>
            <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
              <li className="muted">(Academic) {examples[0]}</li>
              <li className="muted">(Argument) {examples[1]}</li>
            </ol>
          </div>
        ) : data.exampleSentence || r.exampleSentence || r.examples?.[0] ? (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Example</div>
            <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>
              {data.exampleSentence || r.exampleSentence || r.examples?.[0]}
            </div>
          </div>
        ) : (
          <Block title="Examples" items={r.examples ?? []} />
        )}
        <Block title="Synonyms" items={synonyms} inline />
        {tags.length > 0 ? <Block title="Tags" items={tags} inline /> : null}
        {contrast?.word && contrast.explanation ? (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Contrast</div>
            <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>
              <strong style={{ color: 'var(--text)' }}>{contrast.word}</strong>
              {' — '}
              {contrast.explanation}
            </div>
          </div>
        ) : null}
        {memoryHook ? (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Memory hook</div>
            <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>
              {memoryHook}
            </div>
          </div>
        ) : null}
        <Block title="Definitions (legacy)" items={r.definitions ?? []} />
        <Block title="Antonyms" items={r.antonyms ?? []} inline />
        {r.nuanceNote || r.gmatUsageNote ? (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              Notes
            </div>
            <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>
              {[r.nuanceNote, r.gmatUsageNote].filter(Boolean).join('\n\n')}
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

