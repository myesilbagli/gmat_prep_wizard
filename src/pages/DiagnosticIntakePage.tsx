/**
 * Diagnostic intake — /profile/diagnostic.
 *
 * Three-step flow:
 *   1. Upload: user picks up to 3 screenshots, one per section
 *      (Verbal / Quant / DI). At least one section is required.
 *   2. Parse: each uploaded image is sent through the
 *      /parseDiagnostic vision endpoint. While that's happening the
 *      GenerationLoader fills the screen so the user knows the OCR
 *      is in flight.
 *   3. Verify: the parsed rows are shown in an EDITABLE table — every
 *      cell is changeable. Required step. The roadmap's correctness
 *      depends on accurate data, so we explicitly do not auto-commit.
 *   4. Confirm & save: writes a DiagnosticDoc to
 *      users/{uid}/diagnostic/{auto-id} and navigates back to /profile.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { Link, useNavigate } from 'react-router-dom'
import {
  ALL_DIAGNOSTIC_SECTIONS,
  DIAGNOSTIC_SECTION_LABELS,
  DI_CONTENT_DOMAINS,
  DI_QUESTION_TYPES,
  QUANT_CONTENT_DOMAINS,
  QUANT_FUNDAMENTAL_SKILLS,
  VERBAL_FUNDAMENTAL_SKILLS,
  VERBAL_QUESTION_TYPES,
  type DiagnosticRow,
  type DiagnosticSection,
} from '../../shared/diagnosticTypes'
import { subscribeToAuth } from '../lib/auth'
import { ensureUserProfileDefaults } from '../lib/userProfile'
import {
  createDiagnostic,
  fileToBase64,
  parseDiagnosticImage,
} from '../lib/diagnostic'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { Alert } from '../components/ui/Alert'
import { GenerationLoader } from '../components/GenerationLoader'

type SectionFile = {
  file: File
  previewUrl: string
}

type Phase = 'collect' | 'parsing' | 'verify' | 'saving'

const PARSE_LOADING_MESSAGES = [
  'Reading your diagnostic screenshots...',
  'Counting rows...',
  'Reading the Correct / Incorrect column (not the colors)...',
  'Mapping question types and skills...',
  'Almost there — verification will look much nicer than the raw table...',
  "If a row's off, you'll fix it in the next step — nothing is committed yet...",
]

export function DiagnosticIntakePage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)

  const [files, setFiles] = useState<Partial<Record<DiagnosticSection, SectionFile>>>({})
  const [phase, setPhase] = useState<Phase>('collect')
  const [error, setError] = useState<string | null>(null)
  /** Edit buffer — what the user is currently verifying. Initialized
   *  from the parse response; mutated as the user edits cells. */
  const [draftRows, setDraftRows] = useState<DiagnosticRow[]>([])
  const [examMonth, setExamMonth] = useState<number | null>(null)
  const [examYear, setExamYear] = useState<number | null>(null)

  // Lifecycle: revoke object URLs we created when files change / unmount.
  const revokeQueueRef = useRef<string[]>([])
  useEffect(() => {
    return () => {
      for (const url of revokeQueueRef.current) URL.revokeObjectURL(url)
    }
  }, [])

  useEffect(
    () =>
      subscribeToAuth((u) => {
        setUser(u)
        setAuthReady(true)
      }),
    [],
  )

  useEffect(() => {
    if (!user) return
    void ensureUserProfileDefaults().then((p) => {
      if (p.examTarget) {
        setExamMonth(p.examTarget.month)
        setExamYear(p.examTarget.year)
      }
    })
  }, [user])

  function setSectionFile(section: DiagnosticSection, file: File | null) {
    setError(null)
    setFiles((prev) => {
      const next = { ...prev }
      // Revoke previous preview URL if present.
      const existing = prev[section]
      if (existing?.previewUrl) URL.revokeObjectURL(existing.previewUrl)
      if (file == null) {
        delete next[section]
      } else {
        const previewUrl = URL.createObjectURL(file)
        revokeQueueRef.current.push(previewUrl)
        next[section] = { file, previewUrl }
      }
      return next
    })
  }

  const numAttached = Object.keys(files).length

  async function startParse() {
    if (numAttached === 0) {
      setError('Attach at least one section screenshot before parsing.')
      return
    }
    setError(null)
    setPhase('parsing')
    try {
      const all: DiagnosticRow[] = []
      for (const section of ALL_DIAGNOSTIC_SECTIONS) {
        const f = files[section]
        if (!f) continue
        const { base64, mimeType } = await fileToBase64(f.file)
        const rows = await parseDiagnosticImage({
          section,
          imageBase64: base64,
          imageMimeType: mimeType,
        })
        all.push(...rows)
      }
      if (all.length === 0) {
        throw new Error('Parse returned no rows for any section.')
      }
      setDraftRows(all)
      setPhase('verify')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Parse failed.')
      setPhase('collect')
    }
  }

  function updateRow(index: number, patch: Partial<DiagnosticRow>) {
    setDraftRows((rows) => {
      const next = [...rows]
      next[index] = { ...next[index], ...patch }
      return next
    })
  }

  function deleteRow(index: number) {
    setDraftRows((rows) => rows.filter((_, i) => i !== index))
  }

  function addRow(section: DiagnosticSection) {
    setDraftRows((rows) => [
      ...rows,
      {
        section,
        question: rows.filter((r) => r.section === section).length + 1,
        responseTimeMinutes: 2,
        performance: 'correct',
        questionType: section === 'di' ? 'Data Sufficiency' : 'Critical Reasoning',
        contentDomain: section === 'verbal' ? null : null,
        fundamentalSkill: section === 'di' ? null : null,
      },
    ])
  }

  async function confirmAndSave() {
    setError(null)
    setPhase('saving')
    try {
      await createDiagnostic({
        rows: draftRows,
        examMonth,
        examYear,
      })
      navigate('/profile')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save diagnostic.')
      setPhase('verify')
    }
  }

  if (authReady && !user) {
    return (
      <div
        className="container"
        style={{ paddingTop: 'var(--space-3xl)', paddingBottom: 'var(--space-3xl)', maxWidth: 720 }}
      >
        <Alert variant="info">
          Sign in to add a diagnostic.{' '}
          <Link to="/sign-in" style={{ color: 'inherit', textDecoration: 'underline' }}>
            Sign in →
          </Link>
        </Alert>
      </div>
    )
  }

  if (phase === 'parsing') {
    return (
      <div
        className="container"
        style={{ paddingTop: 'var(--space-3xl)', paddingBottom: 'var(--space-3xl)', maxWidth: 720 }}
      >
        <div className="card" style={{ padding: 'var(--card-pad-comfortable)' }}>
          <GenerationLoader
            title={`Parsing ${numAttached} section${numAttached === 1 ? '' : 's'}`}
            messages={PARSE_LOADING_MESSAGES}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className="container"
      style={{
        paddingTop: 'var(--space-2xl)',
        paddingBottom: 'var(--space-3xl)',
        maxWidth: phase === 'verify' ? 1100 : 880,
      }}
    >
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <Link
          to="/profile"
          className="muted text-body-sm"
          style={{ textDecoration: 'none' }}
        >
          ← Back to profile
        </Link>
        <h1 className="text-page-title" style={{ margin: 'var(--space-xs) 0 0' }}>
          Add diagnostic
        </h1>
        <p className="muted text-body-lg" style={{ margin: 'var(--space-xs) 0 0' }}>
          {phase === 'collect'
            ? 'Attach screenshots of your Official Diagnostic Question Performance & Time Management tables. Up to one image per section.'
            : 'Review the parsed rows and fix any errors before saving — your study roadmap depends on this being accurate.'}
        </p>
      </div>

      {error ? (
        <Alert variant="error" style={{ marginBottom: 'var(--space-lg)' }}>
          {error}
        </Alert>
      ) : null}

      {phase === 'collect' ? (
        <CollectStep
          files={files}
          onSetSectionFile={setSectionFile}
          onStartParse={() => void startParse()}
        />
      ) : null}

      {phase === 'verify' || phase === 'saving' ? (
        <VerifyStep
          rows={draftRows}
          onUpdateRow={updateRow}
          onDeleteRow={deleteRow}
          onAddRow={addRow}
          onConfirm={() => void confirmAndSave()}
          saving={phase === 'saving'}
        />
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1: Collect
// ---------------------------------------------------------------------------

function CollectStep({
  files,
  onSetSectionFile,
  onStartParse,
}: {
  files: Partial<Record<DiagnosticSection, SectionFile>>
  onSetSectionFile: (s: DiagnosticSection, f: File | null) => void
  onStartParse: () => void
}) {
  const attached = Object.keys(files).length
  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-xl)',
        }}
      >
        {ALL_DIAGNOSTIC_SECTIONS.map((section) => (
          <SectionUploadCard
            key={section}
            section={section}
            file={files[section] ?? null}
            onChange={(f) => onSetSectionFile(section, f)}
          />
        ))}
      </div>

      <div
        className="card"
        style={{
          padding: 'var(--card-pad-comfortable)',
          marginBottom: 'var(--space-xl)',
          display: 'grid',
          gap: 'var(--space-md)',
        }}
      >
        <div className="muted text-label" style={{ letterSpacing: '0.08em' }}>
          NOTE
        </div>
        <p className="muted text-body-sm" style={{ margin: 0 }}>
          You can submit one, two, or all three sections. Vision OCR is fast (~10–20s per
          image) but not perfect — every cell is editable in the next step. Nothing is
          saved until you confirm.
        </p>
      </div>

      <PrimaryButton onClick={onStartParse} disabled={attached === 0}>
        {attached === 0
          ? 'Attach at least one screenshot'
          : `Parse ${attached} section${attached === 1 ? '' : 's'}`}
      </PrimaryButton>
    </>
  )
}

