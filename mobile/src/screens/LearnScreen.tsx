import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { bucketFromWord } from '@shared/learningBuckets'
import { pickParagraphWords } from '@shared/paragraphPicker'
import { FREE_MAX_SAVED_WORDS, WORD_STACK_CATALOG, canAccessStack } from '@shared/freemium'
import type { GeneratedResult, UserStack, VocabItem } from '@shared/types'
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
import { CreateUserStackModal } from '../components/CreateUserStackModal'
import { StackAssignmentSheet, type PendingStackSave } from '../components/StackAssignmentSheet'
import { generateParagraph, generateWord } from '../lib/api'
import { listUserStacks, replaceWordUserStackMembership } from '../lib/userStacks'
import { saveWord } from '../lib/words'
import { useSubscription } from '../context/SubscriptionContext'
import {
  applyParagraphExposure,
  deleteVocabItem,
  recordWordExposure,
  toggleVocabFlagged,
} from '../lib/vocab'
import type { AppTheme } from '../theme'

type UiListFilter = 'all' | 'new' | 'learning' | 'familiar' | 'mastered'

type ParagraphPart =
  | { kind: 'text'; value: string }
  | { kind: 'target'; text: string }

const FILTER_PILLS: { key: UiListFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'learning', label: 'Learning' },
  { key: 'familiar', label: 'Familiar' },
  { key: 'mastered', label: 'Mastered' },
]

function cardLeftAccent(theme: AppTheme, item: VocabItem): string {
  const b = bucketFromWord(item)
  if (b === 'mastered') return theme.learnOutline
  if (b === 'new') return theme.learnTertiary
  if (b === 'familiar') return theme.learnAccent
  return theme.learnAccent
}

function statusShortLabel(item: VocabItem): string {
  const b = bucketFromWord(item)
  return b.charAt(0).toUpperCase() + b.slice(1)
}

