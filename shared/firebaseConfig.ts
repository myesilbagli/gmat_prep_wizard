export type FirebaseConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
}

export function buildFirebaseConfig(env: Record<string, string | undefined>): FirebaseConfig {
  const apiKey = env.EXPO_PUBLIC_FIREBASE_API_KEY ?? env.VITE_FIREBASE_API_KEY
  const authDomain = env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? env.VITE_FIREBASE_AUTH_DOMAIN
  const projectId = env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? env.VITE_FIREBASE_PROJECT_ID
  const appId = env.EXPO_PUBLIC_FIREBASE_APP_ID ?? env.VITE_FIREBASE_APP_ID

  if (!apiKey || !authDomain || !projectId || !appId) {
    throw new Error('Missing Firebase environment variables.')
  }

  return { apiKey, authDomain, projectId, appId }
}
