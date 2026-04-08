import { Alert, Pressable, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { WORD_STACK_CATALOG, canAccessStack } from '@shared/freemium'
import { useSubscription } from '../context/SubscriptionContext'
import { useGlassFonts } from './GlassUi'
import type { AppTheme } from '../theme'

export function WordStacksSection({ theme }: { theme: AppTheme }) {
  const { fontBody, fontHeadlineSm } = useGlassFonts()
  const { isPro, openPaywall } = useSubscription()

  return (
    <View style={{ marginTop: 28, marginBottom: 8 }}>
      <Text
        style={{
          fontFamily: fontHeadlineSm,
          fontSize: 16,
          fontWeight: '700',
          color: theme.learnOnSurface,
          marginBottom: 6,
        }}
      >
        Word stacks
      </Text>
      <Text
        style={{
          fontFamily: fontBody,
          fontSize: 13,
          lineHeight: 18,
          color: theme.learnOnSurfaceVariant,
          marginBottom: 14,
        }}
      >
        Curated lists for focused study. Free includes two basic stacks; Pro unlocks the full catalog.
      </Text>
      <View style={{ gap: 10 }}>
        {WORD_STACK_CATALOG.map((stack) => {
          const unlocked = canAccessStack(stack.id, isPro)
          return (
            <Pressable
              key={stack.id}
              onPress={() => {
                if (!unlocked) {
                  openPaywall()
                  return
                }
                Alert.alert('Coming soon', 'Stack content will be available in a future update.')
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.learnGlassBorder,
                backgroundColor: theme.learnSearchBg,
                opacity: pressed ? 0.88 : 1,
              })}
            >
              <MaterialIcons
                name={unlocked ? 'library-books' : 'lock-outline'}
                size={22}
                color={unlocked ? theme.learnAccent : theme.learnOutline}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fontBody, fontSize: 15, fontWeight: '700', color: theme.learnOnSurface }}>
                  {stack.title}
                </Text>
                <Text style={{ fontFamily: fontBody, fontSize: 12, color: theme.learnOnSurfaceVariant, marginTop: 2 }}>
                  {stack.description}
                </Text>
                <Text style={{ fontFamily: fontBody, fontSize: 11, color: theme.learnOutline, marginTop: 4 }}>
                  {stack.wordCount} words · {stack.tier === 'basic' ? 'Basic' : 'Pro'}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={theme.learnOutline} />
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
