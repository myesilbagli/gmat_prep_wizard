import type { ComponentProps } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { GlassScreenRoot, glassScreenShadow, useGlassFonts } from '../components/GlassUi'
import type { AppTheme } from '../theme'

type Props = {
  theme: AppTheme
  /** When false, Reading is disabled (no saved words to draw from). */
  hasSavedWords: boolean
  onSelectDrill: () => void
  onSelectReading: () => void
}

export function PracticeHubScreen({ theme, hasSavedWords, onSelectDrill, onSelectReading }: Props) {
  const { fontHeadline, fontHeadlineSm, fontBody, fontLabelBold } = useGlassFonts()

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
        <Text
          style={{
            fontFamily: fontHeadline,
            fontSize: 28,
            fontWeight: '800',
            letterSpacing: -0.5,
            color: theme.learnOnSurface,
            textAlign: 'center',
            marginTop: 8,
          }}
        >
          Practice
        </Text>
        <Text
          style={{
            fontFamily: fontBody,
            fontSize: 14,
            lineHeight: 21,
            color: theme.learnOnSurfaceVariant,
            textAlign: 'center',
            marginTop: 10,
            paddingHorizontal: 8,
            marginBottom: 22,
          }}
        >
          Choose a mode: quick MCQ drill, reading passages from your deck, or simulation (soon).
        </Text>

        <View style={{ gap: 14 }}>
          <ModeCard
            theme={theme}
            fontHeadlineSm={fontHeadlineSm}
            fontBody={fontBody}
            fontLabelBold={fontLabelBold}
            icon="bolt"
            title="Drill"
            description="Quick MCQ drill to warm up on individual words."
            cta="Start drill"
            onPress={onSelectDrill}
            disabled={false}
          />
          <ModeCard
            theme={theme}
            fontHeadlineSm={fontHeadlineSm}
            fontBody={fontBody}
            fontLabelBold={fontLabelBold}
            icon="menu-book"
            title="Reading"
            description={
              hasSavedWords
                ? 'Apply your vocabulary in GMAT-style passages.'
                : 'Save words to your deck first — reading practice needs a vocabulary pool.'
            }
            cta={hasSavedWords ? 'Start reading' : 'Save words first'}
            onPress={onSelectReading}
            disabled={!hasSavedWords}
          />
          <ModeCard
            theme={theme}
            fontHeadlineSm={fontHeadlineSm}
            fontBody={fontBody}
            fontLabelBold={fontLabelBold}
            icon="article"
            title="Simulation"
            description="Full GMAT-style passage and questions. Coming soon."
            cta="Coming soon"
            onPress={() => {}}
            disabled
          />
        </View>
      </ScrollView>
    </GlassScreenRoot>
  )
}

function ModeCard({
  theme,
  fontHeadlineSm,
  fontBody,
  fontLabelBold,
  icon,
  title,
  description,
  cta,
  onPress,
  disabled,
}: {
  theme: AppTheme
  fontHeadlineSm?: string
  fontBody?: string
  fontLabelBold?: string
  icon: ComponentProps<typeof MaterialIcons>['name']
  title: string
  description: string
  cta: string
  onPress: () => void
  disabled: boolean
}) {
  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: theme.learnGlassBorder,
        backgroundColor: theme.surface2,
        padding: 18,
        opacity: disabled ? 0.55 : 1,
        ...glassScreenShadow(theme),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <MaterialIcons name={icon} size={26} color={disabled ? theme.learnOutline : theme.learnAccent} />
        <Text style={{ fontFamily: fontHeadlineSm, fontSize: 18, fontWeight: '800', color: theme.learnOnSurface }}>
          {title}
        </Text>
      </View>
      <Text style={{ fontFamily: fontBody, fontSize: 14, lineHeight: 21, color: theme.learnOnSurfaceVariant }}>
        {description}
      </Text>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={{
          marginTop: 16,
          alignSelf: 'flex-start',
          paddingVertical: 12,
          paddingHorizontal: 20,
          borderRadius: 999,
          backgroundColor: disabled ? theme.learnViewToggleBg : theme.learnPillActiveBg,
        }}
      >
        <Text
          style={{
            fontFamily: fontLabelBold,
            fontSize: 14,
            fontWeight: '800',
            color: disabled ? theme.learnOnSurfaceVariant : theme.learnPillActiveText,
          }}
        >
          {cta}
        </Text>
      </Pressable>
    </View>
  )
}
