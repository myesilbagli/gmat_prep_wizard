/** Fuzzy exam window (no exact day). */
export type ExamPart = 'early' | 'mid' | 'late'

export type ExamTarget = {
  year: number
  month: number // 1–12
  part: ExamPart
}

export type UserProfileDoc = {
  timezone: string
  /** ISO 639-1 (or regional) code for short native-language glosses on cards; `en` = English only. */
  mainLanguage?: string
  /** Canonical GMAT test day `YYYY-MM-DD` (user’s intended calendar date). */
  examDateIso: string | null
  /** @deprecated Legacy fuzzy window; kept for migration. Prefer `examDateIso`. */
  examTarget: ExamTarget | null
  /** Firestore `serverTimestamp` when onboarding finished; null/omit ⇒ show onboarding. */
  onboardingCompletedAt?: unknown | null
  onboardingFirstStackId?: string | null
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
  /** Study sessions started today (freemium daily cap). Incremented when SessionScreen begins. */
  sessionStartsCount?: number
  updatedAt?: unknown
}

export const DEFAULT_TIMEZONE = 'UTC'

/** True when the full onboarding flow should run (new accounts). Legacy users without the field are skipped if they already study. */
export function profileNeedsOnboarding(p: UserProfileDoc): boolean {
  if (p.onboardingCompletedAt != null) return false
  if ((p.sessionCount ?? 0) > 0) return false
  if (p.lastActiveDate) return false
  return true
}
