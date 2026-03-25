/** Fuzzy exam window (no exact day). */
export type ExamPart = 'early' | 'mid' | 'late'

export type ExamTarget = {
  year: number
  month: number // 1–12
  part: ExamPart
}

export type UserProfileDoc = {
  timezone: string
  examTarget: ExamTarget | null
  streakCurrent: number
  streakLongest: number
  /** Lifetime number of completed sessions. */
  sessionCount: number
  /** YYYY-MM-DD in user's timezone */
  lastActiveDate: string | null
  updatedAt?: unknown
}

export type DailyDoc = {
  sessionsCompleted: string[]
  updatedAt?: unknown
}

export const DEFAULT_TIMEZONE = 'UTC'
