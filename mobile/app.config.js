/**
 * Extends app.json: adds Google Sign-In native plugin with iOS URL scheme derived from
 * EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID (set in EAS env for production builds).
 */
module.exports = ({ config }) => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || ''
  const iosUrlScheme = iosClientId.endsWith('.apps.googleusercontent.com')
    ? `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`
    : undefined

  const googlePlugin = iosUrlScheme
    ? ['@react-native-google-signin/google-signin', { iosUrlScheme }]
    : '@react-native-google-signin/google-signin'

  return {
    ...config,
    plugins: [...(config.plugins || []), googlePlugin, 'expo-apple-authentication'],
  }
}
