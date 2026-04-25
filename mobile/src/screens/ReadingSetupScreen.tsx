import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import type { VocabItem } from '@shared/types'
import { pickParagraphWords } from '@shared/paragraphPicker'
import { GlassScreenRoot, glassScreenShadow, useGlassFonts } from '../components/GlassUi'
import type { ReadingLengthMode, ReadingPoolMode, ReadingSessionConfig } from '../reading/readingSession'
import type { AppTheme } from '../theme'

const LENGTH_OPTIONS: { id: ReadingLengthMode; title: string; description: string }[] = [
  { id: 'quick', title: 'Quick', description: 'One passage, self-paced.' },
  { id: 'focused', title: 'Focused', description: 'Three passages in a row — same optional theme, different angles.' },
  { id: 'timed', title: 'Timed', description: 'One passage with a 90-second reading clock.' },
]

const POOL_OPTIONS: { id: ReadingPoolMode; title: string; description: string }[] = [
  { id: 'learning', title: 'From Learning', description: 'Words in your Learning bucket only (excludes New).' },
  { id: 'familiar', title: 'From Familiar', description: 'Words you have partially consolidated.' },
  { id: 'mixed', title: 'Mixed', description: 'Learning ∪ Familiar — good variety.' },
]

type Props = {
  theme: AppTheme
  items: VocabItem[]
  onBackToHub: () => void
  onStart: (config: ReadingSessionConfig) => void
}