function SectionUploadCard({
  section,
  file,
  onChange,
}: {
  section: DiagnosticSection
  file: SectionFile | null
  onChange: (f: File | null) => void
}) {
  const inputId = `diag-upload-${section}`
  return (
    <label
      htmlFor={inputId}
      className="card"
      style={{
        padding: 'var(--card-pad-comfortable)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-md)',
        minHeight: 200,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-sm)',
        }}
      >
        <span className="text-title">{DIAGNOSTIC_SECTION_LABELS[section]}</span>
        {file ? (
          <button
            type="button"
            className="btn text-body-sm"
            onClick={(e) => {
              e.preventDefault()
              onChange(null)
            }}
            style={{
              padding: 'var(--space-2xs) var(--space-sm)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--muted)',
            }}
          >
            Remove
          </button>
        ) : null}
      </div>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          onChange(f)
        }}
        style={{ display: 'none' }}
      />
      {file ? (
        <img
          src={file.previewUrl}
          alt={`${section} preview`}
          style={{
            maxWidth: '100%',
            maxHeight: 220,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            objectFit: 'contain',
          }}
        />
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--muted)',
            background: 'var(--fill-subtle)',
            padding: 'var(--space-2xl)',
            textAlign: 'center',
          }}
        >
          <span className="text-body-sm">Click to attach screenshot</span>
        </div>
      )}
    </label>
  )
}

