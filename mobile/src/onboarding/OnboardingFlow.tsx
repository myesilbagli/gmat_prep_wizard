import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { WORD_STACK_CATALOG } from '@shared/freemium'
import { CANONICAL_STACK_ORDER } from '@shared/canonicalStacks'
import { getWordsForStack } from '@shared/wordStackContent'
import { DEFAULT_MAIN_LANGUAGE, normalizeMainLanguageCode } from '@shared/languages'
import { formatDateKeyInTimezone } from '@shared/dateInTimezone'
import { resolveExamDateIso } from '@shared/examDate'
import { DEFAULT_TIMEZONE } from '@shared/userProfile'
import { GlassScreenRoot, glassScreenShadow, useGlassFonts } from '../components/GlassUi'
import { ExamDatePickerBlock } from '../components/ExamDatePickerBlock'
import {
  completeOnboardingProfile,
  ensureUserProfileDefaults,
} from '../lib/userProfile'
import { saveWordFromStackImport } from '../lib/words'
import type { AppTheme } from '../theme'
import {
  MockLexiconBar,
  MockParagraphHighlight,
  MockSessionStrip,
  MockStacksList,
  MockTodayCaptureCard,
} from './OnboardingMocks'

const STEPS = 7

const ONBOARDING_STACK_ID = 'stack_arg_architecture' as const

type Props = {
  theme: AppTheme
  onComplete: () => void
  onReloadWords: () => Promise<void>
}

