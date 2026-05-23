import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CR_TIMER_DURATIONS,
  type CrAttempt,
  type CrAttemptQuestion,
  type CrTimerMode,
} from '../../shared/crTypes'
import { getCrAttempt, markCrAttemptComplete, recordCrAnswer } from '../lib/crAttempts'
import { McqOption } from '../components/ui/McqOption'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { Alert } from '../components/ui/Alert'
import {
  PASSAGE_LINE_HEIGHT,
  PASSAGE_MEASURE,
  PASSAGE_PARAGRAPH_GAP,
  getPassageFontSize,
} from '../lib/passageTypography'

type Phase = 'loading' | 'reading' | 'submitting' | 'finishing' | 'fatal-error'

export function CrPracticePage() {
  const { attemptId: rawId } = useParams<{ attemptId: string }>()
  const attemptId = rawId ?? ''
  const navigate = useNavigate()

  const [attempt, setAttempt] = useState<CrAttempt | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<string | null>(null)
  const [clockSeconds, setClockSeconds] = useState(0)

  /** Wall-clock time (ms) when the current question's clock started. Used
   *  to compute per-question elapsed when the user advances or the timer
   *  expires. Reset on each question. */
  const questionStartedAtRef = useRef<number>(Date.now())
  /** Wall-clock time (ms) when the practice session began. Used by the
   *  clock + by countdown / count-up modes. Restored from attempt.startedAt
   *  on mount so refresh doesn't reset the timer. */
  const setStartedAtMsRef = useRef<number>(Date.now())
  /** Atomic guard against double-finish (timer auto-submit racing a manual
   *  Finish click on the last question). The first caller wins. */
  const finishingRef = useRef<boolean>(false)

  // ---- Initial load ------------------------------------------------------
  useEffect(() => {
    if (!attemptId) {
      setPhase('fatal-error')
      setError('Missing attempt id.')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const a = await getCrAttempt(attemptId)
        if (cancelled) return
        if (!a) {
          setPhase('fatal-error')
          setError('Attempt not found.')
          return
        }
        // If already complete, send straight to review.
        if (a.completedAt) {
          navigate(`/exam/cr/review/${attemptId}`, { replace: true })
          return
        }
        setAttempt(a)
        // Resume at the first unanswered question (handles refresh).
        const firstUnanswered = a.questions.findIndex((q) => q.userAnswerIndex == null)
        const startIdx = firstUnanswered === -1 ? a.questions.length - 1 : firstUnanswered
        setCurrentIndex(startIdx)
        setSelectedIndex(null)

        // Restore the set's start time from Firestore if available so that
        // refresh keeps the countdown honest.
        const startedAtMs = parseServerTimestampMs(a.startedAt) ?? Date.now()
        setStartedAtMsRef.current = startedAtMs
        questionStartedAtRef.current = Date.now()
        setPhase('reading')
      } catch (e) {
        if (cancelled) return
        setPhase('fatal-error')
        setError(e instanceof Error ? e.message : 'Failed to load attempt.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [attemptId, navigate])

  // ---- Timer tick --------------------------------------------------------
  useEffect(() => {
    if (phase !== 'reading' && phase !== 'submitting') return
    const tick = () => {
      const elapsed = Math.floor((Date.now() - setStartedAtMsRef.current) / 1000)
      setClockSeconds(elapsed)
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [phase])

  // ---- Finish (manual or timer-triggered) -------------------------------
  const finish = useCallback(
    async (
      finalIdx: number,
      finalAnswer: number | null,
      finalQuestionSeconds: number,
    ) => {
      if (!attempt) return
      if (finishingRef.current) return
      finishingRef.current = true
      setPhase('finishing')
      try {
        if (finalIdx >= 0 && finalIdx < attempt.questions.length) {
          await recordCrAnswer(attemptId, finalIdx, finalAnswer, finalQuestionSeconds)
        }
        const fresh = await getCrAttempt(attemptId)
        if (!fresh) throw new Error('Attempt vanished.')
        const score = fresh.questions.reduce((acc, q) => acc + (q.isCorrect ? 1 : 0), 0)
        const total = fresh.questions.reduce((acc, q) => acc + (q.timeSeconds || 0), 0)
        await markCrAttemptComplete(attemptId, score, total)
        navigate(`/exam/cr/review/${attemptId}`, { replace: true })
      } catch (e) {
        finishingRef.current = false
        setError(e instanceof Error ? e.message : 'Failed to finish attempt.')
        setPhase('reading')
      }
    },
    [attempt, attemptId, navigate],
  )

  // ---- Countdown auto-submit --------------------------------------------
  useEffect(() => {
    if (phase !== 'reading' && phase !== 'submitting') return
    if (!attempt) return
    if (attempt.timerMode === 'none') return
    const duration = CR_TIMER_DURATIONS[attempt.timerMode]
    if (clockSeconds < duration) return
    // Time's up. Submit current selection (or null) for the current question,
    // then finish.
    const qSecs = Math.max(0, Math.round((Date.now() - questionStartedAtRef.current) / 1000))
    void finish(currentIndex, selectedIndex, qSecs)
  }, [clockSeconds, phase, attempt, currentIndex, selectedIndex, finish])

  async function onNext() {
    if (!attempt) return
    if (phase !== 'reading') return
    const qSecs = Math.max(0, Math.round((Date.now() - questionStartedAtRef.current) / 1000))
    const isLast = currentIndex >= attempt.questions.length - 1
    if (isLast) {
      await finish(currentIndex, selectedIndex, qSecs)
      return
    }
    setPhase('submitting')
    try {
      await recordCrAnswer(attemptId, currentIndex, selectedIndex, qSecs)
      setCurrentIndex((i) => i + 1)
      setSelectedIndex(null)
      questionStartedAtRef.current = Date.now()
      setPhase('reading')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save your answer.')
      setPhase('reading')
    }
  }

  const total = attempt?.questions.length ?? 5
  const currentQuestion: CrAttemptQuestion | null = attempt?.questions[currentIndex] ?? null
  const isLast = currentIndex >= total - 1

  // ---- Render ------------------------------------------------------------

  if (phase === 'loading') {
    return (
      <CenteredScreen>
        <div className="muted">Loading attempt…</div>
      </CenteredScreen>
    )
  }

  if (phase === 'fatal-error') {
    return (
      <CenteredScreen>
        <Alert variant="error" style={{ maxWidth: 420 }}>
          <strong>Couldn't load attempt.</strong>
          <div style={{ marginTop: 'var(--space-xs)' }}>{error}</div>
        </Alert>
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <PrimaryButton onClick={() => navigate('/exam/cr/setup')}>Back to setup</PrimaryButton>
        </div>
      </CenteredScreen>
    )
  }

  if (!attempt || !currentQuestion) {
    return (
      <CenteredScreen>
        <div className="muted">Loading…</div>
      </CenteredScreen>
    )
  }

  const timerDisplay = renderTimer(attempt.timerMode, clockSeconds)

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
          onClick={() => navigate('/exam')}
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
          Critical Reasoning · Q {currentIndex + 1} / {total}
        </div>
        <div
          className="text-body"
          style={{
            fontWeight: 700,
            fontFamily: 'var(--mono)',
            color: timerDisplay.urgent ? 'var(--danger)' : 'var(--text)',
          }}
        >
          {timerDisplay.label}
        </div>
      </header>

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
          {currentQuestion.questionType.toUpperCase()}
        </div>

        <div style={{ maxWidth: PASSAGE_MEASURE, marginBottom: 'var(--space-lg)' }}>
          <p
            style={{
              margin: `0 0 ${PASSAGE_PARAGRAPH_GAP}`,
              fontSize: getPassageFontSize(currentQuestion.argument),
              lineHeight: PASSAGE_LINE_HEIGHT,
              color: 'var(--text)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {currentQuestion.argument}
          </p>
        </div>

        <h2 className="text-card-title" style={{ margin: '0 0 var(--space-lg)' }}>
          {currentQuestion.questionStem}
        </h2>

        <div
          role="radiogroup"
          style={{ display: 'grid', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}
        >
          {currentQuestion.choices.map((choice, i) => (
            <McqOption
              key={i}
              label={choice}
              letter={String.fromCharCode(65 + i)}
              state={selectedIndex === i ? 'selected' : 'default'}
              onClick={() => phase === 'reading' && setSelectedIndex(i)}
              disabled={phase !== 'reading'}
            />
          ))}
        </div>

        {error ? (
          <Alert variant="error" style={{ marginBottom: 'var(--space-md)' }}>
            {error}
          </Alert>
        ) : null}

        <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
          <PrimaryButton
            onClick={onNext}
            disabled={selectedIndex == null || phase !== 'reading'}
            loading={phase === 'submitting' || phase === 'finishing'}
          >
            {phase === 'submitting' || phase === 'finishing'
              ? 'Saving…'
              : isLast
                ? 'Finish'
                : 'Next'}
          </PrimaryButton>
          {selectedIndex == null ? (
            <span className="muted text-body-sm">Select an answer to continue.</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

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

function renderTimer(mode: CrTimerMode, elapsed: number): { label: string; urgent: boolean } {
  if (mode === 'none') {
    return { label: `↑ ${formatMmSs(elapsed)}`, urgent: false }
  }
  const duration = CR_TIMER_DURATIONS[mode]
  const remaining = Math.max(0, duration - elapsed)
  const urgent = remaining <= 60
  return { label: `↓ ${formatMmSs(remaining)}`, urgent }
}

function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm}:${ss.toString().padStart(2, '0')}`
}

/** Best-effort Firestore Timestamp → ms. Returns null if not a Timestamp. */
function parseServerTimestampMs(v: unknown): number | null {
  if (v == null) return null
  const obj = v as { toMillis?: () => number; seconds?: number; nanoseconds?: number }
  if (typeof obj.toMillis === 'function') return obj.toMillis()
  if (typeof obj.seconds === 'number') {
    return obj.seconds * 1000 + Math.floor((obj.nanoseconds ?? 0) / 1_000_000)
  }
  return null
}
