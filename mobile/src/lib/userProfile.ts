import { arrayUnion, doc, getDoc, increment, serverTimestamp, setDoc } from 'firebase/firestore'
import { formatDateKeyInTimezone, getYesterdayKeyInTimezone } from '@shared/dateInTimezone'
import { DEFAULT_MAIN_LANGUAGE, normalizeMainLanguageCode } from '@shared/languages'
import type { DailyDoc, ExamTarget, UserProfileDoc } from '@shared/userProfile'
import { DEFAULT_TIMEZONE, profileNeedsOnboarding } from '@shared/userProfile'
import { auth, db } from './firebase'

const PROFILE_PATH = ['settings', 'profile'] as const

function requireUid(): string {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You must be signed in.')
  return uid
}

export async function getUserProfile(): Promise<UserProfileDoc | null> {
  const uid = requireUid()
  const ref = doc(db, 'users', uid, ...PROFILE_PATH)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data() as UserProfileDoc
}

export async function saveUserProfilePatch(
  patch: Partial<
    Pick<
      UserProfileDoc,
      | 'timezone'
      | 'mainLanguage'
      | 'examDateIso'
      | 'examTarget'
      | 'onboardingCompletedAt'
      | 'onboardingFirstStackId'
      | 'streakCurrent'
      | 'streakLongest'
      | 'sessionCount'
      | 'lastActiveDate'
    >
  >,
) {
  const uid = requireUid()
  const ref = doc(db, 'users', uid, ...PROFILE_PATH)
  await setDoc(
    ref,
    {
      ...patch,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

function mergeProfileDefaults(d: Partial<UserProfileDoc>): UserProfileDoc {
  return {
    timezone: typeof d.timezone === 'string' && d.timezone ? d.timezone : DEFAULT_TIMEZONE,
    mainLanguage: normalizeMainLanguageCode(d.mainLanguage),
    examDateIso: typeof d.examDateIso === 'string' && d.examDateIso ? d.examDateIso : null,
    examTarget: d.examTarget ?? null,
    onboardingCompletedAt: d.onboardingCompletedAt ?? null,
    onboardingFirstStackId:
      typeof d.onboardingFirstStackId === 'string' ? d.onboardingFirstStackId : null,
    streakCurrent: typeof d.streakCurrent === 'number' ? d.streakCurrent : 0,
    streakLongest: typeof d.streakLongest === 'number' ? d.streakLongest : 0,
    sessionCount: typeof d.sessionCount === 'number' ? d.sessionCount : 0,
    lastActiveDate: d.lastActiveDate ?? null,
  }
}

export async function ensureUserProfileDefaults(): Promise<UserProfileDoc> {
  const uid = requireUid()
  const ref = doc(db, 'users', uid, ...PROFILE_PATH)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    const d = snap.data() as Partial<UserProfileDoc>
    return mergeProfileDefaults(d)
  }
  const initial: UserProfileDoc = {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE,
    mainLanguage: DEFAULT_MAIN_LANGUAGE,
    examDateIso: null,
    examTarget: null,
    onboardingCompletedAt: null,
    onboardingFirstStackId: null,
    streakCurrent: 0,
    streakLongest: 0,
    sessionCount: 0,
    lastActiveDate: null,
  }
  await setDoc(ref, { ...initial, updatedAt: serverTimestamp() })
  return initial
}

/** Whether the onboarding flow should be shown (see shared `profileNeedsOnboarding`). */
export function shouldShowOnboarding(profile: UserProfileDoc): boolean {
  return profileNeedsOnboarding(profile)
}

export function getTodayKey(profile: UserProfileDoc): string {
  return formatDateKeyInTimezone(new Date(), profile.timezone || DEFAULT_TIMEZONE)
}

export async function applyStreakAfterSessionComplete(): Promise<UserProfileDoc> {
  const profile = await ensureUserProfileDefaults()
  const today = getTodayKey(profile)
  if (profile.lastActiveDate === today) {
    return profile
  }
  const y = getYesterdayKeyInTimezone(profile.timezone || DEFAULT_TIMEZONE)
  let next = 1
  if (profile.lastActiveDate === y) {
    next = profile.streakCurrent + 1
  }
  const longest = Math.max(profile.streakLongest, next)
  await saveUserProfilePatch({
    streakCurrent: next,
    streakLongest: longest,
    lastActiveDate: today,
  })
  return {
    ...profile,
    streakCurrent: next,
    streakLongest: longest,
    lastActiveDate: today,
  }
}

/** How many study sessions were started today (for freemium daily cap). */
export async function getTodaySessionStarts(): Promise<number> {
  const uid = requireUid()
  const profile = await ensureUserProfileDefaults()
  const dateKey = getTodayKey(profile)
  const dailyRef = doc(db, 'users', uid, 'daily', dateKey)
  const snap = await getDoc(dailyRef)
  if (!snap.exists()) return 0
  const d = snap.data() as DailyDoc
  return typeof d.sessionStartsCount === 'number' ? d.sessionStartsCount : 0
}

/** Call once when SessionScreen begins (after initial load). */
export async function recordSessionStart(): Promise<void> {
  const uid = requireUid()
  const profile = await ensureUserProfileDefaults()
  const dateKey = getTodayKey(profile)
  const dailyRef = doc(db, 'users', uid, 'daily', dateKey)
  await setDoc(
    dailyRef,
    {
      sessionStartsCount: increment(1),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function recordDailySessionCompletion(sessionId: string = 'daily_vocab') {
  const uid = requireUid()
  const profile = await ensureUserProfileDefaults()
  const dateKey = getTodayKey(profile)
  const dailyRef = doc(db, 'users', uid, 'daily', dateKey)
  const profileRef = doc(db, 'users', uid, ...PROFILE_PATH)
  const nextSessionCount = (profile.sessionCount ?? 0) + 1
  await Promise.all([
    setDoc(
      dailyRef,
      {
        sessionsCompleted: arrayUnion(sessionId),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
    setDoc(
      profileRef,
      {
        sessionCount: nextSessionCount,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  ])
}

export async function saveExamTarget(exam: ExamTarget | null) {
  await saveUserProfilePatch({ examTarget: exam })
}

export async function saveExamDateIso(iso: string | null) {
  await saveUserProfilePatch({ examDateIso: iso, examTarget: null })
}

export async function completeOnboardingProfile(params: {
  examDateIso: string | null
  firstStackId: string
}) {
  const uid = requireUid()
  const ref = doc(db, 'users', uid, ...PROFILE_PATH)
  await setDoc(
    ref,
    {
      examDateIso: params.examDateIso,
      examTarget: null,
      onboardingCompletedAt: serverTimestamp(),
      onboardingFirstStackId: params.firstStackId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

/** Dev / replay: clear completion so onboarding runs again. */
export async function clearOnboardingCompletedFlag(): Promise<void> {
  const uid = requireUid()
  const ref = doc(db, 'users', uid, ...PROFILE_PATH)
  await setDoc(
    ref,
    {
      onboardingCompletedAt: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}
