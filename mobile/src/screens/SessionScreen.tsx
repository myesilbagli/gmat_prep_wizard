import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import type { LearningBucket, QuizQuestion, VocabItem } from '@shared/types'
import { formatSessionBatchComposition, pickSessionBatchTen } from '@shared/sessionPlanner'
import type { SessionWordOutcome } from '@shared/sessionOutcome'
import { bucketFromWord, countDeckBuckets, type DeckBucketCounts } from '@shared/learningBuckets'
import { DEFAULT_TIMEZONE } from '@shared/userProfile'
import { fetchMeaningQuestionsForBatch } from '../lib/api'
import {
  applyStreakAfterSessionComplete,
  ensureUserProfileDefaults,
  recordDailySessionCompletion,
} from '../lib/userProfile'
import { applySessionBatchOutcome, listVocabItems, markWordIntroduced } from '../lib/vocab'
import { PrimaryButton } from '../components/UI'
import { LearnFlashcardModal } from '../components/LearnFlashcardModal'
import type { AppTheme } from '../theme'

type Phase = 'loading' | 'intro' | 'mcq' | 'summary' | 'empty'

type QuizFetchStatus = 'idle' | 'pending' | 'ready' | 'error'

function bucketRank(b: LearningBucket): number {
  if (b === 'new') return 0
  if (b === 'learning') return 1
  if (b === 'familiar') return 2
  return 3
}

/** 6-digit hex → rgba for translucent fills/banners */
function bucketDeltaText(before: number, after: number): string {
  const d = after - before
  if (d === 0) return '±0'
  return d > 0 ? `+${d}` : `${d}`
}

function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function McqStepMobile({
  theme,
  question,
  quizSub,
  quizPicked,
  finishing,
  onQuizPick,
  onQuizContinue,
}: {
  theme: AppTheme
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

  const bannerTint = 0.175
  const rowTint = 0.2

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: theme.text, fontSize: 17, lineHeight: 24 }}>{question.questionText}</Text>

      {reviewing ? (
        <View
          accessibilityLiveRegion="polite"
          accessibilityLabel={pickedOk ? 'Correct' : 'Not quite'}
          style={{
            minHeight: 52,
            borderRadius: 12,
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: pickedOk ? hexAlpha(theme.success, bannerTint) : hexAlpha(theme.danger, bannerTint),
          }}
        >
          <MaterialIcons
            name={pickedOk ? 'check' : 'close'}
            size={28}
            color={pickedOk ? theme.success : theme.danger}
          />
          <Text
            style={{
              fontSize: 19,
              fontWeight: '800',
              color: pickedOk ? theme.success : theme.danger,
            }}
          >
            {pickedOk ? 'Correct' : 'Not quite'}
          </Text>
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        {question.options.map((opt, i) => {
          const isCorrectRow = i === correctIdx
          const isWrongPicked = reviewing && quizPicked === i && i !== correctIdx

          const baseRow: ViewStyle = {
            paddingVertical: 14,
            paddingHorizontal: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surface,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }

          let rowStyle: ViewStyle = baseRow
          let showCheck = false
          let showClose = false

          if (reviewing) {
            if (isCorrectRow) {
              rowStyle = {
                ...baseRow,
                backgroundColor: hexAlpha(theme.success, rowTint),
                borderColor: theme.success,
              }
              showCheck = true
            } else if (isWrongPicked) {
              rowStyle = {
                ...baseRow,
                backgroundColor: hexAlpha(theme.danger, rowTint),
                borderColor: theme.danger,
              }
              showClose = true
            } else {
              rowStyle = {
                ...baseRow,
                borderColor: 'transparent',
                opacity: 0.6,
              }
            }
          }

          return (
            <Pressable
              key={i}
              onPress={() => onQuizPick(i)}
              disabled={reviewing}
              accessibilityState={{ disabled: reviewing }}
              style={rowStyle}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 15 }}>{opt}</Text>
              </View>
              {reviewing && showCheck ? (
                <MaterialIcons name="check" size={20} color={theme.success} />
              ) : reviewing && showClose ? (
                <MaterialIcons name="close" size={20} color={theme.danger} />
              ) : null}
            </Pressable>
          )
        })}
      </View>

      {reviewing ? (
        <>
          <Text style={{ color: theme.muted, fontSize: 14 }}>{question.explanation}</Text>
          <PrimaryButton
            theme={theme}
            label={finishing ? 'Saving…' : 'Next'}
            onPress={onQuizContinue}
            disabled={finishing}
          />
        </>
      ) : null}
    </View>
  )
}

