import { useEffect, useMemo, useRef } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import type { AppTheme } from '../theme'
import { isLearnDarkUi, useGlassFonts } from '../components/GlassUi'
import { useAppTheme } from '../context/ThemeContext'

export function AnimatedSplashScreen({ onFinish }: { onFinish: () => void }) {
  const { theme } = useAppTheme()
  const fonts = useGlassFonts()
  const learnDark = isLearnDarkUi(theme)

  const easeOut = useMemo(() => Easing.out(Easing.cubic), [])
  const easeIn = useMemo(() => Easing.in(Easing.cubic), [])

  // Glass panel values
  const glassOpacity = useSharedValue(0)
  const glassTranslateY = useSharedValue(80)
  const glassScale = useSharedValue(0.96)

  // Wordmark values
  const wordmarkOpacity = useSharedValue(0)
  const wordmarkScale = useSharedValue(0.97)

  // Rule scaleX (0 → 1, with base width 32)
  const ruleScale = useSharedValue(0)

  // Tagline
  const taglineOpacity = useSharedValue(0)
  const taglineTranslateY = useSharedValue(4)

  // Spinner
  const spinnerOpacity = useSharedValue(0)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!fonts.loaded) return

    // Locked animation sequence (use exactly)
    // 0ms → glass rises (translateY 80→0, opacity 0→1, duration 1600ms, easeOut)
    glassOpacity.value = withTiming(1, { duration: 1600, easing: easeOut })
    glassTranslateY.value = withTiming(0, { duration: 1600, easing: easeOut })
    glassScale.value = withTiming(1, { duration: 1600, easing: easeOut })

    // 2100ms → glass fades out (opacity 1→0, scale 1→1.08, duration 700ms, easeIn)
    glassOpacity.value = withDelay(2100, withTiming(0, { duration: 700, easing: easeIn }))
    glassScale.value = withDelay(2100, withTiming(1.08, { duration: 700, easing: easeIn }))

    // 2400ms → wordmark appears (opacity 0→1, scale 0.97→1, duration 800ms, easeOut)
    wordmarkOpacity.value = withDelay(2400, withTiming(1, { duration: 800, easing: easeOut }))
    wordmarkScale.value = withDelay(2400, withTiming(1, { duration: 800, easing: easeOut }))

    // 3000ms → rule scaleX 0→1 (duration 600ms, easeOut)
    ruleScale.value = withDelay(3000, withTiming(1, { duration: 600, easing: easeOut }))

    // 3000ms → spinner fades in (duration 400ms)
    spinnerOpacity.value = withDelay(3000, withTiming(1, { duration: 400 }))

    // 3300ms → tagline fades in + translateY 4→0 (duration 600ms, easeOut)
    taglineOpacity.value = withDelay(3300, withTiming(1, { duration: 600, easing: easeOut }))
    taglineTranslateY.value = withDelay(3300, withTiming(0, { duration: 600, easing: easeOut }))

    // 4200ms → call onFinish()
    timerRef.current = setTimeout(() => onFinish(), 4200)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fonts.loaded])

  const glassStyle = useAnimatedStyle(() => ({
    opacity: glassOpacity.value,
    transform: [
      { translateY: glassTranslateY.value },
      { scale: glassScale.value },
    ],
  }))

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
    transform: [{ scale: wordmarkScale.value }],
  }))

  const ruleStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: ruleScale.value }],
  }))

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineTranslateY.value }],
  }))

  const spinnerStyle = useAnimatedStyle(() => ({
    opacity: spinnerOpacity.value,
  }))

  const s = useMemo(() => styles(theme), [theme])

  // Minimal static fallback while fonts load (no animation yet)
  if (!fonts.loaded) {
    return (
      <View style={s.container}>
        <View style={s.wordmark}>
          <Text style={[s.wordmarkText, { fontFamily: undefined }]}>LEXICON</Text>
          <View style={s.ruleStatic} />
          <Text style={[s.tagline, { fontFamily: undefined, opacity: 0.9 }]}>THE VERBAL EDGE</Text>
        </View>
        <View style={s.spinner}>
          <ActivityIndicator color={theme.primary} />
        </View>
      </View>
    )
  }

  return (
    <View style={s.container}>
      {/* Glass panel */}
      <Animated.View style={[s.glassWrapper, glassStyle]}>
        <BlurView
          intensity={28}
          tint={learnDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Wordmark */}
      <Animated.View style={[s.wordmark, wordmarkStyle]}>
        <Text style={[s.wordmarkText, { fontFamily: fonts.fontHeadline }]}>LEXICON</Text>
        <Animated.View style={[s.rule, ruleStyle]} />
        <Animated.Text style={[s.tagline, taglineStyle, { fontFamily: fonts.fontBody }]}>
          THE VERBAL EDGE
        </Animated.Text>
      </Animated.View>

      {/* Corner details */}
      <View style={[s.corner, s.cornerTL]} />
      <View style={[s.corner, s.cornerBR]} />

      {/* Spinner */}
      <Animated.View style={[s.spinner, spinnerStyle]}>
        <ActivityIndicator color={theme.primary} />
      </Animated.View>
    </View>
  )
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function styles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.learnScreenBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    glassWrapper: {
      position: 'absolute',
      width: 220,
      height: 280,
      borderRadius: 28,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.learnGlassBorder,
    },
    wordmark: {
      alignItems: 'center',
      gap: 10,
    },
    wordmarkText: {
      fontSize: 42,
      letterSpacing: 10,
      color: theme.text,
      fontWeight: '800',
    },
    rule: {
      width: 32,
      height: 1,
      backgroundColor: hexToRgba(theme.primary, 0.6),
    },
    ruleStatic: {
      width: 32,
      height: 1,
      backgroundColor: hexToRgba(theme.primary, 0.6),
      opacity: 1,
    },
    tagline: {
      fontSize: 10,
      letterSpacing: 5,
      color: theme.textSecondary,
    },
    corner: {
      position: 'absolute',
      width: 40,
      height: 40,
    },
    cornerTL: {
      top: 48,
      left: 24,
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderColor: hexToRgba(theme.primary, 0.25),
      borderTopLeftRadius: 4,
    },
    cornerBR: {
      bottom: 48,
      right: 24,
      borderBottomWidth: 1,
      borderRightWidth: 1,
      borderColor: hexToRgba(theme.primary, 0.25),
      borderBottomRightRadius: 4,
    },
    spinner: {
      position: 'absolute',
      bottom: 72,
    },
  })
}

