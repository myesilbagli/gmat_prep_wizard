import { initializeApp } from 'firebase/app'
import * as Auth from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage'
import { buildFirebaseConfig } from '@shared/firebaseConfig'

// Use explicit process.env.EXPO_PUBLIC_* reads so Metro can inline EAS env at bundle time.
// buildFirebaseConfig(process.env) breaks inlining — release builds then see empty values.
const firebaseConfig = buildFirebaseConfig({
  EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  VITE_FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_APP_ID: process.env.VITE_FIREBASE_APP_ID,
})

const app = initializeApp(firebaseConfig)
const getAuth = Auth.getAuth
const initializeAuth = Auth.initializeAuth
const getReactNativePersistence = (Auth as unknown as {
  getReactNativePersistence?: (storage: unknown) => unknown
}).getReactNativePersistence

export const auth = (() => {
  try {
    if (!getReactNativePersistence) return getAuth(app)
    return initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage) as any,
    })
  } catch {
    return getAuth(app)
  }
})()
export const db = getFirestore(app)
