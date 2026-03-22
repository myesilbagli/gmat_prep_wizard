import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import type { VocabItem, VocabStatus } from '@shared/types'
import { Card, Input, PrimaryButton } from '../components/UI'
import { generateParagraph } from '../lib/api'
import { deleteVocabItem, toggleVocabFlagged, updateVocabStatus } from '../lib/vocab'
import type { AppTheme } from '../theme'

type Filter = 'all' | 'do_not_know' | 'learning' | 'know' | 'flagged'
type ViewMode = 'list' | 'flashcards' | 'paragraph'

export function LearnScreen({
  theme,
  items,
  onReload,
}: {
  theme: AppTheme
  items: VocabItem[]
  onReload: () => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [mode, setMode] = useState<ViewMode>('list')
  const [flashIndex, setFlashIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [para, setPara] = useState<string>('')
  const [paraLoading, setParaLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (filter === 'do_not_know' && item.status !== 'do_not_know') return false
      if (filter === 'learning' && item.status !== 'learning') return false
      if (filter === 'know' && item.status !== 'know') return false
      if (filter === 'flagged' && !item.flagged) return false
      if (q && !item.text.toLowerCase().includes(q)) return false
      return true
    })
  }, [items, filter, query])

  const flashItem = filtered[flashIndex] ?? null

  async function updateStatus(id: string, status: VocabStatus) {
    await updateVocabStatus({ id, status })
    await onReload()
  }

  async function toggleFlag(id: string, flagged: boolean) {
    await toggleVocabFlagged({ id, flagged })
    await onReload()
  }

  async function removeItem(id: string) {
    await deleteVocabItem(id)
    await onReload()
  }

  async function onGenerateParagraph() {
    setParaLoading(true)
    setError(null)
    try {
      const picked = filtered.slice(0, 5)
      if (!picked.length) throw new Error('No matching words available.')
      const resp = await generateParagraph(picked)
      const text = resp.parts
        .map((p) => (p.kind === 'text' ? p.value : p.text))
        .join('')
        .trim()
      setPara(text)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate paragraph')
    } finally {
      setParaLoading(false)
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>My Learning Path</Text>
      <Input theme={theme} value={query} onChangeText={setQuery} placeholder="Search words..." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(['all', 'do_not_know', 'learning', 'know', 'flagged'] as Filter[]).map((f) => (
          <Pill key={f} theme={theme} active={filter === f} label={f.replaceAll('_', ' ')} onPress={() => setFilter(f)} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['list', 'flashcards', 'paragraph'] as ViewMode[]).map((m) => (
          <Pill key={m} theme={theme} active={mode === m} label={m} onPress={() => setMode(m)} />
        ))}
      </View>

      {mode === 'list' ? (
        <View style={{ gap: 10 }}>
          {filtered.map((item) => (
            <Card key={item.id} theme={theme}>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>{item.text}</Text>
              <Text style={{ color: theme.muted }}>{item.simpleDefinition || item.definition}</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Pill theme={theme} active={item.status === 'do_not_know'} label="Do not know" onPress={() => void updateStatus(item.id, 'do_not_know')} />
                <Pill theme={theme} active={item.status === 'learning'} label="Learning" onPress={() => void updateStatus(item.id, 'learning')} />
                <Pill theme={theme} active={item.status === 'know'} label="Know" onPress={() => void updateStatus(item.id, 'know')} />
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Text style={{ color: theme.muted }} onPress={() => void toggleFlag(item.id, !item.flagged)}>
                  {item.flagged ? 'Unflag' : 'Flag'}
                </Text>
                <Text style={{ color: theme.danger }} onPress={() => void removeItem(item.id)}>
                  Delete
                </Text>
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {mode === 'flashcards' ? (
        <Card theme={theme}>
          {!flashItem ? (
            <Text style={{ color: theme.muted }}>No words to review.</Text>
          ) : (
            <>
              <Text style={{ color: theme.text, fontSize: 24, fontWeight: '800' }}>{flashItem.text}</Text>
              <Text style={{ color: theme.muted }}>
                {showAnswer ? flashItem.simpleDefinition || flashItem.definition : 'Tap reveal to see definition'}
              </Text>
              <PrimaryButton theme={theme} label={showAnswer ? 'Hide' : 'Reveal'} onPress={() => setShowAnswer((v) => !v)} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.muted }} onPress={() => { setFlashIndex((v) => Math.max(0, v - 1)); setShowAnswer(false) }}>Prev</Text>
                <Text style={{ color: theme.muted }} onPress={() => { setFlashIndex((v) => Math.min(filtered.length - 1, v + 1)); setShowAnswer(false) }}>Next</Text>
              </View>
            </>
          )}
        </Card>
      ) : null}

      {mode === 'paragraph' ? (
        <Card theme={theme}>
          <PrimaryButton
            theme={theme}
            label={paraLoading ? 'Generating...' : 'Generate Paragraph'}
            onPress={() => void onGenerateParagraph()}
            loading={paraLoading}
            disabled={paraLoading}
          />
          {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
          {para ? <Text style={{ color: theme.muted }}>{para}</Text> : <Text style={{ color: theme.muted }}>Generate a contextual paragraph using your learning words.</Text>}
        </Card>
      ) : null}
    </ScrollView>
  )
}

function Pill({
  theme,
  active,
  label,
  onPress,
}: {
  theme: AppTheme
  active: boolean
  label: string
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
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Text style={{ color: active ? theme.text : theme.muted, textTransform: 'capitalize' }}>{label}</Text>
    </Pressable>
  )
}
