import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import { Platform } from 'react-native'

async function randomRawNonce(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16)
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex}${Date.now().toString(36)}`
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false
  return AppleAuthentication.isAvailableAsync()
}

/**
 * Native Sign in with Apple. Expo SHA256-hashes `nonce` before sending to Apple; Firebase needs the same raw string as `rawNonce`.
 */
export async function getAppleIdTokenNative(): Promise<
  { idToken: string; rawNonce: string } | { cancelled: true } | { error: string }
> {
  if (Platform.OS !== 'ios') {
    return { error: 'Sign in with Apple is only available on iOS.' }
  }
  const available = await AppleAuthentication.isAvailableAsync()
  if (!available) {
    return { error: 'Sign in with Apple is not available on this device.' }
  }

  const rawNonce = await randomRawNonce()

  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: rawNonce,
    })

    if (!cred.identityToken) {
      return { error: 'Apple did not return an identity token.' }
    }
    return { idToken: cred.identityToken, rawNonce }
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string }
    if (err.code === 'ERR_REQUEST_CANCELED' || err.code === 'ERR_CANCELED') {
      return { cancelled: true }
    }
    return { error: err.message || 'Apple sign-in failed.' }
  }
}
