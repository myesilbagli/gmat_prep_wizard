import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import type { QuizMode, QuizQuestion, VocabItem } from '@shared/types'
import { Card, PrimaryButton } from '../components/UI'
import { generateQuiz } from '../lib/api'
import type { AppTheme } from '../theme'

type Phase = 'idle' | 'running' | 'finished'

export function TestScreen({
  theme,
  items,
}: {
  theme: AppTheme
  items: VocabItem[]
}) {
  const [mode, setMode] = useState<QuizMode>('meaning')
  const [count, setCount] = useState(10)
  const [phase, setPhase] = useState<Phase>('idle')
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const candidateItems = useMemo(() => {
    const primary = items.filter((i) => i.status === 'learning' || i.status === 'do_not_know')
    if (primary.length >= count) return shuffle(primary).slice(0, count)
    const secondary = items.filter((i) => i.status === 'know')
    return shuffle([...primary, ...secondary]).slice(0, count)
  }, [items, count])

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
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>Practice Session</Text>
      <Card theme={theme}>
        <Text style={{ color: theme.muted, fontWeight: '700' }}>Test type</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ModeButton theme={theme} label="Meaning" active={mode === 'meaning'} onPress={() => setMode('meaning')} />
          <ModeButton theme={theme} label="GMAT-style" active={mode === 'gmat'} onPress={() => setMode('gmat')} />
        </View>
        <Text style={{ color: theme.muted, fontWeight: '700' }}>Questions</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[5, 10, 20, 50].map((n) => (
            <ModeButton key={n} theme={theme} label={String(n)} active={count === n} onPress={() => setCount(n)} />
          ))}
        </View>
        <PrimaryButton
          theme={theme}
          label={starting ? 'Starting...' : 'START TEST'}
          onPress={() => void startQuiz()}
          loading={starting}
        />
        {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
      </Card>

      {phase === 'running' && current ? (
        <Card theme={theme}>
          <Text style={{ color: theme.muted }}>
            Question {currentIndex + 1} of {questions.length}
          </Text>
          <Text style={{ color: theme.text, fontWeight: '700' }}>{current.questionText}</Text>
          {current.options.map((opt, i) => (
            <Pressable
              key={i}
              onPress={() => onAnswer(i)}
              style={{
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 10,
                padding: 10,
              }}
            >
              <Text style={{ color: theme.text }}>{opt}</Text>
            </Pressable>
          ))}
        </Card>
      ) : null}

      {phase === 'finished' ? (
        <Card theme={theme}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>Test complete</Text>
          <Text style={{ color: theme.muted }}>
            Score: {correctCount} / {questions.length}
          </Text>
          <PrimaryButton theme={theme} label="New Test" onPress={() => setPhase('idle')} />
        </Card>
      ) : null}
    </ScrollView>
  )
}

function ModeButton({
  theme,
  label,
  active,
  onPress,
}: {
  theme: AppTheme
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? theme.primary : theme.border,
        backgroundColor: active ? theme.surface2 : 'transparent',
        paddingVertical: 8,
        paddingHorizontal: 12,
      }}
    >
      <Text style={{ color: active ? theme.text : theme.muted }}>{label}</Text>
    </Pressable>
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
