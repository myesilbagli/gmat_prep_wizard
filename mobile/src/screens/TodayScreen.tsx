import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { daysUntilExam, resolveExamDateIso } from '@shared/examDate'
import { countDeckBuckets } from '@shared/learningBuckets'
import { formatSessionBatchComposition, pickSessionBatchTwelve } from '@shared/sessionPlanner'
import { DEFAULT_TIMEZONE } from '@shared/userProfile'
import type { VocabItem } from '@shared/types'
import { GlassScreenRoot, glassScreenShadow, isLearnDarkUi, useGlassFonts } from '../components/GlassUi'
import { ensureUserProfileDefaults } from '../lib/userProfile'
import type { AppTheme } from '../theme'

export function TodayScreen({
  theme,
  mainLanguage: _mainLanguage,
  stats,
  items,
  onStartSession,
  onOpenProfile: _onOpenProfile,
  onSavedWord: _onSavedWord,
}: {
  theme: AppTheme
  mainLanguage: string
  stats: {
    total: number
    new: number
    learning: number
    familiar: number
    mastered: number
    flagged: number
    sessionWordCount: number
    sessionComposition: string
  }
  items: VocabItem[]
  onStartSession: () => void
  onOpenProfile?: () => void
  onSavedWord?: () => void | Promise<void>
}) {
  const { fontHeadline, fontHeadlineSm, fontBody, fontLabel } = useGlassFonts()
  const { height: windowHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const learnDark = isLearnDarkUi(theme)

  const todayChromeOffset = 124 + insets.bottom
  const scrollMinHeight = Math.max(0, windowHeight - todayChromeOffset)

  const [profileLoading, setProfileLoading] = useState(true)
  const [examDaysLeft, setExamDaysLeft] = useState<number | null>(null)
  const [streakCurrent, setStreakCurrent] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const p = await ensureUserProfileDefaults()
        if (!cancelled && p) {
          const iso = resolveExamDateIso({ examDateIso: p.examDateIso, examTarget: p.examTarget })
          if (iso) setExamDaysLeft(daysUntilExam(iso, p.timezone || DEFAULT_TIMEZONE))
          else setExamDaysLeft(null)

          const raw = (p as { streakCurrent?: unknown }).streakCurrent
          if (typeof raw === 'number' && Number.isFinite(raw)) setStreakCurrent(Math.max(0, Math.floor(raw)))
          else setStreakCurrent(null)
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setProfileLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const dailyLabelTeal = learnDark ? '#66d9b8' : '#0d9488'
  const cardRadius = 22

  const total = Math.max(0, stats.total)
  const cNew = Math.max(0, stats.new)
  const cLearning = Math.max(0, stats.learning)
  const cFamiliar = Math.max(0, stats.familiar)
  const cMastered = Math.max(0, stats.mastered)
  const pct = (n: number) => (total > 0 ? Math.max(0, Math.min(1, n / total)) : 0)

  const barMuted = learnDark ? 'rgba(255,255,255,0.08)' : 'rgba(11,18,32,0.08)'
  const barNew = theme.learnOutline
  const barLearning = theme.learnAccent
  const barFamiliar = theme.learnAccentStrong
  const barMastered = theme.success

  const deckPreview = useMemo(() => items.slice(0, 24), [items])
  const surfaceContainer = '#1d2026'
  const borderSubtle = 'rgba(70, 69, 84, 0.35)'

  return (
    <GlassScreenRoot theme={theme}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          minHeight: scrollMinHeight,
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: 10,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Deck overview */}
        <View
          style={{
            marginBottom: 16,
            borderRadius: cardRadius,
            borderWidth: 1,
            borderColor: theme.learnGlassBorder,
            backgroundColor: theme.surface2,
            padding: 20,
            ...glassScreenShadow(theme),
          }}
        >
          <Text style={{ fontFamily: fontHeadlineSm, fontSize: 10, fontWeight: '800', letterSpacing: 2, color: dailyLabelTeal }}>
            YOUR DECK
          </Text>
          <Text
            style={{
              fontFamily: fontHeadline,
              fontSize: 18,
              fontWeight: '800',
              letterSpacing: -0.3,
              color: theme.learnOnSurface,
              marginTop: 8,
            }}
          >
            {profileLoading ? '…' : `Your Deck — ${stats.total} words`}
          </Text>

          <View style={{ marginTop: 14, gap: 6 }}>
            {(
              [
                ['New', stats.new],
                ['Learning', stats.learning],
                ['Familiar', stats.familiar],
                ['Mastered', stats.mastered],
              ] as const
            ).map(([label, n]) => (
              <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fontLabel, fontSize: 13, color: theme.learnOnSurfaceVariant }}>{label}</Text>
                <Text style={{ fontFamily: fontHeadlineSm, fontSize: 15, fontWeight: '700', color: theme.learnOnSurface }}>
                  {profileLoading ? '…' : n}
                </Text>
              </View>
            ))}
          </View>

          <View
            style={{
              marginTop: 14,
              height: 12,
              borderRadius: 999,
              overflow: 'hidden',
              backgroundColor: total === 0 ? barMuted : 'transparent',
              flexDirection: 'row',
            }}
            accessibilityLabel="Deck bucket distribution"
          >
            {total > 0 ? (
              <>
                <View style={{ width: `${pct(cNew) * 100}%`, backgroundColor: barNew }} />
                <View style={{ width: `${pct(cLearning) * 100}%`, backgroundColor: barLearning }} />
                <View style={{ width: `${pct(cFamiliar) * 100}%`, backgroundColor: barFamiliar }} />
                <View style={{ width: `${pct(cMastered) * 100}%`, backgroundColor: barMastered }} />
              </>
            ) : null}
          </View>
        </View>

        {/* Today session (hero) */}
        <View
          style={{
            marginBottom: 16,
            borderRadius: cardRadius,
            borderWidth: 1,
            borderColor: theme.learnGlassBorder,
            backgroundColor: theme.surface2,
            padding: 20,
            ...glassScreenShadow(theme),
          }}
        >
          <Text style={{ fontFamily: fontHeadlineSm, fontSize: 10, fontWeight: '800', letterSpacing: 2, color: dailyLabelTeal }}>
            TODAY&apos;S SESSION
          </Text>
          <Text style={{ fontFamily: fontHeadline, fontSize: 18, fontWeight: '900', color: theme.learnOnSurface, marginTop: 8 }}>
            {profileLoading ? '…' : `Today's session — ${stats.sessionWordCount} words`}
          </Text>
          <Text style={{ fontFamily: fontLabel, fontSize: 12, color: theme.learnOnSurfaceVariant, marginTop: 6 }}>
            {profileLoading ? '…' : stats.sessionComposition}
          </Text>

          <Pressable
            onPress={onStartSession}
            style={({ pressed }) => ({
              marginTop: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 16,
              borderRadius: 999,
              backgroundColor: theme.learnAccent,
              opacity: pressed ? 0.9 : 1,
            })}
            accessibilityLabel="Start Session"
          >
            <Text style={{ fontFamily: fontHeadline, fontSize: 16, fontWeight: '900', color: theme.learnPillActiveText }}>
              Start Session
            </Text>
            <MaterialIcons name="play-arrow" size={24} color={theme.learnPillActiveText} />
          </Pressable>
        </View>

        {/* Countdown + streak (compressed) */}
        {examDaysLeft !== null ? (
          <View
            style={{
              marginBottom: 16,
              borderRadius: cardRadius,
              borderWidth: 1,
              borderColor: theme.learnGlassBorder,
              backgroundColor: theme.surface2,
              paddingVertical: 14,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              ...glassScreenShadow(theme),
            }}
          >
            <Text style={{ fontFamily: fontBody, fontSize: 14, color: theme.learnOnSurface }}>
              {examDaysLeft === 0 ? 'Exam day' : `${examDaysLeft} day${examDaysLeft === 1 ? '' : 's'} until exam`}
              {typeof streakCurrent === 'number' ? ` · ${streakCurrent} day streak` : ''}
            </Text>
            <MaterialIcons name="event" size={22} color={theme.learnAccent} />
          </View>
        ) : null}

        {/* Active Deck */}
        <View style={{ marginBottom: 4, flexGrow: 1, justifyContent: 'flex-end', minHeight: 128 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingRight: 4 }}>
            <Text style={{ fontFamily: fontHeadline, fontSize: 17, fontWeight: '700', color: theme.learnOnSurface }}>Active Deck</Text>
            <Text
              style={{
                fontFamily: fontLabel,
                fontSize: 9,
                fontWeight: '700',
                letterSpacing: 1,
                color: theme.learnOutline,
                textTransform: 'uppercase',
              }}
            >
              Swipe
            </Text>
          </View>
          {deckPreview.length === 0 ? (
            <Text style={{ fontFamily: fontBody, fontSize: 13, color: theme.learnOnSurfaceVariant }} numberOfLines={2}>
              Save words from Learn to fill your deck.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
              {deckPreview.map((item) => (
                <ActiveDeckCard
                  key={item.id}
                  theme={theme}
                  item={item}
                  fontHeadline={fontHeadline}
                  fontBody={fontBody}
                  surfaceContainer={surfaceContainer}
                  borderSubtle={borderSubtle}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>
    </GlassScreenRoot>
  )
}

function ActiveDeckCard({
  theme,
  item,
  fontHeadline,
  fontBody,
  surfaceContainer,
  borderSubtle,
}: {
  theme: AppTheme
  item: VocabItem
  fontHeadline?: string
  fontBody?: string
  surfaceContainer: string
  borderSubtle: string
}) {
  const isFlagged = item.flagged
  const isLearning = item.status === 'learning'
  const tag = isFlagged ? 'Flagged' : isLearning ? 'Learning' : 'Mastered'
  const tagBg = isFlagged ? 'rgba(204, 190, 255, 0.12)' : 'rgba(189, 194, 255, 0.12)'
  const tagColor = isFlagged ? theme.learnTertiary : theme.learnAccent
  const def = (item.simpleDefinition || item.definition || '').trim()
  const snippet = def.length > 72 ? `${def.slice(0, 69)}…` : def

  return (
    <View
      style={{
        width: 168,
        minHeight: 118,
        backgroundColor: surfaceContainer,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: borderSubtle,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: tagBg,
          }}
        >
          <Text style={{ fontSize: 9, fontWeight: '800', color: tagColor, letterSpacing: 0.6 }}>{tag.toUpperCase()}</Text>
        </View>
        <MaterialIcons name="more-vert" size={18} color={theme.learnOutline} />
      </View>
      <View style={{ gap: 4, flex: 1 }}>
        <Text style={{ fontFamily: fontHeadline, fontSize: 16, fontWeight: '800', color: theme.learnOnSurface }} numberOfLines={2}>
          {item.text}
        </Text>
        <Text style={{ fontFamily: fontBody, fontSize: 11, lineHeight: 15, color: theme.learnOnSurfaceVariant }} numberOfLines={3}>
          {snippet || '—'}
        </Text>
      </View>
    </View>
  )
}

export function computeDashboardStats(items: VocabItem[], timeZone?: string) {
  const tz =
    (timeZone && timeZone.trim()) || Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE
  const batch = pickSessionBatchTwelve(items, { nowMs: Date.now(), userTimezone: tz })
  const bc = countDeckBuckets(items)
  return {
    total: items.length,
    new: bc.new,
    learning: bc.learning,
    familiar: bc.familiar,
    mastered: bc.mastered,
    flagged: bc.flagged,
    sessionWordCount: batch.ids.length,
    sessionComposition: formatSessionBatchComposition(batch.slots),
  }
}
