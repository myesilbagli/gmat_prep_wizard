import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native'
import { bucketFromWord } from '@shared/learningBuckets'
import type { UserStack, VocabItem } from '@shared/types'
import { MaterialIcons } from '@expo/vector-icons'
import { GlassScreenRoot, glassScreenShadow, useGlassFonts } from '../components/GlassUi'
import { deleteUserStack, getUserStack, listWordsInUserStack, removeWordFromUserStack } from '../lib/userStacks'
import type { AppTheme } from '../theme'

export function UserStackDetailScreen({
  theme,
  userStackId,
  onBack,
  onReload,
}: {
  theme: AppTheme
  userStackId: string
  onBack: () => void
  onReload: () => Promise<void>
}) {
  const { fontBody, fontHeadline, fontHeadlineSm, fontLabel } = useGlassFonts()
  const [loading, setLoading] = useState(true)
  const [stack, setStack] = useState<UserStack | null>(null)
  const [words, setWords] = useState<VocabItem[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteProgress, setDeleteProgress] = useState(false)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [s, w] = await Promise.all([getUserStack(userStackId), listWordsInUserStack(userStackId)])
      setStack(s)
      setWords(w)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load stack.')
      setStack(null)
      setWords([])
    } finally {
      setLoading(false)
    }
  }, [userStackId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!deleting) {
      setDeleteProgress(false)
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current)
        deleteTimerRef.current = null
      }
      return
    }
    deleteTimerRef.current = setTimeout(() => setDeleteProgress(true), 1000)
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
    }
  }, [deleting])

  function openStackMenu() {
    if (!stack) return
    Alert.alert(stack.name, undefined, [
      {
        text: 'Rename',
        onPress: () =>
          Alert.alert('Rename', 'Rename from the Learn tab list soon, or delete and recreate this stack.'),
      },
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete stack',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            'Delete this stack?',
            'Words will remain in your deck.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => void runDeleteStack() },
            ],
          ),
      },
    ])
  }

  async function removeWordFromStack(wordId: string) {
    try {
      await removeWordFromUserStack(wordId, userStackId)
      await load()
      await onReload()
    } catch (e) {
      Alert.alert('Could not update', e instanceof Error ? e.message : 'Unknown error.')
    }
  }

  async function runDeleteStack() {
    setDeleting(true)
    try {
      await deleteUserStack(userStackId)
      await onReload()
      onBack()
    } catch (e) {
      Alert.alert('Could not delete', e instanceof Error ? e.message : 'Unknown error.')
    } finally {
      setDeleting(false)
      setDeleteProgress(false)
    }
  }

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
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={onBack} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MaterialIcons name="arrow-back" size={22} color={theme.learnOnSurface} />
            <Text style={{ fontFamily: fontBody, color: theme.learnOnSurface }}>Back</Text>
          </Pressable>
          <Pressable onPress={openStackMenu} hitSlop={12} disabled={deleting}>
            <MaterialIcons name="more-vert" size={24} color={theme.learnOutline} />
          </Pressable>
        </View>

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

        {deleting && deleteProgress ? (
          <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ActivityIndicator color={theme.learnAccent} size="small" />
            <Text style={{ fontFamily: fontBody, fontSize: 13, color: theme.learnOnSurfaceVariant }}>Deleting stack…</Text>
          </View>
        ) : null}

        {words.length === 0 ? (
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
        ) : (
          <FlatList
            style={{ marginTop: 20 }}
            data={words}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 32, gap: 10 }}
            renderItem={({ item }) => {
              const b = bucketFromWord(item)
              const label = b.charAt(0).toUpperCase() + b.slice(1)
              return (
                <View
                  style={{
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: theme.learnGlassBorder,
                    backgroundColor: theme.surface2,
                    paddingVertical: 14,
                    paddingHorizontal: 14,
                    ...glassScreenShadow(theme),
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontFamily: fontHeadlineSm, fontSize: 16, fontWeight: '800', color: theme.learnOnSurface, flex: 1 }}>
                      {item.text}
                    </Text>
                    <Text style={{ fontFamily: fontLabel, fontSize: 12, color: theme.learnOutline, marginRight: 8 }}>{label}</Text>
                    <Pressable
                      hitSlop={10}
                      onPress={() =>
                        Alert.alert(item.text, undefined, [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Remove from this stack',
                            style: 'destructive',
                            onPress: () => void removeWordFromStack(item.id),
                          },
                        ])
                      }
                    >
                      <MaterialIcons name="more-vert" size={22} color={theme.learnOutline} />
                    </Pressable>
                  </View>
                </View>
              )
            }}
          />
        )}
      </View>
    </GlassScreenRoot>
  )
}
