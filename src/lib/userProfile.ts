import { arrayUnion, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { DEFAULT_MAIN_LANGUAGE, normalizeMainLanguageCode } from '../../shared/languages'
import { DEFAULT_TIMEZONE, type ExamTarget, type UserProfileDoc } from '../../shared/userProfile'
import { auth, db } from './firebase'
import { formatDateKeyInTimezone, getYesterdayKeyInTimezone } from '../../shared/dateInTimezone'

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
      | 'examTarget'
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

export async function ensureUserProfileDefaults(): Promise<UserProfileDoc> {
  const uid = requireUid()
  const ref = doc(db, 'users', uid, ...PROFILE_PATH)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    const d = snap.data() as Partial<UserProfileDoc>
    return {
      timezone: typeof d.timezone === 'string' && d.timezone ? d.timezone : DEFAULT_TIMEZONE,
      mainLanguage: normalizeMainLanguageCode(d.mainLanguage),
      examTarget: d.examTarget ?? null,
      streakCurrent: typeof d.streakCurrent === 'number' ? d.streakCurrent : 0,
      streakLongest: typeof d.streakLongest === 'number' ? d.streakLongest : 0,
      sessionCount: typeof d.sessionCount === 'number' ? d.sessionCount : 0,
      lastActiveDate: d.lastActiveDate ?? null,
    }
  }
  const initial: UserProfileDoc = {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE,
    mainLanguage: DEFAULT_MAIN_LANGUAGE,
    examTarget: null,
    streakCurrent: 0,
    streakLongest: 0,
    sessionCount: 0,
    lastActiveDate: null,
  }
  await setDoc(ref, { ...initial, updatedAt: serverTimestamp() })
  return initial
}

export function getTodayKey(profile: UserProfileDoc): string {
  return formatDateKeyInTimezone(new Date(), profile.timezone || DEFAULT_TIMEZONE)
}

/** Apply streak after a full daily session completes. Idempotent for same calendar day. */
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