// ---------------------------------------------------------------------------
// Step 2: Verify (editable table)
// ---------------------------------------------------------------------------

function VerifyStep({
  rows,
  onUpdateRow,
  onDeleteRow,
  onAddRow,
  onConfirm,
  saving,
}: {
  rows: DiagnosticRow[]
  onUpdateRow: (i: number, patch: Partial<DiagnosticRow>) => void
  onDeleteRow: (i: number) => void
  onAddRow: (s: DiagnosticSection) => void
  onConfirm: () => void
  saving: boolean
}) {
  // Group rows by section for display.
  const grouped = useMemo(() => {
    const m = new Map<DiagnosticSection, Array<{ row: DiagnosticRow; index: number }>>()
    rows.forEach((row, index) => {
      const arr = m.get(row.section) ?? []
      arr.push({ row, index })
      m.set(row.section, arr)
    })
    return m
  }, [rows])

  return (
    <>
      <Alert variant="info" style={{ marginBottom: 'var(--space-lg)' }}>
        <strong>Review every row.</strong> The vision parse is usually close but rarely
        perfect — toggle wrong Performance values, fix mistyped skills, and delete or add
        rows as needed. Nothing is saved until you click "Confirm &amp; save" below.
      </Alert>

      {ALL_DIAGNOSTIC_SECTIONS.map((section) => {
        const items = grouped.get(section)
        if (!items || items.length === 0) return null
        return (
          <SectionTable
            key={section}
            section={section}
            items={items}
            onUpdate={onUpdateRow}
            onDelete={onDeleteRow}
            onAdd={() => onAddRow(section)}
          />
        )
      })}

      <div
        style={{
          marginTop: 'var(--space-2xl)',
          display: 'flex',
          gap: 'var(--space-md)',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <PrimaryButton onClick={onConfirm} disabled={saving || rows.length === 0} loading={saving}>
          {saving ? 'Saving…' : `Confirm & save (${rows.length} rows)`}
        </PrimaryButton>
        <Link
          to="/profile"
          className="muted text-body"
          style={{ textDecoration: 'none', fontWeight: 600 }}
        >
          Cancel
        </Link>
      </div>
    </>
  )
}

function SectionTable({
  section,
  items,
  onUpdate,
  onDelete,
  onAdd,
}: {
  section: DiagnosticSection
  items: Array<{ row: DiagnosticRow; index: number }>
  onUpdate: (i: number, patch: Partial<DiagnosticRow>) => void
  onDelete: (i: number) => void
  onAdd: () => void
}) {
  const showContentDomain = section !== 'verbal'
  const showSkill = section !== 'di'
  const questionTypeOptions =
    section === 'verbal'
      ? VERBAL_QUESTION_TYPES
      : section === 'di'
        ? DI_QUESTION_TYPES
        : []
  const contentDomainOptions =
    section === 'quant'
      ? QUANT_CONTENT_DOMAINS
      : section === 'di'
        ? DI_CONTENT_DOMAINS
        : []
  const skillOptions =
    section === 'verbal'
      ? VERBAL_FUNDAMENTAL_SKILLS
      : section === 'quant'
        ? QUANT_FUNDAMENTAL_SKILLS
        : []

  const datalistType = `dl-type-${section}`
  const datalistDomain = `dl-domain-${section}`
  const datalistSkill = `dl-skill-${section}`

  return (
    <div
      className="card"
      style={{
        padding: 'var(--card-pad-comfortable)',
        marginBottom: 'var(--space-lg)',
        display: 'grid',
        gap: 'var(--space-md)',
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
          {DIAGNOSTIC_SECTION_LABELS[section]}
        </h2>
        <span className="muted text-label">{items.length} rows</span>
      </div>

      <datalist id={datalistType}>
        {questionTypeOptions.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id={datalistDomain}>
        {contentDomainOptions.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id={datalistSkill}>
        {skillOptions.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'separate',
            borderSpacing: 0,
            fontSize: 'var(--text-body-sm-size)',
          }}
        >
          <thead>
            <tr>
              <Th>Q</Th>
              <Th>Time (min)</Th>
              <Th>Perf.</Th>
              {showContentDomain ? <Th>Content domain</Th> : null}
              <Th>Question type</Th>
              {showSkill ? <Th>Fundamental skill</Th> : null}
              <Th />
            </tr>
          </thead>
          <tbody>
            {items.map(({ row, index }) => (
              <tr key={index}>
                <Td>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={row.question}
                    onChange={(e) =>
                      onUpdate(index, { question: Math.max(1, Number(e.target.value) || 1) })
                    }
                    style={inputCellStyle(60)}
                  />
                </Td>
                <Td>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={row.responseTimeMinutes}
                    onChange={(e) =>
                      onUpdate(index, {
                        responseTimeMinutes: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    style={inputCellStyle(80)}
                  />
                </Td>
                <Td>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdate(index, {
                        performance:
                          row.performance === 'correct' ? 'incorrect' : 'correct',
                      })
                    }
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-pill)',
                      border: '1px solid var(--border)',
                      background:
                        row.performance === 'correct'
                          ? 'var(--success-soft)'
                          : 'var(--danger-soft)',
                      color:
                        row.performance === 'correct'
                          ? 'var(--success-on-soft)'
                          : 'var(--danger-text)',
                      fontWeight: 700,
                      fontSize: 11,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    {row.performance === 'correct' ? '✓ Correct' : '✗ Incorrect'}
                  </button>
                </Td>
                {showContentDomain ? (
                  <Td>
                    <input
                      type="text"
                      list={datalistDomain}
                      value={row.contentDomain ?? ''}
                      onChange={(e) =>
                        onUpdate(index, {
                          contentDomain: e.target.value.trim() ? e.target.value : null,
                        })
                      }
                      style={inputCellStyle(160)}
                    />
                  </Td>
                ) : null}
                <Td>
                  <input
                    type="text"
                    list={datalistType}
                    value={row.questionType}
                    onChange={(e) => onUpdate(index, { questionType: e.target.value })}
                    style={inputCellStyle(180)}
                  />
                </Td>
                {showSkill ? (
                  <Td>
                    <input
                      type="text"
                      list={datalistSkill}
                      value={row.fundamentalSkill ?? ''}
                      onChange={(e) =>
                        onUpdate(index, {
                          fundamentalSkill: e.target.value.trim() ? e.target.value : null,
                        })
                      }
                      style={inputCellStyle(220)}
                    />
                  </Td>
                ) : null}
                <Td>
                  <button
                    type="button"
                    onClick={() => onDelete(index)}
                    style={{
                      padding: '2px var(--space-sm)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--muted)',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                    aria-label="Delete row"
                  >
                    ✕
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <button
          type="button"
          className="btn text-body-sm"
          onClick={onAdd}
          style={{
            padding: 'var(--space-2xs) var(--space-md)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--muted)',
          }}
        >
          + Add row
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tiny styled cell primitives
// ---------------------------------------------------------------------------

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th
      className="muted text-label"
      style={{
        textAlign: 'left',
        padding: 'var(--space-xs) var(--space-sm)',
        borderBottom: '1px solid var(--border)',
        background: 'var(--fill-subtle)',
        position: 'sticky',
        top: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  )
}

function Td({ children }: { children?: React.ReactNode }) {
  return (
    <td
      style={{
        padding: 'var(--space-xs) var(--space-sm)',
        borderBottom: '1px solid var(--border)',
        verticalAlign: 'middle',
      }}
    >
      {children}
    </td>
  )
}

function inputCellStyle(minWidth: number): React.CSSProperties {
  return {
    width: '100%',
    minWidth,
    border: '1px solid var(--border)',
    background: 'var(--fill-subtle)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-sm)',
    padding: '4px 8px',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    outline: 'none',
  }
}
