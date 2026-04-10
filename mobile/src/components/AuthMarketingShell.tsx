import { BlurView } from 'expo-blur'
import { type ReactNode } from 'react'
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { AUTH } from '../lib/authMarketingTheme'

export function AuthMarketingBackground({
  baseColor = AUTH.bgBase,
}: {
  /** Welcome uses indigo-purple full-bleed; auth cards keep near-black. */
  baseColor?: string
}) {
  const { width, height } = useWindowDimensions()
  const dim = Math.max(width, height) * 1.35
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: baseColor }]} pointerEvents="none">
      <View
        style={{
          position: 'absolute',
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: AUTH.radialViolet,
          opacity: Platform.OS === 'android' ? 0.38 : 0.42,
          left: width / 2 - dim / 2,
          top: height * 0.12 - dim / 2,
        }}
      />
    </View>
  )
}

export function AuthBackNav({
  onBack,
  fontMedium,
}: {
  onBack: () => void
  fontMedium?: string
}) {
  return (
    <Pressable
      onPress={onBack}
      hitSlop={12}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingTop: 4,
        paddingBottom: 12,
        alignSelf: 'flex-start',
      }}
    >
      <MaterialIcons name="chevron-left" size={22} color={AUTH.zinc400} />
      <Text style={{ color: AUTH.zinc400, fontSize: 14, fontWeight: '600', fontFamily: fontMedium }}>Back</Text>
    </Pressable>
  )
}

export function AuthGlassCard({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
        borderRadius: 40,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: AUTH.glassBorder,
        ...Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 24 },
            shadowOpacity: 0.45,
            shadowRadius: 32,
          },
          android: { elevation: 16 },
        }),
      }}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 28 : 20}
        tint="dark"
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        style={{
          backgroundColor: AUTH.glassBlurTint,
          paddingHorizontal: 28,
          paddingVertical: 36,
        }}
      >
        {children}
      </BlurView>
    </View>
  )
}
