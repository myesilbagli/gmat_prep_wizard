import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import type { QuizQuestion, VocabItem } from '../../shared/types'
import { formatSessionBatchComposition, pickSessionBatchTwelve } from '../../shared/sessionPlanner'
import type { SessionWordOutcome } from '../../shared/sessionOutcome'
import { bucketFromWord, countDeckBuckets, type DeckBucketCounts } from '../../shared/learningBuckets'
import type { LearningBucket } from '../../shared/types'
import { auth } from '../lib/firebase'
import { APP_HOME } from '../lib/routes'
import { fetchMeaningQuestionsForBatch } from '../lib/quizClient'
import { applySessionBatchOutcome, listVocabItems, markWordIntroduced } from '../lib/vocab'
import {
  applyStreakAfterSessionComplete,
  ensureUserProfileDefaults,
  recordDailySessionCompletion,
} from '../lib/userProfile'
import { DEFAULT_TIMEZONE } from '../../shared/userProfile'

type Phase = 'loading' | 'intro' | 'mcq' | 'summary' | 'empty'

type QuizFetchStatus = 'idle' | 'pending' | 'ready' | 'error'

function bucketRank(b: LearningBucket): number {
  if (b === 'new') return 0
  if (b === 'learning') return 1
  if (b === 'familiar') return 2
  return 3
}

function bucketDeltaText(before: number, after: number): string {
  const d = after - before
  if (d === 0) return '±0'
  return d > 0 ? `+${d}` : `${d}`
}

const WEB_SUCCESS = 'var(--accent-2)'
const WEB_DANGER = 'var(--danger)'

function IconMcqCheck({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <path
        d="M5 13l4 4L19 7"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconMcqClose({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <path
        d="M6 18L18 6M6 6l12 12"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function McqStepWeb({
  question,
  quizSub,
  quizPicked,
  finishing,
  onQuizPick,
  onQuizContinue,
}: {
  question: QuizQuestion
  quizSub: 'mcq' | 'feedback'
  quizPicked: number | null
  finishing: boolean
  onQuizPick: (idx: number) => void
  onQuizContinue: () => void
}) {
  const reviewing = quizSub === 'feedback'
  const correctIdx = question.correctIndex
  const pickedOk = quizPicked !== null && quizPicked === correctIdx

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <p style={{ fontSize: 17, lineHeight: 1.45, margin: 0 }}>{question.questionText}</p>

      {reviewing ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            minHeight: 52,
            borderRadius: 12,
            padding: '0 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            backgroundColor: pickedOk
              ? `color-mix(in srgb, ${WEB_SUCCESS} 17.5%, transparent)`
              : `color-mix(in srgb, ${WEB_DANGER} 17.5%, transparent)`,
          }}
        >
          {pickedOk ? (
            <IconMcqCheck size={28} color={WEB_SUCCESS} />
          ) : (
            <IconMcqClose size={28} color={WEB_DANGER} />
          )}
          <span style={{ fontSize: 19, fontWeight: 800, color: pickedOk ? WEB_SUCCESS : WEB_DANGER }}>
            {pickedOk ? 'Correct' : 'Not quite'}
          </span>
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 10 }}>
        {question.options.map((opt, i) => {
          const isCorrectRow = i === correctIdx
          const isWrongPicked = reviewing && quizPicked === i && i !== correctIdx

          let btnStyle: CSSProperties = {
            width: '100%',
            textAlign: 'left',
            padding: '14px 16px',
            fontSize: 15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            background: 'color-mix(in srgb, var(--surface) 70%, transparent)',
            color: 'var(--text)',
            cursor: reviewing ? 'default' : 'pointer',
          }

          if (reviewing) {
            if (isCorrectRow) {
              btnStyle = {
                ...btnStyle,
                background: `color-mix(in srgb, ${WEB_SUCCESS} 20%, transparent)`,
                borderColor: WEB_SUCCESS,
                opacity: 1,
              }
            } else if (isWrongPicked) {
              btnStyle = {
                ...btnStyle,
                background: `color-mix(in srgb, ${WEB_DANGER} 20%, transparent)`,
                borderColor: WEB_DANGER,
                opacity: 1,
              }
            } else {
              btnStyle = {
                ...btnStyle,
                borderColor: 'transparent',
                opacity: 0.6,
              }
            }
          }

          return (
            <button
              key={i}
              type="button"
              style={btnStyle}
              onClick={() => onQuizPick(i)}
              disabled={reviewing}
            >
              <span style={{ flex: 1 }}>{opt}</span>
              {reviewing && isCorrectRow ? (
                <IconMcqCheck size={20} color={WEB_SUCCESS} />
              ) : reviewing && isWrongPicked ? (
                <IconMcqClose size={20} color={WEB_DANGER} />
              ) : null}
            </button>
          )
        })}
      </div>

      {reviewing ? (
        <>
          <p className="muted" style={{ fontSize: 14, margin: 0 }}>
            {question.explanation}
          </p>
          <button
            type="button"
            className="btn btnPrimary"
            style={{ marginTop: 4, padding: '12px 20px', fontSize: 16 }}
            onClick={() => void onQuizContinue()}
            disabled={finishing}
          >
            {finishing ? 'Saving…' : 'Next'}
          </button>
        </>
      ) : null}
    </div>
  )
}

