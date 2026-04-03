import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { auth } from './firebase'

export function subscribeToAuth(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb)
}

export async function signInWithEmail(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email, password)
}

export async function signUpWithEmail(email: string, password: string) {
  await createUserWithEmailAndPassword(auth, email, password)
}

export async function signOutUser() {
  await signOut(auth)
}

export async function signInWithGoogleIdToken(idToken: string) {
  const credential = GoogleAuthProvider.credential(idToken)
  await signInWithCredential(auth, credential)
}

/** Apple Sign-In (iOS): pass identityToken from Apple and the same raw nonce sent to Apple (Expo hashes it for the request). */
export async function signInWithAppleIdToken(idToken: string, rawNonce: string) {
  const provider = new OAuthProvider('apple.com')
  const credential = provider.credential({ idToken, rawNonce })
  await signInWithCredential(auth, credential)
}
