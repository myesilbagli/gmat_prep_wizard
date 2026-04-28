import { formatDateKeyInTimezone } from './dateInTimezone'
import { bucketFromWord } from './learningBuckets'
import { MASTERED_MIN_SCORE, timestampToMillis } from './exposureScore'
import type { VocabItem } from './types'

const DEFAULT_BATCH = 5

const MS_PER_DAY = 24 * 60 * 60 * 1000

function isLearning(item: VocabItem): boolean {
  return item.exposureScore < MASTERED_MIN_SCORE
}

/**
 * Daily session: exactly 5 words from the full deck (or all if fewer).
 * Pool: learning only. Priorities: (1) recently wrong, (2) lowest score / oldest save,
 * (3) longest unseen (null lastSeenAt first).
 */
export function pickSessionBatchFive(items: VocabItem[], max: number = DEFAULT_BATCH): VocabItem[] {
  const pool = items.filter(isLearning)
  if (pool.length <= max) return pool.slice()

  const picked: VocabItem[] = []
  const pickedIds = new Set<string>()

  const wrong = pool.filter((i) => i.lastCorrect === false)
  wrong.sort((a, b) => {
    const ta = timestampToMillis(a.lastAnsweredAt) ?? 0
    const tb = timestampToMillis(b.lastAnsweredAt) ?? 0
    return tb - ta
  })
  for (const w of wrong) {
    if (picked.length >= max) break
    picked.push(w)
    pickedIds.add(w.id)
  }

  let rest = pool.filter((i) => !pickedIds.has(i.id))
  rest.sort((a, b) => {
    if (a.exposureScore !== b.exposureScore) return a.exposureScore - b.exposureScore
    const ca = timestampToMillis(a.createdAt) ?? Number.POSITIVE_INFINITY
    const cb = timestampToMillis(b.createdAt) ?? Number.POSITIVE_INFINITY
    return ca - cb
  })
  for (const w of rest) {
    if (picked.length >= max) break
    picked.push(w)
    pickedIds.add(w.id)
  }

  rest = pool.filter((i) => !pickedIds.has(i.id))
  rest.sort((a, b) => {
    const sa = timestampToMillis(a.lastSeenAt)
    const sb = timestampToMillis(b.lastSeenAt)
    if (sa == null && sb == null) return 0
    if (sa == null) return -1
    if (sb == null) return 1
    return sa - sb
  })
  for (const w of rest) {
    if (picked.length >= max) break
    picked.push(w)
    pickedIds.add(w.id)
  }

  return picked.slice(0, max)
}

export type SessionSlotRole = 'new' | 'learning' | 'familiar' | 'review'

export type SessionBatchTwelve = {
  ids: string[]
  slots: { id: string; role: SessionSlotRole }[]
}

/** Human-readable composition for Today preview, e.g. `2 new · 6 learning · 2 familiar · 2 review`. */
export function formatSessionBatchComposition(slots: { role: SessionSlotRole }[]): string {
  let n = 0
  let l = 0
  let f = 0
  let r = 0
  for (const s of slots) {
    if (s.role === 'new') n += 1
    else if (s.role === 'learning') l += 1
    else if (s.role === 'familiar') f += 1
    else r += 1
  }
  return `${n} new · ${l} learning · ${f} familiar · ${r} review`
}

