import { Pressable, ScrollView, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { GlassScreenRoot, useGlassFonts } from '../components/GlassUi'
import type { ReadingSession } from '../reading/readingSession'
import type { AppTheme } from '../theme'

function formatDurationMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const rs = s % 60
  return `${m}:${rs.toString().padStart(2, '0')}`
}

type Props = {
  theme: AppTheme
  session: ReadingSession
  onBackToPracticeHub: () => void
  onAnotherRound: () => void
  onContinueFocused: () => void
}

export function ReadingReviewScreen({
  theme,
  session,
  onBackToPracticeHub,
  onAnotherRound,
  onContinueFocused,
}: Props) {
  const { fontHeadline, fontHeadlineSm, fontBody, fontLabelBold } = useGlassFonts()
  const cur = session.passages[session.currentIndex]
  const started = cur?.readingStartedAt
  const ended = cur?.readingEndedAt
  const durationLabel =
    started != null && ended != null ? formatDurationMs(ended - started) : '—'

  const isFocusedMid = session.config.length === 'focused' && session.currentIndex < session.totalPassages - 1

  return (
    <GlassScreenRoot theme={theme}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={onBackToPracticeHub}
          hitSlop={12}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}
          accessibilityRole="button"
          accessibilityLabel="Back to Practice hub"
        >
          <MaterialIcons name="arrow-back" size={22} color={theme.learnAccent} />
          <Text style={{ fontFamily: fontLabelBold, fontSize: 15, fontWeight: '700', color: theme.learnAccent }}>Practice</Text>
        </Pressable>

        <Text
          style={{
            fontFamily: fontHeadline,
            fontSize: 24,
            fontWeight: '800',
            color: theme.learnOnSurface,
            marginBottom: 8,
          }}
        >
          Review
        </Text>
        <Text style={{ fontFamily: fontBody, fontSize: 15, color: theme.learnOnSurfaceVariant, marginBottom: 20 }}>
          Passage {session.currentIndex + 1} of {session.totalPassages}
        </Text>

        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.learnGlassBorder,
            backgroundColor: theme.surface2,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <Text style={{ fontFamily: fontLabelBold, fontSize: 12, letterSpacing: 1, color: theme.learnOnSurfaceVariant }}>
            READING TIME
          </Text>
          <Text style={{ fontFamily: fontHeadlineSm, fontSize: 28, fontWeight: '800', color: theme.learnOnSurface, marginTop: 6 }}>
            {durationLabel}
          </Text>
        </View>

        {cur?.picked?.length ? (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontFamily: fontLabelBold, fontSize: 12, letterSpacing: 1, color: theme.learnOnSurfaceVariant, marginBottom: 8 }}>
              TARGET WORDS
            </Text>
            {cur.picked.map((w) => (
              <Text key={w.id} style={{ fontFamily: fontBody, fontSize: 15, color: theme.learnOnSurface, marginBottom: 4 }}>
                · {w.text}
              </Text>
            ))}
          </View>
        ) : null}

        {isFocusedMid ? (
          <Pressable
            onPress={onContinueFocused}
            style={{
              paddingVertical: 14,
              paddingHorizontal: 20,
              borderRadius: 999,
              backgroundColor: theme.learnPillActiveBg,
              alignItems: 'center',
              marginBottom: 12,
            }}
            accessibilityRole="button"
            accessibilityLabel="Continue to next passage"
          >
            <Text style={{ fontFamily: fontLabelBold, fontSize: 15, fontWeight: '800', color: theme.learnPillActiveText }}>
              Continue
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={onAnotherRound}
          style={{
            paddingVertical: 14,
            paddingHorizontal: 20,
            borderRadius: 999,
            backgroundColor: theme.surface2,
            borderWidth: 1,
            borderColor: theme.learnGlassBorder,
            alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Another reading round"
        >
          <Text style={{ fontFamily: fontLabelBold, fontSize: 15, fontWeight: '800', color: theme.learnOnSurface }}>
            Another round
          </Text>
        </Pressable>
      </ScrollView>
    </GlassScreenRoot>
  )
}
