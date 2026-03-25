import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import * as AuthSession from 'expo-auth-session'
import * as Google from 'expo-auth-session/providers/google'
import * as WebBrowser from 'expo-web-browser'
import Constants from 'expo-constants'
import { Input, PrimaryButton } from '../components/UI'
import { signInWithEmail, signInWithGoogleIdToken } from '../lib/auth'
import { getGoogleOAuthConfig } from '../lib/env'
import type { AppTheme } from '../theme'

WebBrowser.maybeCompleteAuthSession()

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
  const googleConfig = getGoogleOAuthConfig()
  const useProxy = Constants.appOwnership === 'expo'
  const owner = Constants.expoConfig?.owner
  const slug = Constants.expoConfig?.slug
  const projectNameForProxy = useProxy && owner && slug ? `@${owner}/${slug}` : undefined
  const proxyRedirectUri = AuthSession.makeRedirectUri({
    useProxy,
    projectNameForProxy,
    scheme: 'gmatwizard',
  })
  const [request, response, promptAsync] = Google.useAuthRequest({
    ...googleConfig,
    redirectUri: proxyRedirectUri,
  })

  useEffect(() => {
    if (response?.type !== 'success') return
    const idToken =
      response.authentication?.idToken ||
      (typeof response.params?.id_token === 'string' ? response.params.id_token : undefined)
    if (!idToken) {
      setError('Google sign-in did not return a valid token.')
      setGoogleLoading(false)
      return
    }
    void (async () => {
      setError(null)
      try {
        await signInWithGoogleIdToken(idToken)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to sign in with Google')
      } finally {
        setGoogleLoading(false)
      }
    })()
  }, [response])

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
      <PrimaryButton
        theme={theme}
        label="Continue with Google"
        onPress={() => {
          setError(null)
          setGoogleLoading(true)
          void promptAsync(useProxy ? { useProxy: true, projectNameForProxy } : {}).catch((e: unknown) => {
            setError(e instanceof Error ? e.message : 'Failed to launch Google sign-in')
            setGoogleLoading(false)
          })
        }}
        loading={googleLoading}
        disabled={!request || loading}
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
