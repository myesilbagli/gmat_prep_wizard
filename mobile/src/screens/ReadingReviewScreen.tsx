import { Pressable, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { GlassScreenRoot, useGlassFonts } from '../components/GlassUi'
import type { ReadingSession } from '../reading/readingSession'
import type { AppTheme } from '../theme'

/** Shell for commit 4 wiring; expanded in commit 5. */
export function ReadingReviewScreen({
  theme,
  session,
  onBackToPracticeHub,
  onAnotherRound,
  onContinueFocused,
}: {
  theme: AppTheme
  session: ReadingSession
  onBackToPracticeHub: () => void
  onAnotherRound: () => void
  onContinueFocused: () => void
}) {
  const { fontHeadline, fontBody, fontLabelBold } = useGlassFonts()
  const isFocusedMid = session.config.length === 'focused' && session.currentIndex < session.totalPassages - 1

  return (
    <GlassScreenRoot theme={theme}>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 12 }}>
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
        <Text style={{ fontFamily: fontHeadline, fontSize: 22, fontWeight: '800', color: theme.learnOnSurface, marginBottom: 8 }}>
          Review (shell)
        </Text>
        <Text style={{ fontFamily: fontBody, fontSize: 14, color: theme.learnOnSurfaceVariant, marginBottom: 24 }}>
          Passage {session.currentIndex + 1} of {session.totalPassages}. Timing and summary appear in the next build step.
        </Text>
        {isFocusedMid ? (
          <Pressable
            onPress={onContinueFocused}
            style={{
              alignSelf: 'flex-start',
              paddingVertical: 14,
              paddingHorizontal: 20,
              borderRadius: 999,
              backgroundColor: theme.learnPillActiveBg,
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
            alignSelf: 'flex-start',
            paddingVertical: 14,
            paddingHorizontal: 20,
            borderRadius: 999,
            backgroundColor: theme.surface2,
            borderWidth: 1,
            borderColor: theme.learnGlassBorder,
          }}
          accessibilityRole="button"
          accessibilityLabel="Another reading round"
        >
          <Text style={{ fontFamily: fontLabelBold, fontSize: 15, fontWeight: '800', color: theme.learnOnSurface }}>
            Another round
          </Text>
        </Pressable>
      </View>
    </GlassScreenRoot>
  )
}