export function LearnScreen({
  theme,
  mainLanguage,
  items,
  onReload,
  onOpenWordStacks,
  onOpenUserStackDetail,
}: {
  theme: AppTheme
  mainLanguage: string
  items: VocabItem[]
  onReload: () => Promise<void>
  onOpenWordStacks: () => void
  onOpenUserStackDetail: (userStackId: string) => void
}) {
  const { fontHeadlineSm, fontBody, fontLabel, fontLabelBold } = useGlassFonts()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const { isPro, loading: subLoading, openPaywall } = useSubscription()

  const learnDark = isLearnDarkUi(theme)

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<UiListFilter>('learning')
  const [flashOpen, setFlashOpen] = useState(false)
  const [flashStartIndex, setFlashStartIndex] = useState(0)
  const [paraParts, setParaParts] = useState<ParagraphPart[] | null>(null)
  const [paraLoading, setParaLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionsFor, setActionsFor] = useState<VocabItem | null>(null)

  const [genText, setGenText] = useState('')
  const [genState, setGenState] = useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready'; result: GeneratedResult }
    | { status: 'error'; message: string }
  >({ status: 'idle' })
  const [genSaved, setGenSaved] = useState(false)
  const [stackAssignPending, setStackAssignPending] = useState<(PendingStackSave & { source: 'quick' | 'regenerate' }) | null>(
    null,
  )
  const [membershipEdit, setMembershipEdit] = useState<{ wordId: string; initialIds: string[] } | null>(null)
  const [stackSaving, setStackSaving] = useState(false)
  const [myStacks, setMyStacks] = useState<UserStack[]>([])
  const [myStacksLoading, setMyStacksLoading] = useState(false)
  const [createStackOpen, setCreateStackOpen] = useState(false)

  const reloadMyStacks = useCallback(async () => {
    setMyStacksLoading(true)
    try {
      const list = await listUserStacks()
      setMyStacks(list)
    } finally {
      setMyStacksLoading(false)
    }
  }, [])

  useEffect(() => {
    void reloadMyStacks()
  }, [reloadMyStacks])
  const genCanGenerate = genText.trim().length > 0
  const genModalOpen = genState.status !== 'idle'

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (filter !== 'all' && bucketFromWord(item) !== filter) return false
      if (q && !item.text.toLowerCase().includes(q)) return false
      return true
    })
  }, [items, filter, query])

  useEffect(() => {
    setParaParts(null)
  }, [filter, query])

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

  async function regenerateWord(item: VocabItem) {
    try {
      const result = await generateWord(item.text.trim(), mainLanguage)
      setStackAssignPending({
        text: item.text.trim(),
        result,
        mainLanguage,
        source: 'regenerate',
      })
    } catch (e) {
      Alert.alert('Regenerate failed', e instanceof Error ? e.message : 'Unknown error')
    }
  }

  async function handleMembershipConfirm(opts: { deckOnly: boolean; selectedStackIds: string[] }) {
    if (!membershipEdit) return
    setStackSaving(true)
    try {
      const next = opts.deckOnly ? [] : opts.selectedStackIds
      await replaceWordUserStackMembership(membershipEdit.wordId, next)
      setMembershipEdit(null)
      await onReload()
      await reloadMyStacks()
    } catch (e) {
      Alert.alert('Update failed', e instanceof Error ? e.message : 'Unknown error.')
    } finally {
      setStackSaving(false)
    }
  }

  async function handleStackAssignConfirm(opts: { deckOnly: boolean; selectedStackIds: string[] }) {
    if (!stackAssignPending) return
    setStackSaving(true)
    try {
      await saveWord({
        text: stackAssignPending.text,
        result: stackAssignPending.result,
        mainLanguage: stackAssignPending.mainLanguage,
        userStackIds: opts.deckOnly ? [] : opts.selectedStackIds,
      })
      const src = stackAssignPending.source
      setStackAssignPending(null)
      if (src === 'quick') {
        setGenSaved(true)
        setGenState({ status: 'idle' })
        setGenText('')
      }
      await onReload()
      await reloadMyStacks()
      if (src === 'regenerate') {
        Alert.alert('Card updated', 'This word was regenerated with the latest format.')
      }
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setStackSaving(false)
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
      const picked = pickParagraphWords(items, Date.now(), 5)
      if (!picked.length) {
        throw new Error(
          'No eligible words yet. Complete a few sessions so words have exposure (score above 0) before paragraph practice.',
        )
      }
      const resp = await generateParagraph(picked)
      if (!resp.parts?.length) throw new Error('Empty paragraph response.')
      setParaParts(resp.parts)
      await applyParagraphExposure(picked.map((p) => p.id))
      await onReload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate paragraph')
    } finally {
      setParaLoading(false)
    }
  }

  const searchPh = items.length >= 100 ? `Search ${items.length}+ words...` : `Search ${items.length} words...`

  const targetHighlightBg = learnDark ? 'rgba(189, 194, 255, 0.22)' : 'rgba(99, 102, 241, 0.18)'

  async function onGenerateWord() {
    if (!genCanGenerate) return
    setGenState({ status: 'loading' })
    setGenSaved(false)
    try {
      const result = await generateWord(genText.trim(), mainLanguage)
      setGenState({ status: 'ready', result })
    } catch (e) {
      setGenState({ status: 'error', message: e instanceof Error ? e.message : 'Failed to generate' })
    }
  }

  function closeGenModal() {
    if (genState.status === 'loading') return
    setGenState({ status: 'idle' })
  }

  function onSaveGenerated() {
    if (genState.status !== 'ready') return
    const trimmed = genText.trim()
    const key = trimmed.toLowerCase()
    const alreadySaved = items.some((i) => i.text.trim().toLowerCase() === key || (i.textLower && i.textLower === key))
    if (!subLoading && !isPro && !alreadySaved && items.length >= FREE_MAX_SAVED_WORDS) {
      openPaywall()
      return
    }
    setStackAssignPending({
      text: trimmed,
      result: genState.result,
      mainLanguage,
      source: 'quick',
    })
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
        <GlassTitleHeader theme={theme} title="Learn" fontHeadlineSm={fontHeadlineSm} showProfileEntry={false} />
        <Text
          style={{
            fontFamily: fontBody,
            fontSize: 14,
            lineHeight: 20,
            color: theme.learnOnSurfaceVariant,
            marginTop: 8,
          }}
        >
          Your saved vocabulary. Tap a row to study.
        </Text>

        {/* Quick capture (moved from Today) */}
        <View
          style={{
            marginTop: 18,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.learnGlassBorder,
            backgroundColor: theme.surface2,
            padding: 16,
            ...glassScreenShadow(theme),
          }}
        >
          <Text style={{ fontFamily: fontHeadlineSm, fontSize: 10, fontWeight: '800', letterSpacing: 2, color: theme.learnOutline, textTransform: 'uppercase' }}>
            Quick capture
          </Text>
          <View style={{ marginTop: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <TextInput
                value={genText}
                onChangeText={(v) => {
                  setGenText(v)
                  setGenSaved(false)
                }}
                placeholder="Look up or add a word…"
                placeholderTextColor={`${theme.learnOutline}aa`}
                style={{
                  fontFamily: fontBody,
                  fontSize: 15,
                  color: theme.learnOnSurface,
                  backgroundColor: theme.learnSearchBg,
                  borderRadius: 999,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                }}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (genCanGenerate && genState.status !== 'loading') void onGenerateWord()
                }}
              />
            </View>
            <Pressable
              onPress={() => void onGenerateWord()}
              disabled={!genCanGenerate || genState.status === 'loading'}
              style={({ pressed }) => ({
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 999,
                backgroundColor: theme.learnAccent,
                opacity: !genCanGenerate || genState.status === 'loading' ? 0.5 : pressed ? 0.9 : 1,
              })}
            >
              {genState.status === 'loading' ? (
                <ActivityIndicator color={theme.learnPillActiveText} />
              ) : (
                <Text style={{ fontFamily: fontLabelBold, fontSize: 13, fontWeight: '800', color: theme.learnPillActiveText }}>
                  Generate
                </Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Word stacks (horizontal row) */}
        <View style={{ marginTop: 18 }}>
          <Text style={{ fontFamily: fontHeadlineSm, fontSize: 10, fontWeight: '800', letterSpacing: 2, color: theme.learnOutline, textTransform: 'uppercase', marginBottom: 10 }}>
            Word stacks
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 8 }}>
            <Pressable
              onPress={onOpenWordStacks}
              style={({ pressed }) => ({
                width: 160,
                padding: 14,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.learnGlassBorder,
                backgroundColor: theme.surface2,
                opacity: pressed ? 0.92 : 1,
                ...glassScreenShadow(theme),
              })}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <MaterialIcons name="layers" size={20} color={theme.learnAccent} />
                <MaterialIcons name="chevron-right" size={20} color={theme.learnOutline} />
              </View>
              <Text style={{ fontFamily: fontHeadlineSm, fontSize: 14, fontWeight: '900', color: theme.learnOnSurface, marginTop: 10 }}>
                Browse all
              </Text>
              <Text style={{ fontFamily: fontBody, fontSize: 12, color: theme.learnOnSurfaceVariant, marginTop: 4 }}>
                Curated packs
              </Text>
            </Pressable>

            {WORD_STACK_CATALOG.map((s) => {
              const unlocked = canAccessStack(s.id, isPro)
              return (
                <Pressable
                  key={s.id}
                  onPress={onOpenWordStacks}
                  style={({ pressed }) => ({
                    width: 180,
                    padding: 14,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: theme.learnGlassBorder,
                    backgroundColor: theme.surface2,
                    opacity: pressed ? 0.92 : 1,
                    ...glassScreenShadow(theme),
                  })}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <Text
                      numberOfLines={2}
                      style={{ flex: 1, fontFamily: fontHeadlineSm, fontSize: 13, fontWeight: '900', color: theme.learnOnSurface }}
                    >
                      {s.title}
                    </Text>
                    {unlocked ? null : <MaterialIcons name="lock" size={18} color={theme.learnOutline} />}
                  </View>
                  <Text style={{ fontFamily: fontBody, fontSize: 12, color: theme.learnOnSurfaceVariant, marginTop: 8 }}>
                    {s.wordCount} words · {s.tier === 'pro' ? 'Pro' : 'Free'}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        </View>

        {/* My stacks (user-created) */}
        <View style={{ marginTop: 22 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text
              style={{
                fontFamily: fontHeadlineSm,
                fontSize: 10,
                fontWeight: '800',
                letterSpacing: 2,
                color: theme.learnAccent,
                textTransform: 'uppercase',
              }}
            >
              My stacks
            </Text>
            <Pressable onPress={() => setCreateStackOpen(true)} hitSlop={8}>
              <Text style={{ fontFamily: fontLabelBold, fontSize: 13, color: theme.learnAccent }}>+ New stack</Text>
            </Pressable>
          </View>
          {myStacksLoading ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <ActivityIndicator color={theme.learnAccent} />
            </View>
          ) : myStacks.length === 0 ? (
            <View
              style={{
                padding: 18,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.learnGlassBorder,
                backgroundColor: theme.surface2,
                ...glassScreenShadow(theme),
              }}
            >
              <Text style={{ fontFamily: fontBody, fontSize: 14, color: theme.learnOnSurfaceVariant, textAlign: 'center' }}>
                Create your own word stack to group related words. They'll show up here.
              </Text>
              <Pressable onPress={() => setCreateStackOpen(true)} style={{ marginTop: 14, alignSelf: 'center', paddingVertical: 8 }}>
                <Text style={{ fontFamily: fontLabelBold, fontSize: 15, color: theme.learnAccent }}>+ Create your first stack</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 8 }}>
              {myStacks.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => onOpenUserStackDetail(s.id)}
                  style={({ pressed }) => ({
                    width: 168,
                    padding: 14,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: theme.learnGlassBorder,
                    backgroundColor: theme.surface2,
                    opacity: pressed ? 0.92 : 1,
                    ...glassScreenShadow(theme),
                  })}
                >
                  <Text
                    numberOfLines={2}
                    style={{ fontFamily: fontHeadlineSm, fontSize: 14, fontWeight: '900', color: theme.learnOnSurface }}
                  >
                    {s.name}
                  </Text>
                  <Text style={{ fontFamily: fontBody, fontSize: 12, color: theme.learnOnSurfaceVariant, marginTop: 8 }}>
                    {s.wordCount} word{s.wordCount === 1 ? '' : 's'}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={{ marginTop: 22, marginBottom: 22 }}>
          <GlassSearchField
            theme={theme}
            value={query}
            onChangeText={setQuery}
            placeholder={searchPh}
            learnDark={learnDark}
            fontBody={fontBody}
          />
        </View>

        <View style={{ marginBottom: 20 }}>
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
            Status
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
        </View>

        <View style={{ gap: 10, marginBottom: 24 }}>
          {filtered.length === 0 ? (
            <Text style={{ fontFamily: fontBody, color: theme.learnOnSurfaceVariant, fontSize: 15 }}>
              No words match these filters.
            </Text>
          ) : (
            filtered.map((item, index) => (
              <LearnWordRow
                key={item.id}
                theme={theme}
                mainLanguage={mainLanguage}
                item={item}
                learnDark={learnDark}
                fontHeadlineSm={fontHeadlineSm}
                fontBody={fontBody}
                fontLabel={fontLabel}
                leftAccent={cardLeftAccent(theme, item)}
                statusLabel={statusShortLabel(item)}
                onPressStudy={() => openFlashAt(index)}
                onOpenActions={() => setActionsFor(item)}
              />
            ))
          )}
        </View>

        <GlassPanel theme={theme} learnDark={learnDark} leftAccent={theme.learnTertiary}>
          <Text
            style={{
              fontFamily: fontHeadlineSm,
              fontSize: 13,
              fontWeight: '800',
              color: theme.learnOnSurface,
              marginBottom: 6,
            }}
          >
            Reading practice
          </Text>
          <Text
            style={{
              fontFamily: fontBody,
              fontSize: 14,
              lineHeight: 21,
              color: theme.learnOnSurfaceVariant,
              marginBottom: 14,
            }}
          >
            Picks up to five words that benefit from reading in context (by exposure score). Words must have been seen in study at least once.
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
      </ScrollView>

      <LearnFlashcardModal
        visible={flashOpen}
        onClose={() => setFlashOpen(false)}
        items={filtered}
        initialIndex={flashStartIndex}
        mainLanguage={mainLanguage}
        theme={theme}
      />

      <WordActionsSheet
        visible={!!actionsFor}
        theme={theme}
        item={actionsFor}
        fontBody={fontBody}
        fontLabelBold={fontLabelBold}
        bottomInset={insets.bottom}
        onClose={() => setActionsFor(null)}
        onToggleFlag={(item) => void toggleFlag(item.id, !item.flagged)}
        onSync={(item) => void onSyncExposure(item.id)}
        onRegenerate={(item) => void regenerateWord(item)}
        onAddToStacks={(item) => {
          setActionsFor(null)
          setMembershipEdit({ wordId: item.id, initialIds: item.userStackIds ?? [] })
        }}
        onDelete={(item) => {
          setActionsFor(null)
          confirmDelete(item)
        }}
      />

      {/* Generated word modal */}
      <Modal visible={genModalOpen} animationType="slide" transparent onRequestClose={closeGenModal}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' }}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeGenModal} accessibilityLabel="Close" />
          <View style={{ flex: 1, justifyContent: 'flex-end', pointerEvents: 'box-none' }}>
            <View
              style={{
                backgroundColor: theme.learnScreenBg,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                maxHeight: Math.min(Math.round(windowHeight * 0.92), windowHeight - insets.top - 12),
                width: '100%',
                overflow: 'hidden',
                paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 12),
              }}
            >
              <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: fontHeadlineSm, fontSize: 16, fontWeight: '900', color: theme.learnOnSurface }}>
                  New card
                </Text>
                <Pressable onPress={closeGenModal} hitSlop={12}>
                  <Ionicons name="close" size={24} color={theme.learnOutline} />
                </Pressable>
              </View>

              {genState.status === 'loading' ? (
                <View style={{ padding: 20, paddingBottom: 28 }}>
                  <ActivityIndicator color={theme.learnAccent} />
                  <Text style={{ marginTop: 12, fontFamily: fontBody, fontSize: 13, color: theme.learnOnSurfaceVariant }}>
                    Generating a card for “{genText.trim() || '…'}”
                  </Text>
                </View>
              ) : null}

              {genState.status === 'error' ? (
                <View style={{ padding: 20, paddingBottom: 28 }}>
                  <Text style={{ fontFamily: fontHeadlineSm, fontSize: 16, fontWeight: '900', color: theme.learnOnSurface }}>
                    Something went wrong
                  </Text>
                  <Text style={{ marginTop: 10, fontFamily: fontBody, fontSize: 14, color: theme.danger }}>
                    {genState.message}
                  </Text>
                </View>
              ) : null}

              {genState.status === 'ready' ? (
                <>
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator
                    bounces
                    nestedScrollEnabled
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
                  >
                    <Text style={{ fontFamily: fontHeadlineSm, fontSize: 24, fontWeight: '900', color: theme.learnOnSurface }}>
                      {genText.trim()}
                    </Text>
                    <Text style={{ marginTop: 10, fontFamily: fontBody, fontSize: 14, lineHeight: 20, color: theme.learnOnSurfaceVariant }}>
                      {genState.result.simpleDefinition?.trim() || genState.result.definition?.trim() || ''}
                    </Text>
                    {genState.result.exampleSentence?.trim() ? (
                      <View style={{ marginTop: 14, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.learnGlassBorder }}>
                        <Text style={{ fontFamily: fontLabelBold, fontSize: 12, fontWeight: '800', color: theme.learnOutline, letterSpacing: 0.4 }}>
                          Example
                        </Text>
                        <Text style={{ marginTop: 8, fontFamily: fontBody, fontSize: 14, lineHeight: 20, color: theme.learnOnSurface }}>
                          {genState.result.exampleSentence.trim()}
                        </Text>
                      </View>
                    ) : null}
                  </ScrollView>

                  <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 10 }}>
                    <Pressable
                      onPress={closeGenModal}
                      style={({ pressed }) => ({
                        flex: 1,
                        paddingVertical: 14,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: theme.learnGlassBorder,
                        alignItems: 'center',
                        opacity: pressed ? 0.92 : 1,
                      })}
                    >
                      <Text style={{ fontFamily: fontLabelBold, fontSize: 15, fontWeight: '800', color: theme.learnOnSurface }}>
                        Close
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onSaveGenerated()}
                      disabled={stackSaving || genSaved}
                      style={({ pressed }) => ({
                        flex: 1,
                        paddingVertical: 14,
                        borderRadius: 14,
                        backgroundColor: genSaved ? theme.success : theme.learnAccent,
                        alignItems: 'center',
                        opacity: stackSaving ? 0.7 : pressed ? 0.92 : 1,
                      })}
                    >
                      <Text style={{ fontFamily: fontLabelBold, fontSize: 15, fontWeight: '900', color: genSaved ? '#fff' : theme.learnPillActiveText }}>
                        {stackSaving ? 'Saving…' : genSaved ? 'Saved' : 'Save to deck'}
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      <StackAssignmentSheet
        theme={theme}
        visible={stackAssignPending != null || membershipEdit != null}
        pending={stackAssignPending}
        membershipEdit={membershipEdit}
        saving={stackSaving}
        onCancel={() => {
          setStackAssignPending(null)
          setMembershipEdit(null)
        }}
        onConfirm={handleStackAssignConfirm}
        onConfirmMembership={handleMembershipConfirm}
      />

      <CreateUserStackModal
        theme={theme}
        visible={createStackOpen}
        onClose={() => setCreateStackOpen(false)}
        onCreated={() => void reloadMyStacks()}
      />
    </GlassScreenRoot>
  )
}

