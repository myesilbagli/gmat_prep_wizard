/**
 * Per-OFFICIAL-subtype accuracy aggregation across a user's RC + CR
 * attempt history. Powers the /test practice hub.
 *
 * Maps each attempted question's generator type → official subtype via
 * the canonical taxonomy, then tallies correct/total per subtype.
 *
 * - RC correctness is derived (userAnswerIndex === correctIndex) since
 *   it isn't persisted per-question.
 * - CR correctness uses the stored `isCorrect` field.
 * - Unanswered questions are excluded from the tally (the user never
 *   committed an answer, so they shouldn't drag the accuracy down).
 * - Drill attempts and exam-set attempts both contribute.
 */
import type { RcAttempt } from '../../shared/rcTypes'
import type { CrAttempt } from '../../shared/crTypes'
import {
  ALL_VERBAL_SUBTYPE_KEYS,
  officialSubtypeForGeneratorType,
  type VerbalSubtypeKey,
} from '../../shared/verbalTaxonomy'

export type SubtypeAccuracyStats = {
  correct: number
  total: number
  /** correct / total — null when total === 0. */
  accuracy: number | null
}

export type SubtypeAccuracyMap = Record<VerbalSubtypeKey, SubtypeAccuracyStats>

function emptyMap(): SubtypeAccuracyMap {
  const out: Partial<SubtypeAccuracyMap> = {}
  for (const k of ALL_VERBAL_SUBTYPE_KEYS) {
    out[k] = { correct: 0, total: 0, accuracy: null }
  }
  return out as SubtypeAccuracyMap
}

function bumpBucket(
  map: SubtypeAccuracyMap,
  key: VerbalSubtypeKey,
  isCorrect: boolean,
) {
  const b = map[key]
  b.total += 1
  if (isCorrect) b.correct += 1
}

function finalizeAccuracy(map: SubtypeAccuracyMap) {
  for (const k of ALL_VERBAL_SUBTYPE_KEYS) {
    const b = map[k]
    b.accuracy = b.total > 0 ? b.correct / b.total : null
  }
}

export function computeSubtypeAccuracy(args: {
  rcAttempts: RcAttempt[]
  crAttempts: CrAttempt[]
}): SubtypeAccuracyMap {
  const map = emptyMap()

  for (const a of args.rcAttempts) {
    for (const q of a.questions) {
      if (typeof q.userAnswerIndex !== 'number') continue
      const subtypeKey = officialSubtypeForGeneratorType('rc', q.type)
      if (!subtypeKey) continue
      bumpBucket(map, subtypeKey, q.userAnswerIndex === q.correctIndex)
    }
  }

  for (const a of args.crAttempts) {
    for (const q of a.questions) {
      if (q.userAnswerIndex == null) continue
      const subtypeKey = officialSubtypeForGeneratorType('cr', q.questionType)
      if (!subtypeKey) continue
      bumpBucket(map, subtypeKey, q.isCorrect)
    }
  }

  finalizeAccuracy(map)
  return map
}

/** Overall accuracy across a section (rc or cr), rolling up subtypes. */
export function sectionAccuracy(
  map: SubtypeAccuracyMap,
  subtypeKeys: ReadonlyArray<VerbalSubtypeKey>,
): SubtypeAccuracyStats {
  let correct = 0
  let total = 0
  for (const k of subtypeKeys) {
    correct += map[k].correct
    total += map[k].total
  }
  return { correct, total, accuracy: total > 0 ? correct / total : null }
}
