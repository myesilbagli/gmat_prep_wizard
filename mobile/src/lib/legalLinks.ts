/**
 * Legal documents are served from the same origin as Firebase Hosting (Vite app uses HashRouter).
 * URLs look like: https://<project>.web.app/#/privacy
 *
 * Set EXPO_PUBLIC_WEB_APP_URL when using a custom domain (no trailing slash).
 */
function trimTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, '')
}

export function getWebAppOrigin(): string {
  const explicit = process.env.EXPO_PUBLIC_WEB_APP_URL?.trim()
  if (explicit) return trimTrailingSlashes(explicit)
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim()
  if (projectId) return `https://${projectId}.web.app`
  return ''
}

export function getPrivacyPolicyUrl(): string {
  const origin = getWebAppOrigin()
  return origin ? `${origin}/#/privacy` : ''
}

export function getTermsOfServiceUrl(): string {
  const origin = getWebAppOrigin()
  return origin ? `${origin}/#/terms` : ''
}
