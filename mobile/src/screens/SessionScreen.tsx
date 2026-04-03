import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { getMainLanguageLabel } from '@shared/languages'
import type { QuizQuestion, VocabItem } from '@shared/types'
import { getNativeGloss } from '@shared/vocab'
import { pickSessionBatchFive } from '@shared/sessionPlanner'
import { orderQuestionsBySwipeWeakFirst, type SwipeSignal } from '@shared/sessionQuiz'
import { getMatchGloss, shuffledCopy } from '@shared/matchPhase'
import type { SessionWordOutcome } from '@shared/sessionOutcome'
import { fetchMeaningQuestionsForBatch } from '../lib/api'
import { applyStreakAfterSessionComplete, recordDailySessionCompletion } from '../lib/userProfile'
import { applySessionBatchOutcome, listVocabItems } from '../lib/vocab'
import { PrimaryButton } from '../components/UI'
import type { AppTheme } from '../theme'

type Phase = 'loading' | 'learn' | 'match' | 'mcq' | 'summary' | 'empty'

const SWIPE_THRESHOLD = 96

export function SessionScreen({
  theme,
  mainLanguage,
  onClose,
  onCompleted,
}: {
  theme: AppTheme
  mainLanguage: string
  onClose: () => void
  onCompleted: () => void
}) {
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
  const stepAnim = useRef(new Animated.Value(1)).current
  const completionPulse = useRef(new Animated.Value(0)).current

  const batchSize = batch.length
  const currentLearnWord = batch[learnIndex]

  const totalLearnSteps = batchSize

  const currentQuizQ = mcqQuestions[quizIdx]
  const stepKey = `${phase}-${learnIndex}-${quizIdx}-${quizSub}`

  useEffect(() => {
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
        if (!cancelled) setInitError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setVocabLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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

  const goMatch = useCallback(() => {
    setPhase('match')
  }, [])

  const goMcq = useCallback(() => {
    const swipeMap = swipeByIdRef.current
    setMcqQuestions((prev) => orderQuestionsBySwipeWeakFirst(prev, swipeMap))
    setQuizIdx(0)
    setQuizSub('mcq')
    setQuizPicked(null)
    setMcqCorrectById(new Map())
    setPhase('mcq')
  }, [])

  const onLearnSwipe = useCallback(
    (signal: SwipeSignal) => {
      const w = batch[learnIndex]
      if (!w) return
      swipeByIdRef.current.set(w.id, signal)
      if (signal === 'weak') setWeakSwipeCount((c) => c + 1)
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      if (learnIndex + 1 < batch.length) {
        setLearnIndex((i) => i + 1)
      } else {
        goMatch()
      }
    },
    [batch, learnIndex, goMatch],
  )

  const finishMatchAndGoQuiz = useCallback(() => {
    let correct = 0
    for (let i = 0; i < matchRows.length; i++) {
      const rowId = matchRows[i]!.id
      const assigned = matchAssignments[i]
      if (assigned === rowId) correct++
    }
    setMatchCorrectCount(correct)
    setMatchChecked(true)
    void Haptics.notificationAsync(
      correct === matchRows.length
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    )
  }, [matchRows, matchAssignments])

  const continueAfterMatch = useCallback(() => {
    goMcq()
  }, [goMcq])

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
      onCompleted()
    } catch (e) {
      setFinishError(e instanceof Error ? e.message : 'Could not save session')
      setPhase('summary')
    } finally {
      setFinishing(false)
    }
  }, [batch, itemsById, mcqCorrectById, onCompleted])

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
    void Haptics.notificationAsync(
      ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
    )
  }

  const onQuizContinue = useCallback(async () => {
    if (!currentQuizQ) return
    setQuizPicked(null)
    if (quizIdx + 1 < mcqQuestions.length) {
      setQuizIdx((i) => i + 1)
      setQuizSub('mcq')
    } else {
      await finishSession()
    }
  }, [currentQuizQ, quizIdx, mcqQuestions.length, finishSession])

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
    if (phase !== 'summary') return
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
  }, [phase, completionPulse])

  const mcqCorrectTotal = useMemo(() => {
    let n = 0
    for (const w of batch) {
      if (mcqCorrectById.get(w.id)) n++
    }
    return n
  }, [batch, mcqCorrectById, phase])

  const stillNeedWork = useMemo(() => {
    let n = 0
    for (const w of batch) {
      if (!mcqCorrectById.get(w.id)) n++
    }
    return n
  }, [batch, mcqCorrectById, phase])

  if (vocabLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <ActivityIndicator color={theme.primary} />
        <Text style={{ color: theme.muted, marginTop: 12, textAlign: 'center' }}>Preparing your session…</Text>
        <View style={{ width: '100%', marginTop: 16, gap: 8 }}>
          <View style={{ height: 10, width: '62%', borderRadius: 8, backgroundColor: theme.surface2 }} />
          <View style={{ height: 10, width: '100%', borderRadius: 8, backgroundColor: theme.surface2 }} />
        </View>
      </View>
    )
  }

  if (initError && phase === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, padding: 16 }}>
        <Text style={{ color: theme.danger }}>{initError}</Text>
        <View style={{ marginTop: 16 }}>
          <PrimaryButton theme={theme} label="Close" onPress={onClose} />
        </View>
      </View>
    )
  }

  if (phase === 'empty') {
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

  const phaseLabel =
    phase === 'learn' ? 'Learn' : phase === 'match' ? 'Match' : phase === 'mcq' ? 'Quiz' : phase === 'summary' ? 'Done' : ''

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
          {phase === 'summary' ? 'Done' : phase === 'learn' ? `${learnIndex + 1} / ${totalLearnSteps}` : phaseLabel}
        </Text>
        <View style={{ width: 48 }} />
      </View>

      {phase === 'learn' && currentLearnWord ? (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 16 }}>
          {initError ? <Text style={{ color: theme.danger, marginBottom: 8 }}>{initError}</Text> : null}
          <Animated.View
            style={{
              flex: 1,
              opacity: stepAnim,
              transform: [{ translateY: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            }}
          >
            <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>SWIPE</Text>
            <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 12 }}>
              Right = I know this · Left = I don&apos;t know
            </Text>
            <SwipeLearnCard
              key={currentLearnWord.id}
              theme={theme}
              mainLanguage={mainLanguage}
              word={currentLearnWord}
              onCommitted={onLearnSwipe}
            />
          </Animated.View>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {initError ? <Text style={{ color: theme.danger, marginBottom: 8 }}>{initError}</Text> : null}

          {phase === 'match' ? (
          <Animated.View style={{ gap: 14, opacity: stepAnim }}>
            <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '700' }}>MATCH</Text>
            <Text style={{ color: theme.text, fontSize: 15 }}>Tap a word, then tap the blank it fits.</Text>
            {matchRows.map((row, idx) => {
              const assignedId = matchAssignments[idx]
              const assignedWord = assignedId ? itemsById.get(assignedId) : undefined
              const showOk = matchChecked && assignedId === row.id
              const showBad = matchChecked && assignedId !== null && assignedId !== row.id
              return (
                <Pressable
                  key={row.id}
                  onPress={() => {
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
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: showOk ? theme.success : showBad ? theme.danger : theme.border,
                    backgroundColor: theme.surface,
                  }}
                >
                  <Text style={{ color: theme.text, fontSize: 16, lineHeight: 22 }}>
                    <Text style={{ fontWeight: '800' }}>{assignedWord ? assignedWord.text : '_____'}</Text>
                    {': '}
                    {row.gloss}
                  </Text>
                </Pressable>
              )
            })}
            <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '700', marginTop: 8 }}>WORD BANK</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {matchChips.map((c) => {
                const placed = matchAssignments.includes(c.id)
                const selected = selectedChipId === c.id
                if (placed) return null
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      if (matchChecked) return
                      setSelectedChipId((prev) => (prev === c.id ? null : c.id))
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 20,
                      backgroundColor: selected ? theme.primary : theme.surface2,
                      borderWidth: 1,
                      borderColor: theme.border,
                    }}
                  >
                    <Text style={{ color: selected ? '#fff' : theme.text, fontWeight: '700' }}>{c.text}</Text>
                  </Pressable>
                )
              })}
            </View>
            {!matchChecked ? (
              <PrimaryButton
                theme={theme}
                label={matchAssignments.every((a) => a !== null) ? 'Check answers' : 'Fill all blanks first'}
                onPress={() => {
                  if (!matchAssignments.every((a) => a !== null)) return
                  finishMatchAndGoQuiz()
                }}
                disabled={!matchAssignments.every((a) => a !== null)}
              />
            ) : (
              <View style={{ gap: 10 }}>
                <Text style={{ color: theme.text, fontSize: 16 }}>
                  {matchCorrectCount === matchRows.length ? (
                    <Text style={{ color: theme.success, fontWeight: '800' }}>Perfect match.</Text>
                  ) : (
                    <Text>
                      <Text style={{ fontWeight: '800' }}>{matchCorrectCount}</Text> of {matchRows.length} correct
                    </Text>
                  )}
                </Text>
                <PrimaryButton theme={theme} label="Continue to quiz" onPress={continueAfterMatch} />
              </View>
            )}
          </Animated.View>
        ) : null}

        {phase === 'mcq' ? (
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

        {phase === 'summary' ? (
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
            <Text style={{ color: theme.muted, fontSize: 16, lineHeight: 24 }}>
              {batchSize} words reviewed{'\n'}
              {weakSwipeCount} felt unfamiliar{'\n'}
              {matchCorrectCount}/{batchSize} match correct{'\n'}
              {mcqCorrectTotal}/{batchSize} quiz correct{'\n'}
              {stillNeedWork} still need work
            </Text>
            {finishError ? <Text style={{ color: theme.danger }}>{finishError}</Text> : null}
            {streakAfter !== null ? (
              <Text style={{ color: theme.text, fontSize: 16 }}>
                Streak: <Text style={{ fontWeight: '800' }}>{streakAfter}</Text> days
              </Text>
            ) : null}
            <PrimaryButton theme={theme} label="End session" onPress={onClose} />
          </Animated.View>
        ) : null}
      </ScrollView>
      )}
    </View>
  )
}

