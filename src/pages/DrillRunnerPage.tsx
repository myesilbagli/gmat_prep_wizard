import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { RcAttempt } from '../../shared/rcTypes'
import type { CrAttempt, CrAttemptQuestion } from '../../shared/crTypes'
import {
  ALL_VERBAL_SUBTYPES,
  type VerbalSubtypeKey,
} from '../../shared/verbalTaxonomy'
import {
  getRcAttempt,
  markRcAttemptComplete,
  recordQuestionAnswer,
} from '../lib/rcAttempts'
import {
  getCrAttempt,
  markCrAttemptComplete,
  recordCrAnswer,
} from '../lib/crAttempts'
import { McqOption } from '../components/ui/McqOption'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { Alert } from '../components/ui/Alert'
import {
  PASSAGE_LINE_HEIGHT,
  PASSAGE_MEASURE,
  PASSAGE_PARAGRAPH_GAP,
  getPassageFontSize,
} from '../lib/passageTypography'
import { renderInlineBold } from '../lib/inlineBold'

type Phase = 'loading' | 'reading' | 'submitting' | 'finishing' | 'fatal-error'

/**
 * One runner used by both RC and CR drills. Routes:
 *   /test/drill/run/rc/:attemptId
 *   /test/drill/run/cr/:attemptId
 *
 * Mirrors the exam practice page UX (question-by-question, select then
 * Next, Finish on the last question) but lives outside /exam so the
 * exam flows are completely untouched. After Finish, sends the user to
 * the drill review page.
 */
