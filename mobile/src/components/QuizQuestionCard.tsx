import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import type { QuizQuestion, VocabItem } from '@shared/types'
import { BucketPill } from './BucketPill'
import { PrimaryButton } from './UI'
import { useGlassFonts } from './GlassUi'
import { radius, spacing, typography, type AppTheme } from '../theme'
import type { BucketRole } from '../theme/bucketColors'

/**
 * theme.primary at 30% opacity, slightly softer than the SessionIntroCard hero
 * because the subject word here is half the size. Inline because RN text-shadow
 * style values are evaluated at compose time and cannot read theme tokens.
 */
const SUBJECT_GLOW_COLOR = 'rgba(107, 91, 255, 0.3)'

const LETTER_CHIP_SIZE = 28

function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

type AnswerOptionState =
  | 'default'
  | 'selected-correct'
  | 'selected-wrong'
  | 'shown-correct'
  | 'dimmed'

function AnswerOption({
  theme,
  fontBody,
  fontLabelBold,
  letter,
  text,
  state,
  onPress,
}: {
  theme: AppTheme
  fontBody?: string
  fontLabelBold?: string
  letter: string
  text: string
  state: AnswerOptionState
  onPress: () => void
}) {
  const baseRow: ViewStyle = {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bgElevated,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  }

  let rowStyle: ViewStyle = baseRow
  let chipBg: string = theme.bgSubtle
  let chipText: string = theme.textSecondary
  let chipIcon: 'check' | 'close' | null = null
  let chipIconColor: string = theme.textSecondary

  if (state === 'selected-correct' || state === 'shown-correct') {
    rowStyle = {
      ...baseRow,
      backgroundColor: hexAlpha(theme.success, 0.08),
      borderColor: theme.success,
      borderWidth: 2,
    }
    chipBg = theme.success
    chipText = '#FFFFFF'
    chipIcon = 'check'
    chipIconColor = '#FFFFFF'
  } else if (state === 'selected-wrong') {
    rowStyle = {
      ...baseRow,
      backgroundColor: hexAlpha(theme.danger, 0.08),
      borderColor: theme.danger,
      borderWidth: 2,
    }
    chipBg = theme.danger
    chipText = '#FFFFFF'
    chipIcon = 'close'
    chipIconColor = '#FFFFFF'
  } else if (state === 'dimmed') {
    rowStyle = { ...baseRow, opacity: 0.4 }
  }

  const disabled = state !== 'default'

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={`Option ${letter}: ${text}`}
      style={rowStyle}
    >
      <View
        style={{
          width: LETTER_CHIP_SIZE,
          height: LETTER_CHIP_SIZE,
          borderRadius: radius.full,
          backgroundColor: chipBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {chipIcon ? (
          <MaterialIcons name={chipIcon} size={16} color={chipIconColor} />
        ) : (
          <Text
            style={{
              ...typography.label,
              ...(fontLabelBold ? { fontFamily: fontLabelBold } : {}),
              fontWeight: '600',
              color: chipText,
            }}
          >
            {letter}
          </Text>
        )}
      </View>
      <Text
        style={{
          ...typography.body,
          ...(fontBody ? { fontFamily: fontBody } : {}),
          color: theme.textPrimary,
          flex: 1,
        }}
      >
        {text}
      </Text>
    </Pressable>
  )
}

function ExampleRow({
  theme,
  fontBody,
  text,
}: {
  theme: AppTheme
  fontBody?: string
  text: string
}) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' }}>
      <View
        style={{
          width: 2,
          alignSelf: 'stretch',
          backgroundColor: theme.borderStrong,
          borderRadius: radius.full,
        }}
      />
      <Text
        style={{
          ...typography.body,
          ...(fontBody ? { fontFamily: fontBody } : {}),
          color: theme.textSecondary,
          fontStyle: 'italic',
          flex: 1,
        }}
      >
        {`"${text}"`}
      </Text>
    </View>
  )
}

