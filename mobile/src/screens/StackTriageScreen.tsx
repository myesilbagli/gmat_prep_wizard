import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type TextStyle,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FREE_MAX_SAVED_WORDS } from '@shared/freemium'
import type { VocabItem } from '@shared/types'
import { isKnownWord } from '@shared/wordTags'
import { getStackImportResult, getWordsForStack } from '@shared/wordStackContent'
import { useGlassFonts } from '../components/GlassUi'
import { PrimaryButton } from '../components/UI'
import { useSubscription } from '../context/SubscriptionContext'
import { saveWordFromStackImport } from '../lib/words'
import { deleteVocabItem } from '../lib/vocab'
import { radius, spacing, typography, type AppTheme } from '../theme'

/**
 * theme.primary at ~30% opacity — text-shadow can't read theme tokens at compose
 * time. Keep in sync with `theme.primary` if the brand color shifts.
 */
const WORD_GLOW_COLOR = 'rgba(107, 91, 255, 0.3)'

type Decision = { word: string; wordId: string; known: boolean }

type Phase = 'card' | 'summary' | 'empty' | 'paywall'

const SLIDE_DURATION_MS = 200
const FADE_DURATION_MS = 200
const SUMMARY_FADE_DURATION_MS = 250

export function StackTriageScreen({
  theme,
  stackId,
  mainLanguage,
  items,
  onClose,
  onReload,
  onSwitchToTodayTab,
}: {
  theme: AppTheme
  stackId: string
  mainLanguage: string
  items: VocabItem[]
  onClose: () => void
  onReload: () => Promise<void>
  onSwitchToTodayTab: () => void
}) {
  const insets = useSafeAreaInsets()
  const { width: screenWidth } = useWindowDimensions()
  const { loaded: fontsLoaded, fontSerif, fontBody, fontLabelBold } = useGlassFonts()
  const { isPro, openPaywall } = useSubscription()

  // ---------------------------------------------------------------------------
  // Snapshot at mount (lock-in #2): allWords / inDeckSet / undecidedWords are
  // captured ONCE when the screen mounts. Live `items` prop changes do NOT
  // recompute these — re-mount (exit + re-enter) is the only way to refresh.
  // This eliminates a race between `void onReload()` after each save and the
  // resumption logic that would otherwise reclassify just-saved words mid-flow.
  // ---------------------------------------------------------------------------
  const snapshot = useMemo(() => {
    const all = getWordsForStack(stackId)
    const inDeck = new Set<string>()
    for (const it of items) {
      const key = (it.textLower ?? it.text).trim().toLowerCase()
      if (key) inDeck.add(key)
    }
    const undecided = all.filter((w) => !inDeck.has(w.trim().toLowerCase()))
    const initialDone = all.length - undecided.length
    return { allWords: all, undecidedWords: undecided, initialDone, mountItems: items }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { allWords, undecidedWords, initialDone, mountItems } = snapshot

  const initialPhase: Phase =
    allWords.length === 0 ? 'empty' : undecidedWords.length === 0 ? 'summary' : 'card'

  const [phase, setPhase] = useState<Phase>(initialPhase)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [pendingUndo, setPendingUndo] = useState<Decision | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastAttempt, setLastAttempt] = useState<{ known: boolean } | null>(null)

  const slideX = useRef(new Animated.Value(0)).current
  const cardOpacity = useRef(new Animated.Value(0)).current
  const summaryOpacity = useRef(new Animated.Value(initialPhase === 'summary' ? 0 : 0)).current

  // Mount fade-in for whichever phase we entered.
  useEffect(() => {
    const target = initialPhase === 'summary' ? summaryOpacity : cardOpacity
    Animated.timing(target, {
      toValue: 1,
      duration: FADE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When the card phase exhausts undecidedWords, fade card out and summary in.
  useEffect(() => {
    if (phase !== 'card' || currentIndex < undecidedWords.length) return
    Animated.timing(cardOpacity, {
      toValue: 0,
      duration: FADE_DURATION_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setPhase('summary')
      summaryOpacity.setValue(0)
      Animated.timing(summaryOpacity, {
        toValue: 1,
        duration: SUMMARY_FADE_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start()
    })
  }, [phase, currentIndex, undecidedWords.length, cardOpacity, summaryOpacity])

  // If user upgrades from inside paywall phase, return to the card.
  useEffect(() => {
    if (phase === 'paywall' && isPro) {
      setPhase('card')
      cardOpacity.setValue(1)
    }
  }, [isPro, phase, cardOpacity])

  // ---------------------------------------------------------------------------
  // Derived display state
  // ---------------------------------------------------------------------------

  const segmentsDone = initialDone + decisions.length
  const totalSegments = allWords.length
  const displayedIndex = phase === 'card' ? Math.min(segmentsDone + 1, totalSegments) : totalSegments

  const currentWord = phase === 'card' ? undecidedWords[currentIndex] : null
  const currentStackPosition = currentWord
    ? Math.max(0, allWords.indexOf(currentWord))
    : 0
  const currentResult = useMemo(() => {
    if (!currentWord) return null
    return getStackImportResult(stackId, currentStackPosition, mainLanguage)
  }, [currentWord, currentStackPosition, stackId, mainLanguage])

  const partOfSpeech =
    typeof currentResult?.partOfSpeech === 'string' ? currentResult.partOfSpeech.trim() : ''
  const simpleDefinition =
    typeof currentResult?.simpleDefinition === 'string'
      ? currentResult.simpleDefinition.trim()
      : ''

  // ---------------------------------------------------------------------------
  // Decision flow
  // ---------------------------------------------------------------------------

  const animateSlideForward = useCallback(
    (after: () => void) => {
      Animated.timing(slideX, {
        toValue: -screenWidth,
        duration: SLIDE_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        after()
        slideX.setValue(screenWidth)
        Animated.timing(slideX, {
          toValue: 0,
          duration: SLIDE_DURATION_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          setIsAnimating(false)
        })
      })
    },
    [screenWidth, slideX],
  )

  const animateSlideBack = useCallback(
    (after: () => void) => {
      Animated.timing(slideX, {
        toValue: screenWidth,
        duration: SLIDE_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        after()
        slideX.setValue(-screenWidth)
        Animated.timing(slideX, {
          toValue: 0,
          duration: SLIDE_DURATION_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          setIsAnimating(false)
        })
      })
    },
    [screenWidth, slideX],
  )

  const onDecide = useCallback(
    async (known: boolean) => {
      if (isAnimating || phase !== 'card' || !currentWord) return
      setSaveError(null)
      setLastAttempt({ known })

      // Free-tier paywall pre-check. Snapshot deck size + this session's saves.
      if (!isPro && mountItems.length + decisions.length >= FREE_MAX_SAVED_WORDS) {
        openPaywall()
        setPhase('paywall')
        return
      }

      setIsAnimating(true)
      try {
        const { id } = await saveWordFromStackImport({
          text: currentWord,
          mainLanguage,
          stackId,
          stackPosition: currentStackPosition,
          markKnown: known,
        })
        const decision: Decision = { word: currentWord, wordId: id, known }
        animateSlideForward(() => {
          setDecisions((prev) => [...prev, decision])
          setPendingUndo(decision)
          setCurrentIndex((i) => i + 1)
        })
        void onReload().catch(() => {})
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Couldn't save. Try again.")
        setIsAnimating(false)
      }
    },
    [
      isAnimating,
      phase,
      currentWord,
      isPro,
      mountItems.length,
      decisions.length,
      openPaywall,
      mainLanguage,
      stackId,
      currentStackPosition,
      animateSlideForward,
      onReload,
    ],
  )

  const onUndoLast = useCallback(async () => {
    if (isAnimating || pendingUndo == null) return
    setSaveError(null)
    setIsAnimating(true)
    try {
      await deleteVocabItem(pendingUndo.wordId)
      animateSlideBack(() => {
        setDecisions((prev) => prev.slice(0, -1))
        setCurrentIndex((i) => Math.max(0, i - 1))
        setPendingUndo(null)
      })
      void onReload().catch(() => {})
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't undo. Try again.")
      setIsAnimating(false)
    }
  }, [isAnimating, pendingUndo, animateSlideBack, onReload])

  const onRetry = useCallback(() => {
    if (lastAttempt) void onDecide(lastAttempt.known)
  }, [lastAttempt, onDecide])

  // ---------------------------------------------------------------------------
  // Summary counts (stack-scoped). Snapshot items + this session's decisions.
  // ---------------------------------------------------------------------------

  const summary = useMemo(() => {
    const lowercaseStack = new Set(allWords.map((w) => w.trim().toLowerCase()))
    let knownExisting = 0
    let studyExisting = 0
    for (const it of mountItems) {
      const key = (it.textLower ?? it.text).trim().toLowerCase()
      if (!lowercaseStack.has(key)) continue
      if (isKnownWord(it)) knownExisting += 1
      else studyExisting += 1
    }
    const knownThisSession = decisions.filter((d) => d.known).length
    const studyThisSession = decisions.filter((d) => !d.known).length
    return {
      study: studyExisting + studyThisSession,
      known: knownExisting + knownThisSession,
    }
  }, [allWords, mountItems, decisions])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const wordStyle: TextStyle = {
    fontFamily: fontSerif,
    fontSize: 48,
    fontWeight: '700',
    lineHeight: 56,
    letterSpacing: -0.5,
    color: theme.textPrimary,
    textAlign: 'center',
    textShadowColor: WORD_GLOW_COLOR,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  }

  const showProgress = phase === 'card' && totalSegments > 0

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top }}>
        <View
          style={{
            height: 48,
            paddingHorizontal: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.border,
          }}
        >
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close triage"
          >
            <MaterialIcons name="close" size={22} color={theme.primary} />
          </Pressable>

          {showProgress ? (
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 2,
              }}
            >
              {Array.from({ length: totalSegments }).map((_, i) => {
                const isDone = i < segmentsDone
                const isCurrent = i === segmentsDone
                return (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: 2,
                      borderRadius: radius.full,
                      backgroundColor: isDone
                        ? theme.primary
                        : isCurrent
                          ? theme.primary
                          : theme.border,
                      opacity: isDone ? 1 : isCurrent ? 0.6 : 1,
                    }}
                  />
                )
              })}
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          {showProgress ? (
            <Text
              style={{
                ...typography.label,
                fontWeight: '600',
                color: theme.textSecondary,
              }}
            >
              {displayedIndex} / {totalSegments}
            </Text>
          ) : (
            <View style={{ width: 22 }} />
          )}
        </View>
      </View>

      {/* Phase content */}
      {phase === 'card' ? (
        <Animated.View
          style={{
            flex: 1,
            opacity: cardOpacity,
            transform: [{ translateX: slideX }],
          }}
        >
          {!fontsLoaded ? (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <View style={{ flex: 1, paddingHorizontal: spacing.lg }}>
              <View
                style={{
                  marginTop: spacing['4xl'],
                  alignItems: 'center',
                }}
              >
                <Text style={wordStyle} numberOfLines={2} adjustsFontSizeToFit>
                  {currentWord ?? ''}
                </Text>
                {partOfSpeech ? (
                  <Text
                    style={{
                      ...typography.caption,
                      ...(fontLabelBold ? { fontFamily: fontLabelBold } : {}),
                      color: theme.textMuted,
                      marginTop: spacing.sm,
                    }}
                  >
                    {partOfSpeech.toUpperCase()}
                  </Text>
                ) : null}
              </View>

              <View
                style={{
                  marginTop: spacing['3xl'],
                  backgroundColor: theme.bgElevated,
                  borderColor: theme.border,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  padding: spacing.lg,
                }}
              >
                <Text
                  style={{
                    ...typography.body,
                    ...(fontBody ? { fontFamily: fontBody } : {}),
                    fontSize: 16,
                    lineHeight: 24,
                    color: theme.textSecondary,
                    textAlign: 'center',
                  }}
                >
                  {simpleDefinition || '—'}
                </Text>
              </View>

              {/* Spacer pushes action area to the bottom */}
              <View style={{ flex: 1 }} />

              {saveError ? (
                <View style={{ marginBottom: spacing.md, alignItems: 'center' }}>
                  <Text
                    style={{
                      ...typography.caption,
                      ...(fontLabelBold ? { fontFamily: fontLabelBold } : {}),
                      color: theme.danger,
                      textAlign: 'center',
                      letterSpacing: 0.4,
                    }}
                  >
                    {saveError}
                  </Text>
                  <Pressable
                    onPress={onRetry}
                    hitSlop={8}
                    style={{ marginTop: spacing.xs }}
                    accessibilityRole="button"
                    accessibilityLabel="Retry saving"
                  >
                    <Text
                      style={{
                        ...typography.label,
                        fontWeight: '600',
                        color: theme.primary,
                      }}
                    >
                      Retry
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <View
                style={{
                  flexDirection: 'row',
                  gap: spacing.md,
                  marginBottom: pendingUndo ? spacing.lg : spacing['4xl'],
                }}
              >
                <Pressable
                  onPress={() => void onDecide(true)}
                  disabled={isAnimating}
                  accessibilityRole="button"
                  accessibilityLabel="I know this word"
                  style={{
                    flex: 1,
                    paddingVertical: spacing.lg,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: theme.borderStrong,
                    backgroundColor: 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isAnimating ? 0.6 : 1,
                  }}
                >
                  <Text
                    style={{
                      ...typography.bodyEmphasis,
                      ...(fontLabelBold ? { fontFamily: fontLabelBold } : {}),
                      color: theme.textPrimary,
                    }}
                  >
                    I know it
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => void onDecide(false)}
                  disabled={isAnimating}
                  accessibilityRole="button"
                  accessibilityLabel="Add this word to my study deck"
                  style={{
                    flex: 1,
                    paddingVertical: spacing.lg,
                    borderRadius: radius.md,
                    backgroundColor: theme.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isAnimating ? 0.6 : 1,
                  }}
                >
                  <Text
                    style={{
                      ...typography.bodyEmphasis,
                      ...(fontLabelBold ? { fontFamily: fontLabelBold } : {}),
                      color: '#FFFFFF',
                    }}
                  >
                    Study it
                  </Text>
                </Pressable>
              </View>

              {pendingUndo ? (
                <View style={{ alignItems: 'center', marginBottom: spacing['4xl'] }}>
                  <Pressable
                    onPress={() => void onUndoLast()}
                    disabled={isAnimating}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Undo last decision"
                  >
                    <Text
                      style={{
                        ...typography.label,
                        fontWeight: '500',
                        color: theme.textMuted,
                        opacity: isAnimating ? 0.6 : 1,
                      }}
                    >
                      Undo last
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          )}
        </Animated.View>
      ) : null}

      {phase === 'summary' ? (
        <Animated.View
          style={{
            flex: 1,
            opacity: summaryOpacity,
            paddingHorizontal: spacing.lg,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              ...typography.title,
              ...(fontLabelBold ? { fontFamily: fontLabelBold } : {}),
              color: theme.textPrimary,
              textAlign: 'center',
              marginBottom: spacing['3xl'],
            }}
          >
            You&apos;re all set.
          </Text>

          <View style={{ flexDirection: 'row', gap: spacing['3xl'], marginBottom: spacing['4xl'] }}>
            <SummaryStat
              theme={theme}
              fontHeadline={fontLabelBold}
              fontLabel={fontLabelBold}
              count={summary.study}
              label="In study deck"
            />
            <SummaryStat
              theme={theme}
              fontHeadline={fontLabelBold}
              fontLabel={fontLabelBold}
              count={summary.known}
              label="Marked as known"
            />
          </View>

          <View style={{ alignSelf: 'stretch', gap: spacing.md }}>
            <PrimaryButton
              theme={theme}
              label="Start studying"
              onPress={() => {
                onSwitchToTodayTab()
              }}
            />
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={{ alignItems: 'center', paddingVertical: spacing.md }}
              accessibilityRole="button"
              accessibilityLabel="Back to stacks"
            >
              <Text
                style={{
                  ...typography.label,
                  fontWeight: '600',
                  color: theme.primary,
                }}
              >
                Back to stacks
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      {phase === 'paywall' ? (
        <View
          style={{
            flex: 1,
            paddingHorizontal: spacing.lg,
            justifyContent: 'center',
            alignItems: 'center',
            gap: spacing.lg,
          }}
        >
          <Text
            style={{
              ...typography.title,
              ...(fontLabelBold ? { fontFamily: fontLabelBold } : {}),
              color: theme.textPrimary,
              textAlign: 'center',
            }}
          >
            Free tier limit reached.
          </Text>
          <Text
            style={{
              ...typography.body,
              ...(fontBody ? { fontFamily: fontBody } : {}),
              color: theme.textSecondary,
              textAlign: 'center',
              marginBottom: spacing.lg,
            }}
          >
            Upgrade to Pro to keep triaging and saving words from this stack.
          </Text>
          <View style={{ alignSelf: 'stretch', gap: spacing.md }}>
            <PrimaryButton theme={theme} label="Upgrade" onPress={() => openPaywall()} />
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={{ alignItems: 'center', paddingVertical: spacing.md }}
              accessibilityRole="button"
              accessibilityLabel="Back to stacks"
            >
              <Text
                style={{
                  ...typography.label,
                  fontWeight: '600',
                  color: theme.primary,
                }}
              >
                Back to stacks
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {phase === 'empty' ? (
        <View
          style={{
            flex: 1,
            paddingHorizontal: spacing.lg,
            justifyContent: 'center',
            alignItems: 'center',
            gap: spacing.lg,
          }}
        >
          <Text
            style={{
              ...typography.title,
              ...(fontLabelBold ? { fontFamily: fontLabelBold } : {}),
              color: theme.textPrimary,
              textAlign: 'center',
            }}
          >
            This stack is empty.
          </Text>
          <View style={{ alignSelf: 'stretch' }}>
            <PrimaryButton theme={theme} label="Back to stacks" onPress={onClose} />
          </View>
        </View>
      ) : null}
    </View>
  )
}

function SummaryStat({
  theme,
  fontHeadline,
  fontLabel,
  count,
  label,
}: {
  theme: AppTheme
  fontHeadline?: string
  fontLabel?: string
  count: number
  label: string
}) {
  return (
    <View style={{ alignItems: 'center', gap: spacing.xs }}>
      <Text
        style={{
          ...typography.display,
          ...(fontHeadline ? { fontFamily: fontHeadline } : {}),
          color: theme.textPrimary,
        }}
      >
        {count}
      </Text>
      <Text
        style={{
          ...typography.caption,
          ...(fontLabel ? { fontFamily: fontLabel } : {}),
          color: theme.textMuted,
          textAlign: 'center',
          letterSpacing: 0.6,
        }}
      >
        {label}
      </Text>
    </View>
  )
}
