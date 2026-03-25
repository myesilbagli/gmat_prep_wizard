import { Text, View } from 'react-native'
import { PrimaryButton } from '../components/UI'
import type { AppTheme } from '../theme'

export function WelcomeScreen({
  theme,
  onSignIn,
  onSignUp,
}: {
  theme: AppTheme
  onSignIn: () => void
  onSignUp: () => void
}) {
  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: 24,
        paddingVertical: 28,
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <Text style={{ color: theme.muted, fontWeight: '700', letterSpacing: 1.5 }}>
        GMAT LEXICON
      </Text>
      <Text style={{ color: theme.text, fontSize: 34, fontWeight: '900', lineHeight: 38 }}>
        Welcome
      </Text>
      <Text style={{ color: theme.muted, fontSize: 15, lineHeight: 22 }}>
        Build a daily vocabulary habit with GMAT Lexicon—short sessions and progress tracking.
      </Text>

      <View
        style={{
          marginTop: 8,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 14,
          padding: 14,
          backgroundColor: theme.surface,
          gap: 10,
        }}
      >
        <PrimaryButton theme={theme} label="Sign in" onPress={onSignIn} />
        <View style={{ height: 2 }} />
        <PrimaryButton theme={theme} label="Sign up" onPress={onSignUp} />
      </View>

      <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 18 }}>
        Sign in with Email/Password for Expo Go testing. Google sign-in can be added later with
        native OAuth setup.
      </Text>
    </View>
  )
}