export function ReadingSetupScreen({ theme, items, onBackToHub, onStart }: Props) {
  const { fontHeadline, fontHeadlineSm, fontBody, fontLabelBold } = useGlassFonts()
  const [length, setLength] = useState<ReadingLengthMode>('quick')
  const [pool, setPool] = useState<ReadingPoolMode>('learning')
  const [themeDraft, setThemeDraft] = useState('')

  const previewPick = useMemo(
    () => pickParagraphWords(items, Date.now(), 5, { pool }),
    [items, pool],
  )
  const canStart = previewPick.length > 0

  function handleStart() {
    const trimmed = themeDraft.trim()
    const config: ReadingSessionConfig = {
      length,
      pool,
      ...(trimmed ? { theme: trimmed } : {}),
    }
    onStart(config)
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
        <Pressable
          onPress={onBackToHub}
          hitSlop={12}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Back to Practice modes"
        >
          <MaterialIcons name="arrow-back" size={22} color={theme.learnAccent} />
          <Text style={{ fontFamily: fontLabelBold, fontSize: 15, fontWeight: '700', color: theme.learnAccent }}>
            Practice
          </Text>
        </Pressable>

        <Text
          style={{
            fontFamily: fontHeadline,
            fontSize: 26,
            fontWeight: '800',
            letterSpacing: -0.5,
            color: theme.learnOnSurface,
            marginBottom: 8,
          }}
        >
          Reading setup
        </Text>
        <Text style={{ fontFamily: fontBody, fontSize: 14, lineHeight: 21, color: theme.learnOnSurfaceVariant, marginBottom: 22 }}>
          Choose length and word pool. Optional theme guides subject matter; register stays GMAT-academic on the server.
        </Text>

        <Text style={{ fontFamily: fontLabelBold, fontSize: 12, letterSpacing: 1.2, color: theme.learnOnSurfaceVariant, marginBottom: 10 }}>
          LENGTH
        </Text>
        <View style={{ gap: 10, marginBottom: 22 }}>
          {LENGTH_OPTIONS.map((opt) => (
            <ChoiceRow
              key={opt.id}
              theme={theme}
              fontHeadlineSm={fontHeadlineSm}
              fontBody={fontBody}
              fontLabelBold={fontLabelBold}
              title={opt.title}
              description={opt.description}
              selected={length === opt.id}
              onPress={() => setLength(opt.id)}
            />
          ))}
        </View>

        <Text style={{ fontFamily: fontLabelBold, fontSize: 12, letterSpacing: 1.2, color: theme.learnOnSurfaceVariant, marginBottom: 10 }}>
          WORD POOL
        </Text>
        <View style={{ gap: 10, marginBottom: 22 }}>
          {POOL_OPTIONS.map((opt) => (
            <ChoiceRow
              key={opt.id}
              theme={theme}
              fontHeadlineSm={fontHeadlineSm}
              fontBody={fontBody}
              fontLabelBold={fontLabelBold}
              title={opt.title}
              description={opt.description}
              selected={pool === opt.id}
              onPress={() => setPool(opt.id)}
            />
          ))}
        </View>

        <Text style={{ fontFamily: fontLabelBold, fontSize: 12, letterSpacing: 1.2, color: theme.learnOnSurfaceVariant, marginBottom: 8 }}>
          THEME (optional)
        </Text>
        {/* Client max 120 matches server: longer themes are rejected with HTTP 400 (do not truncate silently). */}
        <TextInput
          value={themeDraft}
          onChangeText={setThemeDraft}
          placeholder="e.g. trading, climate policy, Ottoman history"
          placeholderTextColor={theme.learnOnSurfaceVariant}
          maxLength={120}
          accessibilityLabel="Optional reading theme"
          accessibilityHint="Leave blank for varied topics. Maximum 120 characters."
          style={{
            borderWidth: 1,
            borderColor: theme.learnGlassBorder,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontFamily: fontBody,
            fontSize: 16,
            color: theme.learnOnSurface,
            backgroundColor: theme.surface2,
            marginBottom: 8,
          }}
        />
        <Text style={{ fontFamily: fontBody, fontSize: 13, color: theme.learnOnSurfaceVariant, marginBottom: 22 }}>
          Leave blank for varied topics.
        </Text>

        {!canStart ? (
          <View
            style={{
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: theme.learnGlassBorder,
              backgroundColor: theme.surface2,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontFamily: fontBody, fontSize: 14, lineHeight: 21, color: theme.learnOnSurfaceVariant }}>
              No eligible words for this pool yet. Words need exposure score above 0 and a last-seen date — complete a few
              study sessions first.
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleStart}
          disabled={!canStart}
          style={{
            alignSelf: 'flex-start',
            paddingVertical: 14,
            paddingHorizontal: 22,
            borderRadius: 999,
            backgroundColor: canStart ? theme.learnPillActiveBg : theme.learnViewToggleBg,
            opacity: canStart ? 1 : 0.55,
          }}
          accessibilityRole="button"
          accessibilityLabel="Start reading session"
        >
          <Text
            style={{
              fontFamily: fontLabelBold,
              fontSize: 15,
              fontWeight: '800',
              color: canStart ? theme.learnPillActiveText : theme.learnOnSurfaceVariant,
            }}
          >
            Start reading
          </Text>
        </Pressable>
      </ScrollView>
    </GlassScreenRoot>
  )
}

function ChoiceRow({
  theme,
  fontHeadlineSm,
  fontBody,
  fontLabelBold,
  title,
  description,
  selected,
  onPress,
}: {
  theme: AppTheme
  fontHeadlineSm?: string
  fontBody?: string
  fontLabelBold?: string
  title: string
  description: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: 16,
        borderWidth: 2,
        borderColor: selected ? theme.learnAccent : theme.learnGlassBorder,
        backgroundColor: theme.surface2,
        padding: 14,
        ...glassScreenShadow(theme),
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      accessibilityHint={description}
    >
      <Text style={{ fontFamily: fontHeadlineSm, fontSize: 16, fontWeight: '800', color: theme.learnOnSurface }}>{title}</Text>
      <Text style={{ fontFamily: fontBody, fontSize: 13, lineHeight: 19, color: theme.learnOnSurfaceVariant, marginTop: 4 }}>
        {description}
      </Text>
      {selected ? (
        <Text style={{ fontFamily: fontLabelBold, fontSize: 12, color: theme.learnAccent, marginTop: 8 }}>Selected</Text>
      ) : null}
    </Pressable>
  )
}