export function SessionScreen({
  theme,
  mainLanguage,
  onClose,
  onCompleted,
  onRequestNewSession,
}: {
  theme: AppTheme
  mainLanguage: string
  onClose: () => void
  onCompleted: () => void
  /** Same entry path as Today → Start session; parent remounts session when returning true from start flow. */
  onRequestNewSession?: () => void | Promise<void>
}) {
  const insets = useSafeAreaInsets()
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
  const stepAnim = useRef(new Animated.Value(1)).current

  const [deckBefore, setDeckBefore] = useState<DeckBucketCounts | null>(null)
  const [deckAfter, setDeckAfter] = useState<DeckBucketCounts | null>(null)
  const [streakAtSessionStart, setStreakAtSessionStart] = useState<number | null>(null)
  const [postSessionVocabItems, setPostSessionVocabItems] = useState<VocabItem[] | null>(null)
  const [sessionTimezone, setSessionTimezone] = useState(DEFAULT_TIMEZONE)
  const [summaryFlashOpen, setSummaryFlashOpen] = useState(false)
  const [summaryFlashIndex, setSummaryFlashIndex] = useState(0)

  const [quizFetchStatus, setQuizFetchStatus] = useState<QuizFetchStatus>('idle')
  const [quizFetchError, setQuizFetchError] = useState<string | null>(null)
  const [compositionPreview, setCompositionPreview] = useState('')
  const quizFetchGenRef = useRef(0)

  const batchSize = batch.length
  const currentIntroId = introIds[introIndex]
  const currentIntroWord = currentIntroId ? itemsById.get(currentIntroId) : undefined
  const currentQuizQ = mcqQuestions[quizIdx]
  const stepKey = `${phase}-${introIndex}-${quizIdx}-${quizSub}-${quizFetchStatus}`

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
    let cancelled = false
    ;(async () => {
      setInitError(null)
      setVocabLoading(true)
      try {
        const all = await listVocabItems()
        if (cancelled) return
        const profile = await ensureUserProfileDefaults()
        const tz = profile.timezone || DEFAULT_TIMEZONE
        const pick = pickSessionBatchTen(all, { nowMs: Date.now(), userTimezone: tz })
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
        if (!cancelled) setInitError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setVocabLoading(false)
      }
    })()
    return () => {
      cancelled = true
      quizFetchGenRef.current += 1
    }
  }, [runQuizFetchForBatch])

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

  const onIntroGotIt = useCallback(async () => {
    const w = currentIntroWord
    if (!w || introSubmitting) return
    setIntroSubmitting(true)
    try {
      await markWordIntroduced(w.id)
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
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
  }, [currentIntroWord, introIds.length, introIndex, introSubmitting])

  useEffect(() => {
    stepAnim.setValue(0)
    Animated.timing(stepAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [stepKey, stepAnim])

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
      pickSessionBatchTen(postSessionVocabItems, {
        nowMs: Date.now(),
        userTimezone: sessionTimezone,
      }).ids.length > 0
    )
  }, [postSessionVocabItems, sessionTimezone])

  const streakIncreased =
    streakAfter != null && streakAtSessionStart != null && streakAfter > streakAtSessionStart

  if (vocabLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.learnScreenBg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
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
      <View style={{ flex: 1, backgroundColor: theme.learnScreenBg, padding: 16 }}>
        <Text style={{ color: theme.danger }}>{initError}</Text>
        <View style={{ marginTop: 16 }}>
          <PrimaryButton theme={theme} label="Close" onPress={onClose} />
        </View>
      </View>
    )
  }

  if (phase === 'empty') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.learnScreenBg, padding: 16 }}>
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800' }}>Not enough words</Text>
        <Text style={{ color: theme.muted, marginTop: 8 }}>Save a few learning words first.</Text>
        <View style={{ marginTop: 20 }}>
          <PrimaryButton theme={theme} label="Back" onPress={onClose} />
        </View>
      </View>
    )
  }

  const headerCenter =
    phase === 'summary'
      ? 'Done'
      : phase === 'intro' && introIds.length > 0
        ? `${introIndex + 1} / ${introIds.length}`
        : phase === 'mcq' && quizFetchStatus === 'ready' && mcqQuestions.length > 0
          ? `${quizIdx + 1} / ${mcqQuestions.length}`
          : phase === 'mcq'
            ? 'Quiz'
            : ''

  return (
    <View style={{ flex: 1, backgroundColor: theme.learnScreenBg }}>
      <View
        style={{
          paddingHorizontal: 14,
          paddingTop: Math.max(insets.top, 10),
          paddingBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Pressable
          onPress={onClose}
          hitSlop={10}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
          accessibilityRole="button"
          accessibilityLabel="Exit session"
        >
          <MaterialIcons name="close" size={20} color={theme.primary} />
          <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 15 }}>Exit</Text>
        </Pressable>
        <Text style={{ color: theme.muted, fontWeight: '800', fontSize: 13 }}>{headerCenter}</Text>
        <View style={{ width: 56 }} />
      </View>

      {phase === 'intro' && currentIntroWord ? (
        <Animated.View
          style={{
            flex: 1,
            paddingHorizontal: 16,
            paddingBottom: 16,
            opacity: stepAnim,
            transform: [{ translateY: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          }}
        >
          {initError ? <Text style={{ color: theme.danger, marginBottom: 8 }}>{initError}</Text> : null}
          <IntroCardMobile
            theme={theme}
            word={currentIntroWord}
            newWordCurrent={introIndex + 1}
            newWordTotal={introIds.length}
            onGotIt={() => void onIntroGotIt()}
            busy={introSubmitting}
          />
        </Animated.View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {initError ? <Text style={{ color: theme.danger, marginBottom: 8 }}>{initError}</Text> : null}

          {phase === 'mcq' ? (
            <Animated.View style={{ gap: 12, opacity: stepAnim, transform: [{ translateY: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
              <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '700' }}>QUIZ</Text>
              {quizFetchStatus === 'pending' ? (
                <View style={{ gap: 12, paddingVertical: 8 }}>
                  <Text style={{ color: theme.text, fontSize: 17, fontWeight: '800' }}>
                    Preparing your {batchSize} words
                  </Text>
                  <Text style={{ color: theme.muted, fontSize: 15, lineHeight: 22 }}>{compositionPreview}</Text>
                  <ActivityIndicator style={{ marginTop: 8 }} color={theme.primary} />
                  <Text style={{ color: theme.muted, fontSize: 14 }}>Building your quiz…</Text>
                </View>
              ) : quizFetchStatus === 'error' ? (
                <View style={{ gap: 12 }}>
                  <Text style={{ color: theme.danger, fontSize: 15 }}>{quizFetchError ?? 'Quiz could not be loaded.'}</Text>
                  <PrimaryButton theme={theme} label="Retry" onPress={retryQuizFetch} />
                </View>
              ) : quizFetchStatus === 'ready' && currentQuizQ ? (
                <McqStepMobile
                  theme={theme}
                  question={currentQuizQ}
                  quizSub={quizSub}
                  quizPicked={quizPicked}
                  finishing={finishing}
                  onQuizPick={onQuizPick}
                  onQuizContinue={() => void onQuizContinue()}
                />
              ) : quizFetchStatus === 'ready' ? (
                <Text style={{ color: theme.muted }}>No quiz questions.</Text>
              ) : null}
            </Animated.View>
          ) : null}

          {phase === 'summary' ? (
            <View style={{ gap: 20 }}>
              <Text style={{ color: theme.text, fontSize: 24, fontWeight: '800' }}>Session complete</Text>

              {deckBefore && deckAfter ? (
                <View style={{ gap: 12 }}>
                  <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700' }}>Your deck</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
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
                        delta > 0 ? theme.success : delta < 0 ? theme.danger : theme.muted
                      return (
                        <View
                          key={label}
                          style={{
                            flexGrow: 1,
                            flexBasis: '44%',
                            minWidth: 140,
                            padding: 12,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: theme.border,
                            backgroundColor: theme.surface,
                          }}
                        >
                          <Text style={{ color: theme.muted, fontSize: 11, fontWeight: '700', marginBottom: 8 }}>{label}</Text>
                          <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                            <Text style={{ fontVariant: ['tabular-nums'] }}>{before}</Text>
                            <Text style={{ color: theme.muted }}> → </Text>
                            <Text style={{ fontVariant: ['tabular-nums'] }}>{after}</Text>
                          </Text>
                          <Text style={{ color: deltaColor, fontSize: 13, fontWeight: '700', marginTop: 6, fontVariant: ['tabular-nums'] }}>
                            {bucketDeltaText(before, after)}
                          </Text>
                        </View>
                      )
                    })}
                  </View>
                </View>
              ) : null}

              <View style={{ gap: 8 }}>
                <Text style={{ color: theme.text, fontSize: 15, fontWeight: '800' }}>
                  {movedUpWords.length > 0
                    ? `${movedUpWords.length} word${movedUpWords.length === 1 ? '' : 's'} moved up`
                    : 'Promotions'}
                </Text>
                {movedUpWords.length === 0 ? (
                  <Text style={{ color: theme.muted, fontSize: 14, lineHeight: 20 }}>
                    No promotions this session — keep practicing.
                  </Text>
                ) : (
                  <View style={{ gap: 6 }}>
                    {movedUpWords.map((w, idx) => (
                      <Pressable
                        key={w.id}
                        onPress={() => {
                          setSummaryFlashIndex(idx)
                          setSummaryFlashOpen(true)
                        }}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: theme.border,
                          backgroundColor: theme.surface,
                        }}
                      >
                        <Text style={{ color: theme.primary, fontSize: 16, fontWeight: '700' }}>{w.text}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              {finishError ? <Text style={{ color: theme.danger }}>{finishError}</Text> : null}

              {streakIncreased && streakAfter !== null ? (
                <View
                  style={{
                    alignSelf: 'flex-start',
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: hexAlpha(theme.primary, 0.15),
                  }}
                >
                  <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                    Streak: {streakAfter} days
                  </Text>
                </View>
              ) : null}

              <View style={{ gap: 10, marginTop: 8 }}>
                <PrimaryButton theme={theme} label="Back to Today" onPress={onClose} />
                {canStartAnotherSession && onRequestNewSession ? (
                  <Pressable
                    onPress={() => void onRequestNewSession()}
                    style={{
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 999,
                      borderWidth: 2,
                      borderColor: theme.primary,
                    }}
                  >
                    <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 16 }}>Start another session</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}

      <LearnFlashcardModal
        visible={summaryFlashOpen}
        onClose={() => setSummaryFlashOpen(false)}
        items={movedUpWords}
        initialIndex={summaryFlashIndex}
        mainLanguage={mainLanguage}
        theme={theme}
      />
    </View>
  )
}

function IntroCardMobile({
  theme,
  word,
  newWordCurrent,
  newWordTotal,
  onGotIt,
  busy,
}: {
  theme: AppTheme
  word: VocabItem
  /** 1-based index among new-word intros */
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

  const pillTextColor = '#ffffff'

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flexShrink: 1 }}>
          <View
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: 6,
              paddingVertical: 3,
              borderRadius: 6,
              backgroundColor: theme.primary,
            }}
          >
            <Text
              style={{
                color: pillTextColor,
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 0.75,
                textTransform: 'uppercase',
              }}
            >
              NEW WORD
            </Text>
          </View>
        </View>
        {showProgress ? (
          <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600', textAlign: 'right', marginTop: 2 }}>
            New word {newWordCurrent} of {newWordTotal}
          </Text>
        ) : null}
      </View>

      <Text
        style={{
          color: theme.muted,
          fontSize: 13,
          lineHeight: 18,
          marginTop: 10,
          marginBottom: 22,
        }}
      >
        First time learning this — no test yet
      </Text>

      <Text style={{ color: theme.text, fontSize: 34, fontWeight: '800', lineHeight: 40, marginBottom: 20 }}>
        {word.text}
      </Text>

      <View style={{ gap: 18 }}>
        {def ? (
          <View style={{ gap: 6 }}>
            <Text style={{ color: theme.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 }}>DEFINITION</Text>
            <Text style={{ color: theme.text, fontSize: 15, lineHeight: 22 }}>{def}</Text>
          </View>
        ) : null}
        {simple && simple !== def ? (
          <View style={{ gap: 6 }}>
            <Text style={{ color: theme.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 }}>SIMPLE</Text>
            <Text style={{ color: theme.text, fontSize: 15, lineHeight: 22 }}>{simple}</Text>
          </View>
        ) : null}
        {hook ? (
          <View style={{ gap: 6 }}>
            <Text style={{ color: theme.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 }}>MEMORY HOOK</Text>
            <Text style={{ color: theme.text, fontSize: 15, lineHeight: 22 }}>{hook}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ marginTop: 20 }}>
        <PrimaryButton theme={theme} label={busy ? 'Saving…' : 'Got it'} onPress={onGotIt} disabled={busy} />
      </View>
    </ScrollView>
  )
}
