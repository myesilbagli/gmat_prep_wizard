import Constants from 'expo-constants'
import { Platform } from 'react-native'

/**
 * Native Google Sign-In (TestFlight / dev client). Does not use gmatwizard:// or the Web OAuth redirect list.
 * Expo Go is not supported (no native module).
 */
export async function getGoogleIdTokenNative(): Promise<{ idToken: string } | { cancelled: true } | { error: string }> {
  if (Constants.appOwnership === 'expo') {
    return { error: 'Google sign-in needs a development or store build (Expo Go is not supported).' }
  }

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  if (!webClientId) {
    return { error: 'Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.' }
  }

  const { GoogleSignin, statusCodes } = await import('@react-native-google-signin/google-signin')

  GoogleSignin.configure({
    webClientId,
    iosClientId: iosClientId || undefined,
  })

  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
  }

  try {
    const res = await GoogleSignin.signIn()
    if (res.type !== 'success') {
      return { cancelled: true }
    }
    let idToken = res.data.idToken
    if (!idToken) {
      const tokens = await GoogleSignin.getTokens()
      idToken = tokens.idToken
    }
    if (!idToken) {
      return { error: 'Google did not return an ID token. Check Web client ID in Firebase / Google Cloud.' }
    }
    return { idToken }
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string }
    if (err.code === statusCodes.SIGN_IN_CANCELLED) {
      return { cancelled: true }
    }
    return { error: err.message || 'Google sign-in failed.' }
  }
}