function LearnWordRow({
  theme,
  mainLanguage,
  item,
  learnDark,
  fontHeadlineSm,
  fontBody,
  fontLabel,
  leftAccent,
  statusLabel,
  onPressStudy,
  onOpenActions,
}: {
  theme: AppTheme
  mainLanguage: string
  item: VocabItem
  learnDark: boolean
  fontHeadlineSm?: string
  fontBody?: string
  fontLabel?: string
  leftAccent: string
  statusLabel: string
  onPressStudy: () => void
  onOpenActions: () => void
}) {
  const nativeLine = getNativeGloss(item, mainLanguage)
  const preview = (item.simpleDefinition || item.definition || '').trim()
  const previewLine = preview.length > 120 ? `${preview.slice(0, 117)}…` : preview

  return (
    <View
      style={{
        borderRadius: 14,
        overflow: 'hidden',
        borderLeftWidth: 3,
        borderLeftColor: leftAccent,
        borderWidth: 1,
        borderColor: theme.learnGlassBorder,
        ...glassScreenShadow(theme),
      }}
    >
      <BlurView
        intensity={learnDark ? 22 : 14}
        tint={learnDark ? 'dark' : 'light'}
        style={{
          backgroundColor: theme.learnGlass,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingRight: 4 }}>
          <Pressable
            onPress={onPressStudy}
            style={{ flex: 1, paddingVertical: 14, paddingLeft: 14, paddingRight: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`Study ${item.text}`}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <Text
                style={{
                  fontFamily: fontHeadlineSm,
                  fontSize: 17,
                  fontWeight: '800',
                  color: theme.learnOnSurface,
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {item.text}
              </Text>
              {item.flagged ? (
                <Ionicons name="flag" size={16} color={theme.learnAccent} accessibilityLabel="Flagged" />
              ) : null}
            </View>
            {previewLine ? (
              <Text
                style={{
                  fontFamily: fontBody,
                  fontSize: 13,
                  lineHeight: 18,
                  color: theme.learnOnSurfaceVariant,
                }}
                numberOfLines={2}
              >
                {previewLine}
              </Text>
            ) : nativeLine ? (
              <Text
                style={{
                  fontFamily: fontBody,
                  fontSize: 13,
                  lineHeight: 18,
                  color: theme.learnOutline,
                  fontStyle: 'italic',
                }}
                numberOfLines={2}
              >
                {nativeLine}
              </Text>
            ) : null}
            <Text
              style={{
                fontFamily: fontLabel,
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 0.6,
                color: theme.learnOutline,
                marginTop: 6,
                textTransform: 'uppercase',
              }}
            >
              {statusLabel}
            </Text>
          </Pressable>
          <Pressable
            onPress={onOpenActions}
            hitSlop={12}
            style={{ paddingVertical: 14, paddingHorizontal: 12 }}
            accessibilityRole="button"
            accessibilityLabel={`More actions for ${item.text}`}
          >
            <MaterialIcons name="more-horiz" size={24} color={theme.learnOutline} />
          </Pressable>
        </View>
      </BlurView>
    </View>
  )
}

function WordActionsSheet({
  visible,
  theme,
  item,
  fontBody,
  fontLabelBold,
  bottomInset,
  onClose,
  onToggleFlag,
  onSync,
  onRegenerate,
  onAddToStacks,
  onDelete,
}: {
  visible: boolean
  theme: AppTheme
  item: VocabItem | null
  fontBody?: string
  fontLabelBold?: string
  bottomInset: number
  onClose: () => void
  onToggleFlag: (item: VocabItem) => void
  onSync: (item: VocabItem) => void
  onRegenerate: (item: VocabItem) => void
  onAddToStacks: (item: VocabItem) => void
  onDelete: (item: VocabItem) => void
}) {
  if (!item) return null

  const padBottom = Math.max(16, bottomInset + 8)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
          onPress={onClose}
          accessibilityLabel="Dismiss"
        />
        <View
          style={{
            marginHorizontal: 12,
            marginBottom: padBottom,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.learnGlassBorder,
            backgroundColor: theme.learnSearchBg,
            overflow: 'hidden',
            ...glassScreenShadow(theme),
          }}
        >
          <Text
            style={{
              fontFamily: fontLabelBold,
              fontSize: 12,
              color: theme.learnOutline,
              textTransform: 'uppercase',
              letterSpacing: 1,
              paddingHorizontal: 18,
              paddingTop: 14,
              paddingBottom: 6,
            }}
          >
            Word actions
          </Text>
          <Text
            style={{
              fontFamily: fontBody,
              fontSize: 17,
              fontWeight: '800',
              color: theme.learnOnSurface,
              paddingHorizontal: 18,
              paddingBottom: 12,
            }}
            numberOfLines={2}
          >
            {item.text}
          </Text>
          <ActionRow label={item.flagged ? 'Remove flag' : 'Flag for review'} onPress={() => { onClose(); onToggleFlag(item) }} theme={theme} fontBody={fontBody} />
          <ActionRow label="Add exposure (review)" onPress={() => { onClose(); onSync(item) }} theme={theme} fontBody={fontBody} />
          <ActionRow label="Regenerate card" onPress={() => { onClose(); onRegenerate(item) }} theme={theme} fontBody={fontBody} />
          <ActionRow
            label="Add to stacks…"
            onPress={() => {
              onClose()
              onAddToStacks(item)
            }}
            theme={theme}
            fontBody={fontBody}
          />
          <View style={{ height: 1, backgroundColor: theme.learnGlassBorder, marginVertical: 4 }} />
          <ActionRow
            label="Remove from deck…"
            danger
            onPress={() => onDelete(item)}
            theme={theme}
            fontBody={fontBody}
          />
          {Platform.OS === 'ios' ? (
            <Pressable
              onPress={onClose}
              style={{
                paddingVertical: 14,
                alignItems: 'center',
                borderTopWidth: 1,
                borderTopColor: theme.learnGlassBorder,
              }}
            >
              <Text style={{ fontFamily: fontBody, fontSize: 16, color: theme.learnAccent, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={onClose}
              style={{
                paddingVertical: 14,
                alignItems: 'center',
                borderTopWidth: 1,
                borderTopColor: theme.learnGlassBorder,
              }}
            >
              <Text style={{ fontFamily: fontBody, fontSize: 16, color: theme.learnOnSurfaceVariant }}>Close</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  )
}

function ActionRow({
  label,
  onPress,
  danger,
  theme,
  fontBody,
}: {
  label: string
  onPress: () => void
  danger?: boolean
  theme: AppTheme
  fontBody?: string
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 14,
        paddingHorizontal: 18,
        backgroundColor: pressed ? theme.learnViewToggleBg : 'transparent',
      })}
    >
      <Text
        style={{
          fontFamily: fontBody,
          fontSize: 16,
          color: danger ? theme.danger : theme.learnOnSurface,
          fontWeight: danger ? '700' : '500',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}
