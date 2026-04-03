import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import type { QuizQuestion, VocabItem } from '../../shared/types'
import { pickSessionBatchFive } from '../../shared/sessionPlanner'
import { orderQuestionsBySwipeWeakFirst, type SwipeSignal } from '../../shared/sessionQuiz'
import { getMatchGloss, shuffledCopy } from '../../shared/matchPhase'
import type { SessionWordOutcome } from '../../shared/sessionOutcome'
import { auth } from '../lib/firebase'
import { fetchMeaningQuestionsForBatch } from '../lib/quizClient'
import { applySessionBatchOutcome, listVocabItems } from '../lib/vocab'
import { DEFAULT_MAIN_LANGUAGE, getMainLanguageLabel, normalizeMainLanguageCode } from '../../shared/languages'
import { getNativeGloss } from '../../shared/vocab'
import {
  applyStreakAfterSessionComplete,
  ensureUserProfileDefaults,
  recordDailySessionCompletion,
} from '../lib/userProfile'

type Phase = 'loading' | 'learn' | 'match' | 'mcq' | 'summary' | 'empty'

export function SessionPage() {
  const navigate = useNavigate()
  const [userReady, setUserReady] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [vocabLoading, setVocabLoading] = useState(true)
  const [batch, setBatch] = useState<VocabItem[]>([])
  const itemsById = useMemo(() => new Map(batch.map((w) => [w.id, w])), [batch])

  const [phase, setPhase] = useState<Phase>('loading')
  const [learnIndex, setLearnIndex] = useState(0)
  const swipeByIdRef = useRef<Map<string, SwipeSignal>>(new Map())
  const [weakSwipeCount, setWeakSwipeCount] = useState(0)

  const [mcqQuestions, setMcqQuestions] = useState<QuizQuestion[]>([])
  const [quizIdx, setQuizIdx] = useState(0)
  const [quizSub, setQuizSub] = useState<'mcq' | 'feedback'>('mcq')
  const [quizPicked, setQuizPicked] = useState<number | null>(null)
  const [mcqCorrectById, setMcqCorrectById] = useState<Map<string, boolean>>(new Map())

  const [matchRows, setMatchRows] = useState<{ id: string; gloss: string }[]>([])
  const [matchChips, setMatchChips] = useState<{ id: string; text: string }[]>([])
  const [matchAssignments, setMatchAssignments] = useState<(string | null)[]>([])
  const [selectedChipId, setSelectedChipId] = useState<string | null>(null)
  const [matchChecked, setMatchChecked] = useState(false)
  const [matchCorrectCount, setMatchCorrectCount] = useState(0)

  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [streakAfter, setStreakAfter] = useState<number | null>(null)
  const [mainLanguage, setMainLanguage] = useState(DEFAULT_MAIN_LANGUAGE)

  const batchSize = batch.length
  const currentLearnWord = batch[learnIndex]
  const currentQuizQ = mcqQuestions[quizIdx]

  const sessionInProgress = phase === 'learn' || phase === 'match' || phase === 'mcq'

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUserReady(!!u)
      if (!u) setInitError('Please sign in to run a session.')
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!auth.currentUser) return
    void ensureUserProfileDefaults()
      .then((p) => setMainLanguage(normalizeMainLanguageCode(p.mainLanguage)))
      .catch(() => {})
  }, [userReady])

  useEffect(() => {
    const reload = () => {
      void ensureUserProfileDefaults()
        .then((p) => setMainLanguage(normalizeMainLanguageCode(p.mainLanguage)))
        .catch(() => {})
    }
    window.addEventListener('gmat-vocab-profile-updated', reload)
    return () => window.removeEventListener('gmat-vocab-profile-updated', reload)
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
        const picked = pickSessionBatchFive(all)
        if (picked.length === 0) {
          setBatch([])
          setPhase('empty')
          setVocabLoading(false)
          return
        }
        const ids = picked.map((w) => w.id)
        const questions = await fetchMeaningQuestionsForBatch(ids)
        if (cancelled) return
        if (questions.length !== picked.length) {
          throw new Error('Could not prepare all session questions. Please try again.')
        }
        const byId = new Map(questions.map((q) => [q.itemId, q]))
        const orderedQs = ids.map((id) => byId.get(id)).filter(Boolean) as QuizQuestion[]
        setBatch(picked)
        setMcqQuestions(orderedQs)
        setPhase('learn')
        setLearnIndex(0)
        setWeakSwipeCount(0)
        swipeByIdRef.current = new Map()
        setMcqCorrectById(new Map())
        setQuizIdx(0)
        setQuizSub('mcq')
        setQuizPicked(null)
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

  useEffect(() => {
    if (phase !== 'match' || batch.length === 0) return
    const rows = shuffledCopy(batch.map((w) => ({ id: w.id, gloss: getMatchGloss(w) })))
    const chips = shuffledCopy(batch.map((w) => ({ id: w.id, text: w.text })))
    setMatchRows(rows)
    setMatchChips(chips)
    setMatchAssignments(rows.map(() => null))
    setSelectedChipId(null)
    setMatchChecked(false)
    setMatchCorrectCount(0)
  }, [phase, batch])

  const goMatch = useCallback(() => setPhase('match'), [])

  const goMcq = useCallback(() => {
    const swipeMap = swipeByIdRef.current
    setMcqQuestions((prev) => orderQuestionsBySwipeWeakFirst(prev, swipeMap))
    setQuizIdx(0)
    setQuizSub('mcq')
    setQuizPicked(null)
    setMcqCorrectById(new Map())
    setPhase('mcq')
  }, [])

  const onLearnChoice = (signal: SwipeSignal) => {
    const w = batch[learnIndex]
    if (!w) return
    swipeByIdRef.current.set(w.id, signal)
    if (signal === 'weak') setWeakSwipeCount((c) => c + 1)
    if (learnIndex + 1 < batch.length) {
      setLearnIndex((i) => i + 1)
    } else {
      goMatch()
    }
  }

  const finishMatchAndCheck = () => {
    let correct = 0
    for (let i = 0; i < matchRows.length; i++) {
      const rowId = matchRows[i]!.id
      const assigned = matchAssignments[i]
      if (assigned === rowId) correct++
    }
    setMatchCorrectCount(correct)
    setMatchChecked(true)
  }

  const finishSession = useCallback(async () => {
    setFinishing(true)
    setFinishError(null)
    try {
      const outcomes: SessionWordOutcome[] = batch.map((w) => ({
        id: w.id,
        swipe: swipeByIdRef.current.get(w.id) ?? 'strong',
        mcqCorrect: mcqCorrectById.get(w.id) ?? false,
      }))
      await applySessionBatchOutcome(itemsById, outcomes)
      const profile = await applyStreakAfterSessionComplete()
      await recordDailySessionCompletion('daily_vocab')
      setStreakAfter(profile.streakCurrent)
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

  const mcqCorrectTotal = useMemo(() => {
    let n = 0
    for (const w of batch) {
      if (mcqCorrectById.get(w.id)) n++
    }
    return n
  }, [batch, mcqCorrectById])

  const stillNeedWork = useMemo(() => {
    let n = 0
    for (const w of batch) {
      if (!mcqCorrectById.get(w.id)) n++
    }
    return n
  }, [batch, mcqCorrectById])

  function confirmLeave() {
    if (!sessionInProgress) {
      navigate('/')
      return
    }
    if (window.confirm('Leave session? Progress in this run will not count toward your streak.')) {
      navigate('/')
    }
  }

  const headerRight =
    phase === 'summary'
      ? 'Done'
      : phase === 'learn'
        ? `${learnIndex + 1} / ${batchSize}`
        : phase === 'match'
          ? 'Match'
          : phase === 'mcq'
            ? `${quizIdx + 1} / ${mcqQuestions.length}`
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
        <Link to="/" className="btn btnPrimary" style={{ marginTop: 16, display: 'inline-block' }}>
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
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>{headerRight}</div>
        <span style={{ width: 56 }} />
      </header>

      {initError ? (
        <p style={{ color: 'var(--danger)', padding: '8px 16px', margin: 0, fontSize: 13 }}>{initError}</p>
      ) : null}

      <div className="container" style={{ flex: 1, paddingTop: 20, paddingBottom: 32, maxWidth: 560 }}>
        {phase === 'learn' && currentLearnWord ? (
          <LearnCardWeb mainLanguage={mainLanguage} word={currentLearnWord} onChoice={onLearnChoice} />
        ) : null}

        {phase === 'match' ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6 }}>
              MATCH
            </div>
            <p style={{ margin: 0 }}>Tap a word, then tap the blank it fits.</p>
            {matchRows.map((row, idx) => {
              const assignedId = matchAssignments[idx]
              const assignedWord = assignedId ? itemsById.get(assignedId) : undefined
              const showOk = matchChecked && assignedId === row.id
              const showBad = matchChecked && assignedId !== null && assignedId !== row.id
              return (
                <button
                  key={row.id}
                  type="button"
                  className="btn"
                  onClick={() => {
                    if (matchChecked) return
                    if (selectedChipId) {
                      setMatchAssignments((prev) => {
                        const next = [...prev]
                        const oldIdx = next.findIndex((x, i) => i !== idx && x === selectedChipId)
                        if (oldIdx >= 0) next[oldIdx] = null
                        next[idx] = selectedChipId
                        return next
                      })
                      setSelectedChipId(null)
                    } else if (assignedId) {
                      setMatchAssignments((prev) => {
                        const next = [...prev]
                        next[idx] = null
                        return next
                      })
                    }
                  }}
                  style={{
                    textAlign: 'left',
                    borderColor: showOk ? 'var(--success, #22c55e)' : showBad ? 'var(--danger)' : undefined,
                  }}
                >
                  <strong>{assignedWord ? assignedWord.text : '_____'}</strong>
                  {': '}
                  {row.gloss}
                </button>
              )
            })}
            <div className="muted" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6 }}>
              WORD BANK
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {matchChips.map((c) => {
                const placed = matchAssignments.includes(c.id)
                const selected = selectedChipId === c.id
                if (placed) return null
                return (
                  <button
                    key={c.id}
                    type="button"
                    className="btn"
                    onClick={() => {
                      if (matchChecked) return
                      setSelectedChipId((prev) => (prev === c.id ? null : c.id))
                    }}
                    style={{
                      borderRadius: 20,
                      background: selected ? 'var(--accent-gradient-end)' : undefined,
                      color: selected ? '#fff' : undefined,
                    }}
                  >
                    {c.text}
                  </button>
                )
              })}
            </div>
            {!matchChecked ? (
              <button
                type="button"
                className="btn btnPrimary"
                disabled={!matchAssignments.every((a) => a !== null)}
                onClick={finishMatchAndCheck}
              >
                {matchAssignments.every((a) => a !== null) ? 'Check answers' : 'Fill all blanks first'}
              </button>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                <p style={{ margin: 0 }}>
                  {matchCorrectCount === matchRows.length ? (
                    <span style={{ color: 'var(--success, #22c55e)', fontWeight: 700 }}>Perfect match.</span>
                  ) : (
                    <span>
                      <strong>{matchCorrectCount}</strong> of {matchRows.length} correct
                    </span>
                  )}
                </p>
                <button type="button" className="btn btnPrimary" onClick={goMcq}>
                  Continue to quiz
                </button>
              </div>
            )}
          </div>
        ) : null}

        {phase === 'mcq' ? (
          <div className="sessionStepFade" style={{ display: 'grid', gap: 16 }}>
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

        {phase === 'summary' ? (
          <div className="sessionStepFade" style={{ display: 'grid', gap: 16, justifyItems: 'start' }}>
            <div className="sessionCompleteGlow" aria-hidden>
              ✨
            </div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Session complete</h1>
            <p className="muted" style={{ margin: 0, fontSize: 16, lineHeight: 1.6 }}>
              {batchSize} words reviewed
              <br />
              {weakSwipeCount} felt unfamiliar
              <br />
              {matchCorrectCount}/{batchSize} match correct
              <br />
              {mcqCorrectTotal}/{batchSize} quiz correct
              <br />
              {stillNeedWork} still need work
            </p>
            {finishError ? <p style={{ color: 'var(--danger)' }}>{finishError}</p> : null}
            {streakAfter !== null ? (
              <p style={{ fontSize: 16 }}>
                Current streak: <strong>{streakAfter}</strong> day{streakAfter === 1 ? '' : 's'}
              </p>
            ) : null}
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
      </div>
    </div>
  )
}

function LearnCardWeb({
  mainLanguage,
  word,
  onChoice,
}: {
  mainLanguage: string
  word: VocabItem
  onChoice: (s: SwipeSignal) => void
}) {
  const example = word.exampleSentence?.trim()
  const nativeGloss = getNativeGloss(word, mainLanguage)
  const languageTitle = useMemo(() => {
    const full = getMainLanguageLabel(mainLanguage)
    const cut = full.indexOf(' (')
    return cut >= 0 ? full.slice(0, cut) : full
  }, [mainLanguage])
  const typeLabel = word.type === 'phrase' ? 'PHRASE' : 'WORD'
  const simpleLine = (word.simpleDefinition || word.definition || '').trim()
  const longDef =
    word.definition && word.simpleDefinition && word.definition.trim() !== word.simpleDefinition.trim()
      ? word.definition.trim()
      : null

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="muted" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6 }}>
        LEARN
      </div>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>I know this → · ← I don&apos;t know</p>
      <div className="learnFlashZone">
        <div className="learnFlashAmbient" />
        <div className="learnFlashPremium" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.1em',
                color: 'var(--muted)',
              }}
            >
              <span>{typeLabel}</span>
              <span>FLASHCARD</span>
            </div>
            <h2 className="learnFlashWord" style={{ margin: 0, fontSize: 28, letterSpacing: '-0.02em' }}>
              {word.text}
            </h2>
            <div style={{ height: 1, background: 'var(--border)', margin: '16px 0', opacity: 0.85 }} />
          </div>
          {simpleLine ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, letterSpacing: '0.05em' }}>MEANING</div>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>{simpleLine}</p>
            </div>
          ) : null}
          {longDef ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, letterSpacing: '0.05em' }}>
                FULL DEFINITION
              </div>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>{longDef}</p>
            </div>
          ) : null}
          {nativeGloss ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, letterSpacing: '0.05em' }}>{languageTitle}</div>
              <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.5, fontStyle: 'italic' }}>
                {nativeGloss}
              </p>
            </div>
          ) : null}
          {example ? (
            <blockquote
              style={{
                margin: '4px 0 12px',
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
              &quot;{example}&quot;
            </blockquote>
          ) : null}
          {(word.synonyms?.length ?? 0) > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 8, letterSpacing: '0.05em' }}>SYNONYMS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(word.synonyms ?? []).map((syn, idx) => (
                  <span
                    key={`${syn}-${idx}`}
                    style={{
                      borderRadius: 999,
                      border: '1px solid var(--border)',
                      padding: '5px 10px',
                      fontSize: 13,
                    }}
                  >
                    {syn}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {word.nuanceNote ? (
            <p style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.5 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>NUANCE</span>
              {word.nuanceNote}
            </p>
          ) : null}
          {word.gmatUsageNote ? (
            <p style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.5 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>GMAT USAGE</span>
              {word.gmatUsageNote}
            </p>
          ) : null}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 16,
              paddingTop: 14,
              borderTop: '1px solid var(--border)',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <span style={{ color: 'var(--danger)' }}>← Don&apos;t know</span>
            <span style={{ color: 'var(--success, #22c55e)' }}>Know →</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
        <button type="button" className="btn" onClick={() => onChoice('weak')}>
          Don&apos;t know
        </button>
        <button type="button" className="btn btnPrimary" onClick={() => onChoice('strong')}>
          I know this
        </button>
      </div>
    </div>
  )
}
