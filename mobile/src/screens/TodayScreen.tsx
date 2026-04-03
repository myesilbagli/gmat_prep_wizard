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
  useWindowDimensions,
  View,
} from 'react-native'
import { Ionicons, MaterialIcons } from '@expo/vector-icons'
import { getMainLanguageLabel } from '@shared/languages'
import type { GeneratedResult, VocabItem } from '@shared/types'
import { GlassScreenRoot, isLearnDarkUi, useGlassFonts } from '../components/GlassUi'
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
  onReviewLearning,
  onReviewFlagged,
  onStartSession,
  onOpenProfile,
  onSavedWord,
}: {
  theme: AppTheme
  mainLanguage: string
  stats: { total: number; learning: number; mastered: number; flagged: number }
  /** For Active Deck horizontal list */
  items: VocabItem[]
  onReviewLearning?: () => void
  onReviewFlagged?: () => void
  onStartSession: () => void
  onOpenProfile?: () => void
  onSavedWord?: () => void | Promise<void>
}) {
  const { fontHeadline, fontHeadlineSm, fontBody, fontLabel, fontLabelBold } = useGlassFonts()
  const { height: windowHeight } = useWindowDimensions()
  const learnDark = isLearnDarkUi(theme)

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
  const surfaceLow = '#191c22'
  const surfaceContainer = '#1d2026'
  const inputBg = '#0b0e14'
  const borderSubtle = 'rgba(70, 69, 84, 0.35)'

  return (
    <GlassScreenRoot theme={theme}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: 120,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Capture */}
        <View style={{ marginBottom: 36 }}>
          <Text
            style={{
              fontFamily: fontHeadline,
              fontSize: 20,
              fontWeight: '700',
              color: theme.learnOnSurface,
              marginBottom: 20,
            }}
          >
            Quick Capture
          </Text>
          <View
            style={{
              borderRadius: 16,
              padding: 22,
              borderWidth: 1,
              borderColor: borderSubtle,
              backgroundColor: learnDark ? 'rgba(189, 194, 255, 0.04)' : theme.learnGlass,
            }}
          >
            <TextInput
              value={text}
              onChangeText={(v) => {
                setText(v)
                setSaved(false)
              }}
              placeholder="Enter word or phrase"
              placeholderTextColor={`${theme.learnOutline}99`}
              style={{
                fontFamily: fontBody,
                fontSize: 16,
                color: theme.learnOnSurface,
                backgroundColor: inputBg,
                borderRadius: 14,
                paddingHorizontal: 18,
                paddingVertical: 16,
                marginBottom: 12,
              }}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (canGenerate && state.status !== 'loading') void onGenerate()
              }}
            />
            <Pressable
              onPress={() => void onGenerate()}
              disabled={!canGenerate || state.status === 'loading'}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 14,
                borderRadius: 14,
                opacity: !canGenerate || state.status === 'loading' ? 0.45 : pressed ? 0.85 : 1,
              })}
            >
              <MaterialIcons name="add-circle-outline" size={22} color={theme.learnAccent} />
              <Text style={{ fontFamily: fontHeadline, fontSize: 16, fontWeight: '700', color: theme.learnAccent }}>
                Generate Card
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Today's Session */}
        <View style={{ marginBottom: 36 }}>
          <Text
            style={{
              fontFamily: fontHeadline,
              fontSize: 28,
              fontWeight: '800',
              color: theme.learnOnSurface,
              letterSpacing: -0.5,
            }}
          >
            Today&apos;s Session
          </Text>
          <Text
            style={{
              fontFamily: fontBody,
              fontSize: 16,
              lineHeight: 24,
              color: theme.learnOnSurfaceVariant,
              marginTop: 8,
              maxWidth: '92%',
            }}
          >
            Resume your personalized learning path and master new complexities.
          </Text>

          <View
            style={{
              marginTop: 22,
              backgroundColor: surfaceLow,
              borderRadius: 16,
              padding: 28,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: borderSubtle,
            }}
          >
            <View style={{ position: 'absolute', top: 8, right: 8, opacity: 0.1 }} pointerEvents="none">
              <MaterialIcons name="import-contacts" size={88} color={theme.learnAccent} />
            </View>
            <View style={{ gap: 28, zIndex: 1 }}>
              <View style={{ flexDirection: 'row', gap: 28 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: theme.learnAccent,
                      shadowColor: theme.learnAccent,
                      shadowOpacity: 0.6,
                      shadowRadius: 8,
                    }}
                  />
                  <Text style={{ fontFamily: fontHeadline, fontSize: 14, fontWeight: '700', color: theme.learnOnSurface }}>
                    {profileLoading ? '…' : stats.learning} Learning
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: theme.learnTertiary,
                      shadowColor: theme.learnTertiary,
                      shadowOpacity: 0.5,
                      shadowRadius: 8,
                    }}
                  />
                  <Text style={{ fontFamily: fontHeadline, fontSize: 14, fontWeight: '700', color: theme.learnOnSurface }}>
                    {profileLoading ? '…' : stats.flagged} Flagged
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={onStartSession}
                style={({ pressed }) => ({
                  backgroundColor: theme.learnAccentStrong,
                  borderRadius: 999,
                  paddingVertical: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.92 : 1,
                  shadowColor: '#7c87f3',
                  shadowOffset: { width: 0, height: 12 },
                  shadowOpacity: 0.25,
                  shadowRadius: 20,
                  elevation: 8,
                })}
              >
                <Text
                  style={{
                    fontFamily: fontHeadline,
                    fontSize: 17,
                    fontWeight: '800',
                    color: '#081486',
                  }}
                >
                  Start Session
                </Text>
              </Pressable>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
                <Pressable onPress={() => onReviewLearning?.()}>
                  <Text style={{ fontFamily: fontBody, fontSize: 13, color: theme.learnAccent, fontWeight: '600' }}>
                    Review learning
                  </Text>
                </Pressable>
                <Pressable onPress={() => onReviewFlagged?.()}>
                  <Text style={{ fontFamily: fontBody, fontSize: 13, color: theme.learnTertiary, fontWeight: '600' }}>
                    Review flagged
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Active Deck */}
        <View style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, paddingRight: 4 }}>
            <Text style={{ fontFamily: fontHeadline, fontSize: 20, fontWeight: '700', color: theme.learnOnSurface }}>
              Active Deck
            </Text>
            <Text
              style={{
                fontFamily: fontLabel,
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 1.2,
                color: theme.learnOutline,
                textTransform: 'uppercase',
              }}
            >
              Swipe for more
            </Text>
          </View>
          {deckPreview.length === 0 ? (
            <Text style={{ fontFamily: fontBody, fontSize: 14, color: theme.learnOnSurfaceVariant }}>
              Save words from Quick Capture to fill your deck.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 24 }}>
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
                paddingBottom: Platform.OS === 'ios' ? 34 : 20,
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
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                  bounces
                  style={{ maxHeight: windowHeight * 0.92 }}
                  contentContainerStyle={{
                    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
                  }}
                >
                  <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontFamily: fontHeadline, fontSize: 18, fontWeight: '800', color: theme.learnOnSurface }}>
                      New card
                    </Text>
                    <Pressable onPress={closeModal} hitSlop={12}>
                      <Ionicons name="close" size={26} color={theme.learnOutline} />
                    </Pressable>
                  </View>
                  <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
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
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 12,
                      paddingHorizontal: 20,
                      paddingTop: 12,
                      paddingBottom: 4,
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
                </ScrollView>
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
  const snippet = def.length > 120 ? `${def.slice(0, 117)}…` : def

  return (
    <View
      style={{
        width: 240,
        backgroundColor: surfaceContainer,
        borderRadius: 12,
        padding: 22,
        borderWidth: 1,
        borderColor: borderSubtle,
        gap: 14,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: tagBg,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '800', color: tagColor, letterSpacing: 0.8 }}>{tag.toUpperCase()}</Text>
        </View>
        <MaterialIcons name="more-vert" size={20} color={theme.learnOutline} />
      </View>
      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: fontHeadline, fontSize: 20, fontWeight: '800', color: theme.learnOnSurface }}>{item.text}</Text>
        <Text style={{ fontFamily: fontBody, fontSize: 13, lineHeight: 19, color: theme.learnOnSurfaceVariant }}>{snippet || '—'}</Text>
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
