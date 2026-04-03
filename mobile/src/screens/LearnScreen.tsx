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
import { generateParagraph } from '../lib/api'
import {
  deleteVocabItem,
  recordWordExposure,
  toggleVocabFlagged,
  updateVocabStatus,
} from '../lib/vocab'
import type { AppTheme } from '../theme'

/** Preset applied when navigating from Today (not shown as a pill). */
export type LearnTabPreset = 'learning' | 'flagged'

type UiListFilter = 'all' | 'fresh' | 'learning' | 'mastered' | 'flagged' | 'learning_any'
type KindFilter = 'all' | 'word' | 'phrase'
type ViewMode = 'list' | 'flashcards' | 'paragraph'

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
  learnPreset,
  onConsumedLearnPreset,
  onOpenProfile,
}: {
  theme: AppTheme
  mainLanguage: string
  items: VocabItem[]
  onReload: () => Promise<void>
  learnPreset?: LearnTabPreset | null
  onConsumedLearnPreset?: () => void
  onOpenProfile?: () => void
}) {
  const { fontHeadline, fontHeadlineSm, fontBody, fontLabel, fontLabelBold } = useGlassFonts()

  const learnDark = isLearnDarkUi(theme)

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<UiListFilter>('all')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [mode, setMode] = useState<ViewMode>('list')
  const [flashIndex, setFlashIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [para, setPara] = useState<string>('')
  const [paraLoading, setParaLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!learnPreset) return
    if (learnPreset === 'learning') setFilter('learning_any')
    if (learnPreset === 'flagged') setFilter('flagged')
    onConsumedLearnPreset?.()
  }, [learnPreset, onConsumedLearnPreset])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (filter === 'learning_any' && item.status !== 'learning') return false
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

  const flashItem = filtered[flashIndex] ?? null
  const flashNativeGloss = useMemo(
    () => (flashItem ? getNativeGloss(flashItem, mainLanguage) : undefined),
    [flashItem, mainLanguage],
  )

  useEffect(() => {
    setFlashIndex(0)
    setShowAnswer(false)
  }, [filter, kindFilter, query, mode])

  useEffect(() => {
    if (filtered.length === 0) {
      setFlashIndex(0)
      return
    }
    if (flashIndex >= filtered.length) setFlashIndex(0)
  }, [filtered.length, flashIndex])

  useEffect(() => {
    if (mode !== 'flashcards' || !flashItem) return
    void recordWordExposure(flashItem.id).catch(() => {})
  }, [mode, flashItem])

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

  async function onGenerateParagraph() {
    setParaLoading(true)
    setError(null)
    try {
      const pool = items.filter((i) => i.status === 'learning')
      if (!pool.length) throw new Error('No Learning items yet. Add words or mark items as Learning.')
      const copy = [...pool]
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
      }
      const picked = copy.slice(0, Math.min(5, copy.length))
      const resp = await generateParagraph(picked)
      const text = resp.parts
        .map((p) => (p.kind === 'text' ? p.value : p.text))
        .join('')
        .trim()
      setPara(text)
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
        <GlassTitleHeader
          theme={theme}
          title="My Learning Path"
          onOpenProfile={onOpenProfile}
          fontHeadlineSm={fontHeadlineSm}
        />

        <View style={{ marginTop: 20, marginBottom: 28 }}>
          <GlassSearchField
            theme={theme}
            value={query}
            onChangeText={setQuery}
            placeholder={searchPh}
            learnDark={learnDark}
            fontBody={fontBody}
          />
        </View>

        <View style={{ marginBottom: 28 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <Text
              style={{
                fontFamily: fontHeadlineSm,
                fontSize: 10,
                fontWeight: '800',
                letterSpacing: 2,
                color: theme.learnOutline,
                textTransform: 'uppercase',
              }}
            >
              Filter knowledge
            </Text>
            <View
              style={{
                flexDirection: 'row',
                gap: 2,
                backgroundColor: theme.learnViewToggleBg,
                borderRadius: 12,
                padding: 4,
              }}
            >
              {(
                [
                  { m: 'list' as const, icon: 'view-list' as const },
                  { m: 'flashcards' as const, icon: 'view-carousel' as const },
                  { m: 'paragraph' as const, icon: 'description' as const },
                ] as const
              ).map(({ m, icon }) => (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: mode === m ? theme.learnPillIdle : 'transparent',
                  }}
                >
                  <MaterialIcons
                    name={icon}
                    size={18}
                    color={mode === m ? theme.learnAccent : theme.learnOutline}
                  />
                </Pressable>
              ))}
            </View>
          </View>

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

          {filter === 'learning_any' ? (
            <Text
              style={{
                fontFamily: fontBody,
                fontSize: 12,
                color: theme.learnOnSurfaceVariant,
                marginTop: 10,
                opacity: 0.9,
              }}
            >
              Showing every word still marked Learning (including new).
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 8 }}>
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

        {mode === 'list' ? (
          <View style={{ gap: 18 }}>
            {filtered.length === 0 ? (
              <Text style={{ fontFamily: fontBody, color: theme.learnOnSurfaceVariant, fontSize: 15 }}>
                No words match these filters.
              </Text>
            ) : (
              filtered.map((item) => (
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
                  onToggleFlag={() => void toggleFlag(item.id, !item.flagged)}
                  onSync={() => void onSyncExposure(item.id)}
                  onDelete={() => confirmDelete(item)}
                  onSetLearning={() => void updateStatus(item.id, 'learning')}
                  onSetMastered={() => void updateStatus(item.id, 'mastered')}
                />
              ))
            )}
          </View>
        ) : null}

        {mode === 'flashcards' ? (
          <GlassPanel theme={theme} learnDark={learnDark} leftAccent={theme.learnAccent}>
            {!flashItem ? (
              <Text style={{ fontFamily: fontBody, color: theme.learnOnSurfaceVariant, fontSize: 15 }}>
                No words to review for this filter.
              </Text>
            ) : (
              <>
                <Text
                  style={{
                    fontFamily: fontHeadline,
                    fontSize: 28,
                    fontWeight: '800',
                    color: theme.learnOnSurface,
                    marginBottom: 12,
                  }}
                >
                  {flashItem.text}
                </Text>
                <View style={{ gap: 8 }}>
                  <Text style={{ fontFamily: fontBody, fontSize: 15, lineHeight: 22, color: theme.learnOnSurfaceVariant }}>
                    {showAnswer
                      ? flashItem.simpleDefinition || flashItem.definition
                      : 'Tap reveal to see the definition.'}
                  </Text>
                  {showAnswer && flashNativeGloss ? (
                    <Text
                      style={{
                        fontFamily: fontBody,
                        fontSize: 14,
                        lineHeight: 20,
                        color: theme.learnOutline,
                        fontStyle: 'italic',
                      }}
                    >
                      {flashNativeGloss}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => setShowAnswer((v) => !v)}
                  style={{
                    marginTop: 20,
                    alignSelf: 'flex-start',
                    backgroundColor: theme.learnPillActiveBg,
                    paddingVertical: 12,
                    paddingHorizontal: 22,
                    borderRadius: 999,
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
                    {showAnswer ? 'Hide' : 'Reveal'}
                  </Text>
                </Pressable>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 }}>
                  <Pressable
                    onPress={() => {
                      setFlashIndex((v) => (v <= 0 ? filtered.length - 1 : v - 1))
                      setShowAnswer(false)
                    }}
                  >
                    <Text style={{ fontFamily: fontLabelBold, color: theme.learnAccent, fontSize: 14 }}>
                      Previous
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setFlashIndex((v) => (v + 1 >= filtered.length ? 0 : v + 1))
                      setShowAnswer(false)
                    }}
                  >
                    <Text style={{ fontFamily: fontLabelBold, color: theme.learnAccent, fontSize: 14 }}>
                      Next
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </GlassPanel>
        ) : null}

        {mode === 'paragraph' ? (
          <GlassPanel theme={theme} learnDark={learnDark} leftAccent={theme.learnTertiary}>
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
            <Text
              style={{
                fontFamily: fontBody,
                fontSize: 15,
                lineHeight: 22,
                color: theme.learnOnSurfaceVariant,
                marginTop: 16,
              }}
            >
              {para ||
                'Generate a short paragraph using up to five words you marked as Learning.'}
            </Text>
          </GlassPanel>
        ) : null}
      </ScrollView>
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
          <View style={{ flex: 1, paddingRight: 12 }}>
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
          </View>
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

        <View style={{ marginTop: 12, marginBottom: 18 }}>
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

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
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
            paddingTop: 14,
            borderTopWidth: 1,
            borderTopColor: theme.learnGlassBorder,
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

