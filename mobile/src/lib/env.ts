export function requireFunctionsBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_FUNCTIONS_BASE_URL
  if (!url) throw new Error('Missing EXPO_PUBLIC_FUNCTIONS_BASE_URL')
  return url
}

export function getGoogleOAuthConfig() {
  return {
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  }
}