export function SessionPage() {
  const [sessionInstance, setSessionInstance] = useState(0)
  return <SessionPageInner key={sessionInstance} onRequestNewSession={() => setSessionInstance((n) => n + 1)} />
}

function SessionPageInner({ onRequestNewSession }: { onRequestNewSession?: () => void }) {
  const navigate = useNavigate()
  const [userReady, setUserReady] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [vocabLoading, setVocabLoading] = useState(true)
  const [batch, setBatch] = useState<VocabItem[]>([])
  const itemsById = useMemo(() => new Map(batch.map((w) => [w.id, w])), [batch])

  const [phase, setPhase] = useState<Phase>('loading')
  const [introIds, setIntroIds] = useState<string[]>([])
  const [introIndex, setIntroIndex] = useState(0)
  const [introSubmitting, setIntroSubmitting] = useState(false)

  const [mcqQuestions, setMcqQuestions] = useState<QuizQuestion[]>([])
  const [quizIdx, setQuizIdx] = useState(0)
  const [quizSub, setQuizSub] = useState<'mcq' | 'feedback'>('mcq')
  const [quizPicked, setQuizPicked] = useState<number | null>(null)
  const [mcqCorrectById, setMcqCorrectById] = useState<Map<string, boolean>>(new Map())

  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [streakAfter, setStreakAfter] = useState<number | null>(null)
  const [deckBefore, setDeckBefore] = useState<DeckBucketCounts | null>(null)
  const [deckAfter, setDeckAfter] = useState<DeckBucketCounts | null>(null)
  const [streakAtSessionStart, setStreakAtSessionStart] = useState<number | null>(null)
  const [postSessionVocabItems, setPostSessionVocabItems] = useState<VocabItem[] | null>(null)
  const [sessionTimezone, setSessionTimezone] = useState(DEFAULT_TIMEZONE)

  const [quizFetchStatus, setQuizFetchStatus] = useState<QuizFetchStatus>('idle')
  const [quizFetchError, setQuizFetchError] = useState<string | null>(null)
  const [compositionPreview, setCompositionPreview] = useState('')
  const quizFetchGenRef = useRef(0)

  const batchSize = batch.length
  const currentIntroId = introIds[introIndex]
  const currentIntroWord = currentIntroId ? itemsById.get(currentIntroId) : undefined
  const currentQuizQ = mcqQuestions[quizIdx]

  const sessionInProgress = phase === 'intro' || phase === 'mcq'

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUserReady(!!u)
      if (!u) setInitError('Please sign in to run a session.')
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!sessionInProgress) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [sessionInProgress])

  const runQuizFetchForBatch = useCallback((pickIds: string[], orderedLen: number) => {
    quizFetchGenRef.current += 1
    const gen = quizFetchGenRef.current
    void fetchMeaningQuestionsForBatch(pickIds)
      .then((questions) => {
        if (gen !== quizFetchGenRef.current) return
        if (questions.length !== orderedLen) {
          setQuizFetchStatus('error')
          setQuizFetchError('Could not prepare all session questions. Please try again.')
          return
        }
        const byId = new Map(questions.map((q) => [q.itemId, q]))
        const orderedQs = pickIds.map((id) => byId.get(id)).filter(Boolean) as QuizQuestion[]
        if (orderedQs.length !== orderedLen) {
          setQuizFetchStatus('error')
          setQuizFetchError('Could not prepare all session questions. Please try again.')
          return
        }
        setMcqQuestions(orderedQs)
        setQuizFetchStatus('ready')
      })
      .catch((e) => {
        if (gen !== quizFetchGenRef.current) return
        setQuizFetchStatus('error')
        setQuizFetchError(e instanceof Error ? e.message : 'Quiz failed')
      })
  }, [])

  const retryQuizFetch = useCallback(() => {
    const ids = batch.map((w) => w.id)
    if (ids.length === 0) return
    setQuizFetchStatus('pending')
    setQuizFetchError(null)
    runQuizFetchForBatch(ids, ids.length)
  }, [batch, runQuizFetchForBatch])

  useEffect(() => {
    if (!userReady || !auth.currentUser) return
    let cancelled = false
    ;(async () => {
      setInitError(null)
      setVocabLoading(true)
      try {
        const all = await listVocabItems()
        if (cancelled) return
        const profile = await ensureUserProfileDefaults()
        const tz = profile.timezone || DEFAULT_TIMEZONE
        const pick = pickSessionBatchTwelve(all, { nowMs: Date.now(), userTimezone: tz })
        if (pick.ids.length === 0) {
          setBatch([])
          setPhase('empty')
          setQuizFetchStatus('idle')
          setPostSessionVocabItems(null)
          setStreakAtSessionStart(null)
          setVocabLoading(false)
          return
        }
        const byIdAll = new Map(all.map((w) => [w.id, w]))
        const ordered: VocabItem[] = []
        for (const id of pick.ids) {
          const w = byIdAll.get(id)
          if (w) ordered.push(w)
        }
        if (ordered.length === 0) {
          setBatch([])
          setPhase('empty')
          setQuizFetchStatus('idle')
          setPostSessionVocabItems(null)
          setStreakAtSessionStart(null)
          setVocabLoading(false)
          return
        }

        setDeckBefore(countDeckBuckets(all))
        setStreakAtSessionStart(profile.streakCurrent ?? null)
        setSessionTimezone(tz)
        setPostSessionVocabItems(null)
        setBatch(ordered)
        setMcqQuestions([])
        setCompositionPreview(formatSessionBatchComposition(pick.slots))
        const intros = pick.slots.filter((s) => s.role === 'new').map((s) => s.id)
        setIntroIds(intros)
        setIntroIndex(0)
        setMcqCorrectById(new Map())
        setQuizIdx(0)
        setQuizSub('mcq')
        setQuizPicked(null)
        setDeckAfter(null)
        setQuizFetchStatus('pending')
        setQuizFetchError(null)
        setPhase(intros.length > 0 ? 'intro' : 'mcq')

        runQuizFetchForBatch(pick.ids, ordered.length)
      } catch (e) {
        if (!cancelled) {
          setInitError(e instanceof Error ? e.message : 'Failed to load vocabulary')
        }
      } finally {
        if (!cancelled) setVocabLoading(false)
      }
    })()
    return () => {
      cancelled = true
      quizFetchGenRef.current += 1
    }
  }, [userReady, runQuizFetchForBatch])

  const finishSession = useCallback(async () => {
    setFinishing(true)
    setFinishError(null)
    try {
      const outcomes: SessionWordOutcome[] = batch.map((w) => ({
        id: w.id,
        swipe: 'strong',
        mcqCorrect: mcqCorrectById.get(w.id) ?? false,
      }))
      await applySessionBatchOutcome(itemsById, outcomes)
      const profile = await applyStreakAfterSessionComplete()
      await recordDailySessionCompletion('daily_vocab')
      setStreakAfter(profile.streakCurrent)

      const allAfter = await listVocabItems()
      setPostSessionVocabItems(allAfter)
      setDeckAfter(countDeckBuckets(allAfter))
      setPhase('summary')
    } catch (e) {
      setFinishError(e instanceof Error ? e.message : 'Could not save session')
      setPhase('summary')
    } finally {
      setFinishing(false)
    }
  }, [batch, itemsById, mcqCorrectById])

  const onQuizPick = (idx: number) => {
    if (quizSub !== 'mcq' || quizPicked !== null || !currentQuizQ) return
    setQuizPicked(idx)
    setQuizSub('feedback')
    const ok = idx === currentQuizQ.correctIndex
    setMcqCorrectById((prev) => {
      const next = new Map(prev)
      next.set(currentQuizQ.itemId, ok)
      return next
    })
  }

  const onQuizContinue = async () => {
    if (!currentQuizQ) return
    setQuizPicked(null)
    if (quizIdx + 1 < mcqQuestions.length) {
      setQuizIdx((i) => i + 1)
      setQuizSub('mcq')
    } else {
      await finishSession()
    }
  }

  const onIntroGotIt = async () => {
    const w = currentIntroWord
    if (!w || introSubmitting) return
    setIntroSubmitting(true)
    try {
      await markWordIntroduced(w.id)
      if (introIndex + 1 < introIds.length) {
        setIntroIndex((i) => i + 1)
      } else {
        setPhase('mcq')
      }
    } catch (e) {
      setInitError(e instanceof Error ? e.message : 'Could not save intro')
    } finally {
      setIntroSubmitting(false)
    }
  }

  const movedUpWords = useMemo(() => {
    if (!postSessionVocabItems?.length) return []
    const byId = new Map(postSessionVocabItems.map((w) => [w.id, w]))
    const out: VocabItem[] = []
    for (const w of batch) {
      const w1 = byId.get(w.id)
      if (!w1) continue
      if (bucketRank(bucketFromWord(w1)) > bucketRank(bucketFromWord(w))) out.push(w1)
    }
    return out
  }, [batch, postSessionVocabItems])

  const canStartAnotherSession = useMemo(() => {
    if (!postSessionVocabItems?.length) return false
    return (
      pickSessionBatchTwelve(postSessionVocabItems, {
        nowMs: Date.now(),
        userTimezone: sessionTimezone,
      }).ids.length > 0
    )
  }, [postSessionVocabItems, sessionTimezone])

  const streakIncreased =
    streakAfter != null && streakAtSessionStart != null && streakAfter > streakAtSessionStart

  function confirmLeave() {
    if (!sessionInProgress) {
      navigate(APP_HOME)
      return
    }
    if (window.confirm('Leave session? Progress in this run will not count toward your streak.')) {
      navigate(APP_HOME)
    }
  }

  const headerRight =
    phase === 'summary'
      ? 'Done'
      : phase === 'intro' && introIds.length > 0
        ? `${introIndex + 1} / ${introIds.length}`
        : phase === 'mcq' && quizFetchStatus === 'ready' && mcqQuestions.length > 0
          ? `${quizIdx + 1} / ${mcqQuestions.length}`
          : phase === 'mcq'
            ? 'Quiz'
            : ''

  if (!userReady) {
    return (
      <div className="container" style={{ padding: 24 }}>
        <p className="muted">Checking sign-in…</p>
      </div>
    )
  }

  if (userReady && vocabLoading) {
    return (
      <div className="container" style={{ padding: 24 }}>
        <p className="muted">Preparing your session…</p>
        <div className="sessionPrepShell">
          <div className="lookupSkeleton" style={{ width: '58%' }} />
          <div className="lookupSkeleton" style={{ width: '100%' }} />
        </div>
      </div>
    )
  }

  if (initError && phase === 'loading') {
    return (
      <div className="container" style={{ padding: 24 }}>
        <p style={{ color: 'var(--danger)' }}>{initError}</p>
        <Link to={APP_HOME} className="btn btnPrimary" style={{ marginTop: 16, display: 'inline-block' }}>
          Back to Today
        </Link>
      </div>
    )
  }

  if (phase === 'empty') {
    return (
      <div className="container" style={{ padding: 24, maxWidth: 520 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Not enough words yet</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Add a few learning words or save new items, then come back for a full session.
        </p>
        <Link to={APP_HOME} className="btn btnPrimary" style={{ marginTop: 20, display: 'inline-block' }}>
          Back to Today
        </Link>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          background: 'var(--header-bg)',
        }}
      >
        <button type="button" className="btn" onClick={confirmLeave} style={{ fontSize: 13 }}>
          ← Exit
        </button>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>{headerRight}</div>
        <span style={{ width: 56 }} />
      </header>

      {initError ? (
        <p style={{ color: 'var(--danger)', padding: '8px 16px', margin: 0, fontSize: 13 }}>{initError}</p>
      ) : null}

      <div className="container" style={{ flex: 1, paddingTop: 20, paddingBottom: 32, maxWidth: 560 }}>
        {phase === 'intro' && currentIntroWord ? (
          <IntroCardWeb
            word={currentIntroWord}
            newWordCurrent={introIndex + 1}
            newWordTotal={introIds.length}
            onGotIt={() => void onIntroGotIt()}
            busy={introSubmitting}
          />
        ) : null}

        {phase === 'mcq' ? (
          <div className="sessionStepFade" style={{ display: 'grid', gap: 16 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6 }}>
              QUIZ
            </div>
            {quizFetchStatus === 'pending' ? (
              <div style={{ display: 'grid', gap: 12, padding: '8px 0' }}>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
                  Preparing your {batchSize} words
                </p>
                <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>
                  {compositionPreview}
                </p>
                <div className="sessionPrepShell" aria-hidden style={{ marginTop: 8 }}>
                  <div className="lookupSkeleton" style={{ width: '58%' }} />
                  <div className="lookupSkeleton" style={{ width: '100%' }} />
                </div>
                <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                  Building your quiz…
                </p>
              </div>
            ) : quizFetchStatus === 'error' ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <p style={{ margin: 0, fontSize: 15, color: 'var(--danger)' }}>
                  {quizFetchError ?? 'Quiz could not be loaded.'}
                </p>
                <button type="button" className="btn btnPrimary" style={{ justifySelf: 'start' }} onClick={retryQuizFetch}>
                  Retry
                </button>
              </div>
            ) : quizFetchStatus === 'ready' && currentQuizQ ? (
              <McqStepWeb
                question={currentQuizQ}
                quizSub={quizSub}
                quizPicked={quizPicked}
                finishing={finishing}
                onQuizPick={onQuizPick}
                onQuizContinue={() => void onQuizContinue()}
              />
            ) : quizFetchStatus === 'ready' ? (
              <p className="muted">No quiz questions.</p>
            ) : null}
          </div>
        ) : null}

        {phase === 'summary' ? (
          <div className="sessionStepFade" style={{ display: 'grid', gap: 20, justifyItems: 'stretch', width: '100%' }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Session complete</h1>

            {deckBefore && deckAfter ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Your deck</div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))',
                    gap: 10,
                  }}
                >
                  {(
                    [
                      ['New', deckBefore.new, deckAfter.new],
                      ['Learning', deckBefore.learning, deckAfter.learning],
                      ['Familiar', deckBefore.familiar, deckAfter.familiar],
                      ['Mastered', deckBefore.mastered, deckAfter.mastered],
                    ] as const
                  ).map(([label, before, after]) => {
                    const delta = after - before
                    const deltaColor =
                      delta > 0 ? 'var(--accent-2)' : delta < 0 ? 'var(--danger)' : 'var(--muted)'
                    return (
                      <div
                        key={label}
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          border: '1px solid var(--border)',
                          background: 'var(--surface)',
                        }}
                      >
                        <div className="muted" style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
                          {label}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{before}</span>
                          <span className="muted"> → </span>
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{after}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, color: deltaColor, fontVariantNumeric: 'tabular-nums' }}>
                          {bucketDeltaText(before, after)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}

            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>
                {movedUpWords.length > 0
                  ? `${movedUpWords.length} word${movedUpWords.length === 1 ? '' : 's'} moved up`
                  : 'Promotions'}
              </div>
              {movedUpWords.length === 0 ? (
                <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}>
                  No promotions this session — keep practicing.
                </p>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {movedUpWords.map((w) => (
                    <Link
                      key={w.id}
                      to={`/words/${encodeURIComponent(w.id)}`}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        fontSize: 16,
                        fontWeight: 700,
                        color: 'var(--accent-gradient-end)',
                        textDecoration: 'none',
                      }}
                    >
                      {w.text}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {finishError ? <p style={{ color: 'var(--danger)' }}>{finishError}</p> : null}

            {streakIncreased && streakAfter !== null ? (
              <div
                style={{
                  justifySelf: 'start',
                  padding: '6px 10px',
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  background: 'color-mix(in srgb, var(--accent-gradient-end) 15%, transparent)',
                  color: 'var(--accent-gradient-end)',
                }}
              >
                Streak: {streakAfter} days
              </div>
            ) : null}

            <div style={{ display: 'grid', gap: 10 }}>
              <button
                type="button"
                className="btn btnPrimary"
                style={{ padding: '12px 20px', fontSize: 16 }}
                onClick={() => navigate(APP_HOME)}
              >
                Back to Today
              </button>
              {canStartAnotherSession && onRequestNewSession ? (
                <button type="button" className="btn" style={{ padding: '12px 20px', fontSize: 16 }} onClick={onRequestNewSession}>
                  Start another session
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function IntroCardWeb({
  word,
  newWordCurrent,
  newWordTotal,
  onGotIt,
  busy,
}: {
  word: VocabItem
  newWordCurrent?: number
  newWordTotal?: number
  onGotIt: () => void
  busy: boolean
}) {
  const def = (word.definition || '').trim()
  const simple = (word.simpleDefinition || word.definition || '').trim()
  const hook = (word.memoryHook || '').trim()
  const showProgress =
    typeof newWordCurrent === 'number' &&
    typeof newWordTotal === 'number' &&
    newWordTotal > 1 &&
    newWordCurrent >= 1

  return (
    <div className="sessionStepFade" style={{ display: 'grid', gap: 0 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            padding: '3px 6px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#fff',
            background: 'linear-gradient(135deg, var(--accent-gradient-start), var(--accent-gradient-end))',
          }}
        >
          NEW WORD
        </span>
        {showProgress ? (
          <span className="muted" style={{ fontSize: 12, fontWeight: 600, marginLeft: 'auto', textAlign: 'right' }}>
            New word {newWordCurrent} of {newWordTotal}
          </span>
        ) : null}
      </div>

      <p className="muted" style={{ margin: '10px 0 22px', fontSize: 13, lineHeight: 1.45 }}>
        First time learning this — no test yet
      </p>

      <h2 style={{ margin: '0 0 20px', fontSize: 32, fontWeight: 800, lineHeight: 1.15, color: 'var(--text)' }}>
        {word.text}
      </h2>

      <div style={{ display: 'grid', gap: 18 }}>
        {def ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
              DEFINITION
            </div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{def}</p>
          </div>
        ) : null}
        {simple && simple !== def ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
              SIMPLE
            </div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{simple}</p>
          </div>
        ) : null}
        {hook ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
              MEMORY HOOK
            </div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{hook}</p>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="btn btnPrimary"
        style={{ marginTop: 20, padding: '14px 20px', fontSize: 16, justifySelf: 'stretch' }}
        onClick={onGotIt}
        disabled={busy}
      >
        {busy ? 'Saving…' : 'Got it'}
      </button>
    </div>
  )
}
