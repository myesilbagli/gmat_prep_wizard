import { Pressable, ScrollView, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { WORD_STACK_CATALOG, canAccessStack } from '@shared/freemium'
import { GlassScreenRoot, useGlassFonts } from '../components/GlassUi'
import { useSubscription } from '../context/SubscriptionContext'
import type { AppTheme } from '../theme'

export function WordStackBrowseScreen({
  theme,
  onBack,
  onSelectStack,
}: {
  theme: AppTheme
  onBack: () => void
  onSelectStack: (stackId: string) => void
}) {
  const { fontBody, fontHeadlineSm } = useGlassFonts()
  const { isPro, openPaywall } = useSubscription()

  return (
    <GlassScreenRoot theme={theme}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 120,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={onBack}
          hitSlop={12}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16, alignSelf: 'flex-start' }}
        >
          <MaterialIcons name="chevron-left" size={24} color={theme.learnOutline} />
          <Text style={{ fontFamily: fontBody, fontSize: 16, fontWeight: '600', color: theme.learnOutline }}>Learn</Text>
        </Pressable>

        <Text
          style={{
            fontFamily: fontHeadlineSm,
            fontSize: 22,
            fontWeight: '800',
            color: theme.learnOnSurface,
            letterSpacing: -0.3,
            marginBottom: 8,
          }}
        >
          Word stacks
        </Text>
        <Text
          style={{
            fontFamily: fontBody,
            fontSize: 14,
            lineHeight: 20,
            color: theme.learnOnSurfaceVariant,
            marginBottom: 20,
          }}
        >
          Curated packs for focused study. Free includes two basic stacks; Pro unlocks the full catalog. Open a pack to
          preview words and add them to your deck.
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
                  onSelectStack(stack.id)
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: theme.learnGlassBorder,
                  backgroundColor: theme.learnSearchBg,
                  opacity: pressed ? 0.88 : 1,
                })}
              >
                <MaterialIcons
                  name={unlocked ? 'library-books' : 'lock-outline'}
                  size={24}
                  color={unlocked ? theme.learnAccent : theme.learnOutline}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fontBody, fontSize: 16, fontWeight: '700', color: theme.learnOnSurface }}>
                    {stack.title}
                  </Text>
                  <Text style={{ fontFamily: fontBody, fontSize: 13, color: theme.learnOnSurfaceVariant, marginTop: 4 }}>
                    {stack.description}
                  </Text>
                  <Text style={{ fontFamily: fontBody, fontSize: 12, color: theme.learnOutline, marginTop: 6 }}>
                    {stack.wordCount} words · {stack.tier === 'basic' ? 'Basic' : 'Pro'}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={theme.learnOutline} />
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
    </GlassScreenRoot>
  )
}
