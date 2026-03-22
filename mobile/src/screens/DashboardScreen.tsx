import { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import type { GeneratedResult, VocabItem } from '@shared/types'
import { Card, Input, PrimaryButton } from '../components/UI'
import { generateWord } from '../lib/api'
import { saveWord } from '../lib/words'
import type { AppTheme } from '../theme'

type GenerateState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; result: GeneratedResult }
  | { status: 'error'; message: string }

function emptyResult(): GeneratedResult {
  return {
    definition: '',
    simpleDefinition: '',
    exampleSentence: '',
    synonyms: [],
    nuanceNote: '',
    gmatUsageNote: '',
    definitions: [],
    examples: [],
  }
}

export function DashboardScreen({
  theme,
  stats,
}: {
  theme: AppTheme
  stats: { total: number; learning: number; known: number }
}) {
  const [text, setText] = useState('')
  const [state, setState] = useState<GenerateState>({ status: 'idle' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const canGenerate = useMemo(() => text.trim().length > 0, [text])

  async function onGenerate() {
    setState({ status: 'loading' })
    setSaved(false)
    try {
      const result = await generateWord(text.trim())
      setState({ status: 'ready', result: { ...emptyResult(), ...result } })
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Failed to generate' })
    }
  }

  async function onSave() {
    if (state.status !== 'ready') return
    setSaving(true)
    try {
      await saveWord({
        text: text.trim(),
        type: text.includes(' ') ? 'phrase' : 'word',
        result: state.result,
      })
      setSaved(true)
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>Dashboard</Text>
      <Text style={{ color: theme.muted }}>Stats + lookup in one place.</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <StatCard theme={theme} label="Saved" value={String(stats.total)} />
        <StatCard theme={theme} label="Learning" value={String(stats.learning)} />
        <StatCard theme={theme} label="Mastered" value={String(stats.known)} />
      </View>

      <Card theme={theme}>
        <Input
          theme={theme}
          value={text}
          onChangeText={(v) => {
            setText(v)
            setSaved(false)
          }}
          placeholder="Lookup & Generate"
          onSubmitEditing={() => {
            if (!canGenerate || state.status === 'loading') return
            void onGenerate()
          }}
        />
        <PrimaryButton
          theme={theme}
          label={state.status === 'loading' ? 'Generating...' : 'Generate Analysis'}
          onPress={onGenerate}
          disabled={!canGenerate || state.status === 'loading'}
          loading={state.status === 'loading'}
        />
      </Card>

      <Card theme={theme}>
        {state.status === 'idle' ? (
          <Text style={{ color: theme.muted }}>Enter a word or phrase and tap Generate Analysis.</Text>
        ) : null}
        {state.status === 'loading' ? <LoadingCard theme={theme} word={text.trim()} /> : null}
        {state.status === 'error' ? <Text style={{ color: theme.danger }}>{state.message}</Text> : null}
        {state.status === 'ready' ? (
          <WordAnalysisCard
            theme={theme}
            word={text.trim()}
            result={state.result}
            onSave={onSave}
            saving={saving}
            saved={saved}
          />
        ) : null}
      </Card>
    </ScrollView>
  )
}

function StatCard({ theme, label, value }: { theme: AppTheme; label: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 12,
        padding: 10,
        backgroundColor: theme.surface,
      }}
    >
      <Text style={{ color: theme.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: theme.text, fontSize: 20, fontWeight: '800' }}>{value}</Text>
    </View>
  )
}

function LoadingCard({ theme, word }: { theme: AppTheme; word: string }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <ActivityIndicator color={theme.primary} />
        <Text style={{ color: theme.muted }}>
          Generating analysis{word ? ` for "${word}"` : ''}...
        </Text>
      </View>
      <View style={{ height: 10, borderRadius: 8, backgroundColor: theme.surface2 }} />
      <View style={{ height: 10, width: '80%', borderRadius: 8, backgroundColor: theme.surface2 }} />
      <View style={{ height: 10, width: '60%', borderRadius: 8, backgroundColor: theme.surface2 }} />
    </View>
  )
}

function WordAnalysisCard({
  theme,
  word,
  result,
  onSave,
  saving,
  saved,
}: {
  theme: AppTheme
  word: string
  result: GeneratedResult
  onSave: () => void
  saving: boolean
  saved: boolean
}) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={{ color: theme.muted, fontSize: 11, fontWeight: '700' }}>WORD OF THE DAY</Text>
          <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>{word}</Text>
        </View>
        <Pressable
          onPress={onSave}
          disabled={saving || saved}
          style={{
            backgroundColor: saved ? theme.success : theme.primary,
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
          </Text>
        </Pressable>
      </View>
      <Text style={{ color: theme.muted }}>{result.simpleDefinition || result.definition}</Text>
      {result.definition && result.definition !== result.simpleDefinition ? (
        <Text style={{ color: theme.text }}>{result.definition}</Text>
      ) : null}
      {result.exampleSentence ? <Text style={{ color: theme.muted }}>{result.exampleSentence}</Text> : null}
      {!!result.synonyms?.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {result.synonyms.map((syn, idx) => (
            <View
              key={`${syn}-${idx}`}
              style={{
                borderRadius: 999,
                borderWidth: 1,
                borderColor: theme.border,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text style={{ color: theme.muted, fontSize: 12 }}>{syn}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {result.nuanceNote ? <Text style={{ color: theme.muted }}>{result.nuanceNote}</Text> : null}
      {result.gmatUsageNote ? <Text style={{ color: theme.muted }}>{result.gmatUsageNote}</Text> : null}
    </View>
  )
}

export function computeDashboardStats(items: VocabItem[]) {
  return {
    total: items.length,
    learning: items.filter((i) => i.status === 'learning' || i.status === 'do_not_know').length,
    known: items.filter((i) => i.status === 'know').length,
  }
}
