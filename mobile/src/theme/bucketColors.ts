/**
 * Bucket color system — centralized colors and labels for word buckets/roles.
 * Used in: session intro cards, Today screen previews, Learn deck rows.
 *
 * Color choices:
 * - NEW: amber — attention-getting, signals "untouched"
 * - LEARNING: primary lavender — main study color, "actively working" (uses theme.primary / #6366f1)
 * - FAMILIAR: emerald green — close to mastered, positive signal
 * - REVIEW: sky blue — "checking in", distinct from FAMILIAR
 * - MASTERED: slate — muted, "done", rarely surfaces in UI
 *
 * To add a new role, extend BucketRole, add a case in getBucketColors,
 * and confirm the label is correct.
 */

import type { LearningBucket } from '@shared/types'
import type { SessionSlotRole } from '@shared/sessionPlanner'
import type { AppTheme } from '../theme'

export type BucketRole = LearningBucket | SessionSlotRole

export type BucketColorTokens = {
  bg: string
  text: string
  border: string
  label: string
}

/** LEARNING bg/border from app primary `#6366f1` — matches theme.primary in darkTheme/lightTheme */
const PRIMARY_RGB = '99, 102, 241'

export function getBucketColors(theme: AppTheme, role: BucketRole): BucketColorTokens {
  switch (role) {
    case 'new':
      return {
        bg: 'rgba(245, 158, 11, 0.15)',
        text: '#F59E0B',
        border: 'rgba(245, 158, 11, 0.35)',
        label: 'NEW',
      }
    case 'learning':
      return {
        bg: `rgba(${PRIMARY_RGB}, 0.15)`,
        text: theme.primary,
        border: `rgba(${PRIMARY_RGB}, 0.35)`,
        label: 'LEARNING',
      }
    case 'familiar':
      return {
        bg: 'rgba(34, 197, 94, 0.15)',
        text: '#22C55E',
        border: 'rgba(34, 197, 94, 0.35)',
        label: 'FAMILIAR',
      }
    case 'review':
      return {
        bg: 'rgba(56, 189, 248, 0.15)',
        text: '#38BDF8',
        border: 'rgba(56, 189, 248, 0.35)',
        label: 'REVIEW',
      }
    case 'mastered':
      return {
        bg: 'rgba(148, 163, 184, 0.15)',
        text: '#94A3B8',
        border: 'rgba(148, 163, 184, 0.35)',
        label: 'MASTERED',
      }
  }
}