export function DrillRunnerPage() {
  const { section: rawSection, attemptId: rawId } = useParams<{
    section: string
    attemptId: string
  }>()
  const navigate = useNavigate()
  const section = rawSection === 'rc' || rawSection === 'cr' ? rawSection : null
  const attemptId = rawId ?? ''

  const [rcAttempt, setRcAttempt] = useState<RcAttempt | null>(null)
  const [crAttempt, setCrAttempt] = useState<CrAttempt | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<string | null>(null)

  const questionStartedAtRef = useRef<number>(Date.now())
  const finishingRef = useRef<boolean>(false)

  // Load the attempt on mount.
  useEffect(() => {
    if (!section || !attemptId) {
      setPhase('fatal-error')
      setError('Missing drill id.')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        if (section === 'rc') {
          const a = await getRcAttempt(attemptId)
          if (cancelled) return
          if (!a) {
            setPhase('fatal-error')
            setError('Drill not found.')
            return
          }
          if (a.completedAt) {
            navigate(`/test/drill/review/rc/${attemptId}`, { replace: true })
            return
          }
          setRcAttempt(a)
          const firstUnanswered = a.questions.findIndex(
            (q) => typeof q.userAnswerIndex !== 'number',
          )
          setCurrentIndex(firstUnanswered === -1 ? a.questions.length - 1 : firstUnanswered)
          questionStartedAtRef.current = Date.now()
          setPhase('reading')
        } else {
          const a = await getCrAttempt(attemptId)
          if (cancelled) return
          if (!a) {
            setPhase('fatal-error')
            setError('Drill not found.')
            return
          }
          if (a.completedAt) {
            navigate(`/test/drill/review/cr/${attemptId}`, { replace: true })
            return
          }
          setCrAttempt(a)
          const firstUnanswered = a.questions.findIndex((q) => q.userAnswerIndex == null)
          setCurrentIndex(firstUnanswered === -1 ? a.questions.length - 1 : firstUnanswered)
          questionStartedAtRef.current = Date.now()
          setPhase('reading')
        }
      } catch (e) {
        if (cancelled) return
        setPhase('fatal-error')
        setError(e instanceof Error ? e.message : 'Failed to load drill.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [section, attemptId, navigate])

  const drillSubtypeKey: VerbalSubtypeKey | null = useMemo(() => {
    const raw = section === 'rc' ? rcAttempt?.drillSubtype : crAttempt?.drillSubtype
    if (raw && raw in ALL_VERBAL_SUBTYPES) return raw as VerbalSubtypeKey
    return null
  }, [section, rcAttempt, crAttempt])

  const totalQuestions = section === 'rc'
    ? rcAttempt?.questions.length ?? 0
    : crAttempt?.questions.length ?? 0

  async function finish(finalIdx: number, finalAnswer: number | null, finalSeconds: number) {
    if (finishingRef.current) return
    finishingRef.current = true
    setPhase('finishing')
    try {
      if (section === 'rc') {
        if (rcAttempt && finalIdx >= 0 && finalIdx < rcAttempt.questions.length && finalAnswer != null) {
          await recordQuestionAnswer(attemptId, finalIdx, finalAnswer, finalSeconds)
        }
        await markRcAttemptComplete(attemptId)
        navigate(`/test/drill/review/rc/${attemptId}`, { replace: true })
      } else {
        if (crAttempt && finalIdx >= 0 && finalIdx < crAttempt.questions.length) {
          await recordCrAnswer(attemptId, finalIdx, finalAnswer, finalSeconds)
        }
        const fresh = await getCrAttempt(attemptId)
        if (!fresh) throw new Error('Attempt vanished.')
        const score = fresh.questions.reduce((acc, q) => acc + (q.isCorrect ? 1 : 0), 0)
        const total = fresh.questions.reduce((acc, q) => acc + (q.timeSeconds || 0), 0)
        await markCrAttemptComplete(attemptId, score, total)
        navigate(`/test/drill/review/cr/${attemptId}`, { replace: true })
      }
    } catch (e) {
      finishingRef.current = false
      setError(e instanceof Error ? e.message : 'Failed to finish drill.')
      setPhase('reading')
    }
  }

  async function onNext() {
    if (phase !== 'reading') return
    if (selectedIndex == null) return
    const qSecs = Math.max(0, Math.round((Date.now() - questionStartedAtRef.current) / 1000))
    const isLast = currentIndex >= totalQuestions - 1
    if (isLast) {
      await finish(currentIndex, selectedIndex, qSecs)
      return
    }
    setPhase('submitting')
    try {
      if (section === 'rc') {
        await recordQuestionAnswer(attemptId, currentIndex, selectedIndex, qSecs)
      } else {
        await recordCrAnswer(attemptId, currentIndex, selectedIndex, qSecs)
      }
      setCurrentIndex((i) => i + 1)
      setSelectedIndex(null)
      questionStartedAtRef.current = Date.now()
      setPhase('reading')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save your answer.')
      setPhase('reading')
    }
  }

  if (phase === 'loading') return <CenteredScreen><div className="muted">Loading drill…</div></CenteredScreen>

  if (phase === 'fatal-error') {
    return (
      <CenteredScreen>
        <Alert variant="error" style={{ maxWidth: 420 }}>
          <strong>Couldn't load drill.</strong>
          <div style={{ marginTop: 'var(--space-xs)' }}>{error}</div>
        </Alert>
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <PrimaryButton onClick={() => navigate('/test')}>Back to practice</PrimaryButton>
        </div>
      </CenteredScreen>
    )
  }

  if (section === 'rc' && rcAttempt) {
    const q = rcAttempt.questions[currentIndex]
    if (!q) return <CenteredScreen><div className="muted">Loading…</div></CenteredScreen>
    const pi = typeof q.passageIndex === 'number' ? q.passageIndex : 0
    const passage = rcAttempt.passages && rcAttempt.passages[pi]
      ? rcAttempt.passages[pi].passage
      : rcAttempt.passage
    return (
      <DrillShell
        subtypeLabel={drillSubtypeKey ? ALL_VERBAL_SUBTYPES[drillSubtypeKey].label : 'Reading Comprehension'}
        questionIndex={currentIndex}
        total={totalQuestions}
        onExit={() => navigate('/test')}
      >
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 0,
            minHeight: 0,
          }}
        >
          <PassagePane passage={passage} />
          <div
            style={{
              padding: 'var(--space-2xl)',
              overflowY: 'auto',
              borderLeft: '1px solid var(--border)',
              background: 'var(--fill-subtle)',
            }}
          >
            <h2 className="text-card-title" style={{ margin: '0 0 var(--space-lg)' }}>
              {q.questionText}
            </h2>
            <div role="radiogroup" style={{ display: 'grid', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
              {q.choices.map((c, i) => (
                <McqOption
                  key={i}
                  label={c}
                  letter={String.fromCharCode(65 + i)}
                  state={selectedIndex === i ? 'selected' : 'default'}
                  onClick={() => phase === 'reading' && setSelectedIndex(i)}
                  disabled={phase !== 'reading'}
                />
              ))}
            </div>
            {error ? <Alert variant="error" style={{ marginBottom: 'var(--space-md)' }}>{error}</Alert> : null}
            <PrimaryButton
              onClick={onNext}
              disabled={selectedIndex == null || phase !== 'reading'}
              loading={phase === 'submitting' || phase === 'finishing'}
            >
              {phase === 'submitting' || phase === 'finishing'
                ? 'Saving…'
                : currentIndex >= totalQuestions - 1
                  ? 'Finish'
                  : 'Next'}
            </PrimaryButton>
          </div>
        </div>
      </DrillShell>
    )
  }

  if (section === 'cr' && crAttempt) {
    const q: CrAttemptQuestion | undefined = crAttempt.questions[currentIndex]
    if (!q) return <CenteredScreen><div className="muted">Loading…</div></CenteredScreen>
    return (
      <DrillShell
        subtypeLabel={drillSubtypeKey ? ALL_VERBAL_SUBTYPES[drillSubtypeKey].label : 'Critical Reasoning'}
        questionIndex={currentIndex}
        total={totalQuestions}
        onExit={() => navigate('/test')}
      >
        <div
          style={{
            flex: 1,
            padding: 'var(--space-2xl)',
            maxWidth: 800,
            margin: '0 auto',
            width: '100%',
            boxSizing: 'border-box',
            overflowY: 'auto',
          }}
        >
          <div className="muted text-label" style={{ marginBottom: 'var(--space-md)' }}>
            {q.questionType.toUpperCase()}
          </div>
          <div style={{ maxWidth: PASSAGE_MEASURE, marginBottom: 'var(--space-lg)' }}>
            <p
              style={{
                margin: `0 0 ${PASSAGE_PARAGRAPH_GAP}`,
                fontSize: getPassageFontSize(q.argument),
                lineHeight: PASSAGE_LINE_HEIGHT,
                color: 'var(--text)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {renderInlineBold(q.argument)}
            </p>
          </div>
          <h2 className="text-card-title" style={{ margin: '0 0 var(--space-lg)' }}>
            {q.questionStem}
          </h2>
          <div role="radiogroup" style={{ display: 'grid', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
            {q.choices.map((c, i) => (
              <McqOption
                key={i}
                label={c}
                letter={String.fromCharCode(65 + i)}
                state={selectedIndex === i ? 'selected' : 'default'}
                onClick={() => phase === 'reading' && setSelectedIndex(i)}
                disabled={phase !== 'reading'}
              />
            ))}
          </div>
          {error ? <Alert variant="error" style={{ marginBottom: 'var(--space-md)' }}>{error}</Alert> : null}
          <PrimaryButton
            onClick={onNext}
            disabled={selectedIndex == null || phase !== 'reading'}
            loading={phase === 'submitting' || phase === 'finishing'}
          >
            {phase === 'submitting' || phase === 'finishing'
              ? 'Saving…'
              : currentIndex >= totalQuestions - 1
                ? 'Finish'
                : 'Next'}
          </PrimaryButton>
        </div>
      </DrillShell>
    )
  }

  return <CenteredScreen><div className="muted">Loading…</div></CenteredScreen>
}

function DrillShell({
  subtypeLabel,
  questionIndex,
  total,
  onExit,
  children,
}: {
  subtypeLabel: string
  questionIndex: number
  total: number
  onExit: () => void
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      <header
        style={{
          padding: 'var(--space-md) var(--space-lg)',
          background: 'var(--header-bg)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-md)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      >
        <button
          type="button"
          className="btn text-body-sm"
          onClick={onExit}
          style={{
            background: 'transparent',
            padding: 'var(--space-2xs) var(--space-md)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--muted)',
            fontWeight: 600,
          }}
        >
          Exit
        </button>
        <div className="text-body" style={{ fontWeight: 700 }}>
          {subtypeLabel} drill
        </div>
        <div className="muted text-body-sm">
          Question {questionIndex + 1} / {total}
        </div>
      </header>
      {children}
    </div>
  )
}

function PassagePane({ passage }: { passage: string }) {
  const paragraphs = useMemo(
    () => passage.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
    [passage],
  )
  const fontSize = useMemo(() => getPassageFontSize(passage), [passage])
  return (
    <div
      style={{
        padding: 'var(--space-2xl)',
        overflowY: 'auto',
        background: 'var(--fill-subtle)',
      }}
    >
      <div style={{ maxWidth: PASSAGE_MEASURE, marginLeft: 0, marginRight: 'auto' }}>
        <div className="muted text-label" style={{ marginBottom: 'var(--space-md)' }}>
          Passage
        </div>
        {paragraphs.length === 0 ? (
          <div className="muted text-body">Loading passage…</div>
        ) : (
          paragraphs.map((p, i) => (
            <p
              key={i}
              style={{
                margin: `0 0 ${PASSAGE_PARAGRAPH_GAP}`,
                fontSize,
                lineHeight: PASSAGE_LINE_HEIGHT,
                color: 'var(--text)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {p}
            </p>
          ))
        )}
      </div>
    </div>
  )
}

function CenteredScreen({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        color: 'var(--text)',
        padding: 'var(--space-xl)',
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  )
}
