/**
 * Diagnostic intake + storage + weakness profile computation.
 *
 * Pipeline:
 *   1. fileToBase64() — browser converts the uploaded image to base64.
 *   2. parseDiagnosticImage() — POST /parseDiagnostic with the image and
 *      section. Server calls OpenAI vision and returns parsed rows.
 *   3. The page lets the user verify/edit the rows.
 *   4. createDiagnostic() — writes the verified rows to
 *      users/{uid}/diagnostic/{auto-id}.
 *
 * Weakness profile is computed on read from the stored rows — no
 * separate stats document.
 */
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { postJson } from './rcGeneration'
import type {
  DiagnosticDoc,
  DiagnosticParseResponse,
  DiagnosticRow,
  DiagnosticSection,
} from '../../shared/diagnosticTypes'

function requireUid(): string {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You must be signed in.')
  return uid
}

// ---------------------------------------------------------------------------
// Browser → base64
// ---------------------------------------------------------------------------

export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Unexpected reader result'))
        return
      }
      // result is a data URL: data:image/png;base64,xxxxx
      const idx = result.indexOf(',')
      const base64 = idx >= 0 ? result.slice(idx + 1) : result
      const mimeMatch = result.match(/^data:([^;]+);/)
      const mimeType = mimeMatch?.[1] ?? file.type ?? 'image/png'
      resolve({ base64, mimeType })
    }
    reader.readAsDataURL(file)
  })
}

// ---------------------------------------------------------------------------
// Cloud Function call — OpenAI vision parse
// ---------------------------------------------------------------------------

/** Calls /parseDiagnostic with a single section screenshot. The server
 *  returns rows already tagged with `section`. */
export async function parseDiagnosticImage(params: {
  section: DiagnosticSection
  imageBase64: string
  imageMimeType: string
}): Promise<DiagnosticRow[]> {
  const resp = await postJson<DiagnosticParseResponse>('/parseDiagnostic', {
    section: params.section,
    imageBase64: params.imageBase64,
    imageMimeType: params.imageMimeType,
  })
  if (!resp || !Array.isArray(resp.rows)) {
    throw new Error('Parse returned no rows.')
  }
  return resp.rows
}

// ---------------------------------------------------------------------------
// Firestore CRUD
// ---------------------------------------------------------------------------

function diagCol(uid: string) {
  return collection(db, 'users', uid, 'diagnostic')
}

function diagDoc(uid: string, id: string) {
  return doc(db, 'users', uid, 'diagnostic', id)
}

/** Write a verified diagnostic doc. The caller has already let the user
 *  verify every row. */
export async function createDiagnostic(params: {
  rows: DiagnosticRow[]
  examMonth: number | null
  examYear: number | null
}): Promise<string> {
  const uid = requireUid()
  const ref = await addDoc(diagCol(uid), {
    rows: params.rows,
    examMonth: params.examMonth,
    examYear: params.examYear,
    createdAt: serverTimestamp(),
  })
  await updateDoc(ref, { diagnosticId: ref.id })
  return ref.id
}

/** Returns the most recent diagnostic for the signed-in user, or null
 *  if none exist. */
export async function getLatestDiagnostic(): Promise<DiagnosticDoc | null> {
  const uid = requireUid()
  const q = query(diagCol(uid), orderBy('createdAt', 'desc'), limit(1))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  const data = d.data() as Partial<DiagnosticDoc>
  return {
    diagnosticId: d.id,
    createdAt: data.createdAt,
    examMonth: typeof data.examMonth === 'number' ? data.examMonth : null,
    examYear: typeof data.examYear === 'number' ? data.examYear : null,
    rows: Array.isArray(data.rows) ? (data.rows as DiagnosticRow[]) : [],
  }
}

