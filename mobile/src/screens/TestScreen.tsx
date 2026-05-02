import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import type { QuizMode, QuizQuestion, VocabItem } from '@shared/types'
import {
  GlassPanel,
  GlassPrimaryCta,
  GlassScreenRoot,
  isLearnDarkUi,
  useGlassFonts,
} from '../components/GlassUi'
import { MASTERED_MIN_SCORE } from '@shared/exposureScore'
import { bucketFromWord } from '@shared/learningBuckets'
import { generateQuiz } from '../lib/api'
import { applyQuizAnswerExposure } from '../lib/vocab'
import { QuizQuestionCard } from '../components/QuizQuestionCard'
import { SessionHeader } from '../components/SessionHeader'
import type { AppTheme } from '../theme'

type Phase = 'idle' | 'running' | 'finished'

const MODE_OPTIONS: {
  id: QuizMode
  title: string
  description: string
}[] = [
  {
    id: 'context',
    title: 'Meaning in Context',
    description:
      'Context-rich questions built from your current deck to reinforce semantic links.',
  },
  {
    id: 'verbal',
    title: 'GMAT-Style Verbal',
    description: 'Full-length verbal practice to simulate exam-style pacing and difficulty.',
  },
]

export function TestScreen({
  theme,
  items,
  drillMode = false,
  onBackToPracticeHub,
}: {
  theme: AppTheme
  items: VocabItem[]
  /** When true, show Drill framing and optional back to Practice hub. */
  drillMode?: boolean
  onBackToPracticeHub?: () => void
}) {
  const { fontHeadline, fontHeadlineSm, fontBody, fontLabelBold } = useGlassFonts()
  const learnDark = isLearnDarkUi(theme)

  const [mode, setMode] = useState<QuizMode>('context')
  const [count, setCount] = useState(10)
  const [phase, setPhase] = useState<Phase>('idle')
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const candidateItems = useMemo(() => {
    const active = items.filter((i) => i.exposureScore < MASTERED_MIN_SCORE)
    return shuffle(active).slice(0, count)
  }, [items, count])

  const itemsByQuestionId = useMemo(
    () => new Map(candidateItems.map((c) => [c.id, c])),
    [candidateItems],
  )

  async function startQuiz() {
    setError(null)
    if (!candidateItems.length) {
      setError('No saved items available to test yet.')
      return
    }
    setStarting(true)
    try {
      const next = await generateQuiz(candidateItems.map((c) => c.id), mode, count)
      if (!next.length) throw new Error('Quiz response did not contain any questions.')
      setQuestions(next)
      setAnswers([])
      setCurrentIndex(0)
      setPhase('running')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start test')
    } finally {
      setStarting(false)
    }
  }

  const current = phase === 'running' ? questions[currentIndex] : null
  const correctCount =
    phase === 'finished'
      ? questions.reduce((acc, q, idx) => acc + (answers[idx] === q.correctIndex ? 1 : 0), 0)
      : 0

  const lastAnswerRef = useMemo(() => ({ current: null as number | null }), [])

  function onAnswer(optionIndex: number, isCorrect: boolean) {
    if (!current) return
    lastAnswerRef.current = optionIndex
    void applyQuizAnswerExposure(current.itemId, isCorrect).catch(() => {})
  }

  function onContinue() {
    if (lastAnswerRef.current === null || !current) return
    const nextAnswers = [...answers]
    nextAnswers[currentIndex] = lastAnswerRef.current
    setAnswers(nextAnswers)
    lastAnswerRef.current = null
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((v) => v + 1)
    } else {
      setPhase('finished')
    }
  }

  const onSessionClose =
    drillMode && onBackToPracticeHub ? onBackToPracticeHub : () => setPhase('idle')

  const cardBg = theme.surface2
  const cardBorder = theme.learnGlassBorder

  const currentWord = current ? itemsByQuestionId.get(current.itemId) : undefined

  if (phase === 'idle') {
    return (
      <GlassScreenRoot theme={theme}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 120,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
            {drillMode && onBackToPracticeHub ? (
              <Pressable
                onPress={onBackToPracticeHub}
                hitSlop={12}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Back to Practice modes"
              >
                <MaterialIcons name="arrow-back" size={22} color={theme.learnAccent} />
                <Text style={{ fontFamily: fontLabelBold, fontSize: 15, fontWeight: '700', color: theme.learnAccent }}>
                  Practice
                </Text>
              </Pressable>
            ) : null}
            <Text
              style={{
                fontFamily: fontHeadline,
                fontSize: 28,
                fontWeight: '800',
                letterSpacing: -0.5,
                color: theme.learnOnSurface,
                textAlign: 'center',
                marginTop: drillMode ? 0 : 8,
              }}
            >
              {drillMode ? 'Drill' : 'Practice'}
            </Text>
            <Text
              style={{
                fontFamily: fontBody,
                fontSize: 14,
                lineHeight: 21,
                color: theme.learnOnSurfaceVariant,
                textAlign: 'center',
                marginTop: 10,
                paddingHorizontal: 8,
              }}
            >
              {drillMode
                ? 'Quick MCQ drill to warm up on individual words. Your saved deck powers each question.'
                : 'Configure your session for focused verbal work. Your saved deck powers each question.'}
            </Text>

            <View
              style={{
                marginTop: 24,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: cardBorder,
                backgroundColor: cardBg,
                padding: 20,
                paddingBottom: 22,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <MaterialIcons name="psychology" size={20} color={theme.learnOutline} />
                <Text
                  style={{
                    fontFamily: fontHeadlineSm,
                    fontSize: 10,
                    fontWeight: '800',
                    letterSpacing: 2,
                    color: theme.learnOutline,
                  }}
                >
                  MODE
                </Text>
              </View>

              <View style={{ gap: 10 }}>
                {MODE_OPTIONS.map((opt) => {
                  const selected = mode === opt.id
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => setMode(opt.id)}
                      style={{
                        borderRadius: 16,
                        borderWidth: selected ? 2 : 1,
                        borderColor: selected ? theme.learnAccent : theme.learnGlassBorder,
                        backgroundColor: theme.learnSearchBg,
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: 12,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontFamily: fontHeadlineSm,
                            fontSize: 16,
                            fontWeight: '800',
                            color: theme.learnOnSurface,
                            letterSpacing: -0.2,
                          }}
                        >
                          {opt.title}
                        </Text>
                        <Text
                          style={{
                            fontFamily: fontBody,
                            fontSize: 13,
                            lineHeight: 19,
                            color: theme.learnOnSurfaceVariant,
                            marginTop: 6,
                          }}
                        >
                          {opt.description}
                        </Text>
                      </View>
                      {selected ? (
                        <MaterialIcons name="check-circle" size={24} color={theme.learnAccent} style={{ marginTop: 2 }} />
                      ) : null}
                    </Pressable>
                  )
                })}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22, marginBottom: 14 }}>
                <MaterialIcons name="linear-scale" size={20} color={theme.learnOutline} />
                <Text
                  style={{
                    fontFamily: fontHeadlineSm,
                    fontSize: 10,
                    fontWeight: '800',
                    letterSpacing: 2,
                    color: theme.learnOutline,
                  }}
                >
                  LENGTH
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[5, 10, 20, 50].map((n) => {
                  const active = count === n
                  return (
                    <Pressable
                      key={n}
                      onPress={() => setCount(n)}
                      style={{
                        flex: 1,
                        height: 56,
                        borderRadius: 28,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: active ? 2 : 1,
                        borderColor: active ? theme.learnAccent : theme.learnGlassBorder,
                        backgroundColor: theme.learnViewToggleBg,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: fontHeadlineSm,
                          fontSize: 17,
                          fontWeight: '800',
                          color: active ? theme.learnAccent : theme.learnOnSurface,
                        }}
                      >
                        {n}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>

              <Pressable
                onPress={() => void startQuiz()}
                disabled={starting}
                style={{
                  marginTop: 22,
                  borderRadius: 999,
                  backgroundColor: theme.learnPillActiveBg,
                  paddingVertical: 16,
                  paddingHorizontal: 24,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: starting ? 0.65 : 1,
                }}
              >
                {starting ? (
                  <ActivityIndicator color={theme.learnPillActiveText} />
                ) : (
                  <>
                    <Text
                      style={{
                        fontFamily: fontLabelBold,
                        fontSize: 17,
                        fontWeight: '800',
                        color: theme.learnPillActiveText,
                      }}
                    >
                      Start Practice
                    </Text>
                    <MaterialIcons name="play-arrow" size={26} color={theme.learnPillActiveText} />
                  </>
                )}
              </Pressable>

              {error ? (
                <Text
                  style={{
                    fontFamily: fontBody,
                    color: theme.danger,
                    fontSize: 14,
                    marginTop: 14,
                    textAlign: 'center',
                  }}
                >
                  {error}
                </Text>
              ) : null}
            </View>
        </ScrollView>
      </GlassScreenRoot>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.learnScreenBg }}>
      <SessionHeader
        theme={theme}
        onClose={onSessionClose}
        current={phase === 'running' ? currentIndex + 1 : undefined}
        total={phase === 'running' ? questions.length : undefined}
        centerLabel={phase === 'finished' ? 'Done' : undefined}
      />
      {phase === 'running' && current && currentWord ? (
        <QuizQuestionCard
          theme={theme}
          question={current}
          word={currentWord}
          bucketRole={bucketFromWord(currentWord)}
          onAnswer={onAnswer}
          onContinue={onContinue}
          continueLabel={currentIndex + 1 < questions.length ? 'Continue' : 'View results'}
        />
      ) : phase === 'finished' ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        >
          <GlassPanel theme={theme} learnDark={learnDark} leftAccent={theme.learnAccentStrong}>
            <Text
              style={{
                fontFamily: fontHeadline,
                fontSize: 22,
                fontWeight: '800',
                color: theme.learnOnSurface,
                marginBottom: 8,
              }}
            >
              Section complete
            </Text>
            <Text style={{ fontFamily: fontBody, fontSize: 16, color: theme.learnOnSurfaceVariant, marginBottom: 18 }}>
              Score: {correctCount} / {questions.length}
            </Text>
            <GlassPrimaryCta theme={theme} label="New session" onPress={() => setPhase('idle')} fontLabelBold={fontLabelBold} />
          </GlassPanel>
        </ScrollView>
      ) : null}
    </View>
  )
}

function shuffle<T>(arr: T[]) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
