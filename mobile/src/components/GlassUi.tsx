import { useMemo, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
} from 'react-native'
import { BlurView } from 'expo-blur'
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter'
import { Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope'
import { MaterialIcons } from '@expo/vector-icons'
import { useFonts } from 'expo-font'
import type { AppTheme } from '../theme'

export function isLearnDarkUi(theme: AppTheme) {
  return theme.learnScreenBg.toLowerCase() === '#10131a'
}

export function useGlassFonts() {
  const [loaded] = useFonts({
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  })
  return useMemo(
    () => ({
      loaded,
      fontHeadline: loaded ? 'Manrope_800ExtraBold' : undefined,
      fontHeadlineSm: loaded ? 'Manrope_700Bold' : undefined,
      fontBody: loaded ? 'Inter_400Regular' : undefined,
      fontLabel: loaded ? 'Inter_500Medium' : undefined,
      fontLabelBold: loaded ? 'Inter_600SemiBold' : undefined,
    }),
    [loaded],
  )
}

export function glassScreenShadow(theme: AppTheme) {
  return {
    shadowColor: theme.learnAccent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  }
}

export function GlassBackgroundBlobs({ theme }: { theme: AppTheme }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <View
        style={{
          position: 'absolute',
          top: 48,
          right: -72,
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: theme.learnGlowBlob1,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 100,
          left: -56,
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: theme.learnGlowBlob2,
        }}
      />
    </View>
  )
}

export function GlassScreenRoot({
  theme,
  children,
}: {
  theme: AppTheme
  children: ReactNode
}) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.learnScreenBg }}>
      <GlassBackgroundBlobs theme={theme} />
      {children}
    </View>
  )
}

export function GlassTitleHeader({
  theme,
  title,
  onOpenProfile,
  fontHeadlineSm,
}: {
  theme: AppTheme
  title: string
  onOpenProfile?: () => void
  fontHeadlineSm?: string
}) {
  return (
    <View style={styles.headerRow}>
      <Pressable
        onPress={onOpenProfile}
        hitSlop={12}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}
      >
        <MaterialIcons name="menu" size={22} color={theme.learnHeadline} />
        <Text
          style={{
            fontFamily: fontHeadlineSm,
            fontSize: 17,
            fontWeight: '800',
            color: theme.learnHeadline,
            letterSpacing: -0.3,
          }}
        >
          {title}
        </Text>
      </Pressable>
      <Pressable
        onPress={onOpenProfile}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.learnGlassBorder,
          backgroundColor: theme.learnPillIdle,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialIcons name="person" size={20} color={theme.learnOnSurfaceVariant} />
      </Pressable>
    </View>
  )
}

export function GlassSectionLabel({
  theme,
  children,
  fontHeadlineSm,
  style,
}: {
  theme: AppTheme
  children: string
  fontHeadlineSm?: string
  style?: TextStyle
}) {
  return (
    <Text
      style={[
        {
          fontFamily: fontHeadlineSm,
          fontSize: 10,
          fontWeight: '800',
          letterSpacing: 2,
          color: theme.learnOutline,
          textTransform: 'uppercase',
          marginBottom: 10,
        },
        style,
      ]}
    >
      {children}
    </Text>
  )
}

export function GlassSearchField({
  theme,
  value,
  onChangeText,
  placeholder,
  onSubmitEditing,
  learnDark,
  fontBody,
  multiline,
}: {
  theme: AppTheme
  value: string
  onChangeText: (t: string) => void
  placeholder: string
  onSubmitEditing?: () => void
  learnDark: boolean
  fontBody?: string
  multiline?: boolean
}) {
  const placeholderColor = learnDark ? 'rgba(198, 196, 215, 0.45)' : 'rgba(11, 18, 32, 0.4)'
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: multiline ? 'flex-start' : 'center',
        backgroundColor: theme.learnSearchBg,
        borderRadius: 16,
        paddingVertical: multiline ? 12 : 14,
        paddingHorizontal: 14,
        paddingLeft: 44,
        minHeight: multiline ? 100 : undefined,
      }}
    >
      <MaterialIcons
        name="search"
        size={22}
        color={theme.learnOutline}
        style={{ position: 'absolute', left: 14, top: multiline ? 14 : undefined }}
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        onSubmitEditing={onSubmitEditing}
        returnKeyType="search"
        multiline={multiline}
        style={{
          flex: 1,
          fontFamily: fontBody,
          fontSize: 15,
          color: theme.learnOnSurface,
          padding: 0,
          minHeight: multiline ? 80 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  )
}

export function GlassPanel({
  theme,
  learnDark,
  leftAccent,
  children,
}: {
  theme: AppTheme
  learnDark: boolean
  leftAccent: string
  children: ReactNode
}) {
  return (
    <View
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        borderLeftWidth: 4,
        borderLeftColor: leftAccent,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.learnGlassBorder,
        ...glassScreenShadow(theme),
      }}
    >
      <BlurView
        intensity={learnDark ? 28 : 18}
        tint={learnDark ? 'dark' : 'light'}
        style={{
          backgroundColor: theme.learnGlass,
          padding: 22,
        }}
      >
        {children}
      </BlurView>
    </View>
  )
}

export function GlassPill({
  theme,
  active,
  label,
  onPress,
  fontLabel,
}: {
  theme: AppTheme
  active: boolean
  label: string
  onPress: () => void
  fontLabel?: string
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: active ? theme.learnPillActiveBg : theme.learnPillIdle,
      }}
    >
      <Text
        style={{
          fontFamily: fontLabel,
          fontSize: 12,
          fontWeight: '700',
          color: active ? theme.learnPillActiveText : theme.learnOnSurfaceVariant,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export function GlassPrimaryCta({
  theme,
  label,
  onPress,
  disabled,
  loading,
  fontLabelBold,
}: {
  theme: AppTheme
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  fontLabelBold?: string
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={{
        backgroundColor: theme.learnPillActiveBg,
        paddingVertical: 14,
        paddingHorizontal: 22,
        borderRadius: 999,
        opacity: disabled || loading ? 0.55 : 1,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      {loading ? <ActivityIndicator color={theme.learnPillActiveText} size="small" /> : null}
      <Text
        style={{
          fontFamily: fontLabelBold,
          color: theme.learnPillActiveText,
          fontSize: 14,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export function GlassOutlineCta({
  theme,
  label,
  onPress,
  fontLabelBold,
}: {
  theme: AppTheme
  label: string
  onPress: () => void
  fontLabelBold?: string
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.learnGlassBorder,
        backgroundColor: theme.learnPillIdle,
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 999,
      }}
    >
      <Text
        style={{
          fontFamily: fontLabelBold,
          color: theme.learnOnSurface,
          fontSize: 13,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export function GlassQuizOption({
  theme,
  learnDark,
  label,
  onPress,
  fontBody,
}: {
  theme: AppTheme
  learnDark: boolean
  label: string
  onPress: () => void
  fontBody?: string
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.learnGlassBorder,
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: learnDark ? 'rgba(29, 32, 38, 0.35)' : 'rgba(255,255,255,0.5)',
      }}
    >
      <Text style={{ fontFamily: fontBody, fontSize: 15, lineHeight: 22, color: theme.learnOnSurface }}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
})
