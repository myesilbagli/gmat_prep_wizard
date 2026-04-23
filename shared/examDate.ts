import type { ExamPart, ExamTarget } from './userProfile'
import { formatDateKeyInTimezone } from './dateInTimezone'

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function representativeDayForPart(part: ExamPart): number {
  if (part === 'early') return 5
  if (part === 'mid') return 15
  return 25
}

/** Legacy migration: approximate a calendar day from fuzzy exam window. */
export function deriveExamDateIsoFromTarget(t: ExamTarget): string {
  const day = Math.min(representativeDayForPart(t.part), daysInMonth(t.year, t.month))
  const m = String(t.month).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${t.year}-${m}-${d}`
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isValidExamDateIso(s: string): boolean {
  if (!ISO_DATE.test(s)) return false
  const [y, mo, d] = s.split('-').map(Number)
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

export function resolveExamDateIso(params: {
  examDateIso?: string | null
  examTarget?: ExamTarget | null
}): string | null {
  const raw = params.examDateIso
  if (typeof raw === 'string' && raw && isValidExamDateIso(raw)) return raw
  if (params.examTarget) return deriveExamDateIsoFromTarget(params.examTarget)
  return null
}

/** Calendar days from today (in `timezone`) until `examDateIso` (inclusive of exam day). Past dates → 0. */
export function daysUntilExam(examDateIso: string, timezone: string): number {
  const today = formatDateKeyInTimezone(new Date(), timezone)
  if (examDateIso < today) return 0
  const t0 = Date.UTC(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)) - 1,
    Number(today.slice(8, 10)),
  )
  const t1 = Date.UTC(
    Number(examDateIso.slice(0, 4)),
    Number(examDateIso.slice(5, 7)) - 1,
    Number(examDateIso.slice(8, 10)),
  )
  return Math.round((t1 - t0) / (24 * 60 * 60 * 1000))
}