export function pickSessionBatchTwelve(
  items: VocabItem[],
  args: { nowMs: number; userTimezone: string },
): SessionBatchTwelve {
  const { nowMs, userTimezone } = args
  const todayKey = formatDateKeyInTimezone(new Date(nowMs), userTimezone)

  const daysSinceLastSeenMs = (w: VocabItem): number => {
    const ms = timestampToMillis(w.lastSeenAt)
    if (ms == null) return 999
    return Math.floor((nowMs - ms) / MS_PER_DAY)
  }

  const lastSeenIsToday = (w: VocabItem): boolean => {
    const ms = timestampToMillis(w.lastSeenAt)
    if (ms == null) return false
    return formatDateKeyInTimezone(new Date(ms), userTimezone) === todayKey
  }

  const learningRank = (w: VocabItem): number => {
    let p = 0
    if (w.lastCorrect === false) p += 40
    p += 25 - w.exposureScore
    p += Math.min(daysSinceLastSeenMs(w), 14)
    if (lastSeenIsToday(w)) p -= 30
    return p
  }

  const newRank = (w: VocabItem): number => {
    const c = timestampToMillis(w.createdAt) ?? 0
    return -c
  }

  const reviewRank = (w: VocabItem): number => daysSinceLastSeenMs(w)

  const familiarRank = (w: VocabItem): number => w.exposureScore

  const poolNew = items.filter((w) => bucketFromWord(w) === 'new')
  const poolLearning = items.filter((w) => bucketFromWord(w) === 'learning')
  const poolFamiliar = items.filter((w) => bucketFromWord(w) === 'familiar')
  const poolReview = items.filter((w) => {
    const b = bucketFromWord(w)
    return (b === 'familiar' || b === 'mastered') && daysSinceLastSeenMs(w) >= 10
  })

  const pickedIds = new Set<string>()
  const slots: { id: string; role: SessionSlotRole }[] = []

  const pushPick = (w: VocabItem, role: SessionSlotRole): boolean => {
    if (pickedIds.has(w.id)) return false
    if (slots.length >= 12) return false
    pickedIds.add(w.id)
    slots.push({ id: w.id, role })
    return true
  }

  const pickN = (pool: VocabItem[], role: SessionSlotRole, n: number, rank: (w: VocabItem) => number): number => {
    const sorted = [...pool]
      .filter((w) => !pickedIds.has(w.id))
      .sort((a, b) => {
        const ra = rank(a)
        const rb = rank(b)
        if (rb !== ra) return rb - ra
        return a.id.localeCompare(b.id)
      })
    let taken = 0
    for (const w of sorted) {
      if (taken >= n) break
      if (pushPick(w, role)) taken++
    }
    return taken
  }

  const countRole = (r: SessionSlotRole) => slots.filter((s) => s.role === r).length

  const NEW_CAP = 2
  const LEARN_CAP = 6
  const FAM_CAP = 2
  const REV_CAP = 2

  pickN(poolReview, 'review', REV_CAP, reviewRank)
  pickN(poolNew, 'new', NEW_CAP, newRank)
  pickN(poolFamiliar, 'familiar', FAM_CAP, familiarRank)
  pickN(poolLearning, 'learning', LEARN_CAP, learningRank)

  const deficitNew = NEW_CAP - countRole('new')
  if (deficitNew > 0) {
    let left = deficitNew
    left -= pickN(poolLearning, 'learning', left, learningRank)
    if (left > 0) pickN(poolFamiliar, 'learning', left, learningRank)
  }

  const deficitLearn = LEARN_CAP - countRole('learning')
  if (deficitLearn > 0) {
    let left = deficitLearn
    left -= pickN(
      poolNew.filter((w) => !pickedIds.has(w.id)),
      'learning',
      left,
      learningRank,
    )
    if (left > 0) pickN(poolFamiliar, 'learning', left, learningRank)
  }

  const deficitRev = REV_CAP - countRole('review')
  if (deficitRev > 0) {
    pickN(poolFamiliar, 'familiar', deficitRev, familiarRank)
  }

  const rankTopUp = (w: VocabItem): number => learningRank(w)

  while (slots.length < 12) {
    const rest = items.filter((w) => !pickedIds.has(w.id))
    if (rest.length === 0) break
    rest.sort((a, b) => {
      const ra = rankTopUp(a)
      const rb = rankTopUp(b)
      if (rb !== ra) return rb - ra
      return a.id.localeCompare(b.id)
    })
    const w = rest[0]!
    const b = bucketFromWord(w)
    const role: SessionSlotRole =
      b === 'new' ? 'new' : b === 'familiar' ? 'familiar' : b === 'mastered' ? 'review' : 'learning'
    if (!pushPick(w, role)) break
  }

  const newIds = slots.filter((s) => s.role === 'new').map((s) => s.id)
  const restIds = slots.filter((s) => s.role !== 'new').map((s) => s.id)
  const ids = [...newIds, ...restIds]

  return { ids, slots }
}

/** Daily session batch (10 words, mobile). Same slot structure as `SessionBatchTwelve`. */
export type SessionBatchTen = {
  ids: string[]
  slots: { id: string; role: SessionSlotRole }[]
}

/**
 * Daily session: up to 10 words. Target composition 2 new / 5 learning / 2 familiar / 1 review.
 * Same ranking functions and deficit logic as `pickSessionBatchTwelve`; only caps and total size differ.
 */
