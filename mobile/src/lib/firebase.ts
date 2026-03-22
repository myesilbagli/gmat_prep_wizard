import { initializeApp } from 'firebase/app'
import * as Auth from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage'
import { buildFirebaseConfig } from '@shared/firebaseConfig'

const firebaseConfig = buildFirebaseConfig(process.env)

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