export async function getDiagnostic(id: string): Promise<DiagnosticDoc | null> {
  const uid = requireUid()
  const snap = await getDoc(diagDoc(uid, id))
  if (!snap.exists()) return null
  const data = snap.data() as Partial<DiagnosticDoc>
  return {
    diagnosticId: snap.id,
    createdAt: data.createdAt,
    examMonth: typeof data.examMonth === 'number' ? data.examMonth : null,
    examYear: typeof data.examYear === 'number' ? data.examYear : null,
    rows: Array.isArray(data.rows) ? (data.rows as DiagnosticRow[]) : [],
  }
}

// ---------------------------------------------------------------------------
// Weakness profile — computed on read, no stored stats
// ---------------------------------------------------------------------------

export type WeaknessProfileGroup = {
  /** Display key — fundamentalSkill when available, else questionType. */
  key: string
  /** The dimension this group used. */
  groupedBy: 'fundamentalSkill' | 'questionType'
  /** Section the group came from. */
  section: DiagnosticSection
  correct: number
  total: number
  /** correct / total. 0..1. */
  accuracy: number
  /** Average response time across all rows in the group, in minutes. */
  avgTimeMinutes: number
  /** Count of rows in this group flagged 'rushed' (fast + wrong). */
  rushedCount: number
  /** Count of rows in this group flagged 'slow' (slow regardless of right/wrong). */
  slowCount: number
}

/** Per-question pacing flag. Independent of group. */
export type RowPacingFlag = 'rushed' | 'slow' | null

export function rowPacingFlag(row: DiagnosticRow): RowPacingFlag {
  const t = row.responseTimeMinutes
  if (!Number.isFinite(t)) return null
  // "Rushed" = fast AND wrong. The user spent <1.5 min and got it wrong —
  // probably misread or guessed. Fast + correct isn't a problem.
  if (t < 1.5 && row.performance === 'incorrect') return 'rushed'
  // "Slow" = significantly over the ~2 min target regardless of outcome.
  // Slow + wrong is the canonical "stuck and bombed" case; slow + correct
  // still flags a pacing concern.
  if (t > 2.75) return 'slow'
  return null
}

/** Group the rows by fundamentalSkill (falling back to questionType when
 *  skill is null, e.g. on the DI section). Returns groups ranked by
 *  accuracy ascending — weakest first. */
export function computeWeaknessProfile(rows: DiagnosticRow[]): WeaknessProfileGroup[] {
  type Bucket = {
    key: string
    groupedBy: 'fundamentalSkill' | 'questionType'
    section: DiagnosticSection
    correct: number
    total: number
    timeSum: number
    rushed: number
    slow: number
  }
  const buckets = new Map<string, Bucket>()
  for (const r of rows) {
    const groupedBy: 'fundamentalSkill' | 'questionType' = r.fundamentalSkill
      ? 'fundamentalSkill'
      : 'questionType'
    const key = groupedBy === 'fundamentalSkill' ? (r.fundamentalSkill as string) : r.questionType
    if (!key) continue
    const id = `${r.section}::${groupedBy}::${key}`
    const b =
      buckets.get(id) ??
      {
        key,
        groupedBy,
        section: r.section,
        correct: 0,
        total: 0,
        timeSum: 0,
        rushed: 0,
        slow: 0,
      }
    b.total += 1
    if (r.performance === 'correct') b.correct += 1
    if (Number.isFinite(r.responseTimeMinutes)) b.timeSum += r.responseTimeMinutes
    const flag = rowPacingFlag(r)
    if (flag === 'rushed') b.rushed += 1
    if (flag === 'slow') b.slow += 1
    buckets.set(id, b)
  }
  const out: WeaknessProfileGroup[] = []
  for (const b of buckets.values()) {
    out.push({
      key: b.key,
      groupedBy: b.groupedBy,
      section: b.section,
      correct: b.correct,
      total: b.total,
      accuracy: b.total > 0 ? b.correct / b.total : 0,
      avgTimeMinutes: b.total > 0 ? b.timeSum / b.total : 0,
      rushedCount: b.rushed,
      slowCount: b.slow,
    })
  }
  // Weakest first; tie-break by larger total so high-volume weak skills
  // surface above one-shot misreads.
  out.sort((a, b) => {
    if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy
    return b.total - a.total
  })
  return out
}
