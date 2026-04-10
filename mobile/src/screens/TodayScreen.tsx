import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons, MaterialIcons } from '@expo/vector-icons'
import { FREE_MAX_SAVED_WORDS } from '@shared/freemium'
import { getMainLanguageLabel } from '@shared/languages'
import type { GeneratedResult, VocabItem } from '@shared/types'
import { GlassScreenRoot, glassScreenShadow, isLearnDarkUi, useGlassFonts } from '../components/GlassUi'
import { useSubscription } from '../context/SubscriptionContext'
import { generateWord } from '../lib/api'
import { saveWord } from '../lib/words'
import { ensureUserProfileDefaults } from '../lib/userProfile'
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

export function TodayScreen({
  theme,
  mainLanguage,
  stats,
  items,
  onStartSession,
  onOpenProfile,
  onSavedWord,
}: {
  theme: AppTheme
  mainLanguage: string
  stats: { total: number; learning: number; mastered: number; flagged: number }
  /** For Active Deck horizontal list */
  items: VocabItem[]
  onStartSession: () => void
  onOpenProfile?: () => void
  onSavedWord?: () => void | Promise<void>
}) {
  const { fontHeadline, fontHeadlineSm, fontBody, fontLabel, fontLabelBold } = useGlassFonts()
  const { isPro, loading: subLoading, openPaywall } = useSubscription()
  const { height: windowHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const learnDark = isLearnDarkUi(theme)
  /** LEXICON header + bottom tab bar (+ home indicator). Content is already inside SafeAreaView. */
  const todayChromeOffset = 124 + insets.bottom
  const scrollMinHeight = Math.max(0, windowHeight - todayChromeOffset)

  const [text, setText] = useState('')
  const [state, setState] = useState<GenerateState>({ status: 'idle' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const canGenerate = useMemo(() => text.trim().length > 0, [text])

  const [profileLoading, setProfileLoading] = useState(true)

  const modalOpen = state.status === 'loading' || state.status === 'ready' || state.status === 'error'

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await ensureUserProfileDefaults()
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setProfileLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function onGenerate() {
    if (!canGenerate) return
    setState({ status: 'loading' })
    setSaved(false)
    try {
      const result = await generateWord(text.trim(), mainLanguage)
      setState({ status: 'ready', result: { ...emptyResult(), ...result } })
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Failed to generate' })
    }
  }

  function closeModal() {
    setState({ status: 'idle' })
  }

  async function onSave() {
    if (state.status !== 'ready') return
    const trimmed = text.trim()
    const key = trimmed.toLowerCase()
    const alreadySaved = items.some(
      (i) => i.text.trim().toLowerCase() === key || (i.textLower && i.textLower === key),
    )
    if (!subLoading && !isPro && !alreadySaved && items.length >= FREE_MAX_SAVED_WORDS) {
      openPaywall()
      return
    }
    setSaving(true)
    try {
      await saveWord({
        text: text.trim(),
        type: text.includes(' ') ? 'phrase' : 'word',
        result: state.result,
        mainLanguage,
      })
      setSaved(true)
      await onSavedWord?.()
      closeModal()
      setText('')
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  const deckPreview = useMemo(() => items.slice(0, 24), [items])
  /** Bottom sheet height for generated card: bounded so header + scroll + sticky actions fit on screen */
  const generateCardSheetHeight = useMemo(
    () => Math.min(Math.round(windowHeight * 0.9), Math.max(360, windowHeight - insets.top - 16)),
    [windowHeight, insets.top],
  )
  const surfaceLow = '#191c22'
  const surfaceContainer = '#1d2026'
  const inputBg = '#0b0e14'
  const borderSubtle = 'rgba(70, 69, 84, 0.35)'
  /** Mint label for “DAILY OBJECTIVE” (coherent on dark Lexicon UI). */
  const dailyLabelTeal = learnDark ? '#66d9b8' : '#0d9488'
  const cardRadius = 22

  return (
    <GlassScreenRoot theme={theme}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          minHeight: scrollMinHeight,
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: 10,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Card generation */}
        <View
          style={{
            marginBottom: 16,
            borderRadius: cardRadius,
            borderWidth: 1,
            borderColor: theme.learnGlassBorder,
            backgroundColor: theme.surface2,
            padding: 18,
            ...glassScreenShadow(theme),
          }}
        >
          {!subLoading && !isPro ? (
            <Text
              style={{
                fontFamily: fontBody,
                fontSize: 12,
                lineHeight: 16,
                color: theme.learnOnSurfaceVariant,
                marginBottom: 12,
              }}
            >
              Free plan: up to {FREE_MAX_SAVED_WORDS} saved words · {items.length}/{FREE_MAX_SAVED_WORDS} used
            </Text>
          ) : null}
          <View style={{ position: 'relative' }}>
            <TextInput
              value={text}
              onChangeText={(v) => {
                setText(v)
                setSaved(false)
              }}
              placeholder="Enter word or phrase…"
              placeholderTextColor={`${theme.learnOutline}aa`}
              style={{
                fontFamily: fontBody,
                fontSize: 15,
                color: theme.learnOnSurface,
                backgroundColor: inputBg,
                borderRadius: 999,
                paddingHorizontal: 18,
                paddingVertical: 14,
                paddingRight: 48,
              }}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (canGenerate && state.status !== 'loading') void onGenerate()
              }}
            />
            <View style={{ position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' }} pointerEvents="none">
              <MaterialIcons name="edit-note" size={22} color={theme.learnOutline} />
            </View>
          </View>
          <Pressable
            onPress={() => void onGenerate()}
            disabled={!canGenerate || state.status === 'loading'}
            style={({ pressed }) => ({
              marginTop: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 15,
              borderRadius: 999,
              backgroundColor: theme.learnPillActiveBg,
              opacity: !canGenerate || state.status === 'loading' ? 0.45 : pressed ? 0.9 : 1,
            })}
          >
            {state.status === 'loading' ? (
              <ActivityIndicator color={theme.learnPillActiveText} />
            ) : (
              <>
                <MaterialIcons name="flash-on" size={22} color={theme.learnPillActiveText} />
                <Text
                  style={{
                    fontFamily: fontHeadline,
                    fontSize: 16,
                    fontWeight: '800',
                    color: theme.learnPillActiveText,
                  }}
                >
                  Generate Card
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Daily objective */}
        <View
          style={{
            marginBottom: 16,
            borderRadius: cardRadius,
            borderWidth: 1,
            borderColor: theme.learnGlassBorder,
            backgroundColor: theme.surface2,
            padding: 20,
            ...glassScreenShadow(theme),
          }}
        >
          <Text
            style={{
              fontFamily: fontHeadlineSm,
              fontSize: 10,
              fontWeight: '800',
              letterSpacing: 2,
              color: dailyLabelTeal,
            }}
          >
            DAILY OBJECTIVE
          </Text>
          <Text
            style={{
              fontFamily: fontHeadline,
              fontSize: 22,
              fontWeight: '800',
              letterSpacing: -0.3,
              color: theme.learnOnSurface,
              marginTop: 6,
            }}
          >
            Focus Mastery
          </Text>

          <View style={{ flexDirection: 'row', marginTop: 18, paddingRight: 8 }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: fontHeadline,
                  fontSize: 34,
                  fontWeight: '800',
                  color: theme.learnOnSurface,
                  letterSpacing: -1,
                }}
              >
                {profileLoading ? '…' : stats.learning}
              </Text>
              <Text
                style={{
                  fontFamily: fontLabel,
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 1,
                  color: theme.learnOnSurfaceVariant,
                  marginTop: 4,
                }}
              >
                LEARNING
              </Text>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-start' }}>
              <Text
                style={{
                  fontFamily: fontHeadline,
                  fontSize: 34,
                  fontWeight: '800',
                  letterSpacing: -1,
                  color: stats.mastered === 0 ? theme.learnOutline : theme.learnOnSurface,
                }}
              >
                {profileLoading ? '…' : stats.mastered}
              </Text>
              <Text
                style={{
                  fontFamily: fontLabel,
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 1,
                  color: theme.learnOnSurfaceVariant,
                  marginTop: 4,
                }}
              >
                MASTERED
              </Text>
            </View>
          </View>

          <Pressable
            onPress={onStartSession}
            style={({ pressed }) => ({
              marginTop: 20,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 15,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: learnDark ? 'rgba(255,255,255,0.22)' : theme.learnGlassBorder,
              backgroundColor: 'transparent',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontFamily: fontHeadline, fontSize: 16, fontWeight: '700', color: theme.learnOnSurface }}>
              Start Session
            </Text>
            <MaterialIcons name="play-arrow" size={24} color={theme.learnOnSurface} />
          </Pressable>
        </View>

        {/* Active Deck */}
        <View style={{ marginBottom: 4, flexGrow: 1, justifyContent: 'flex-end', minHeight: 128 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingRight: 4 }}>
            <Text style={{ fontFamily: fontHeadline, fontSize: 17, fontWeight: '700', color: theme.learnOnSurface }}>
              Active Deck
            </Text>
            <Text
              style={{
                fontFamily: fontLabel,
                fontSize: 9,
                fontWeight: '700',
                letterSpacing: 1,
                color: theme.learnOutline,
                textTransform: 'uppercase',
              }}
            >
              Swipe
            </Text>
          </View>
          {deckPreview.length === 0 ? (
            <Text style={{ fontFamily: fontBody, fontSize: 13, color: theme.learnOnSurfaceVariant }} numberOfLines={2}>
              Save words from Quick Capture to fill your deck.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
              {deckPreview.map((item) => (
                <ActiveDeckCard
                  key={item.id}
                  theme={theme}
                  item={item}
                  fontHeadline={fontHeadline}
                  fontBody={fontBody}
                  surfaceContainer={surfaceContainer}
                  borderSubtle={borderSubtle}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.65)',
              justifyContent: 'flex-end',
            }}
            onPress={state.status === 'loading' ? undefined : closeModal}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: theme.learnScreenBg,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                maxHeight: '92%',
                paddingBottom:
                  state.status === 'ready' ? 0 : Platform.OS === 'ios' ? Math.max(insets.bottom, 20) : 20,
              }}
            >
              {state.status === 'loading' ? (
                <ModalLoadingContent theme={theme} word={text.trim()} fontBody={fontBody} learnDark={learnDark} />
              ) : null}
              {state.status === 'error' ? (
                <View style={{ padding: 24 }}>
                  <Text style={{ fontFamily: fontHeadline, fontSize: 18, fontWeight: '800', color: theme.learnOnSurface, marginBottom: 12 }}>
                    Something went wrong
                  </Text>
                  <Text style={{ fontFamily: fontBody, fontSize: 15, color: theme.danger, marginBottom: 24 }}>{state.message}</Text>
                  <Pressable
                    onPress={closeModal}
                    style={{
                      backgroundColor: theme.learnPillIdle,
                      paddingVertical: 14,
                      borderRadius: 14,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontFamily: fontLabelBold, fontSize: 16, color: theme.learnOnSurface }}>Dismiss</Text>
                  </Pressable>
                </View>
              ) : null}
              {state.status === 'ready' ? (
                <View style={{ height: generateCardSheetHeight }}>
                  <View
                    style={{
                      paddingHorizontal: 20,
                      paddingTop: 16,
                      paddingBottom: 8,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontFamily: fontHeadline, fontSize: 18, fontWeight: '800', color: theme.learnOnSurface }}>
                      New card
                    </Text>
                    <Pressable onPress={closeModal} hitSlop={12}>
                      <Ionicons name="close" size={26} color={theme.learnOutline} />
                    </Pressable>
                  </View>
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator
                    bounces
                    style={{ flex: 1 }}
                    contentContainerStyle={{
                      paddingHorizontal: 20,
                      paddingBottom: 16,
                    }}
                  >
                    <WordAnalysisCard
                      theme={theme}
                      learnDark={learnDark}
                      word={text.trim()}
                      mainLanguage={mainLanguage}
                      result={state.result}
                      onSave={() => void onSave()}
                      saving={saving}
                      saved={saved}
                      showInlineSave={false}
                      fontHeadline={fontHeadline}
                      fontBody={fontBody}
                      fontLabel={fontLabel}
                      fontLabelBold={fontLabelBold}
                    />
                  </ScrollView>
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 12,
                      paddingHorizontal: 20,
                      paddingTop: 12,
                      paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 12),
                      borderTopWidth: 1,
                      borderTopColor: borderSubtle,
                    }}
                  >
                    <Pressable
                      onPress={closeModal}
                      style={{
                        flex: 1,
                        paddingVertical: 16,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: borderSubtle,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontFamily: fontLabelBold, fontSize: 16, color: theme.learnOnSurface }}>Dismiss</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void onSave()}
                      disabled={saving || saved}
                      style={{
                        flex: 1,
                        paddingVertical: 16,
                        borderRadius: 14,
                        backgroundColor: theme.learnAccent,
                        alignItems: 'center',
                        opacity: saving ? 0.7 : 1,
                      }}
                    >
                      <Text style={{ fontFamily: fontLabelBold, fontSize: 16, fontWeight: '700', color: '#10131a' }}>
                        {saving ? 'Saving…' : saved ? 'Saved' : 'Save to deck'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </GlassScreenRoot>
  )
}

function ActiveDeckCard({
  theme,
  item,
  fontHeadline,
  fontBody,
  surfaceContainer,
  borderSubtle,
}: {
  theme: AppTheme
  item: VocabItem
  fontHeadline?: string
  fontBody?: string
  surfaceContainer: string
  borderSubtle: string
}) {
  const isFlagged = item.flagged
  const isLearning = item.status === 'learning'
  const tag = isFlagged ? 'Flagged' : isLearning ? 'Learning' : 'Mastered'
  const tagBg = isFlagged ? 'rgba(204, 190, 255, 0.12)' : 'rgba(189, 194, 255, 0.12)'
  const tagColor = isFlagged ? theme.learnTertiary : theme.learnAccent
  const def = (item.simpleDefinition || item.definition || '').trim()
  const snippet = def.length > 72 ? `${def.slice(0, 69)}…` : def

  return (
    <View
      style={{
        width: 168,
        minHeight: 118,
        backgroundColor: surfaceContainer,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: borderSubtle,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: tagBg,
          }}
        >
          <Text style={{ fontSize: 9, fontWeight: '800', color: tagColor, letterSpacing: 0.6 }}>{tag.toUpperCase()}</Text>
        </View>
        <MaterialIcons name="more-vert" size={18} color={theme.learnOutline} />
      </View>
      <View style={{ gap: 4, flex: 1 }}>
        <Text
          style={{ fontFamily: fontHeadline, fontSize: 16, fontWeight: '800', color: theme.learnOnSurface }}
          numberOfLines={2}
        >
          {item.text}
        </Text>
        <Text style={{ fontFamily: fontBody, fontSize: 11, lineHeight: 15, color: theme.learnOnSurfaceVariant }} numberOfLines={3}>
          {snippet || '—'}
        </Text>
      </View>
    </View>
  )
}

function ModalLoadingContent({
  theme,
  word,
  fontBody,
  learnDark,
}: {
  theme: AppTheme
  word: string
  fontBody?: string
  learnDark: boolean
}) {
  const pulse = useMemo(() => new Animated.Value(0.4), [])
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])

  const lineBg = learnDark ? 'rgba(189, 194, 255, 0.12)' : 'rgba(99, 102, 241, 0.12)'

  return (
    <View style={{ padding: 28, alignItems: 'center', gap: 20 }}>
      <Animated.View style={{ opacity: pulse }}>
        <ActivityIndicator size="large" color={theme.learnAccent} />
      </Animated.View>
      <Text style={{ fontFamily: fontBody, fontSize: 16, fontWeight: '600', color: theme.learnOnSurface, textAlign: 'center' }}>
        Generating your card{word ? `\n“${word}”` : ''}…
      </Text>
      <View style={{ width: '100%', gap: 10, marginTop: 8 }}>
        <View style={{ height: 10, borderRadius: 6, backgroundColor: lineBg, width: '100%' }} />
        <View style={{ height: 10, borderRadius: 6, backgroundColor: lineBg, width: '88%' }} />
        <View style={{ height: 10, borderRadius: 6, backgroundColor: lineBg, width: '72%' }} />
      </View>
    </View>
  )
}

function wordHighlightRegex(w: string) {
  return new RegExp(`\\b(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi')
}

function ExampleWithBold({
  sentence,
  word,
  theme,
  fontBody,
}: {
  sentence: string
  word: string
  theme: AppTheme
  fontBody?: string
}) {
  let parts: string[]
  try {
    parts = sentence.split(wordHighlightRegex(word))
  } catch {
    return (
      <Text style={{ fontFamily: fontBody, fontSize: 14, lineHeight: 22, color: theme.learnOnSurfaceVariant }}>{sentence}</Text>
    )
  }
  return (
    <Text style={{ fontFamily: fontBody, fontSize: 14, lineHeight: 22, color: theme.learnOnSurfaceVariant }}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={{ fontWeight: '800', color: theme.learnOnSurface }}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  )
}

function AnalysisLabeledBlock({
  theme,
  label,
  fontLabelBold,
  fontBody,
  children,
}: {
  theme: AppTheme
  label: string
  fontLabelBold?: string
  fontBody?: string
  children: ReactNode
}) {
  return (
    <View>
      <Text
        style={{
          fontFamily: fontLabelBold,
          fontSize: 12,
          fontWeight: '700',
          color: theme.learnOutline,
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      {typeof children === 'string' ? (
        <Text style={{ fontFamily: fontBody, fontSize: 14, lineHeight: 22, color: theme.learnOnSurfaceVariant }}>{children}</Text>
      ) : (
        children
      )}
    </View>
  )
}

function AnalysisIconSection({
  theme,
  icon,
  label,
  fontLabelBold,
  fontBody,
  children,
}: {
  theme: AppTheme
  icon: ReactNode
  label: string
  fontLabelBold?: string
  fontBody?: string
  children: ReactNode
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ marginTop: 2 }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: fontLabelBold,
            fontSize: 12,
            fontWeight: '700',
            color: theme.learnOutline,
            marginBottom: 4,
          }}
        >
          {label}
        </Text>
        {children}
      </View>
    </View>
  )
}

function WordAnalysisCard({
  theme,
  learnDark,
  word,
  mainLanguage,
  result,
  onSave,
  saving,
  saved,
  showInlineSave = true,
  fontHeadline,
  fontBody,
  fontLabel,
  fontLabelBold,
}: {
  theme: AppTheme
  learnDark: boolean
  word: string
  mainLanguage: string
  result: GeneratedResult
  onSave: () => void
  saving: boolean
  saved: boolean
  showInlineSave?: boolean
  fontHeadline?: string
  fontBody?: string
  fontLabel?: string
  fontLabelBold?: string
}) {
  const typeLabel = word.includes(' ') ? 'PHRASE' : 'WORD'
  const typeMuted = word.includes(' ') ? theme.learnTertiary : theme.learnAccent
  const exampleSentence = result.exampleSentence ?? ''
  const nativeGloss = result.translationSimple?.trim() || undefined
  const languageTitle = (() => {
    const full = getMainLanguageLabel(mainLanguage)
    const cut = full.indexOf(' (')
    return cut >= 0 ? full.slice(0, cut) : full
  })()
  const iconColor = theme.learnOutline
  const chipBg = learnDark ? 'rgba(29, 32, 38, 0.45)' : 'rgba(255,255,255,0.55)'

  return (
    <View style={{ gap: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1, paddingRight: 4 }}>
          <Text
            style={{
              fontFamily: fontLabel,
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 0.8,
              color: typeMuted,
              opacity: 0.85,
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
              letterSpacing: -0.3,
            }}
          >
            {word}
          </Text>
        </View>
        {showInlineSave ? (
          <Pressable
            onPress={onSave}
            disabled={saving || saved}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: saved ? theme.success : theme.learnPillActiveBg,
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 10,
              opacity: saving ? 0.7 : 1,
            }}
          >
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18} color={saved ? '#fff' : theme.learnPillActiveText} />
            <Text
              style={{
                fontFamily: fontLabelBold,
                color: saved ? '#fff' : theme.learnPillActiveText,
                fontSize: 14,
                fontWeight: '700',
              }}
            >
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {(result.simpleDefinition || result.definition) && (
        <AnalysisIconSection
          theme={theme}
          icon={<MaterialIcons name="menu-book" size={22} color={iconColor} />}
          label="Simple definition"
          fontLabelBold={fontLabelBold}
          fontBody={fontBody}
        >
          <Text style={{ fontFamily: fontBody, fontSize: 14, lineHeight: 22, color: theme.learnOnSurfaceVariant }}>
            {result.simpleDefinition || result.definition}
          </Text>
        </AnalysisIconSection>
      )}

      {result.definition && result.definition !== result.simpleDefinition ? (
        <AnalysisLabeledBlock theme={theme} label="Definition" fontLabelBold={fontLabelBold} fontBody={fontBody}>
          {result.definition}
        </AnalysisLabeledBlock>
      ) : null}

      {exampleSentence ? (
        <AnalysisIconSection
          theme={theme}
          icon={<MaterialIcons name="format-quote" size={22} color={iconColor} />}
          label="Example"
          fontLabelBold={fontLabelBold}
          fontBody={fontBody}
        >
          <ExampleWithBold sentence={exampleSentence} word={word} theme={theme} fontBody={fontBody} />
        </AnalysisIconSection>
      ) : null}

      {(result.synonyms?.length ?? 0) > 0 ? (
        <View>
          <Text
            style={{
              fontFamily: fontLabelBold,
              fontSize: 12,
              fontWeight: '700',
              color: theme.learnOutline,
              marginBottom: 8,
            }}
          >
            Synonyms
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(result.synonyms ?? []).map((syn, idx) => (
              <View
                key={`${syn}-${idx}`}
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: theme.learnGlassBorder,
                  backgroundColor: chipBg,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ fontFamily: fontBody, fontSize: 13, color: theme.learnOnSurfaceVariant }}>{syn}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {nativeGloss ? (
        <View style={{ gap: 6 }}>
          <Text
            style={{
              fontFamily: fontHeadline,
              fontSize: 16,
              fontWeight: '800',
              color: theme.learnOnSurface,
              letterSpacing: -0.2,
            }}
          >
            {languageTitle}
          </Text>
          <Text
            style={{
              fontFamily: fontLabelBold,
              fontSize: 12,
              fontWeight: '700',
              color: theme.learnOutline,
            }}
          >
            Meaning
          </Text>
          <Text style={{ fontFamily: fontBody, fontSize: 15, lineHeight: 22, color: theme.learnOnSurface }}>{nativeGloss}</Text>
        </View>
      ) : null}

      {result.nuanceNote ? (
        <AnalysisIconSection
          theme={theme}
          icon={<MaterialIcons name="lightbulb-outline" size={22} color={iconColor} />}
          label="Nuance note"
          fontLabelBold={fontLabelBold}
          fontBody={fontBody}
        >
          <Text style={{ fontFamily: fontBody, fontSize: 14, lineHeight: 22, color: theme.learnOnSurfaceVariant }}>{result.nuanceNote}</Text>
        </AnalysisIconSection>
      ) : null}

      {result.gmatUsageNote ? (
        <AnalysisIconSection
          theme={theme}
          icon={<MaterialIcons name="star-border" size={22} color={iconColor} />}
          label="GMAT usage note"
          fontLabelBold={fontLabelBold}
          fontBody={fontBody}
        >
          <Text style={{ fontFamily: fontBody, fontSize: 14, lineHeight: 22, color: theme.learnOnSurfaceVariant }}>{result.gmatUsageNote}</Text>
        </AnalysisIconSection>
      ) : null}
    </View>
  )
}

export function computeDashboardStats(items: VocabItem[]) {
  return {
    total: items.length,
    learning: items.filter((i) => i.status === 'learning').length,
    mastered: items.filter((i) => i.status === 'mastered').length,
    flagged: items.filter((i) => i.flagged).length,
  }
}
