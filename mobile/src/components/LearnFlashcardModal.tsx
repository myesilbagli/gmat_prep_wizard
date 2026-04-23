import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import type { VocabItem } from '@shared/types'
import { VocabWordCardContent } from './VocabWordCardContent'
import { useGlassFonts } from './GlassUi'
import { recordWordExposure } from '../lib/vocab'
import type { AppTheme } from '../theme'

const HEADER_ROW_H = 52
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 60 }

export function LearnFlashcardModal({
  visible,
  onClose,
  items,
  initialIndex,
  mainLanguage,
  theme,
}: {
  visible: boolean
  onClose: () => void
  items: VocabItem[]
  initialIndex: number
  mainLanguage: string
  theme: AppTheme
}) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const { fontHeadline, fontBody, fontLabelBold } = useGlassFonts()
  const listRef = useRef<FlatList<VocabItem>>(null)
  const [page, setPage] = useState(initialIndex)

  const safeIndex = Math.max(0, Math.min(initialIndex, Math.max(0, items.length - 1)))

  const cardMaxH = useMemo(() => {
    const available = height - insets.top - insets.bottom - HEADER_ROW_H - 24
    return Math.min(560, Math.max(280, available * 0.88))
  }, [height, insets.top, insets.bottom])

  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => {
      setPage(safeIndex)
      listRef.current?.scrollToIndex({ index: safeIndex, animated: false })
    }, 0)
    return () => clearTimeout(t)
  }, [visible, safeIndex, items.length])

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { index: number | null; item: VocabItem }[] }) => {
      const first = viewableItems[0]
      if (first?.index != null && first.item) {
        setPage(first.index)
        void recordWordExposure(first.item.id).catch(() => {})
      }
    },
    [],
  )

  const scrollBottomPad = insets.bottom + 28

  const renderItem = useCallback(
    ({ item }: { item: VocabItem }) => {
      return (
        <View
          style={{
            width,
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 12,
            justifyContent: 'flex-start',
          }}
        >
          <View
            style={{
              maxHeight: cardMaxH,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.learnGlassBorder,
              backgroundColor: theme.learnSearchBg,
              overflow: 'hidden',
            }}
          >
            <ScrollView
              style={{ maxHeight: cardMaxH }}
              contentContainerStyle={{ paddingBottom: scrollBottomPad }}
              showsVerticalScrollIndicator
              bounces={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <VocabWordCardContent
                theme={theme}
                mainLanguage={mainLanguage}
                word={item}
                variant="learn"
                fontHeadline={fontHeadline}
                fontBody={fontBody}
                footer={
                  <Text
                    style={{
                      fontFamily: fontBody,
                      fontSize: 12,
                      color: theme.learnOutline,
                      marginTop: 8,
                    }}
                  >
                    Swipe sideways for the next card · Scroll vertically to read everything
                  </Text>
                }
              />
            </ScrollView>
          </View>
        </View>
      )
    },
    [width, cardMaxH, scrollBottomPad, fontHeadline, fontBody, mainLanguage, theme],
  )

  const progress = items.length > 0 ? (page + 1) / items.length : 0

  if (!items.length) return null

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: theme.learnScreenBg,
          paddingTop: insets.top,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 10,
            minHeight: HEADER_ROW_H,
          }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontFamily: fontLabelBold, fontSize: 15, color: theme.learnOnSurface, fontWeight: '800' }}>
              Studying
            </Text>
            <Text style={{ fontFamily: fontBody, fontSize: 12, color: theme.learnOutline, marginTop: 2 }}>
              {page + 1} / {items.length}
            </Text>
            <View
              style={{
                marginTop: 8,
                height: 3,
                borderRadius: 2,
                backgroundColor: theme.learnGlassBorder,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${progress * 100}%`,
                  borderRadius: 2,
                  backgroundColor: theme.learnAccent,
                }}
              />
            </View>
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close study">
            <MaterialIcons name="close" size={28} color={theme.learnOnSurface} />
          </Pressable>
        </View>
        <FlatList
          style={{ flex: 1 }}
          ref={listRef}
          data={items}
          keyExtractor={(it) => it.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={safeIndex}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={VIEWABILITY_CONFIG}
          renderItem={renderItem}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index: info.index, animated: false })
            }, 100)
          }}
        />
      </View>
    </Modal>
  )
}
