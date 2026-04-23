import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import type { UserStack } from '@shared/types'
import { GlassScreenRoot, useGlassFonts } from '../components/GlassUi'
import { getUserStack } from '../lib/userStacks'
import type { AppTheme } from '../theme'

/** User-created stack detail; word list and actions filled in follow-up commits. */
export function UserStackDetailScreen({
  theme,
  userStackId,
  onBack,
}: {
  theme: AppTheme
  userStackId: string
  onBack: () => void
}) {
  const { fontBody, fontHeadline } = useGlassFonts()
  const [loading, setLoading] = useState(true)
  const [stack, setStack] = useState<UserStack | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const s = await getUserStack(userStackId)
      setStack(s)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load stack.')
      setStack(null)
    } finally {
      setLoading(false)
    }
  }, [userStackId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <GlassScreenRoot theme={theme}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <ActivityIndicator color={theme.learnAccent} />
        </View>
      </GlassScreenRoot>
    )
  }

  if (loadError || !stack) {
    return (
      <GlassScreenRoot theme={theme}>
        <View style={{ flex: 1, padding: 20 }}>
          <Pressable onPress={onBack} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MaterialIcons name="arrow-back" size={22} color={theme.learnOnSurface} />
            <Text style={{ fontFamily: fontBody, color: theme.learnOnSurface }}>Back</Text>
          </Pressable>
          <Text style={{ fontFamily: fontBody, color: theme.danger, marginTop: 24 }}>
            {loadError ?? 'Stack not found.'}
          </Text>
        </View>
      </GlassScreenRoot>
    )
  }

  return (
    <GlassScreenRoot theme={theme}>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}>
        <Pressable onPress={onBack} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MaterialIcons name="arrow-back" size={22} color={theme.learnOnSurface} />
          <Text style={{ fontFamily: fontBody, color: theme.learnOnSurface }}>Back</Text>
        </Pressable>

        <Text
          style={{
            fontFamily: fontHeadline,
            fontSize: 22,
            fontWeight: '800',
            color: theme.learnOnSurface,
            marginTop: 16,
          }}
          numberOfLines={2}
        >
          {stack.name}
        </Text>
        <Text style={{ fontFamily: fontBody, fontSize: 14, color: theme.learnOnSurfaceVariant, marginTop: 6 }}>
          {stack.wordCount} word{stack.wordCount === 1 ? '' : 's'}
        </Text>

        <View
          style={{
            marginTop: 28,
            padding: 20,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.learnGlassBorder,
            backgroundColor: theme.surface2,
          }}
        >
          <Text style={{ fontFamily: fontBody, fontSize: 14, color: theme.learnOnSurfaceVariant, textAlign: 'center' }}>
            No words yet. When you save a word you can add it to this stack.
          </Text>
        </View>
      </View>
    </GlassScreenRoot>
  )
}
