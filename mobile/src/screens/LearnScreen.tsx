import { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import type { VocabItem, VocabStatus } from '@shared/types'
import { getNativeGloss } from '@shared/vocab'
import { BlurView } from 'expo-blur'
import { Ionicons, MaterialIcons } from '@expo/vector-icons'
import {
  GlassPanel,
  GlassScreenRoot,
  GlassSearchField,
  GlassTitleHeader,
  glassScreenShadow,
  isLearnDarkUi,
  useGlassFonts,
} from '../components/GlassUi'
import { LearnFlashcardModal } from '../components/LearnFlashcardModal'
import { WordStacksSection } from '../components/WordStacksSection'
import { generateParagraph } from '../lib/api'
import {
  deleteVocabItem,
  recordWordExposure,
  toggleVocabFlagged,
  updateVocabStatus,
} from '../lib/vocab'
import type { AppTheme } from '../theme'

type UiListFilter = 'all' | 'fresh' | 'learning' | 'mastered' | 'flagged'
type KindFilter = 'all' | 'word' | 'phrase'
type TopLearnMode = 'deck' | 'paragraph'

type ParagraphPart =
  | { kind: 'text'; value: string }
  | { kind: 'target'; text: string }

const FILTER_PILLS: { key: UiListFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'fresh', label: 'Do Not Know' },
  { key: 'learning', label: 'Learning' },
  { key: 'mastered', label: 'Mastered' },
  { key: 'flagged', label: 'Flagged' },
]

function cardLeftAccent(theme: AppTheme, item: VocabItem): string {
  if (item.status === 'mastered') return theme.learnOutline
  if (item.status === 'learning' && (item.seenCount ?? 0) === 0) return theme.learnTertiary
  if (item.status === 'learning') return theme.learnAccent
  return theme.learnOutline
}

function statusFooter(theme: AppTheme, item: VocabItem): { dot: string; label: string } {
  if (item.status === 'mastered') return { dot: theme.learnOutline, label: 'MASTERED' }
  if (item.status === 'learning' && (item.seenCount ?? 0) === 0)
    return { dot: theme.learnTertiary, label: 'DO NOT KNOW' }
  if (item.status === 'learning') return { dot: theme.learnAccent, label: 'LEARNING PHASE' }
  return { dot: theme.learnOutline, label: 'LEARNING PHASE' }
}

