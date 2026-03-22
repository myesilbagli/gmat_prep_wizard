import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../lib/firebase'
import type { GeneratedResult } from '../lib/types'
import { saveWord } from '../lib/words'
import {
  IconBook,
  IconBookmark,
  IconLightbulb,
  IconQuote,
  IconStar,
} from '../components/Icons'

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
  const [saved, setSaved] = useState(false)
  const [userReady, setUserReady] = useState(false)
  const user = auth.currentUser

  useEffect(() => onAuthStateChanged(auth, () => setUserReady(true)), [])
  const canGenerate = useMemo(() => text.trim().length > 0, [text])

  async function generate() {
    setState({ status: 'loading' })
    setSaved(false)
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
        const resText = await res.text().catch(() => '')
        throw new Error(resText || `Request failed (${res.status})`)
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
      setSaved(true)
      setState({
        status: 'ready',
        result: state.result,
      })
      window.history.replaceState({}, '', `/words/${id}`)
    } catch (e) {
      setState({
        status: 'error',
        message: e instanceof Error ? e.message : 'Unknown error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.3 }}>
          Expand your lexicon
        </h1>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 15 }}>
          Enter a high-frequency GMAT word to decode its meaning and nuances.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            borderRadius: 14,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <input
            className="input"
            placeholder="Lookup & Generate"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              if (saved) setSaved(false)
            }}
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                canGenerate &&
                state.status !== 'loading' &&
                userReady
              ) {
                e.preventDefault()
                void generate()
              }
            }}
            autoCapitalize="none"
            autoCorrect="off"
            style={{
              border: 'none',
              background: 'transparent',
              minHeight: 28,
              padding: '4px 0',
              flex: 1,
            }}
          />
          <button
            type="button"
            className="btn btnPrimary"
            onClick={generate}
            disabled={!canGenerate || state.status === 'loading' || !userReady}
            style={{ padding: '8px 12px', fontSize: 13 }}
          >
            {state.status === 'loading' ? 'Generating…' : 'Generate Analysis'}
          </button>
        </div>

        {!user ? (
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            Sign in to generate and save your words.
          </p>
        ) : null}
      </div>

      <div style={{ height: 24 }} />

      <div className="card" style={{ padding: 20 }}>
        {state.status === 'idle' && (
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            Enter a word or phrase and tap Generate Analysis.
          </p>
        )}
        {state.status === 'loading' && (
          <LookupLoading word={text.trim()} />
        )}
        {state.status === 'error' && (
          <p style={{ margin: 0, color: 'var(--danger)', fontSize: 14 }}>
            {state.message}
          </p>
        )}
        {state.status === 'ready' && (
          <WordAnalysisCard
            word={text.trim()}
            result={state.result}
            onSave={save}
            saving={saving}
            saved={saved}
          />
        )}
      </div>
    </div>
  )
}

function LookupLoading({ word }: { word: string }) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="lookupLoadingDot" />
        <p className="muted" style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
          Generating analysis{word ? ` for "${word}"` : ''}...
        </p>
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

function WordAnalysisCard({
  word,
  result,
  onSave,
  saving,
  saved,
}: {
  word: string
  result: GeneratedResult
  onSave: () => void
  saving: boolean
  saved: boolean
}) {
  const typeLabel = word.includes(' ') ? 'PHRASE' : 'WORD'
  const exampleSentence = result.exampleSentence ?? ''
  const wordRegex = new RegExp(`\\b(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi')

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div
            className="muted"
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            {typeLabel} OF THE DAY
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: -0.3,
              color: 'var(--text)',
            }}
          >
            {word}
          </div>
        </div>
        <button
          type="button"
          className="btn btnPrimary"
          onClick={onSave}
          disabled={saving || saved}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
          }}
        >
          <IconBookmark style={{ flexShrink: 0 }} />
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </button>
      </div>

      {(result.simpleDefinition || result.definition) && (
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 2 }}>
            <IconBook />
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--muted)',
                marginBottom: 4,
              }}
            >
              Simple definition
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
              {result.simpleDefinition || result.definition}
            </p>
          </div>
        </div>
      )}

      {result.definition && result.definition !== result.simpleDefinition && (
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--muted)',
              marginBottom: 6,
            }}
          >
            Definition
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            {result.definition}
          </p>
        </div>
      )}

      {exampleSentence && (
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 2 }}>
            <IconQuote />
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--muted)',
                marginBottom: 4,
              }}
            >
              Example
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
              {exampleSentence.split(wordRegex).map((part, i) =>
                i % 2 === 1 ? (
                  <strong key={i} style={{ color: 'var(--text)' }}>
                    {part}
                  </strong>
                ) : (
                  <span key={i}>{part}</span>
                ),
              )}
            </p>
          </div>
        </div>
      )}

      {result.synonyms && result.synonyms.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--muted)',
              marginBottom: 8,
            }}
          >
            Synonyms
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {result.synonyms.map((s, i) => (
              <span
                key={`${s}-${i}`}
                style={{
                  fontSize: 13,
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'var(--muted)',
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {result.nuanceNote && (
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 2 }}>
            <IconLightbulb />
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--muted)',
                marginBottom: 4,
              }}
            >
              Nuance note
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
              {result.nuanceNote}
            </p>
          </div>
        </div>
      )}

      {result.gmatUsageNote && (
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 2 }}>
            <IconStar />
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--muted)',
                marginBottom: 4,
              }}
            >
              GMAT usage note
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
              {result.gmatUsageNote}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
