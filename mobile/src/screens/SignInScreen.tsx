import * as AppleAuthentication from 'expo-apple-authentication'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { Input, PrimaryButton } from '../components/UI'
import { signInWithAppleIdToken, signInWithEmail, signInWithGoogleIdToken } from '../lib/auth'
import { getAppleIdTokenNative, isAppleSignInAvailable } from '../lib/appleNativeSignIn'
import { getGoogleIdTokenNative } from '../lib/googleNativeSignIn'
import type { AppTheme } from '../theme'

export function SignInScreen({
  theme,
  onGoSignUp,
  onBack,
}: {
  theme: AppTheme
  onGoSignUp: () => void
  onBack: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [appleLoading, setAppleLoading] = useState(false)
  const [showApple, setShowApple] = useState(false)

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

  return (
    <View style={{ padding: 20, gap: 12 }}>
      <Text style={{ color: theme.muted }} onPress={onBack}>
        ← Back
      </Text>
      <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>Sign In</Text>
      <Text style={{ color: theme.muted }}>
        Continue your GMAT prep with GMAT Lexicon on mobile.
      </Text>
      {showApple ? (
        <View style={{ position: 'relative' }}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={999}
            style={{ width: '100%', height: 48, opacity: appleLoading ? 0.55 : 1 }}
            onPress={() => void handleApple()}
          />
          {appleLoading ? (
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
              <ActivityIndicator color="#fff" />
            </View>
          ) : null}
        </View>
      ) : null}
      <PrimaryButton
        theme={theme}
        label="Continue with Google"
        onPress={() => void handleGoogle()}
        loading={googleLoading}
        disabled={loading || appleLoading}
      />
      <View style={{ alignItems: 'center', paddingVertical: 2 }}>
        <Text style={{ color: theme.muted, fontSize: 12 }}>or use email</Text>
      </View>
      <Input theme={theme} value={email} onChangeText={setEmail} placeholder="Email" />
      <Input
        theme={theme}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        onSubmitEditing={handleSignIn}
      />
      {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
      <PrimaryButton
        theme={theme}
        label="Sign In"
        onPress={handleSignIn}
        loading={loading}
        disabled={!email.trim() || !password}
      />
      <Pressable onPress={onGoSignUp}>
        <Text style={{ color: theme.muted }}>No account? Sign up</Text>
      </Pressable>
    </View>
  )
}
