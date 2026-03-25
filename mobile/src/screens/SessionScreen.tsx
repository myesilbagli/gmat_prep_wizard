import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import type { QuizQuestion, VocabItem } from '@shared/types'
import {
  NEW,
  pickNewWords,
  pickQuizItemIds,
  pickReviewWords,
  sessionTotalSteps,
} from '@shared/sessionPlanner'
import { prefetchSessionMeaningQuestions } from '../lib/api'
import {
  applyStreakAfterSessionComplete,
  recordDailySessionCompletion,
} from '../lib/userProfile'
import { applySessionWordOutcome, listVocabItems, recordWordExposure } from '../lib/vocab'
import { PrimaryButton } from '../components/UI'
import type { AppTheme } from '../theme'

type WordSub = 'intro' | 'mcq' | 'feedback' | 'actions'
type Segment = 'review' | 'newWords' | 'quiz' | 'complete'

export function SessionScreen({
  theme,
  onClose,
  onCompleted,
}: {
  theme: AppTheme
  onClose: () => void
  onCompleted: () => void
}) {
  const [initError, setInitError] = useState<string | null>(null)
  const [vocabLoading, setVocabLoading] = useState(true)
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
  const stepAnim = useRef(new Animated.Value(1)).current
  const completionPulse = useRef(new Animated.Value(0)).current

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

  useEffect(() => {
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
        if (!cancelled) setInitError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setVocabLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const finishSession = useCallback(async () => {
    setFinishing(true)
    setFinishError(null)
    try {
      const profile = await applyStreakAfterSessionComplete()
      await recordDailySessionCompletion('daily_vocab')
      setStreakAfter(profile.streakCurrent)
      setSegment('complete')
      onCompleted()
    } catch (e) {
      setFinishError(e instanceof Error ? e.message : 'Could not save streak')
    } finally {
      setFinishing(false)
    }
  }, [onCompleted])

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

  useEffect(() => {
    stepAnim.setValue(0)
    Animated.timing(stepAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [stepKey, stepAnim])

  useEffect(() => {
    if (segment !== 'complete') return
    completionPulse.setValue(0)
    const loop = Animated.loop(
      Animated.timing(completionPulse, {
        toValue: 1,
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    )
    loop.start()
    return () => loop.stop()
  }, [segment, completionPulse])

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
      /* ignore */
    }
    setQuizPicked(null)
    if (quizIdx + 1 < quizQuestions.length) {
      setQuizIdx((i) => i + 1)
      setQuizSub('mcq')
    } else {
      await finishSession()
    }
  }

  if (vocabLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <ActivityIndicator color={theme.primary} />
        <Text style={{ color: theme.muted, marginTop: 12, textAlign: 'center' }}>Preparing your session…</Text>
        <Text style={{ color: theme.muted, marginTop: 8, fontSize: 13, textAlign: 'center' }}>
          Loading words and questions (one-time wait).
        </Text>
        <View style={{ width: '100%', marginTop: 16, gap: 8 }}>
          <View style={{ height: 10, width: '62%', borderRadius: 8, backgroundColor: theme.surface2 }} />
          <View style={{ height: 10, width: '100%', borderRadius: 8, backgroundColor: theme.surface2 }} />
          <View style={{ height: 10, width: '84%', borderRadius: 8, backgroundColor: theme.surface2 }} />
          <View style={{ height: 10, width: '92%', borderRadius: 8, backgroundColor: theme.surface2 }} />
        </View>
      </View>
    )
  }

  if (initError && totalSteps === 0 && !vocabLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, padding: 16 }}>
        <Text style={{ color: theme.danger }}>{initError}</Text>
        <View style={{ marginTop: 16 }}>
          <PrimaryButton theme={theme} label="Close" onPress={onClose} />
        </View>
      </View>
    )
  }

  if (totalSteps === 0 && segment === 'complete') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, padding: 16 }}>
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800' }}>Not enough words</Text>
        <Text style={{ color: theme.muted, marginTop: 8 }}>Save a few learning words first.</Text>
        <View style={{ marginTop: 20 }}>
          <PrimaryButton theme={theme} label="Back" onPress={onClose} />
        </View>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Pressable onPress={onClose}>
          <Text style={{ color: theme.primary, fontWeight: '700' }}>← Exit</Text>
        </Pressable>
        <Text style={{ color: theme.muted, fontWeight: '700' }}>
          {segment === 'complete' ? 'Done' : `${currentStep} / ${totalSteps}`}
        </Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {initError ? <Text style={{ color: theme.danger, marginBottom: 8 }}>{initError}</Text> : null}

        {segment === 'complete' ? (
          <Animated.View style={{ gap: 12, opacity: stepAnim, transform: [{ translateY: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
            <View style={{ width: 88, height: 88, alignItems: 'center', justifyContent: 'center' }}>
              <Animated.View
                style={{
                  position: 'absolute',
                  width: 88,
                  height: 88,
                  borderRadius: 44,
                  borderWidth: 2,
                  borderColor: theme.primary,
                  opacity: completionPulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
                  transform: [{ scale: completionPulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.25] }) }],
                }}
              />
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 28, color: '#fff' }}>✨</Text>
              </View>
            </View>
            <Text style={{ color: theme.text, fontSize: 24, fontWeight: '800' }}>Session complete</Text>
            {finishError ? <Text style={{ color: theme.danger }}>{finishError}</Text> : null}
            {streakAfter !== null ? (
              <Text style={{ color: theme.text, fontSize: 16 }}>
                Streak: <Text style={{ fontWeight: '800' }}>{streakAfter}</Text> days
              </Text>
            ) : null}
            <PrimaryButton theme={theme} label="End session" onPress={onClose} />
          </Animated.View>
        ) : null}

        {(segment === 'review' || segment === 'newWords') && activeWord ? (
          <Animated.View style={{ opacity: stepAnim, transform: [{ translateY: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
            <WordFlow
              theme={theme}
              label={segment === 'review' ? 'Review' : 'New'}
              word={activeWord}
              wordSub={wordSub}
              mcq={wordMcq}
              picked={picked}
              onContinueIntro={() => {
                if (!wordMcq) {
                  setInitError('Missing question for this word.')
                  return
                }
                setWordSub('mcq')
              }}
              onPickMcq={(i) => {
                if (wordSub !== 'mcq' || picked !== null || !wordMcq) return
                setPicked(i)
                setWordSub('feedback')
              }}
              onContinueFeedback={() => setWordSub('actions')}
              onWordOutcome={onWordOutcome}
            />
          </Animated.View>
        ) : null}

        {segment === 'quiz' ? (
          <Animated.View style={{ gap: 12, opacity: stepAnim, transform: [{ translateY: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
            <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '700' }}>QUIZ</Text>
            {!currentQuizQ ? (
              <Text style={{ color: theme.muted }}>No quiz questions.</Text>
            ) : (
              <>
                {quizSub === 'mcq' ? (
                  <View style={{ gap: 10 }}>
                    <Text style={{ color: theme.text, fontSize: 17, lineHeight: 24 }}>{currentQuizQ.questionText}</Text>
                    {currentQuizQ.options.map((opt, i) => (
                      <Pressable
                        key={i}
                        onPress={() => onQuizPick(i)}
                        disabled={quizSub !== 'mcq'}
                        style={{
                          padding: 14,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: theme.border,
                          backgroundColor: theme.surface,
                        }}
                      >
                        <Text style={{ color: theme.text, fontSize: 15 }}>{opt}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    <Text style={{ color: theme.text, fontSize: 15 }}>
                      {quizPicked === currentQuizQ.correctIndex ? (
                        <Text style={{ color: theme.success, fontWeight: '800' }}>Correct.</Text>
                      ) : (
                        <Text>
                          Correct: <Text style={{ fontWeight: '800' }}>{currentQuizQ.options[currentQuizQ.correctIndex]}</Text>
                        </Text>
                      )}
                    </Text>
                    <Text style={{ color: theme.muted, fontSize: 14 }}>{currentQuizQ.explanation}</Text>
                    <PrimaryButton
                      theme={theme}
                      label={finishing ? 'Saving…' : 'Continue'}
                      onPress={() => void onQuizContinue()}
                      disabled={finishing}
                    />
                  </View>
                )}
              </>
            )}
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
  )
}

function WordFlow({
  theme,
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
  theme: AppTheme
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
    <View style={{ gap: 14 }}>
      <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '700' }}>{label.toUpperCase()}</Text>

      {wordSub === 'intro' ? (
        <View style={{ gap: 10 }}>
          <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>{word.text}</Text>
          {!revealed ? (
            <PrimaryButton theme={theme} label="Reveal meaning" onPress={() => setRevealed(true)} />
          ) : (
            <>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: theme.primary,
                  backgroundColor: 'rgba(99,102,241,0.10)',
                  borderRadius: 12,
                  padding: 12,
                  gap: 8,
                }}
              >
                <Text style={{ color: theme.muted, fontSize: 16, lineHeight: 22 }}>
                  {word.simpleDefinition || word.definition}
                </Text>
                {word.definition && word.definition !== word.simpleDefinition ? (
                  <Text style={{ color: theme.text, fontSize: 15, lineHeight: 22 }}>{word.definition}</Text>
                ) : null}
                {example ? (
                  <View
                    style={{
                      marginTop: 2,
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      borderLeftWidth: 3,
                      borderLeftColor: theme.primary,
                      borderRadius: 10,
                      backgroundColor: theme.surface2,
                    }}
                  >
                    <Text style={{ color: theme.muted, fontSize: 14, lineHeight: 21, fontStyle: 'italic' }}>
                      "{example}"
                    </Text>
                  </View>
                ) : null}
              </View>
              <PrimaryButton theme={theme} label="Continue" onPress={onContinueIntro} />
            </>
          )}
        </View>
      ) : null}

      {(wordSub === 'mcq' || wordSub === 'feedback') && mcq ? (
        wordSub === 'mcq' ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: theme.text, fontSize: 17, lineHeight: 24 }}>{mcq.questionText}</Text>
            {mcq.options.map((opt, i) => (
              <Pressable
                key={i}
                onPress={() => onPickMcq(i)}
                disabled={picked !== null}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.border,
                  backgroundColor: theme.surface,
                }}
              >
                <Text style={{ color: theme.text, fontSize: 15 }}>{opt}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Text style={{ color: theme.text, fontSize: 15 }}>
              {picked === mcq.correctIndex ? (
                <Text style={{ color: theme.success, fontWeight: '800' }}>Correct.</Text>
              ) : (
                <Text>
                  Correct: <Text style={{ fontWeight: '800' }}>{mcq.options[mcq.correctIndex]}</Text>
                </Text>
              )}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 14 }}>{mcq.explanation}</Text>
            <PrimaryButton theme={theme} label="Continue" onPress={onContinueFeedback} />
          </View>
        )
      ) : null}

      {wordSub === 'actions' ? (
        <View style={{ gap: 12 }}>
          <Text style={{ color: theme.text, fontSize: 16 }}>How should we track this word?</Text>
          <PrimaryButton theme={theme} label="Keep learning" onPress={() => void onWordOutcome('learning')} />
          <Pressable
            onPress={() => void onWordOutcome('mastered')}
            style={{
              padding: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: theme.text, fontWeight: '700' }}>Mark as mastered</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}
