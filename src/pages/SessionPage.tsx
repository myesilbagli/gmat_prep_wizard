import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import type { QuizQuestion, VocabItem } from '../../shared/types'
import {
  NEW,
  pickNewWords,
  pickQuizItemIds,
  pickReviewWords,
  sessionTotalSteps,
} from '../../shared/sessionPlanner'
import { auth } from '../lib/firebase'
import { prefetchSessionMeaningQuestions } from '../lib/quizClient'
import { applySessionWordOutcome, listVocabItems, recordWordExposure } from '../lib/vocab'
import {
  applyStreakAfterSessionComplete,
  recordDailySessionCompletion,
} from '../lib/userProfile'

type WordSub = 'intro' | 'mcq' | 'feedback' | 'actions'
type Segment = 'review' | 'newWords' | 'quiz' | 'complete'

export function SessionPage() {
  const navigate = useNavigate()
  const [userReady, setUserReady] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [reviewWords, setReviewWords] = useState<VocabItem[]>([])
  const [newWords, setNewWords] = useState<VocabItem[]>([])
  const [quizIds, setQuizIds] = useState<string[]>([])

  const [segment, setSegment] = useState<Segment>('review')
  const [wordIdx, setWordIdx] = useState(0)
  const [wordSub, setWordSub] = useState<WordSub>('intro')
  const [picked, setPicked] = useState<number | null>(null)

  const [reviewMcqs, setReviewMcqs] = useState<QuizQuestion[]>([])
  const [newWordMcqs, setNewWordMcqs] = useState<QuizQuestion[]>([])
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([])
  const [quizIdx, setQuizIdx] = useState(0)
  const [quizSub, setQuizSub] = useState<'mcq' | 'feedback'>('mcq')
  const [quizPicked, setQuizPicked] = useState<number | null>(null)

  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [streakAfter, setStreakAfter] = useState<number | null>(null)
  const [vocabLoading, setVocabLoading] = useState(true)

  const totalSteps = useMemo(
    () => sessionTotalSteps(reviewWords.length, newWords.length, quizIds.length),
    [reviewWords.length, newWords.length, quizIds.length],
  )

  const currentStep = useMemo(() => {
    if (segment === 'review') return wordIdx + 1
    if (segment === 'newWords') return reviewWords.length + wordIdx + 1
    if (segment === 'quiz') return reviewWords.length + newWords.length + quizIdx + 1
    return totalSteps
  }, [segment, wordIdx, quizIdx, reviewWords.length, newWords.length, totalSteps])

  const activeWord = useMemo(() => {
    if (segment === 'review') return reviewWords[wordIdx]
    if (segment === 'newWords') return newWords[wordIdx]
    return undefined
  }, [segment, wordIdx, reviewWords, newWords])

  const wordMcq = useMemo((): QuizQuestion | null => {
    if (segment === 'review') return reviewMcqs[wordIdx] ?? null
    if (segment === 'newWords') return newWordMcqs[wordIdx] ?? null
    return null
  }, [segment, wordIdx, reviewMcqs, newWordMcqs])

  const sessionInProgress = segment !== 'complete' && totalSteps > 0

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

  useEffect(() => {
    if (!userReady || !auth.currentUser) return
    let cancelled = false
    ;(async () => {
      setInitError(null)
      setVocabLoading(true)
      try {
        const all = await listVocabItems()
        if (cancelled) return
        const rw = pickReviewWords(all)
        const rwIds = new Set(rw.map((w) => w.id))
        const nw = pickNewWords(all, NEW, rwIds)
        const sid = [...rw, ...nw].map((w) => w.id)
        const qid = pickQuizItemIds(sid, all)
        const steps = sessionTotalSteps(rw.length, nw.length, qid.length)

        if (steps > 0) {
          const { review, newWords: nwm, quiz } = await prefetchSessionMeaningQuestions({
            reviewIds: rw.map((w) => w.id),
            newIds: nw.map((w) => w.id),
            quizIds: qid,
          })
          if (cancelled) return
          if (review.length !== rw.length || nwm.length !== nw.length || quiz.length !== qid.length) {
            throw new Error('Could not prepare all session questions. Please try again.')
          }
          setReviewMcqs(review)
          setNewWordMcqs(nwm)
          setQuizQuestions(quiz)
        } else {
          setReviewMcqs([])
          setNewWordMcqs([])
          setQuizQuestions([])
        }

        setReviewWords(rw)
        setNewWords(nw)
        setQuizIds(qid)
        if (steps === 0) {
          setSegment('complete')
        } else if (rw.length > 0) {
          setSegment('review')
        } else if (nw.length > 0) {
          setSegment('newWords')
        } else {
          setSegment('quiz')
        }
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
    }
  }, [userReady])

  const finishSession = useCallback(async () => {
    setFinishing(true)
    setFinishError(null)
    try {
      const profile = await applyStreakAfterSessionComplete()
      await recordDailySessionCompletion('daily_vocab')
      setStreakAfter(profile.streakCurrent)
      setSegment('complete')
    } catch (e) {
      setFinishError(e instanceof Error ? e.message : 'Could not save streak')
    } finally {
      setFinishing(false)
    }
  }, [])

  const goToNextAfterWord = useCallback(async () => {
    const resetWord = () => {
      setWordSub('intro')
      setPicked(null)
    }
    const enterQuiz = () => {
      setSegment('quiz')
      setQuizIdx(0)
      setQuizSub('mcq')
      setQuizPicked(null)
    }

    if (segment === 'review') {
      if (wordIdx < reviewWords.length - 1) {
        setWordIdx((w) => w + 1)
        resetWord()
        return
      }
      if (newWords.length > 0) {
        setSegment('newWords')
        setWordIdx(0)
        resetWord()
        return
      }
      if (quizIds.length === 0) {
        await finishSession()
        return
      }
      enterQuiz()
      return
    }

    if (segment === 'newWords') {
      if (wordIdx < newWords.length - 1) {
        setWordIdx((w) => w + 1)
        resetWord()
        return
      }
      if (quizIds.length === 0) {
        await finishSession()
        return
      }
      enterQuiz()
    }
  }, [segment, wordIdx, reviewWords.length, newWords.length, quizIds.length, finishSession])

  const onContinueIntro = () => {
    if (!activeWord || !wordMcq) {
      setInitError('Missing question for this word. Go back and try again.')
      return
    }
    setWordSub('mcq')
  }

  const onPickMcq = (idx: number) => {
    if (wordSub !== 'mcq' || picked !== null || !wordMcq) return
    setPicked(idx)
    setWordSub('feedback')
  }

  const onContinueFeedback = () => {
    setWordSub('actions')
  }

  const onWordOutcome = async (status: 'learning' | 'mastered') => {
    if (!activeWord) return
    try {
      await applySessionWordOutcome({ id: activeWord.id, status })
      await goToNextAfterWord()
    } catch (e) {
      setInitError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const currentQuizQ = quizQuestions[quizIdx]
  const stepKey = `${segment}-${wordIdx}-${wordSub}-${quizIdx}-${quizSub}`

  const onQuizPick = (idx: number) => {
    if (quizSub !== 'mcq' || quizPicked !== null || !currentQuizQ) return
    setQuizPicked(idx)
    setQuizSub('feedback')
  }

  const onQuizContinue = async () => {
    if (!currentQuizQ) return
    try {
      await recordWordExposure(currentQuizQ.itemId)
    } catch {
      /* still advance */
    }
    setQuizPicked(null)
    if (quizIdx + 1 < quizQuestions.length) {
      setQuizIdx((i) => i + 1)
      setQuizSub('mcq')
    } else {
      await finishSession()
    }
  }

  function confirmLeave() {
    if (!sessionInProgress) {
      navigate('/')
      return
    }
    if (window.confirm('Leave session? Progress in this run will not count toward your streak.')) {
      navigate('/')
    }
  }

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
        <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
          Loading words and questions (one-time wait).
        </p>
        <div className="sessionPrepShell">
          <div className="lookupSkeleton" style={{ width: '58%' }} />
          <div className="lookupSkeleton" style={{ width: '100%' }} />
          <div className="lookupSkeleton" style={{ width: '82%' }} />
          <div className="lookupSkeleton" style={{ width: '92%' }} />
        </div>
      </div>
    )
  }

  if (initError && totalSteps === 0 && !vocabLoading) {
    return (
      <div className="container" style={{ padding: 24 }}>
        <p style={{ color: 'var(--danger)' }}>{initError}</p>
        <Link to="/" className="btn btnPrimary" style={{ marginTop: 16, display: 'inline-block' }}>
          Back to Today
        </Link>
      </div>
    )
  }

  if (userReady && totalSteps === 0 && segment === 'complete') {
    return (
      <div className="container" style={{ padding: 24, maxWidth: 520 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Not enough words yet</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Add a few learning words or save new items, then come back for a full session.
        </p>
        <Link to="/" className="btn btnPrimary" style={{ marginTop: 20, display: 'inline-block' }}>
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
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
          {segment === 'complete' ? 'Done' : `${currentStep} / ${totalSteps}`}
        </div>
        <span style={{ width: 56 }} />
      </header>

      {initError ? (
        <p style={{ color: 'var(--danger)', padding: '8px 16px', margin: 0, fontSize: 13 }}>{initError}</p>
      ) : null}

      <div className="container" style={{ flex: 1, paddingTop: 20, paddingBottom: 32, maxWidth: 560 }}>
        {segment === 'complete' ? (
          <div className="sessionStepFade" style={{ display: 'grid', gap: 16, justifyItems: 'start' }}>
            <div className="sessionCompleteGlow" aria-hidden>
              ✨
            </div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Session complete</h1>
            {finishError ? <p style={{ color: 'var(--danger)' }}>{finishError}</p> : null}
            {streakAfter !== null ? (
              <p style={{ fontSize: 16 }}>
                Current streak: <strong>{streakAfter}</strong> day{streakAfter === 1 ? '' : 's'}
              </p>
            ) : null}
            <p className="muted" style={{ margin: 0 }}>
              Nice work — keep your daily session going tomorrow.
            </p>
            <button
              type="button"
              className="btn btnPrimary"
              style={{ justifySelf: 'start', padding: '12px 20px', fontSize: 16 }}
              onClick={() => navigate('/')}
            >
              End session
            </button>
          </div>
        ) : null}

        {segment === 'review' || segment === 'newWords' ? (
          activeWord ? (
            <div key={stepKey} className="sessionStepFade">
              <WordRound
                label={segment === 'review' ? 'Review' : 'New'}
                word={activeWord}
                wordSub={wordSub}
                mcq={wordMcq}
                picked={picked}
                onContinueIntro={onContinueIntro}
                onPickMcq={onPickMcq}
                onContinueFeedback={onContinueFeedback}
                onWordOutcome={onWordOutcome}
              />
            </div>
          ) : null
        ) : null}

        {segment === 'quiz' ? (
          <div key={stepKey} className="sessionStepFade" style={{ display: 'grid', gap: 16 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6 }}>
              QUIZ
            </div>
            {!currentQuizQ ? (
              <p className="muted">No quiz questions.</p>
            ) : (
              <>
                {quizSub === 'mcq' ? (
                  <>
                    <p style={{ fontSize: 17, lineHeight: 1.45, margin: 0 }}>{currentQuizQ.questionText}</p>
                    <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
                      {currentQuizQ.options.map((opt, i) => (
                        <button
                          key={i}
                          type="button"
                          className="btn"
                          style={{
                            textAlign: 'left',
                            padding: '14px 16px',
                            fontSize: 15,
                          }}
                          onClick={() => onQuizPick(i)}
                          disabled={quizSub !== 'mcq'}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 15, margin: 0 }}>
                      {quizPicked === currentQuizQ.correctIndex ? (
                        <span style={{ color: 'var(--success, #22c55e)', fontWeight: 700 }}>Correct.</span>
                      ) : (
                        <span>
                          Correct: <strong>{currentQuizQ.options[currentQuizQ.correctIndex]}</strong>
                        </span>
                      )}
                    </p>
                    <p className="muted" style={{ fontSize: 14, marginTop: 8 }}>
                      {currentQuizQ.explanation}
                    </p>
                    <button
                      type="button"
                      className="btn btnPrimary"
                      style={{ marginTop: 12, padding: '12px 20px', fontSize: 16 }}
                      onClick={() => void onQuizContinue()}
                      disabled={finishing}
                    >
                      {finishing ? 'Saving…' : 'Continue'}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function WordRound({
  label,
  word,
  wordSub,
  mcq,
  picked,
  onContinueIntro,
  onPickMcq,
  onContinueFeedback,
  onWordOutcome,
}: {
  label: string
  word: VocabItem
  wordSub: WordSub
  mcq: QuizQuestion | null
  picked: number | null
  onContinueIntro: () => void
  onPickMcq: (i: number) => void
  onContinueFeedback: () => void
  onWordOutcome: (s: 'learning' | 'mastered') => void
}) {
  const example = word.exampleSentence?.trim()
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    setRevealed(false)
  }, [word.id, wordSub])

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="muted" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6 }}>
        {label.toUpperCase()}
      </div>

      {wordSub === 'intro' ? (
        <div className="learnFlashZone">
          <div className="learnFlashAmbient" />
          <div className="learnFlashPremium">
            <p className="learnFlashEyebrow">{label}</p>
            <h2 className="learnFlashWord" style={{ marginTop: 0 }}>{word.text}</h2>
            <span className="learnFlashTypePill">{word.type.toUpperCase()}</span>

            {!revealed ? (
              <button
                type="button"
                className="learnFlashRevealBtn"
                onClick={() => setRevealed(true)}
              >
                Reveal meaning
              </button>
            ) : (
              <div className="learnFlashRevealBlock">
                <div className="learnFlashAnswerPanel">
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>
                    {word.simpleDefinition || word.definition}
                  </p>
                  {word.definition && word.definition !== word.simpleDefinition ? (
                    <p className="muted" style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.5 }}>
                      {word.definition}
                    </p>
                  ) : null}
                  {example ? (
                    <blockquote
                      style={{
                        margin: '8px 0 0',
                        padding: '10px 12px',
                        borderLeft: '3px solid var(--accent-gradient-end)',
                        borderRadius: 10,
                        background: 'color-mix(in srgb, var(--surface-2) 84%, transparent)',
                        color: 'var(--muted)',
                        fontSize: 14,
                        lineHeight: 1.5,
                        fontStyle: 'italic',
                      }}
                    >
                      "{example}"
                    </blockquote>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="btn btnPrimary"
                  style={{ padding: '12px 20px', fontSize: 16 }}
                  onClick={onContinueIntro}
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {wordSub === 'mcq' || wordSub === 'feedback' ? (
        mcq ? (
          <>
            <p style={{ fontSize: 17, lineHeight: 1.45, margin: 0 }}>{mcq.questionText}</p>
            {wordSub === 'mcq' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {mcq.options.map((opt, i) => (
                  <button
                    key={i}
                    type="button"
                    className="btn"
                    style={{
                      textAlign: 'left',
                      padding: '14px 16px',
                      fontSize: 15,
                    }}
                    onClick={() => onPickMcq(i)}
                    disabled={picked !== null}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <p style={{ fontSize: 15, margin: 0 }}>
                  {picked === mcq.correctIndex ? (
                    <span style={{ color: 'var(--success, #22c55e)', fontWeight: 700 }}>Correct.</span>
                  ) : (
                    <span>
                      Correct: <strong>{mcq.options[mcq.correctIndex]}</strong>
                    </span>
                  )}
                </p>
                <p className="muted" style={{ fontSize: 14, marginTop: 8 }}>
                  {mcq.explanation}
                </p>
                <button
                  type="button"
                  className="btn btnPrimary"
                  style={{ marginTop: 12, padding: '12px 20px', fontSize: 16 }}
                  onClick={onContinueFeedback}
                >
                  Continue
                </button>
              </>
            )}
          </>
        ) : null
      ) : null}

      {wordSub === 'actions' ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 16 }}>How should we track this word?</p>
          <button
            type="button"
            className="btn btnPrimary"
            style={{ padding: '14px 20px', fontSize: 16 }}
            onClick={() => onWordOutcome('learning')}
          >
            Keep learning
          </button>
          <button
            type="button"
            className="btn"
            style={{ padding: '14px 20px', fontSize: 16 }}
            onClick={() => onWordOutcome('mastered')}
          >
            Mark as mastered
          </button>
        </div>
      ) : null}
    </div>
  )
}
