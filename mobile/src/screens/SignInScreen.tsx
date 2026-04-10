import { useEffect, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import FontAwesome5 from '@expo/vector-icons/FontAwesome5'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AuthBackNav, AuthGlassCard, AuthMarketingBackground } from '../components/AuthMarketingShell'
import { useGlassFonts } from '../components/GlassUi'
import { AUTH } from '../lib/authMarketingTheme'
import { signInWithAppleIdToken, signInWithEmail, signInWithGoogleIdToken } from '../lib/auth'
import { getAppleIdTokenNative, isAppleSignInAvailable } from '../lib/appleNativeSignIn'
import { getGoogleIdTokenNative } from '../lib/googleNativeSignIn'
import type { AppTheme } from '../theme'

export function SignInScreen({
  theme: _theme,
  onGoSignUp,
  onBack,
}: {
  theme: AppTheme
  onGoSignUp: () => void
  onBack: () => void
}) {
  const insets = useSafeAreaInsets()
  const fonts = useGlassFonts()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [appleLoading, setAppleLoading] = useState(false)
  const [showApple, setShowApple] = useState(false)
  const [emailFocus, setEmailFocus] = useState(false)
  const [passwordFocus, setPasswordFocus] = useState(false)

  useEffect(() => {
    void isAppleSignInAvailable().then(setShowApple)
  }, [])

  async function handleApple() {
    setError(null)
    setAppleLoading(true)
    try {
      const result = await getAppleIdTokenNative()
      if ('error' in result) {
        setError(result.error)
        return
      }
      if ('cancelled' in result) {
        return
      }
      await signInWithAppleIdToken(result.idToken, result.rawNonce)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sign in with Apple')
    } finally {
      setAppleLoading(false)
    }
  }

  async function handleGoogle() {
    setError(null)
    setGoogleLoading(true)
    try {
      const result = await getGoogleIdTokenNative()
      if ('error' in result) {
        setError(result.error)
        return
      }
      if ('cancelled' in result) {
        return
      }
      await signInWithGoogleIdToken(result.idToken)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sign in with Google')
    } finally {
      setGoogleLoading(false)
    }
  }

  async function handleSignIn() {
    setError(null)
    setLoading(true)
    try {
      await signInWithEmail(email.trim(), password)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = email.trim().length > 0 && password.length > 0

  const inputBase = {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: Platform.OS === 'ios' ? 16 : 14,
    fontSize: 15,
    color: AUTH.zinc100,
    fontFamily: fonts.fontBody,
  } as const

  function SocialButton({
    label,
    icon,
    onPress,
    busy,
    disabled,
  }: {
    label: string
    icon: ReactNode
    onPress: () => void
    busy: boolean
    disabled?: boolean
  }) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled || busy}
        style={({ pressed }) => ({
          width: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 999,
          overflow: 'hidden',
          backgroundColor: pressed ? AUTH.socialBgPress : AUTH.socialBg,
          borderWidth: 1,
          borderColor: AUTH.socialBorder,
          opacity: disabled ? 0.5 : 1,
        })}
      >
        {icon}
        <Text
          style={{
            fontSize: 15,
            fontWeight: '600',
            letterSpacing: 0.3,
            color: AUTH.white,
            fontFamily: fonts.fontLabelBold,
          }}
        >
          {label}
        </Text>
        {busy ? (
          <View
            pointerEvents="none"
            style={{
              ...StyleSheet.absoluteFillObject,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.25)',
            }}
          >
            <ActivityIndicator color={AUTH.white} size="small" />
          </View>
        ) : null}
      </Pressable>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: AUTH.radialViolet }}>
      <AuthMarketingBackground baseColor={AUTH.radialViolet} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: Math.max(insets.top, 4),
            paddingBottom: 28 + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
        >
          <AuthBackNav onBack={onBack} fontMedium={fonts.fontLabel} />

          <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 16 }}>
            <AuthGlassCard>
              <View style={{ alignItems: 'center', marginBottom: 28 }}>
                <Text
                  style={{
                    fontSize: 30,
                    fontWeight: '800',
                    letterSpacing: -0.5,
                    color: AUTH.white,
                    marginBottom: 10,
                    fontFamily: fonts.fontHeadline,
                  }}
                >
                  Sign In
                </Text>
                <Text
                  style={{
                    textAlign: 'center',
                    fontSize: 14,
                    lineHeight: 21,
                    color: AUTH.zinc400,
                    fontFamily: fonts.fontBody,
                  }}
                >
                  Continue your GMAT prep with <Text style={{ color: AUTH.zinc200, fontWeight: '600' }}>GMAT Lexicon</Text> on
                  mobile.
                </Text>
              </View>

              <View style={{ gap: 10, marginBottom: 22 }}>
                {showApple ? (
                  <SocialButton
                    label="Sign in with Apple"
                    busy={appleLoading}
                    disabled={loading || googleLoading}
                    onPress={() => void handleApple()}
                    icon={<Ionicons name="logo-apple" size={22} color={AUTH.white} />}
                  />
                ) : null}
                <SocialButton
                  label="Continue with Google"
                  busy={googleLoading}
                  disabled={loading || appleLoading}
                  onPress={() => void handleGoogle()}
                  icon={<FontAwesome5 name="google" brand size={18} color={AUTH.white} />}
                />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 22 }}>
                <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: AUTH.divider }} />
                <Text
                  style={{
                    marginHorizontal: 14,
                    fontSize: 10,
                    fontWeight: '800',
                    letterSpacing: 2,
                    color: AUTH.zinc500,
                    fontFamily: fonts.fontLabelBold,
                  }}
                >
                  OR USE EMAIL
                </Text>
                <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: AUTH.divider }} />
              </View>

              {error ? (
                <Text
                  style={{
                    color: AUTH.danger,
                    fontSize: 14,
                    marginBottom: 12,
                    fontFamily: fonts.fontBody,
                  }}
                >
                  {error}
                </Text>
              ) : null}

              <View style={{ gap: 14 }}>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email address"
                  placeholderTextColor={AUTH.zinc500}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  onFocus={() => setEmailFocus(true)}
                  onBlur={() => setEmailFocus(false)}
                  style={{
                    ...inputBase,
                    borderColor: emailFocus ? AUTH.inputBorderFocus : AUTH.inputBorder,
                    backgroundColor: emailFocus ? AUTH.inputBgFocus : AUTH.inputBg,
                  }}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor={AUTH.zinc500}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="password"
                  onFocus={() => setPasswordFocus(true)}
                  onBlur={() => setPasswordFocus(false)}
                  onSubmitEditing={() => void handleSignIn()}
                  style={{
                    ...inputBase,
                    borderColor: passwordFocus ? AUTH.inputBorderFocus : AUTH.inputBorder,
                    backgroundColor: passwordFocus ? AUTH.inputBgFocus : AUTH.inputBg,
                  }}
                />

                <Pressable
                  onPress={() => void handleSignIn()}
                  disabled={!canSubmit || loading}
                  style={({ pressed }) => ({
                    marginTop: 6,
                    width: '100%',
                    paddingVertical: 16,
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: pressed ? AUTH.primaryPressed : AUTH.primary,
                    opacity: !canSubmit ? 0.55 : 1,
                    ...Platform.select({
                      ios: {
                        shadowColor: AUTH.primary,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.35,
                        shadowRadius: 12,
                      },
                      android: { elevation: 6 },
                    }),
                  })}
                >
                  {loading ? (
                    <ActivityIndicator color={AUTH.white} />
                  ) : (
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '800',
                        letterSpacing: 0.5,
                        color: AUTH.white,
                        fontFamily: fonts.fontHeadlineSm,
                      }}
                    >
                      Sign In
                    </Text>
                  )}
                </Pressable>
              </View>

              <View style={{ marginTop: 28, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: AUTH.zinc400, fontFamily: fonts.fontBody }}>No account? </Text>
                <Pressable onPress={onGoSignUp} hitSlop={8}>
                  <Text style={{ fontSize: 14, color: AUTH.primary, fontWeight: '800', fontFamily: fonts.fontLabelBold }}>Sign up</Text>
                </Pressable>
              </View>
            </AuthGlassCard>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}
