/** Same behavior as `parseJsonFromOutputText` in Firebase `handleGenerate`. */
export function parseJsonFromOutputText<T>(outputText: string): T | null {
  const t = outputText.trim()
  if (!t) return null
  try {
    return JSON.parse(t) as T
  } catch {
    const start = t.indexOf('{')
    const end = t.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1)) as T
      } catch {
        return null
      }
    }
    return null
  }
}