export function OnboardingFlow({ theme, onComplete, onReloadWords }: Props) {
  const insets = useSafeAreaInsets()
  const { fontHeadline, fontHeadlineSm, fontBody, fontLabel } = useGlassFonts()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [profileTz, setProfileTz] = useState(DEFAULT_TIMEZONE)
  const [examDateIso, setExamDateIso] = useState(() =>
    formatDateKeyInTimezone(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE),
  )
  const [mainLanguage, setMainLanguage] = useState(DEFAULT_MAIN_LANGUAGE)
  const [addArgStackToVocabs, setAddArgStackToVocabs] = useState(true)

  const argStackTitle =
    CANONICAL_STACK_ORDER.find((s) => s.id === ONBOARDING_STACK_ID)?.title ?? 'Argument Architecture'
  const argStackWordCount = WORD_STACK_CATALOG.find((s) => s.id === ONBOARDING_STACK_ID)?.wordCount ?? 0

  const fade = useRef(new Animated.Value(1)).current
  const slide = useRef(new Animated.Value(0)).current
  const didMountAnim = useRef(false)

  useEffect(() => {
    void ensureUserProfileDefaults().then((p) => {
      const tz = p.timezone || DEFAULT_TIMEZONE
      setProfileTz(tz)
      setMainLanguage(normalizeMainLanguageCode(p.mainLanguage))
      const resolved =
        resolveExamDateIso({ examDateIso: p.examDateIso, examTarget: p.examTarget }) ??
        formatDateKeyInTimezone(new Date(), tz)
      setExamDateIso(resolved)
    })
  }, [])

  useEffect(() => {
    if (!didMountAnim.current) {
      didMountAnim.current = true
      return
    }
    fade.setValue(0)
    slide.setValue(18)
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start()
  }, [step, fade, slide])

  const goNext = useCallback(() => {
    setStep((s) => Math.min(s + 1, STEPS - 1))
  }, [])

  const finishSetup = useCallback(async () => {
    setSubmitError(null)
    setSubmitting(true)
    try {
      if (addArgStackToVocabs) {
        const words = getWordsForStack(ONBOARDING_STACK_ID)
        if (words.length === 0) throw new Error('Argument Architecture stack is empty.')
        for (let i = 0; i < words.length; i++) {
          await saveWordFromStackImport({
            text: words[i]!,
            mainLanguage,
            stackId: ONBOARDING_STACK_ID,
            stackPosition: i,
          })
        }
      }
      await completeOnboardingProfile({
        examDateIso,
        firstStackId: addArgStackToVocabs ? ONBOARDING_STACK_ID : null,
      })
      await onReloadWords()
      onComplete()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }, [addArgStackToVocabs, examDateIso, mainLanguage, onComplete, onReloadWords])

  const progress = `${step + 1} / ${STEPS}`
  const cardBg = theme.surface2

  const animatedContentStyle = {
    opacity: fade,
    transform: [{ translateX: slide }],
  }

  return (
    <GlassScreenRoot theme={theme}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Text style={[styles.progress, { color: theme.learnOnSurfaceVariant, fontFamily: fontLabel }]}>{progress}</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingBottom: Math.max(insets.bottom, 24) + 12,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={animatedContentStyle}>
          {step === 0 ? (
            <View>
              <MockLexiconBar theme={theme} />
              <OnbScreen
                theme={theme}
                cardBg={cardBg}
                fontHeadline={fontHeadline}
                fontBody={fontBody}
                title="Your GMAT vocabulary, organized"
                body="Lexicon turns scattered lookups into a structured deck you actually retain — built for how the GMAT tests verbal reasoning."
              />
            </View>
          ) : null}
          {step === 1 ? (
            <View>
              <OnbScreen
                theme={theme}
                cardBg={cardBg}
                fontHeadline={fontHeadline}
                fontBody={fontBody}
                title="Look up anything in seconds"
                body="Capture a word or phrase on Today. We generate definitions, nuance, and GMAT-style context so each card is exam-useful."
              />
              <View style={styles.mockBelow}>
                <MockTodayCaptureCard theme={theme} fontBody={fontBody} fontHeadline={fontHeadline} />
              </View>
            </View>
          ) : null}
          {step === 2 ? (
            <View>
              <OnbScreen
                theme={theme}
                cardBg={cardBg}
                fontHeadline={fontHeadline}
                fontBody={fontBody}
                title="Stacks keep you honest"
                body="Curated word stacks let you bulk-add high-value vocabulary instead of hoping you’ll remember to save words later."
              />
              <View style={styles.mockBelow}>
                <MockStacksList theme={theme} fontBody={fontBody} />
              </View>
            </View>
          ) : null}
          {step === 3 ? (
            <View>
              <OnbScreen
                theme={theme}
                cardBg={cardBg}
                fontHeadline={fontHeadline}
                fontBody={fontBody}
                title="Daily sessions, five words at a time"
                body="Short sessions pull from your learning pool so you review what needs reps — not a random slice of the dictionary."
              />
              <View style={styles.mockBelow}>
                <MockSessionStrip theme={theme} fontBody={fontBody} fontHeadlineSm={fontHeadlineSm} />
              </View>
            </View>
          ) : null}
          {step === 4 ? (
            <ExposureDemoScreen theme={theme} cardBg={cardBg} fontHeadline={fontHeadline} fontBody={fontBody} fontLabel={fontLabel} />
          ) : null}
          {step === 5 ? (
            <View>
              <OnbScreen
                theme={theme}
                cardBg={cardBg}
                fontHeadline={fontHeadline}
                fontBody={fontBody}
                title="From paragraph to confidence"
                body="Words you’ve studied surface with stronger recognition in dense passages — exposure score tracks how ready each term is for test day."
              />
              <View style={styles.mockBelow}>
                <MockParagraphHighlight theme={theme} fontBody={fontBody} />
              </View>
            </View>
          ) : null}
          {step === 6 ? (
            <View>
              <Text style={[styles.screenTitle, { color: theme.learnOnSurface, fontFamily: fontHeadline }]}>
                You’re set — one last step
              </Text>
              <Text
                style={[styles.screenBody, { color: theme.learnOnSurfaceVariant, fontFamily: fontBody, marginBottom: 16 }]}
              >
                Pick your GMAT date. Optionally add the Argument Architecture stack to your vocabs, then you’re ready to study.
              </Text>
              <Text style={[styles.fieldLabel, { color: theme.learnOnSurfaceVariant, fontFamily: fontLabel }]}>
                EXAM DATE
              </Text>
              <ExamDatePickerBlock
                theme={theme}
                timezone={profileTz}
                examDateIso={examDateIso}
                onExamDateIsoChange={setExamDateIso}
              />
              <Text
                style={[
                  styles.fieldLabel,
                  { color: theme.learnOnSurfaceVariant, fontFamily: fontLabel, marginTop: 20 },
                ]}
              >
                STARTER STACK
              </Text>
              <Pressable
                onPress={() => setAddArgStackToVocabs((v) => !v)}
                style={({ pressed }) => [
                  styles.onbStackCard,
                  {
                    borderColor: addArgStackToVocabs ? theme.learnAccent : theme.learnGlassBorder,
                    backgroundColor: theme.learnSearchBg,
                    marginTop: 8,
                    opacity: pressed ? 0.92 : 1,
                    ...glassScreenShadow(theme),
                  },
                ]}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: addArgStackToVocabs ? theme.learnAccent : theme.learnGlassBorder,
                    backgroundColor: addArgStackToVocabs ? theme.learnAccent : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 2,
                  }}
                >
                  {addArgStackToVocabs ? <MaterialIcons name="check" size={16} color={theme.learnPillActiveText} /> : null}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialIcons name="library-books" size={22} color={theme.learnAccent} />
                    <Text style={{ fontFamily: fontHeadline, fontSize: 17, fontWeight: '800', color: theme.learnOnSurface }}>
                      Add to my vocabs
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: fontBody,
                      fontSize: 14,
                      color: theme.learnOnSurfaceVariant,
                      marginTop: 4,
                    }}
                    numberOfLines={4}
                  >
                    {argStackTitle} · {argStackWordCount} words — GMAT argument-move vocabulary. Turn off to start with an
                    empty deck and add words yourself.
                  </Text>
                </View>
              </Pressable>
              {submitError ? (
                <Text style={{ color: theme.danger, fontFamily: fontBody, marginTop: 12, textAlign: 'center' }}>{submitError}</Text>
              ) : null}
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {step < STEPS - 1 ? (
          <Pressable
            onPress={goNext}
            style={({ pressed }) => ({
              borderRadius: 999,
              paddingVertical: 16,
              alignItems: 'center',
              backgroundColor: theme.learnPillActiveBg,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ fontFamily: fontHeadline, fontSize: 16, fontWeight: '800', color: theme.learnPillActiveText }}>
              Continue
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => void finishSetup()}
            disabled={submitting}
            style={({ pressed }) => ({
              borderRadius: 999,
              paddingVertical: 16,
              alignItems: 'center',
              backgroundColor: theme.learnAccent,
              opacity: submitting ? 0.55 : pressed ? 0.92 : 1,
            })}
          >
            {submitting ? (
              <ActivityIndicator color={theme.learnPillActiveText} />
            ) : (
              <Text style={{ fontFamily: fontHeadline, fontSize: 16, fontWeight: '800', color: theme.learnPillActiveText }}>
                Get started
              </Text>
            )}
          </Pressable>
        )}
      </View>
    </GlassScreenRoot>
  )
}