export function QuizQuestionCard({
  theme,
  question,
  word,
  bucketRole,
  onAnswer,
  onContinue,
  continueLabel,
  busy,
}: {
  theme: AppTheme
  question: QuizQuestion
  word: VocabItem
  bucketRole: BucketRole
  onAnswer: (selectedIndex: number, isCorrect: boolean) => void
  onContinue: () => void
  /** Override Continue label (default "Continue"). */
  continueLabel?: string
  /** When true, disables Continue and shows "Saving…". */
  busy?: boolean
}) {
  const { loaded, fontSerif, fontBody, fontLabelBold } = useGlassFonts()
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const revealAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    setSelectedIndex(null)
    setRevealed(false)
    revealAnim.setValue(0)
  }, [question.itemId, revealAnim])

  useEffect(() => {
    if (!revealed) return
    Animated.timing(revealAnim, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start()
  }, [revealed, revealAnim])

  const briefExample = (() => {
    const fromList = (Array.isArray(word.examples) ? word.examples : [])
      .map((e) => String(e).trim())
      .filter((s) => s.length > 0)
      .sort((a, b) => a.length - b.length)
    return fromList[0] ?? (word.exampleSentence?.trim() || '')
  })()
  const hasExample = briefExample.length > 0

  if (!loaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: spacing['3xl'],
        }}
      >
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    )
  }

  const subjectWordStyle: TextStyle = {
    fontFamily: fontSerif,
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    letterSpacing: -0.5,
    color: theme.textPrimary,
    textAlign: 'center',
    textShadowColor: SUBJECT_GLOW_COLOR,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  }

  const stateFor = (i: number): AnswerOptionState => {
    if (!revealed) return 'default'
    const isPick = i === selectedIndex
    const isCorrect = i === question.correctIndex
    if (isPick && isCorrect) return 'selected-correct'
    if (isPick && !isCorrect) return 'selected-wrong'
    if (!isPick && isCorrect) return 'shown-correct'
    return 'dimmed'
  }

  const handlePick = (i: number) => {
    if (revealed) return
    const isCorrect = i === question.correctIndex
    setSelectedIndex(i)
    setRevealed(true)
    onAnswer(i, isCorrect)
  }

  const userPickedCorrectly = revealed && selectedIndex === question.correctIndex
  const explanationCaption = userPickedCorrectly ? 'WHY THIS IS RIGHT' : 'THE CORRECT ANSWER'

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing['2xl'],
        alignItems: 'center',
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Text
        style={{
          ...typography.caption,
          ...(fontLabelBold ? { fontFamily: fontLabelBold } : {}),
          color: theme.textMuted,
          marginTop: spacing['2xl'],
        }}
      >
        TESTING
      </Text>
      <Text
        style={[subjectWordStyle, { marginTop: spacing.sm }]}
        adjustsFontSizeToFit
        numberOfLines={1}
        minimumFontScale={0.6}
      >
        {word.text}
      </Text>
      <View style={{ marginTop: spacing.sm }}>
        <BucketPill role={bucketRole} size="md" />
      </View>

      {hasExample ? (
        <View
          style={{
            width: '100%',
            marginTop: spacing.xl,
            backgroundColor: theme.bgElevated,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: radius.md,
            padding: spacing.lg,
          }}
        >
          <ExampleRow theme={theme} fontBody={fontBody} text={briefExample} />
        </View>
      ) : null}

      <View style={{ width: '100%', marginTop: spacing.xl }}>
        <Text
          style={{
            ...typography.caption,
            ...(fontLabelBold ? { fontFamily: fontLabelBold } : {}),
            color: theme.textMuted,
          }}
        >
          QUESTION
        </Text>
        <Text
          style={{
            ...typography.body,
            ...(fontBody ? { fontFamily: fontBody } : {}),
            fontSize: 16,
            lineHeight: 24,
            color: theme.textPrimary,
            marginTop: spacing.sm,
          }}
        >
          {question.questionText}
        </Text>
      </View>

      <View style={{ width: '100%', marginTop: spacing.xl, gap: spacing.md }}>
        {question.options.map((opt, i) => (
          <AnswerOption
            key={i}
            theme={theme}
            fontBody={fontBody}
            fontLabelBold={fontLabelBold}
            letter={String.fromCharCode(65 + i)}
            text={opt}
            state={stateFor(i)}
            onPress={() => handlePick(i)}
          />
        ))}
      </View>

      {revealed ? (
        <Animated.View
          style={{
            width: '100%',
            marginTop: spacing.lg,
            opacity: revealAnim,
          }}
          accessibilityLiveRegion="polite"
        >
          <View
            style={{
              backgroundColor: theme.bgSubtle,
              borderRadius: radius.md,
              padding: spacing.lg,
            }}
          >
            <Text
              style={{
                ...typography.caption,
                ...(fontLabelBold ? { fontFamily: fontLabelBold } : {}),
                color: theme.success,
              }}
            >
              {explanationCaption}
            </Text>
            <Text
              style={{
                ...typography.body,
                ...(fontBody ? { fontFamily: fontBody } : {}),
                color: theme.textSecondary,
                marginTop: spacing.sm,
              }}
            >
              {question.explanation}
            </Text>
          </View>

          <View style={{ width: '100%', marginTop: spacing.xl }}>
            <PrimaryButton
              theme={theme}
              label={busy ? 'Saving…' : (continueLabel ?? 'Continue')}
              onPress={onContinue}
              disabled={busy}
            />
          </View>
        </Animated.View>
      ) : null}
    </ScrollView>
  )
}
