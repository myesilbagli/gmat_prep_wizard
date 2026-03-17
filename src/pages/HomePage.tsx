import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../lib/firebase'
import type { GeneratedResult } from '../lib/types'
import { saveWord } from '../lib/words'

type GenerateState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; result: GeneratedResult }
  | { status: 'error'; message: string }

function emptyResult(): GeneratedResult {
  return { definitions: [], examples: [], synonyms: [], antonyms: [], notes: '' }
}

export function HomePage() {
  const [word, setWord] = useState('')
  const [context, setContext] = useState('')
  const [state, setState] = useState<GenerateState>({ status: 'idle' })
  const [saving, setSaving] = useState(false)
  const [userReady, setUserReady] = useState(false)
  const user = auth.currentUser

  useEffect(() => onAuthStateChanged(auth, () => setUserReady(true)), [])

  const canGenerate = useMemo(() => word.trim().length > 0, [word])

  async function generate() {
    setState({ status: 'loading' })
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('Please sign in first.')

      const baseUrl =
        (import.meta.env.VITE_FUNCTIONS_BASE_URL as string | undefined) ?? ''
      if (!baseUrl) throw new Error('Missing VITE_FUNCTIONS_BASE_URL')

      const res = await fetch(`${baseUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ word: word.trim(), context: context.trim() || undefined }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Request failed (${res.status})`)
      }

      const json = (await res.json()) as GeneratedResult
      setState({ status: 'ready', result: { ...emptyResult(), ...json } })
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
      const { id } = await saveWord({ word, result: state.result })
      setState({
        status: 'ready',
        result: state.result,
      })
      window.history.replaceState({}, '', `/words/${id}`)
    } catch (e) {
      setState({
        status: 'error',
        message: e instanceof Error ? e.message : 'Failed to save',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container" style={{ paddingBottom: 18 }}>
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
          Lookup & Generate
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <input
            className="input"
            placeholder="Word (e.g., 'obdurate')"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <textarea
            className="input"
            placeholder="Optional context (where you saw it)"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={3}
          />

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btnPrimary"
              onClick={generate}
              disabled={!canGenerate || state.status === 'loading' || !userReady}
            >
              {state.status === 'loading' ? 'Generating…' : 'Generate'}
            </button>
            <button
              className="btn"
              onClick={() => {
                setWord('')
                setContext('')
                setState({ status: 'idle' })
              }}
              disabled={state.status === 'loading'}
            >
              Reset
            </button>
          </div>

          {!user ? (
            <div className="muted" style={{ fontSize: 13 }}>
              Sign in to generate and save your words.
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>
            Result
          </div>
          <button
            className="btn"
            onClick={save}
            disabled={saving || state.status !== 'ready'}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div style={{ height: 10 }} />

        {state.status === 'idle' ? (
          <div className="muted">Enter a word and tap Generate.</div>
        ) : null}
        {state.status === 'error' ? (
          <div style={{ color: 'var(--danger)' }}>{state.message}</div>
        ) : null}
        {state.status === 'loading' ? <div className="muted">Working…</div> : null}
        {state.status === 'ready' ? <ResultView result={state.result} /> : null}
      </div>
    </div>
  )
}

function ResultView({ result }: { result: GeneratedResult }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Section title="Definitions" items={result.definitions} />
      <Section title="Examples" items={result.examples} />
      <Section title="Synonyms" items={result.synonyms} inline />
      <Section title="Antonyms" items={result.antonyms} inline />
      {result.notes ? (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
            Notes
          </div>
          <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>
            {result.notes}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Section(props: {
  title: string
  items: string[]
  inline?: boolean
}) {
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