export function LearnScreen({
  theme,
  mainLanguage,
  items,
  onReload,
}: {
  theme: AppTheme
  mainLanguage: string
  items: VocabItem[]
  onReload: () => Promise<void>
}) {
  const { fontHeadline, fontHeadlineSm, fontBody, fontLabel, fontLabelBold } = useGlassFonts()

  const learnDark = isLearnDarkUi(theme)

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<UiListFilter>('all')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [topMode, setTopMode] = useState<TopLearnMode>('deck')
  const [flashOpen, setFlashOpen] = useState(false)
  const [flashStartIndex, setFlashStartIndex] = useState(0)
  const [paraParts, setParaParts] = useState<ParagraphPart[] | null>(null)
  const [paraLoading, setParaLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (filter === 'fresh') {
        if (item.status !== 'learning') return false
        if ((item.seenCount ?? 0) > 0) return false
      }
      if (filter === 'learning') {
        if (item.status !== 'learning') return false
        if ((item.seenCount ?? 0) === 0) return false
      }
      if (filter === 'mastered' && item.status !== 'mastered') return false
      if (filter === 'flagged' && !item.flagged) return false
      if (kindFilter === 'word' && item.type !== 'word') return false
      if (kindFilter === 'phrase' && item.type !== 'phrase') return false
      if (q && !item.text.toLowerCase().includes(q)) return false
      return true
    })
  }, [items, filter, kindFilter, query])

  useEffect(() => {
    setParaParts(null)
  }, [filter, kindFilter, query])

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

  function confirmDelete(item: VocabItem) {
    Alert.alert('Remove word', `Remove “${item.text}” from your list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void removeItem(item.id),
      },
    ])
  }

  async function onSyncExposure(id: string) {
    try {
      await recordWordExposure(id)
      await onReload()
    } catch {
      /* ignore */
    }
  }

  function openFlashAt(index: number) {
    if (filtered.length === 0) return
    setFlashStartIndex(Math.max(0, Math.min(index, filtered.length - 1)))
    setFlashOpen(true)
  }

  async function onGenerateParagraph() {
    setParaLoading(true)
    setError(null)
    try {
      const learningInFilter = filtered.filter((i) => i.status === 'learning')
      const picked = learningInFilter.slice(0, Math.min(5, learningInFilter.length))
      if (!picked.length) {
        throw new Error('No Learning items in this filter. Adjust filters or mark words as Learning.')
      }
      const resp = await generateParagraph(picked)
      if (!resp.parts?.length) throw new Error('Empty paragraph response.')
      setParaParts(resp.parts)
      for (const p of picked) {
        void recordWordExposure(p.id).catch(() => {})
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate paragraph')
    } finally {
      setParaLoading(false)
    }
  }

  const searchPh = items.length >= 100 ? `Search ${items.length}+ words...` : `Search ${items.length} words...`

  const targetHighlightBg = learnDark ? 'rgba(189, 194, 255, 0.22)' : 'rgba(99, 102, 241, 0.18)'

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
        <GlassTitleHeader theme={theme} title="Study library" fontHeadlineSm={fontHeadlineSm} showProfileEntry={false} />
        <Text
          style={{
            fontFamily: fontBody,
            fontSize: 14,
            lineHeight: 20,
            color: theme.learnOnSurfaceVariant,
            marginTop: 8,
          }}
        >
          {topMode === 'deck'
            ? 'Browse and manage saved vocabulary. Tap a card to study it in focus mode.'
            : 'Read a formal paragraph that weaves in your Learning items—targets are highlighted.'}
        </Text>

        <WordStacksSection theme={theme} />

        <View
          style={{
            flexDirection: 'row',
            marginTop: 20,
            marginBottom: 20,
            backgroundColor: theme.learnViewToggleBg,
            borderRadius: 14,
            padding: 4,
            gap: 4,
          }}
        >
          {(['deck', 'paragraph'] as const).map((m) => {
            const active = topMode === m
            const label = m === 'deck' ? 'Deck' : 'Paragraph'
            return (
              <Pressable
                key={m}
                onPress={() => setTopMode(m)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: active ? theme.learnPillActiveBg : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontFamily: fontLabelBold,
                    fontSize: 14,
                    fontWeight: '700',
                    textAlign: 'center',
                    color: active ? theme.learnPillActiveText : theme.learnOnSurfaceVariant,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <View style={{ marginBottom: 22 }}>
          <GlassSearchField
            theme={theme}
            value={query}
            onChangeText={setQuery}
            placeholder={searchPh}
            learnDark={learnDark}
            fontBody={fontBody}
          />
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontFamily: fontHeadlineSm,
              fontSize: 10,
              fontWeight: '800',
              letterSpacing: 2,
              color: theme.learnOutline,
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            Filter
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
            {FILTER_PILLS.map(({ key, label }) => {
              const active = filter === key
              return (
                <Pressable
                  key={key}
                  onPress={() => setFilter(key)}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 11,
                    borderRadius: 999,
                    backgroundColor: active ? theme.learnPillActiveBg : theme.learnPillIdle,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fontLabelBold,
                      fontSize: 12,
                      fontWeight: '700',
                      color: active ? theme.learnPillActiveText : theme.learnOnSurfaceVariant,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 8 }}>
            <Text
              style={{
                fontFamily: fontLabel,
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 1.2,
                color: theme.learnOutline,
                textTransform: 'uppercase',
                marginRight: 4,
              }}
            >
              Type
            </Text>
            {(['all', 'word', 'phrase'] as KindFilter[]).map((k) => {
              const active = kindFilter === k
              const lbl = k === 'all' ? 'All' : k === 'word' ? 'Words' : 'Phrases'
              return (
                <Pressable
                  key={k}
                  onPress={() => setKindFilter(k)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: active ? theme.learnPillActiveBg : theme.learnPillIdle,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fontLabel,
                      fontSize: 11,
                      fontWeight: '600',
                      color: active ? theme.learnPillActiveText : theme.learnOnSurfaceVariant,
                    }}
                  >
                    {lbl}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        {topMode === 'deck' ? (
          <View style={{ gap: 18 }}>
            {filtered.length === 0 ? (
              <Text style={{ fontFamily: fontBody, color: theme.learnOnSurfaceVariant, fontSize: 15 }}>
                No words match these filters.
              </Text>
            ) : (
              filtered.map((item, index) => (
                <WordGlassCard
                  key={item.id}
                  theme={theme}
                  mainLanguage={mainLanguage}
                  item={item}
                  learnDark={learnDark}
                  fontHeadline={fontHeadline}
                  fontBody={fontBody}
                  fontLabel={fontLabel}
                  leftAccent={cardLeftAccent(theme, item)}
                  footer={statusFooter(theme, item)}
                  onPressStudy={() => openFlashAt(index)}
                  onToggleFlag={() => void toggleFlag(item.id, !item.flagged)}
                  onSync={() => void onSyncExposure(item.id)}
                  onDelete={() => confirmDelete(item)}
                  onSetLearning={() => void updateStatus(item.id, 'learning')}
                  onSetMastered={() => void updateStatus(item.id, 'mastered')}
                />
              ))
            )}
          </View>
        ) : (
          <GlassPanel theme={theme} learnDark={learnDark} leftAccent={theme.learnTertiary}>
            <Text
              style={{
                fontFamily: fontBody,
                fontSize: 14,
                lineHeight: 21,
                color: theme.learnOnSurfaceVariant,
                marginBottom: 16,
              }}
            >
              Uses up to five Learning items from your current filter, in list order.
            </Text>
            <Pressable
              onPress={() => void onGenerateParagraph()}
              disabled={paraLoading}
              style={{
                backgroundColor: theme.learnPillActiveBg,
                paddingVertical: 14,
                paddingHorizontal: 20,
                borderRadius: 999,
                opacity: paraLoading ? 0.7 : 1,
                alignSelf: 'flex-start',
              }}
            >
              <Text
                style={{
                  fontFamily: fontLabelBold,
                  color: theme.learnPillActiveText,
                  fontSize: 14,
                  fontWeight: '700',
                }}
              >
                {paraLoading ? 'Generating…' : 'Generate paragraph'}
              </Text>
            </Pressable>
            {error ? (
              <Text style={{ fontFamily: fontBody, color: theme.danger, marginTop: 12, fontSize: 14 }}>{error}</Text>
            ) : null}
            {paraParts && paraParts.length > 0 ? (
              <Text
                style={{
                  fontFamily: fontBody,
                  fontSize: 17,
                  lineHeight: 28,
                  color: theme.learnOnSurface,
                  marginTop: 20,
                }}
              >
                {paraParts.map((p, i) =>
                  p.kind === 'text' ? (
                    <Text key={i}>{p.value}</Text>
                  ) : (
                    <Text
                      key={i}
                      style={{
                        backgroundColor: targetHighlightBg,
                        fontWeight: '800',
                        color: theme.learnOnSurface,
                      }}
                    >
                      {p.text}
                    </Text>
                  ),
                )}
              </Text>
            ) : !error && !paraLoading ? (
              <Text
                style={{
                  fontFamily: fontBody,
                  fontSize: 15,
                  lineHeight: 22,
                  color: theme.learnOnSurfaceVariant,
                  marginTop: 16,
                }}
              >
                Generate a paragraph to practice reading your vocabulary in context.
              </Text>
            ) : null}
          </GlassPanel>
        )}
      </ScrollView>

      <LearnFlashcardModal
        visible={flashOpen}
        onClose={() => setFlashOpen(false)}
        items={filtered}
        initialIndex={flashStartIndex}
        mainLanguage={mainLanguage}
        theme={theme}
      />
    </GlassScreenRoot>
  )
}

function WordGlassCard({
  theme,
  mainLanguage,
  item,
  learnDark,
  fontHeadline,
  fontBody,
  fontLabel,
  leftAccent,
  footer,
  onPressStudy,
  onToggleFlag,
  onSync,
  onDelete,
  onSetLearning,
  onSetMastered,
}: {
  theme: AppTheme
  mainLanguage: string
  item: VocabItem
  learnDark: boolean
  fontHeadline?: string
  fontBody?: string
  fontLabel?: string
  leftAccent: string
  footer: { dot: string; label: string }
  onPressStudy: () => void
  onToggleFlag: () => void
  onSync: () => void
  onDelete: () => void
  onSetLearning: () => void
  onSetMastered: () => void
}) {
  const typeLabel = item.type === 'word' ? 'WORD' : 'PHRASE'
  const typeMuted = item.type === 'word' ? theme.learnAccent : theme.learnTertiary
  const nativeLine = getNativeGloss(item, mainLanguage)

  return (
    <View
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        borderLeftWidth: 4,
        borderLeftColor: leftAccent,
        borderWidth: 1,
        borderColor: theme.learnGlassBorder,
        ...glassScreenShadow(theme),
      }}
    >
      <BlurView
        intensity={learnDark ? 28 : 18}
        tint={learnDark ? 'dark' : 'light'}
        style={{
          backgroundColor: theme.learnGlass,
          padding: 22,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Pressable onPress={onPressStudy} style={{ flex: 1, paddingRight: 12 }} accessibilityRole="button" accessibilityLabel="Open study card">
            <Text
              style={{
                fontFamily: fontLabel,
                fontSize: 10,
                fontWeight: '800',
                letterSpacing: 2,
                color: typeMuted,
                opacity: 0.72,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              {typeLabel}
            </Text>
            <Text
              style={{
                fontFamily: fontHeadline,
                fontSize: 28,
                fontWeight: '800',
                color: theme.learnOnSurface,
                letterSpacing: -0.5,
              }}
            >
              {item.text}
            </Text>
            <View style={{ marginTop: 12 }}>
              <Text
                style={{
                  fontFamily: fontBody,
                  fontSize: 14,
                  lineHeight: 21,
                  color: theme.learnOnSurfaceVariant,
                }}
              >
                {item.simpleDefinition || item.definition}
              </Text>
              {nativeLine ? (
                <Text
                  style={{
                    fontFamily: fontBody,
                    fontSize: 13,
                    lineHeight: 19,
                    color: theme.learnOutline,
                    fontStyle: 'italic',
                    marginTop: 8,
                  }}
                >
                  {nativeLine}
                </Text>
              ) : null}
            </View>
            <Text
              style={{
                fontFamily: fontLabel,
                fontSize: 11,
                fontWeight: '700',
                color: theme.learnAccent,
                marginTop: 10,
              }}
            >
              Tap to study
            </Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <Pressable onPress={onToggleFlag} hitSlop={8} style={{ padding: 6 }}>
              <Ionicons
                name={item.flagged ? 'flag' : 'flag-outline'}
                size={22}
                color={item.flagged ? theme.learnAccent : theme.learnOutline}
              />
            </Pressable>
            <Pressable onPress={onSync} hitSlop={8} style={{ padding: 6 }}>
              <MaterialIcons name="sync" size={22} color={theme.learnOutline} />
            </Pressable>
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16, marginBottom: 16 }}>
          <MiniStatusChip
            theme={theme}
            learnDark={learnDark}
            fontLabel={fontLabel}
            label="Learning"
            active={item.status === 'learning'}
            onPress={onSetLearning}
          />
          <MiniStatusChip
            theme={theme}
            learnDark={learnDark}
            fontLabel={fontLabel}
            label="Mastered"
            active={item.status === 'mastered'}
            onPress={onSetMastered}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: footer.dot,
              }}
            />
            <Text
              style={{
                fontFamily: fontLabel,
                fontSize: 10,
                fontWeight: '800',
                letterSpacing: 0.5,
                color: theme.learnOutline,
              }}
            >
              {footer.label}
            </Text>
          </View>
          <Pressable onPress={onDelete} hitSlop={10} style={{ padding: 6 }}>
            <MaterialIcons name="delete-outline" size={22} color={theme.learnOutline} />
          </Pressable>
        </View>
      </BlurView>
    </View>
  )
}

function MiniStatusChip({
  theme,
  learnDark,
  fontLabel,
  label,
  active,
  onPress,
}: {
  theme: AppTheme
  learnDark: boolean
  fontLabel?: string
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? theme.learnAccent : theme.learnGlassBorder,
        backgroundColor: active ? (learnDark ? 'rgba(189, 194, 255, 0.14)' : 'rgba(99, 102, 241, 0.12)') : 'transparent',
      }}
    >
      <Text
        style={{
          fontFamily: fontLabel,
          fontSize: 12,
          fontWeight: '700',
          color: active ? theme.learnAccent : theme.learnOnSurfaceVariant,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}