export function pickSessionBatchTen(
  items: VocabItem[],
  args: { nowMs: number; userTimezone: string },
): SessionBatchTen {
  const { nowMs, userTimezone } = args
  const todayKey = formatDateKeyInTimezone(new Date(nowMs), userTimezone)

  const daysSinceLastSeenMs = (w: VocabItem): number => {
    const ms = timestampToMillis(w.lastSeenAt)
    if (ms == null) return 999
    return Math.floor((nowMs - ms) / MS_PER_DAY)
  }

  const lastSeenIsToday = (w: VocabItem): boolean => {
    const ms = timestampToMillis(w.lastSeenAt)
    if (ms == null) return false
    return formatDateKeyInTimezone(new Date(ms), userTimezone) === todayKey
  }

  const learningRank = (w: VocabItem): number => {
    let p = 0
    if (w.lastCorrect === false) p += 40
    p += 25 - w.exposureScore
    p += Math.min(daysSinceLastSeenMs(w), 14)
    if (lastSeenIsToday(w)) p -= 30
    return p
  }

  const newRank = (w: VocabItem): number => {
    const c = timestampToMillis(w.createdAt) ?? 0
    return -c
  }

  const reviewRank = (w: VocabItem): number => daysSinceLastSeenMs(w)

  const familiarRank = (w: VocabItem): number => w.exposureScore

  const poolNew = items.filter((w) => bucketFromWord(w) === 'new')
  const poolLearning = items.filter((w) => bucketFromWord(w) === 'learning')
  const poolFamiliar = items.filter((w) => bucketFromWord(w) === 'familiar')
  const poolReview = items.filter((w) => {
    const b = bucketFromWord(w)
    return (b === 'familiar' || b === 'mastered') && daysSinceLastSeenMs(w) >= 10
  })

  const pickedIds = new Set<string>()
  const slots: { id: string; role: SessionSlotRole }[] = []

  const pushPick = (w: VocabItem, role: SessionSlotRole): boolean => {
    if (pickedIds.has(w.id)) return false
    if (slots.length >= 10) return false
    pickedIds.add(w.id)
    slots.push({ id: w.id, role })
    return true
  }

  const pickN = (pool: VocabItem[], role: SessionSlotRole, n: number, rank: (w: VocabItem) => number): number => {
    const sorted = [...pool]
      .filter((w) => !pickedIds.has(w.id))
      .sort((a, b) => {
        const ra = rank(a)
        const rb = rank(b)
        if (rb !== ra) return rb - ra
        return a.id.localeCompare(b.id)
      })
    let taken = 0
    for (const w of sorted) {
      if (taken >= n) break
      if (pushPick(w, role)) taken++
    }
    return taken
  }

  const countRole = (r: SessionSlotRole) => slots.filter((s) => s.role === r).length

  const NEW_CAP = 2
  const LEARN_CAP = 5
  const FAM_CAP = 2
  const REV_CAP = 1

  pickN(poolReview, 'review', REV_CAP, reviewRank)
  pickN(poolNew, 'new', NEW_CAP, newRank)
  pickN(poolFamiliar, 'familiar', FAM_CAP, familiarRank)
  pickN(poolLearning, 'learning', LEARN_CAP, learningRank)

  const deficitNew = NEW_CAP - countRole('new')
  if (deficitNew > 0) {
    let left = deficitNew
    left -= pickN(poolLearning, 'learning', left, learningRank)
    if (left > 0) pickN(poolFamiliar, 'learning', left, learningRank)
  }

  const deficitLearn = LEARN_CAP - countRole('learning')
  if (deficitLearn > 0) {
    let left = deficitLearn
    left -= pickN(
      poolNew.filter((w) => !pickedIds.has(w.id)),
      'learning',
      left,
      learningRank,
    )
    if (left > 0) pickN(poolFamiliar, 'learning', left, learningRank)
  }

  const deficitRev = REV_CAP - countRole('review')
  if (deficitRev > 0) {
    pickN(poolFamiliar, 'familiar', deficitRev, familiarRank)
  }

  const rankTopUp = (w: VocabItem): number => learningRank(w)

  while (slots.length < 10) {
    const rest = items.filter((w) => !pickedIds.has(w.id))
    if (rest.length === 0) break
    rest.sort((a, b) => {
      const ra = rankTopUp(a)
      const rb = rankTopUp(b)
      if (rb !== ra) return rb - ra
      return a.id.localeCompare(b.id)
    })
    const w = rest[0]!
    const b = bucketFromWord(w)
    const role: SessionSlotRole =
      b === 'new' ? 'new' : b === 'familiar' ? 'familiar' : b === 'mastered' ? 'review' : 'learning'
    if (!pushPick(w, role)) break
  }

  const newIds = slots.filter((s) => s.role === 'new').map((s) => s.id)
  const restIds = slots.filter((s) => s.role !== 'new').map((s) => s.id)
  const ids = [...newIds, ...restIds]

  return { ids, slots }
}

export { DEFAULT_BATCH as SESSION_BATCH_SIZE }
