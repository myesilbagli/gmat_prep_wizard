/** YYYY-MM-DD for a Date in the given IANA timezone (fallback UTC). */
export function formatDateKeyInTimezone(date: Date, timeZone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const parts = fmt.formatToParts(date)
    const y = parts.find((p) => p.type === 'year')?.value
    const m = parts.find((p) => p.type === 'month')?.value
    const d = parts.find((p) => p.type === 'day')?.value
    if (y && m && d) return `${y}-${m}-${d}`
  } catch {
    // fall through
  }
  return date.toISOString().slice(0, 10)
}

/** Approximate yesterday's calendar date key in the given timezone. */
export function getYesterdayKeyInTimezone(timeZone: string): string {
  const now = new Date()
  const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  return formatDateKeyInTimezone(yest, timeZone)
}
