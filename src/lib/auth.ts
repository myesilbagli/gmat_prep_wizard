import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { auth } from './firebase'

export function subscribeToAuth(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb)
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  await signInWithPopup(auth, provider)
}

export async function signOutUser() {
  await signOut(auth)
}

