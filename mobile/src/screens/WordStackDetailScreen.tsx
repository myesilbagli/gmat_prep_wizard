import { useMemo, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { FREE_MAX_SAVED_WORDS, WORD_STACK_CATALOG, canAccessStack } from '@shared/freemium'
import { getWordsForStack } from '@shared/wordStackContent'
import type { VocabItem } from '@shared/types'
import { GlassScreenRoot, useGlassFonts } from '../components/GlassUi'
import { useSubscription } from '../context/SubscriptionContext'
import { saveWordFromStackImport } from '../lib/words'
import type { AppTheme } from '../theme'

export function WordStackDetailScreen({
  theme,
  stackId,
  mainLanguage,
  items,
  onBack,
  onReload,
}: {
  theme: AppTheme
  stackId: string
  mainLanguage: string
  items: VocabItem[]
  onBack: () => void
  onReload: () => Promise<void>
}) {
  const { fontBody, fontHeadlineSm, fontLabelBold } = useGlassFonts()
  const { isPro, openPaywall } = useSubscription()
  const [adding, setAdding] = useState(false)

  const stack = useMemo(() => WORD_STACK_CATALOG.find((s) => s.id === stackId), [stackId])
  const words = useMemo(() => getWordsForStack(stackId), [stackId])

  const unlocked = stack ? canAccessStack(stack.id, isPro) : false

  const inDeck = useMemo(() => {
    const set = new Set(items.map((i) => (i.textLower ?? i.text.trim().toLowerCase())))
    return (w: string) => set.has(w.trim().toLowerCase())
  }, [items])

  async function addAllToDeck() {
    if (!stack || !unlocked) {
      openPaywall()
      return
    }
    setAdding(true)
    let added = 0
    let skippedDup = 0
    let stoppedForLimit = false

    try {
      let deckCount = items.length
      for (const w of words) {
        const key = w.trim().toLowerCase()
        if (inDeck(w)) {
          skippedDup++
          continue
        }
        if (!isPro && deckCount >= FREE_MAX_SAVED_WORDS) {
          openPaywall()
          stoppedForLimit = true
          break
        }
        await saveWordFromStackImport({ text: w, mainLanguage })
        deckCount += 1
        added++
      }
      await onReload()
      if (stoppedForLimit) {
        Alert.alert(
          'Word limit',
          `Added ${added} new word${added === 1 ? '' : 's'}. Upgrade to Pro for unlimited saves and all stacks.`,
        )
      } else if (added > 0) {
        Alert.alert(
          'Added to deck',
          `Imported ${added} word${added === 1 ? '' : 's'}.${skippedDup ? ` ${skippedDup} were already in your deck.` : ''}`,
        )
      } else if (skippedDup === words.length) {
        Alert.alert('Already saved', 'Every word in this pack is already in your deck.')
      }
    } catch (e) {
      Alert.alert('Could not add', e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setAdding(false)
    }
  }

  if (!stack) {
    return (
      <GlassScreenRoot theme={theme}>
        <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
          <Text style={{ color: theme.learnOnSurfaceVariant, fontFamily: fontBody }}>Stack not found.</Text>
          <Pressable onPress={onBack} style={{ marginTop: 16 }}>
            <Text style={{ color: theme.learnAccent, fontWeight: '700' }}>Go back</Text>
          </Pressable>
        </View>
      </GlassScreenRoot>
    )
  }

  const notYetInDeck = words.filter((w) => !inDeck(w)).length

  return (
    <GlassScreenRoot theme={theme}>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <Pressable
          onPress={onBack}
          hitSlop={12}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12, alignSelf: 'flex-start' }}
        >
          <MaterialIcons name="chevron-left" size={24} color={theme.learnOutline} />
          <Text style={{ fontFamily: fontBody, fontSize: 16, fontWeight: '600', color: theme.learnOutline }}>
            Word stacks
          </Text>
        </Pressable>

        <Text
          style={{
            fontFamily: fontHeadlineSm,
            fontSize: 22,
            fontWeight: '800',
            color: theme.learnOnSurface,
            letterSpacing: -0.3,
            marginBottom: 6,
          }}
        >
          {stack.title}
        </Text>
        <Text style={{ fontFamily: fontBody, fontSize: 14, lineHeight: 20, color: theme.learnOnSurfaceVariant, marginBottom: 16 }}>
          {stack.description}
        </Text>

        <Pressable
          onPress={() => {
            if (!unlocked) {
              openPaywall()
              return
            }
            void addAllToDeck()
          }}
          disabled={adding || words.length === 0 || (unlocked && notYetInDeck === 0)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: unlocked ? theme.learnAccent : theme.learnOutline,
            opacity: adding || words.length === 0 || (unlocked && notYetInDeck === 0) ? 0.55 : 1,
            marginBottom: 16,
          }}
        >
          {adding ? (
            <ActivityIndicator color={theme.learnPillActiveText} />
          ) : (
            <>
              <MaterialIcons name="playlist-add" size={22} color={theme.learnPillActiveText} />
              <Text style={{ fontFamily: fontLabelBold, fontSize: 16, color: theme.learnPillActiveText, fontWeight: '800' }}>
                {!unlocked ? 'Unlock with Pro' : notYetInDeck === 0 ? 'All words in deck' : `Add ${notYetInDeck} to my deck`}
              </Text>
            </>
          )}
        </Pressable>

        {!unlocked ? (
          <Text style={{ fontFamily: fontBody, fontSize: 13, color: theme.learnOutline, marginBottom: 12 }}>
            This pack requires Pro, or open a free basic stack from the list.
          </Text>
        ) : null}

        <Text
          style={{
            fontFamily: fontHeadlineSm,
            fontSize: 10,
            fontWeight: '800',
            letterSpacing: 1.2,
            color: theme.learnOutline,
            marginBottom: 10,
            textTransform: 'uppercase',
          }}
        >
          Words in this pack ({words.length})
        </Text>

        <FlatList
          data={words}
          keyExtractor={(item) => item}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const saved = inDeck(item)
            return (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.learnGlassBorder,
                }}
              >
                <Text style={{ fontFamily: fontBody, fontSize: 16, fontWeight: '600', color: theme.learnOnSurface }}>{item}</Text>
                {saved ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <MaterialIcons name="check-circle" size={18} color={theme.learnAccent} />
                    <Text style={{ fontFamily: fontBody, fontSize: 12, color: theme.learnAccent, fontWeight: '700' }}>Saved</Text>
                  </View>
                ) : null}
              </View>
            )
          }}
        />
      </View>
    </GlassScreenRoot>
  )
}
