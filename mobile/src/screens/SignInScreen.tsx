import { useState } from 'react'
import { Text, View } from 'react-native'
import { Input, PrimaryButton } from '../components/UI'
import { signInWithEmail } from '../lib/auth'
import type { AppTheme } from '../theme'

export function SignInScreen({
  theme,
  onGoSignUp,
}: {
  theme: AppTheme
  onGoSignUp: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
      <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>Sign In</Text>
      <Text style={{ color: theme.muted }}>
        Continue your GMAT vocabulary journey from mobile.
      </Text>
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
      <Text style={{ color: theme.muted }} onPress={onGoSignUp}>
        No account? Sign up
      </Text>
    </View>
  )
}
