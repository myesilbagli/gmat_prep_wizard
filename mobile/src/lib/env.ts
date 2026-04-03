export function requireFunctionsBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_FUNCTIONS_BASE_URL
  if (!url) throw new Error('Missing EXPO_PUBLIC_FUNCTIONS_BASE_URL')
  return url
}
