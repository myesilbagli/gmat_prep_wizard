import { Pressable, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { GlassScreenRoot, useGlassFonts } from '../components/GlassUi'
import type { ReadingSession } from '../reading/readingSession'
import type { AppTheme } from '../theme'

/** Shell for commit 4 wiring; expanded in commit 5. */
export function ReadingScreen({
  theme,
  session,
  onAbandonToSetup,
  onDoneReading,
}: {
  theme: AppTheme
  session: ReadingSession
  onAbandonToSetup: () => void
  onDoneReading: () => void
}) {
  const { fontHeadline, fontBody, fontLabelBold } = useGlassFonts()
  return (
    <GlassScreenRoot theme={theme}>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 12 }}>
        <Pressable
          onPress={onAbandonToSetup}
          hitSlop={12}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}
          accessibilityRole="button"
          accessibilityLabel="Back to reading setup"
        >
          <MaterialIcons name="arrow-back" size={22} color={theme.learnAccent} />
          <Text style={{ fontFamily: fontLabelBold, fontSize: 15, fontWeight: '700', color: theme.learnAccent }}>Setup</Text>
        </Pressable>
        <Text style={{ fontFamily: fontHeadline, fontSize: 22, fontWeight: '800', color: theme.learnOnSurface, marginBottom: 8 }}>
          Reading (shell)
        </Text>
        <Text style={{ fontFamily: fontBody, fontSize: 14, color: theme.learnOnSurfaceVariant, marginBottom: 16 }}>
          Passage {session.currentIndex + 1} of {session.totalPassages} · pool {session.config.pool} · length {session.config.length}
          {session.config.theme ? ` · theme “${session.config.theme}”` : ''}
        </Text>
        <Text style={{ fontFamily: fontBody, fontSize: 14, color: theme.learnOnSurfaceVariant, marginBottom: 24 }}>
          Full passage UI, timer, and glossary load in the next step of this build.
        </Text>
        <Pressable
          onPress={onDoneReading}
          style={{
            alignSelf: 'flex-start',
            paddingVertical: 14,
            paddingHorizontal: 20,
            borderRadius: 999,
            backgroundColor: theme.learnPillActiveBg,
          }}
          accessibilityRole="button"
          accessibilityLabel="Done reading"
        >
          <Text style={{ fontFamily: fontLabelBold, fontSize: 15, fontWeight: '800', color: theme.learnPillActiveText }}>
            Done reading
          </Text>
        </Pressable>
      </View>
    </GlassScreenRoot>
  )
}
