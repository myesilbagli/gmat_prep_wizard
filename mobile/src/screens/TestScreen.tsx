import { useEffect, useMemo, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import type { QuizMode, QuizQuestion, VocabItem } from '@shared/types'
import {
  GlassPanel,
  GlassPill,
  GlassPrimaryCta,
  GlassScreenRoot,
  GlassSectionLabel,
  GlassTitleHeader,
  GlassQuizOption,
  isLearnDarkUi,
  useGlassFonts,
} from '../components/GlassUi'
import { generateQuiz } from '../lib/api'
import { recordWordExposure } from '../lib/vocab'
import type { AppTheme } from '../theme'

type Phase = 'idle' | 'running' | 'finished'

export function TestScreen({
  theme,
  items,
  onOpenProfile,
}: {
  theme: AppTheme
  items: VocabItem[]
  onOpenProfile?: () => void
}) {
  const { fontHeadline, fontHeadlineSm, fontBody, fontLabel, fontLabelBold } = useGlassFonts()
  const learnDark = isLearnDarkUi(theme)

  const [mode, setMode] = useState<QuizMode>('meaning')
  const [count, setCount] = useState(10)
  const [phase, setPhase] = useState<Phase>('idle')
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const candidateItems = useMemo(() => {
    const primary = items.filter((i) => i.status === 'learning')
    if (primary.length >= count) return shuffle(primary).slice(0, count)
    const secondary = items.filter((i) => i.status === 'mastered')
    return shuffle([...primary, ...secondary]).slice(0, count)
  }, [items, count])

  useEffect(() => {
    if (phase !== 'running' || questions.length === 0) return
    const q = questions[currentIndex]
    if (!q?.itemId) return
    void recordWordExposure(q.itemId).catch(() => {})
  }, [phase, currentIndex, questions])

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
      setError(e instanceof Error ? e.message : 'Failed to start quiz')
    } finally {
      setStarting(false)
    }
  }

  const current = phase === 'running' ? questions[currentIndex] : null
  const correctCount =
    phase === 'finished'
      ? questions.reduce((acc, q, idx) => acc + (answers[idx] === q.correctIndex ? 1 : 0), 0)
      : 0

  function onAnswer(optionIndex: number) {
    const next = [...answers]
    next[currentIndex] = optionIndex
    setAnswers(next)
    if (currentIndex + 1 < questions.length) setCurrentIndex((v) => v + 1)
    else setPhase('finished')
  }

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
        <GlassTitleHeader theme={theme} title="Practice test" onOpenProfile={onOpenProfile} fontHeadlineSm={fontHeadlineSm} />
        <Text
          style={{
            fontFamily: fontBody,
            fontSize: 14,
            lineHeight: 20,
            color: theme.learnOnSurfaceVariant,
            marginTop: 10,
          }}
        >
          Multiple choice from your learning and mastered words.
        </Text>

        <View style={{ marginTop: 22, gap: 18 }}>
          <GlassPanel theme={theme} learnDark={learnDark} leftAccent={theme.learnAccent}>
            <GlassSectionLabel theme={theme} fontHeadlineSm={fontHeadlineSm}>
              Test type
            </GlassSectionLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <GlassPill
                theme={theme}
                label="Meaning"
                active={mode === 'meaning'}
                onPress={() => setMode('meaning')}
                fontLabel={fontLabel}
              />
              <GlassPill
                theme={theme}
                label="GMAT-style"
                active={mode === 'gmat'}
                onPress={() => setMode('gmat')}
                fontLabel={fontLabel}
              />
            </View>

            <GlassSectionLabel theme={theme} fontHeadlineSm={fontHeadlineSm} style={{ marginTop: 6 }}>
              Questions
            </GlassSectionLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {[5, 10, 20, 50].map((n) => (
                <GlassPill
                  key={n}
                  theme={theme}
                  label={String(n)}
                  active={count === n}
                  onPress={() => setCount(n)}
                  fontLabel={fontLabel}
                />
              ))}
            </View>

            <View style={{ marginTop: 8 }}>
              <GlassPrimaryCta
                theme={theme}
                label={starting ? 'Starting…' : 'Start test'}
                onPress={() => void startQuiz()}
                loading={starting}
                disabled={starting}
                fontLabelBold={fontLabelBold}
              />
            </View>
            {error ? (
              <Text style={{ fontFamily: fontBody, color: theme.danger, fontSize: 14, marginTop: 12 }}>{error}</Text>
            ) : null}
          </GlassPanel>

          {phase === 'running' && current ? (
            <GlassPanel theme={theme} learnDark={learnDark} leftAccent={theme.learnTertiary}>
              <Text
                style={{
                  fontFamily: fontLabelBold,
                  fontSize: 12,
                  fontWeight: '700',
                  letterSpacing: 0.6,
                  color: theme.learnOutline,
                  marginBottom: 10,
                }}
              >
                Question {currentIndex + 1} of {questions.length}
              </Text>
              <Text
                style={{
                  fontFamily: fontHeadline,
                  fontSize: 20,
                  fontWeight: '800',
                  color: theme.learnOnSurface,
                  lineHeight: 28,
                  marginBottom: 16,
                }}
              >
                {current.questionText}
              </Text>
              <View style={{ gap: 10 }}>
                {current.options.map((opt, i) => (
                  <GlassQuizOption
                    key={i}
                    theme={theme}
                    learnDark={learnDark}
                    label={opt}
                    onPress={() => onAnswer(i)}
                    fontBody={fontBody}
                  />
                ))}
              </View>
            </GlassPanel>
          ) : null}

          {phase === 'finished' ? (
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
                Test complete
              </Text>
              <Text style={{ fontFamily: fontBody, fontSize: 16, color: theme.learnOnSurfaceVariant, marginBottom: 18 }}>
                Score: {correctCount} / {questions.length}
              </Text>
              <GlassPrimaryCta theme={theme} label="New test" onPress={() => setPhase('idle')} fontLabelBold={fontLabelBold} />
            </GlassPanel>
          ) : null}
        </View>
      </ScrollView>
    </GlassScreenRoot>
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
