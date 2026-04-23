import type { UserStack } from './types'

const MAX_NAME_LEN = 60

/** Trim, require 1–60 chars after trim. Duplicate names allowed across stacks. */
export function validateUserStackName(name: string): { ok: true } | { ok: false; error: string } {
  const t = name.trim()
  if (t.length === 0) return { ok: false, error: 'Name is required.' }
  if (t.length > MAX_NAME_LEN) return { ok: false, error: `Name must be at most ${MAX_NAME_LEN} characters.` }
  return { ok: true }
}

export function normalizeUserStackDoc(raw: unknown): UserStack | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : null
  if (!id) return null
  const name = typeof o.name === 'string' ? o.name.trim() : ''
  if (!name) return null
  const description =
    o.description === null
      ? null
      : typeof o.description === 'string'
        ? o.description.trim() || null
        : null
  const wordCount =
    typeof o.wordCount === 'number' && Number.isFinite(o.wordCount) ? Math.max(0, Math.floor(o.wordCount)) : 0
  return {
    id,
    name,
    description,
    wordCount,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  }
}
