import { useState } from 'react'
import { Text, View } from 'react-native'
import { Input, PrimaryButton } from '../components/UI'
import { signUpWithEmail } from '../lib/auth'
import type { AppTheme } from '../theme'

export function SignUpScreen({
  theme,
  onGoSignIn,
}: {
  theme: AppTheme
  onGoSignIn: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSignUp() {
    setError(null)
    setLoading(true)
    try {
      await signUpWithEmail(email.trim(), password)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sign up')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={{ padding: 20, gap: 12 }}>
      <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>Sign Up</Text>
      <Text style={{ color: theme.muted }}>
        Create your account to save and practice words across web and mobile.
      </Text>
      <Input theme={theme} value={email} onChangeText={setEmail} placeholder="Email" />
      <Input
        theme={theme}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        onSubmitEditing={handleSignUp}
      />
      {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
      <PrimaryButton
        theme={theme}
        label="Create Account"
        onPress={handleSignUp}
        loading={loading}
        disabled={!email.trim() || password.length < 6}
      />
      <Text style={{ color: theme.muted }} onPress={onGoSignIn}>
        Already have an account? Sign in
      </Text>
    </View>
  )
}
