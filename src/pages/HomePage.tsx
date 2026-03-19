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
  return {
    definition: '',
    simpleDefinition: '',
    exampleSentence: '',
    synonyms: [],
    nuanceNote: '',
    gmatUsageNote: '',
    definitions: [],
    examples: [],
  }
}

export function HomePage() {
  const [text, setText] = useState('')
  const [state, setState] = useState<GenerateState>({ status: 'idle' })
  const [saving, setSaving] = useState(false)
  const [userReady, setUserReady] = useState(false)
  const user = auth.currentUser

  useEffect(() => onAuthStateChanged(auth, () => setUserReady(true)), [])

  const canGenerate = useMemo(() => text.trim().length > 0, [text])

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
        body: JSON.stringify({ text: text.trim() }),
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
      const trimmed = text.trim()
      const type = trimmed.includes(' ') ? 'phrase' : 'word'
      const { id } = await saveWord({ text: trimmed, type, result: state.result })
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
            placeholder="Word or phrase (e.g., 'obdurate' or 'on the verge of')"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
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
                setText('')
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
          <div className="muted">Enter a word or phrase and tap Generate.</div>
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
      <Single title="Definition" value={result.definition} />
      <Single title="Simple definition" value={result.simpleDefinition} />
      <Single title="Example sentence" value={result.exampleSentence ?? ''} />
      <Section title="Synonyms" items={result.synonyms ?? []} inline />
      <Single title="Nuance note" value={result.nuanceNote ?? ''} />
      <Single title="GMAT usage note" value={result.gmatUsageNote ?? ''} />

      {(result.definitions ?? []).length > 0 ? (
        <Section title="Extra definitions" items={result.definitions ?? []} />
      ) : null}
      {(result.examples ?? []).length > 0 ? (
        <Section title="Extra examples" items={result.examples ?? []} />
      ) : null}
    </div>
  )
}

function Single(props: { title: string; value: string }) {
  const v = props.value?.trim()
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
        {props.title}
      </div>
      {v ? (
        <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>
          {v}
        </div>
      ) : (
        <div className="muted" style={{ fontSize: 13 }}>
          —
        </div>
      )}
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

