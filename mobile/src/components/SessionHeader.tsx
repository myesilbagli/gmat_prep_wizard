import { Pressable, StyleSheet, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { radius, spacing, typography, type AppTheme } from '../theme'

const PROGRESS_DASH_TRACK = 48

function SessionProgressDash({
  theme,
  current,
  total,
}: {
  theme: AppTheme
  current: number
  total: number
}) {
  const safeTotal = Math.max(total, 1)
  const safeCurrent = Math.min(Math.max(current, 0), safeTotal)
  const fillWidth = Math.max(2, Math.round((PROGRESS_DASH_TRACK * safeCurrent) / safeTotal))
  return (
    <View style={{ alignItems: 'center', gap: spacing.xs }}>
      <Text
        style={{
          ...typography.label,
          fontWeight: '600',
          color: theme.textSecondary,
        }}
      >
        {current} / {total}
      </Text>
      <View
        style={{
          width: PROGRESS_DASH_TRACK,
          height: 2,
          borderRadius: radius.full,
          backgroundColor: theme.border,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: fillWidth,
            height: 2,
            borderRadius: radius.full,
            backgroundColor: theme.primary,
          }}
        />
      </View>
    </View>
  )
}

export function SessionHeader({
  theme,
  onClose,
  current,
  total,
  centerLabel,
}: {
  theme: AppTheme
  onClose: () => void
  /** When both `current` and `total` (and total > 1) are provided, the lavender ProgressDash renders instead of `centerLabel`. */
  current?: number
  total?: number
  /** Fallback center label when no progress is being shown (e.g. "Done", "Quiz"). */
  centerLabel?: string
}) {
  const insets = useSafeAreaInsets()
  const showDash =
    typeof current === 'number' && typeof total === 'number' && total > 1 && current > 0

  return (
    <View style={{ paddingTop: insets.top }}>
      <View
        style={{
          height: 48,
          paddingHorizontal: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
          position: 'relative',
        }}
      >
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <MaterialIcons name="close" size={22} color={theme.primary} />
        </Pressable>

        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {showDash ? (
            <SessionProgressDash theme={theme} current={current as number} total={total as number} />
          ) : centerLabel ? (
            <Text
              style={{
                ...typography.label,
                fontWeight: '600',
                color: theme.textSecondary,
              }}
            >
              {centerLabel}
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Exit"
        >
          <Text
            style={{
              ...typography.label,
              fontWeight: '600',
              color: theme.primary,
            }}
          >
            Exit
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