function OnbScreen({
  theme,
  cardBg,
  fontHeadline,
  fontBody,
  title,
  body,
}: {
  theme: AppTheme
  cardBg: string
  fontHeadline?: string
  fontBody?: string
  title: string
  body: string
}) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor: theme.learnGlassBorder,
        },
      ]}
    >
      <Text style={[styles.screenTitle, { color: theme.learnOnSurface, fontFamily: fontHeadline }]}>{title}</Text>
      <Text style={[styles.screenBody, { color: theme.learnOnSurfaceVariant, fontFamily: fontBody }]}>{body}</Text>
    </View>
  )
}

function ExposureDemoScreen({
  theme,
  cardBg,
  fontHeadline,
  fontBody,
  fontLabel,
}: {
  theme: AppTheme
  cardBg: string
  fontHeadline?: string
  fontBody?: string
  fontLabel?: string
}) {
  const demo = 0.72
  const pct = Math.round(demo * 100)
  const filled = Math.min(1, demo)
  return (
    <View>
      <View
        style={[
          styles.card,
          {
            backgroundColor: cardBg,
            borderColor: theme.learnGlassBorder,
          },
        ]}
      >
        <Text style={[styles.screenTitle, { color: theme.learnOnSurface, fontFamily: fontHeadline }]}>
          Exposure score tracks readiness
        </Text>
        <Text style={[styles.screenBody, { color: theme.learnOnSurfaceVariant, fontFamily: fontBody }]}>
          Each word earns exposure as you study. Higher scores mean the word is closer to automatic recall — the bar fills toward mastery.
        </Text>
        <Text style={[styles.fieldLabel, { color: theme.learnOnSurfaceVariant, fontFamily: fontLabel, marginTop: 18 }]}>
          EXAMPLE
        </Text>
        <View style={[styles.scoreTrack, { backgroundColor: theme.learnViewToggleBg }]}>
          <View
            style={{
              height: '100%',
              width: `${filled * 100}%`,
              borderRadius: 8,
              backgroundColor: theme.learnAccent,
            }}
          />
        </View>
        <Text
          style={{
            fontFamily: fontHeadline,
            fontSize: 22,
            fontWeight: '800',
            color: theme.learnOnSurface,
            marginTop: 10,
            textAlign: 'center',
            width: '100%',
          }}
        >
          {pct}%
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 22,
    paddingBottom: 8,
    alignItems: 'center',
  },
  progress: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  mockBelow: {
    marginTop: 18,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    marginBottom: 8,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 12,
    textAlign: 'center',
    width: '100%',
  },
  screenBody: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    width: '100%',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    textAlign: 'center',
    width: '100%',
  },
  onbStackCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.25)',
  },
  scoreTrack: {
    height: 12,
    borderRadius: 8,
    overflow: 'hidden',
    width: '100%',
  },
})