function SwipeLearnCard({
  theme,
  mainLanguage,
  word,
  onCommitted,
}: {
  theme: AppTheme
  mainLanguage: string
  word: VocabItem
  onCommitted: (signal: SwipeSignal) => void
}) {
  const { height: windowHeight } = useWindowDimensions()
  const cardBodyMaxH = Math.max(280, windowHeight * 0.58)
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

  const translateX = useRef(new Animated.Value(0)).current
  const rotate = translateX.interpolate({
    inputRange: [-280, 280],
    outputRange: ['-10deg', '10deg'],
  })

  useEffect(() => {
    translateX.setValue(0)
  }, [word.id, translateX])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 0.85 + 2,
        onPanResponderMove: (_, g) => {
          translateX.setValue(g.dx)
        },
        onPanResponderRelease: (_, g) => {
          const dx = g.dx
          if (dx > SWIPE_THRESHOLD) {
            Animated.timing(translateX, { toValue: 420, duration: 200, useNativeDriver: true }).start(() =>
              onCommitted('strong'),
            )
          } else if (dx < -SWIPE_THRESHOLD) {
            Animated.timing(translateX, { toValue: -420, duration: 200, useNativeDriver: true }).start(() =>
              onCommitted('weak'),
            )
          } else {
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 7 }).start()
          }
        },
      }),
    [onCommitted, translateX],
  )

  return (
    <View style={{ flex: 1, minHeight: 240 }}>
      <Animated.View
        collapsable={false}
        {...panResponder.panHandlers}
        style={[
          {
            flex: 1,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surface,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOpacity: 0.1,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 8 },
            elevation: 5,
          },
          { transform: [{ translateX }, { rotate }] },
        ]}
      >
        <ScrollView
          style={{ maxHeight: cardBodyMaxH }}
          contentContainerStyle={{ padding: 20, paddingBottom: 18 }}
          showsVerticalScrollIndicator
          bounces={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '800',
                letterSpacing: 1.1,
                color: theme.muted,
              }}
            >
              {typeLabel}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 1, color: theme.muted }}>SWIPE</Text>
          </View>

          <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.4 }}>{word.text}</Text>

          <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 16, opacity: 0.85 }} />

          {simpleLine ? (
            <View style={{ gap: 6, marginBottom: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, letterSpacing: 0.6 }}>MEANING</Text>
              <Text style={{ color: theme.text, fontSize: 16, lineHeight: 24 }}>{simpleLine}</Text>
            </View>
          ) : null}

          {longDef ? (
            <View style={{ gap: 6, marginBottom: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, letterSpacing: 0.6 }}>FULL DEFINITION</Text>
              <Text style={{ color: theme.text, fontSize: 15, lineHeight: 22 }}>{longDef}</Text>
            </View>
          ) : null}

          {nativeGloss ? (
            <View style={{ gap: 6, marginBottom: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, letterSpacing: 0.6 }}>{languageTitle}</Text>
              <Text style={{ color: theme.muted, fontSize: 15, lineHeight: 22, fontStyle: 'italic' }}>{nativeGloss}</Text>
            </View>
          ) : null}

          {example ? (
            <View
              style={{
                marginTop: 4,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderLeftWidth: 3,
                borderLeftColor: theme.primary,
                borderRadius: 10,
                backgroundColor: theme.surface2,
                marginBottom: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <MaterialIcons name="format-quote" size={18} color={theme.muted} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, letterSpacing: 0.6 }}>EXAMPLE</Text>
              </View>
              <Text style={{ color: theme.muted, fontSize: 14, lineHeight: 21, fontStyle: 'italic' }}>&quot;{example}&quot;</Text>
            </View>
          ) : null}

          {(word.synonyms?.length ?? 0) > 0 ? (
            <View style={{ gap: 8, marginBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, letterSpacing: 0.6 }}>SYNONYMS</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(word.synonyms ?? []).map((syn, idx) => (
                  <View
                    key={`${syn}-${idx}`}
                    style={{
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: theme.border,
                      backgroundColor: theme.surface2,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                    }}
                  >
                    <Text style={{ color: theme.text, fontSize: 13 }}>{syn}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {word.nuanceNote ? (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
              <MaterialIcons name="lightbulb-outline" size={20} color={theme.muted} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted }}>NUANCE</Text>
                <Text style={{ color: theme.text, fontSize: 14, lineHeight: 21 }}>{word.nuanceNote}</Text>
              </View>
            </View>
          ) : null}

          {word.gmatUsageNote ? (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
              <MaterialIcons name="star-border" size={20} color={theme.muted} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted }}>GMAT USAGE</Text>
                <Text style={{ color: theme.text, fontSize: 14, lineHeight: 21 }}>{word.gmatUsageNote}</Text>
              </View>
            </View>
          ) : null}

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 16,
              paddingTop: 14,
              borderTopWidth: 1,
              borderTopColor: theme.border,
            }}
          >
            <Text style={{ color: theme.danger, fontSize: 12, fontWeight: '700' }}>← Don&apos;t know</Text>
            <Text style={{ color: theme.success, fontSize: 12, fontWeight: '700' }}>Know →</Text>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  )
}
