import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { Ionicons, MaterialIcons } from '@expo/vector-icons'
import type { GeneratedResult, VocabItem } from '@shared/types'
import {
  GlassOutlineCta,
  GlassPanel,
  GlassPrimaryCta,
  GlassScreenRoot,
  GlassSearchField,
  GlassSectionLabel,
  GlassTitleHeader,
  isLearnDarkUi,
  useGlassFonts,
} from '../components/GlassUi'
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
  stats,
  onReviewLearning,
  onReviewFlagged,
  onStartSession,
  onOpenProfile,
  onSavedWord,
}: {
  theme: AppTheme
  stats: { total: number; learning: number; mastered: number; flagged: number }
  onReviewLearning?: () => void
  onReviewFlagged?: () => void
  onStartSession: () => void
  onOpenProfile?: () => void
  /** Called after a word is saved to Firestore so Learn / stats refresh. */
  onSavedWord?: () => void | Promise<void>
}) {
  const { fontHeadline, fontHeadlineSm, fontBody, fontLabel, fontLabelBold } = useGlassFonts()
  const learnDark = isLearnDarkUi(theme)

  const [text, setText] = useState('')
  const [state, setState] = useState<GenerateState>({ status: 'idle' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const canGenerate = useMemo(() => text.trim().length > 0, [text])

  const [profileLoading, setProfileLoading] = useState(true)
  const [streak, setStreak] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const p = await ensureUserProfileDefaults()
        if (cancelled) return
        setStreak(p.streakCurrent)
        setSessionCount(p.sessionCount)
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
      await onSavedWord?.()
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
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
        <GlassTitleHeader theme={theme} title="Today" onOpenProfile={onOpenProfile} fontHeadlineSm={fontHeadlineSm} />
        <Text
          style={{
            fontFamily: fontBody,
            fontSize: 14,
            lineHeight: 20,
            color: theme.learnOnSurfaceVariant,
            marginTop: 10,
          }}
        >
          Streak, daily session, and lookup.
        </Text>
        <Text style={{ fontFamily: fontBody, fontSize: 12, color: theme.learnOutline, marginTop: 6 }}>
          Exam window and timezone: open Profile (top right).
        </Text>

        <View style={{ marginTop: 22, gap: 18 }}>
          <GlassPanel theme={theme} learnDark={learnDark} leftAccent={theme.learnAccent}>
            <GlassSectionLabel theme={theme} fontHeadlineSm={fontHeadlineSm}>
              Streak
            </GlassSectionLabel>
            {profileLoading ? (
              <ActivityIndicator color={theme.learnAccent} />
            ) : (
              <Text
                style={{
                  fontFamily: fontHeadline,
                  fontSize: 32,
                  fontWeight: '800',
                  color: theme.learnOnSurface,
                }}
              >
                {streak}{' '}
                <Text style={{ fontFamily: fontBody, fontSize: 15, color: theme.learnOnSurfaceVariant }}>days</Text>
              </Text>
            )}
            <Text
              style={{
                fontFamily: fontBody,
                fontSize: 13,
                lineHeight: 19,
                color: theme.learnOnSurfaceVariant,
                marginTop: 8,
              }}
            >
              Complete a full daily session to extend your streak.
            </Text>
            <Text style={{ fontFamily: fontBody, fontSize: 12, color: theme.learnOutline, marginTop: 6 }}>
              Sessions completed: {profileLoading ? '…' : sessionCount}
            </Text>
            <View style={{ marginTop: 16 }}>
              <GlassPrimaryCta
                theme={theme}
                label="Start session"
                onPress={onStartSession}
                fontLabelBold={fontLabelBold}
              />
            </View>
          </GlassPanel>

          <GlassPanel theme={theme} learnDark={learnDark} leftAccent={theme.learnTertiary}>
            <GlassSectionLabel theme={theme} fontHeadlineSm={fontHeadlineSm}>
              Your library
            </GlassSectionLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <StatTile theme={theme} label="Total" value={String(stats.total)} fontLabel={fontLabel} fontHeadline={fontHeadline} />
              <StatTile theme={theme} label="Learning" value={String(stats.learning)} fontLabel={fontLabel} fontHeadline={fontHeadline} />
              <StatTile theme={theme} label="Mastered" value={String(stats.mastered)} fontLabel={fontLabel} fontHeadline={fontHeadline} />
              <StatTile theme={theme} label="Flagged" value={String(stats.flagged)} fontLabel={fontLabel} fontHeadline={fontHeadline} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
              <GlassPrimaryCta
                theme={theme}
                label="Review learning"
                onPress={() => onReviewLearning?.()}
                fontLabelBold={fontLabelBold}
              />
              <GlassOutlineCta theme={theme} label="Review flagged" onPress={() => onReviewFlagged?.()} fontLabelBold={fontLabelBold} />
            </View>
          </GlassPanel>

          <View>
            <GlassSectionLabel theme={theme} fontHeadlineSm={fontHeadlineSm}>
              Lookup
            </GlassSectionLabel>
            <GlassSearchField
              theme={theme}
              value={text}
              onChangeText={(v) => {
                setText(v)
                setSaved(false)
              }}
              placeholder="Search a word or phrase…"
              onSubmitEditing={() => {
                if (!canGenerate || state.status === 'loading') return
                void onGenerate()
              }}
              learnDark={learnDark}
              fontBody={fontBody}
            />
            <View style={{ marginTop: 14 }}>
              <GlassPrimaryCta
                theme={theme}
                label={state.status === 'loading' ? 'Generating…' : 'Generate analysis'}
                onPress={() => void onGenerate()}
                disabled={!canGenerate || state.status === 'loading'}
                loading={state.status === 'loading'}
                fontLabelBold={fontLabelBold}
              />
            </View>
          </View>

          <GlassPanel theme={theme} learnDark={learnDark} leftAccent={theme.learnAccentStrong}>
            {state.status === 'idle' ? (
              <Text style={{ fontFamily: fontBody, fontSize: 15, color: theme.learnOnSurfaceVariant, lineHeight: 22 }}>
                Enter a word or phrase and tap Generate analysis.
              </Text>
            ) : null}
            {state.status === 'loading' ? (
              <LoadingCard theme={theme} word={text.trim()} fontBody={fontBody} learnDark={learnDark} />
            ) : null}
            {state.status === 'error' ? (
              <Text style={{ fontFamily: fontBody, color: theme.danger, fontSize: 14 }}>{state.message}</Text>
            ) : null}
            {state.status === 'ready' ? (
              <WordAnalysisCard
                theme={theme}
                learnDark={learnDark}
                word={text.trim()}
                result={state.result}
                onSave={() => void onSave()}
                saving={saving}
                saved={saved}
                fontHeadline={fontHeadline}
                fontBody={fontBody}
                fontLabel={fontLabel}
                fontLabelBold={fontLabelBold}
              />
            ) : null}
          </GlassPanel>
        </View>
      </ScrollView>
    </GlassScreenRoot>
  )
}

function StatTile({
  theme,
  label,
  value,
  fontLabel,
  fontHeadline,
}: {
  theme: AppTheme
  label: string
  value: string
  fontLabel?: string
  fontHeadline?: string
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 140,
        maxWidth: '48%',
        backgroundColor: theme.learnPillIdle,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: theme.learnGlassBorder,
      }}
    >
      <Text style={{ fontFamily: fontLabel, fontSize: 11, fontWeight: '700', color: theme.learnOutline, textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {label}
      </Text>
      <Text style={{ fontFamily: fontHeadline, fontSize: 22, fontWeight: '800', color: theme.learnOnSurface, marginTop: 4 }}>{value}</Text>
    </View>
  )
}

function LoadingCard({
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
  const lineBg = learnDark ? 'rgba(189, 194, 255, 0.08)' : 'rgba(99, 102, 241, 0.1)'
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <ActivityIndicator color={theme.learnAccent} />
        <Text style={{ fontFamily: fontBody, fontSize: 14, color: theme.learnOnSurfaceVariant }}>
          Generating analysis{word ? ` for “${word}”` : ''}…
        </Text>
      </View>
      <View style={{ height: 10, borderRadius: 8, backgroundColor: lineBg }} />
      <View style={{ height: 10, width: '80%', borderRadius: 8, backgroundColor: lineBg }} />
      <View style={{ height: 10, width: '60%', borderRadius: 8, backgroundColor: lineBg }} />
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
  result,
  onSave,
  saving,
  saved,
  fontHeadline,
  fontBody,
  fontLabel,
  fontLabelBold,
}: {
  theme: AppTheme
  learnDark: boolean
  word: string
  result: GeneratedResult
  onSave: () => void
  saving: boolean
  saved: boolean
  fontHeadline?: string
  fontBody?: string
  fontLabel?: string
  fontLabelBold?: string
}) {
  const typeLabel = word.includes(' ') ? 'PHRASE' : 'WORD'
  const typeMuted = word.includes(' ') ? theme.learnTertiary : theme.learnAccent
  const exampleSentence = result.exampleSentence ?? ''
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
