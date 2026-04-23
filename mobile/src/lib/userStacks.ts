import {
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import type { UserStack, VocabItem } from '@shared/types'
import { normalizeUserStackDoc, validateUserStackName } from '@shared/userStacks'
import { normalizeRawVocabDoc } from '@shared/vocab'
import { MAX_USER_STACKS_PER_WORD } from './words'
import { auth, db } from './firebase'

const BATCH_SIZE = 500

function requireUserId(): string {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You must be signed in.')
  return uid
}

function myStacksCol(uid: string) {
  return collection(db, 'users', uid, 'myStacks')
}

function wordsCol(uid: string) {
  return collection(db, 'users', uid, 'words')
}

export async function getUserStack(stackId: string): Promise<UserStack | null> {
  const uid = requireUserId()
  const ref = doc(db, 'users', uid, 'myStacks', stackId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return normalizeUserStackDoc({ id: snap.id, ...snap.data() })
}

export async function listUserStacks(): Promise<UserStack[]> {
  const uid = requireUserId()
  const q = query(myStacksCol(uid), orderBy('updatedAt', 'desc'))
  const snap = await getDocs(q)
  const out: UserStack[] = []
  for (const d of snap.docs) {
    const raw = { id: d.id, ...d.data() }
    const n = normalizeUserStackDoc(raw)
    if (n) out.push(n)
  }
  return out
}

export async function createUserStack(params: { name: string; description?: string | null }): Promise<UserStack> {
  const v = validateUserStackName(params.name)
  if (!v.ok) throw new Error(v.error)
  const uid = requireUserId()
  const name = params.name.trim()
  const description =
    params.description === undefined
      ? null
      : params.description === null
        ? null
        : String(params.description).trim() || null

  const ref = doc(myStacksCol(uid))
  await setDoc(ref, {
    id: ref.id,
    name,
    description,
    wordCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return {
    id: ref.id,
    name,
    description,
    wordCount: 0,
    createdAt: null,
    updatedAt: null,
  }
}

export async function renameUserStack(stackId: string, newName: string) {
  const v = validateUserStackName(newName)
  if (!v.ok) throw new Error(v.error)
  const uid = requireUserId()
  const ref = doc(db, 'users', uid, 'myStacks', stackId)
  await updateDoc(ref, { name: newName.trim(), updatedAt: serverTimestamp() })
}

export async function updateUserStackDescription(stackId: string, description: string | null) {
  const uid = requireUserId()
  const ref = doc(db, 'users', uid, 'myStacks', stackId)
  await updateDoc(ref, {
    description: description === null ? null : String(description).trim() || null,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Removes stack membership from all words, then deletes the stack doc.
 * wordCount on the deleted stack doc is irrelevant — the document is removed; membership on word
 * documents is the source of truth for which words were in this stack.
 */
export async function deleteUserStack(stackId: string): Promise<void> {
  const uid = requireUserId()
  const words = wordsCol(uid)
  let lastSnap: QueryDocumentSnapshot | undefined

  for (;;) {
    const q = lastSnap
      ? query(
          words,
          where('userStackIds', 'array-contains', stackId),
          orderBy(documentId()),
          startAfter(lastSnap),
          limit(BATCH_SIZE),
        )
      : query(
          words,
          where('userStackIds', 'array-contains', stackId),
          orderBy(documentId()),
          limit(BATCH_SIZE),
        )
    const snap = await getDocs(q)
    if (snap.empty) break

    const batch = writeBatch(db)
    for (const d of snap.docs) {
      batch.update(d.ref, {
        userStackIds: arrayRemove(stackId),
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()

    if (snap.docs.length < BATCH_SIZE) break
    lastSnap = snap.docs[snap.docs.length - 1]
  }

  await deleteDoc(doc(db, 'users', uid, 'myStacks', stackId))
}

export async function addWordToUserStacks(wordId: string, stackIds: string[]): Promise<void> {
  const uid = requireUserId()
  const wordRef = doc(db, 'users', uid, 'words', wordId)
  const toAdd = [...new Set(stackIds)]

  await runTransaction(db, async (transaction) => {
    const wordSnap = await transaction.get(wordRef)
    if (!wordSnap.exists()) throw new Error('Word not found.')
    const data = wordSnap.data() as Record<string, unknown>
    const prev: string[] = Array.isArray(data.userStackIds)
      ? data.userStackIds.map((x: unknown) => String(x).trim()).filter(Boolean)
      : []
    const next = [...new Set([...prev, ...toAdd])]

    const added = toAdd.filter((id) => !prev.includes(id))
    for (const sid of added) {
      const sref = doc(db, 'users', uid, 'myStacks', sid)
      const ss = await transaction.get(sref)
      if (!ss.exists()) throw new Error(`Stack not found: ${sid}`)
      const wc =
        typeof (ss.data() as { wordCount?: unknown }).wordCount === 'number'
          ? Math.max(0, Math.floor((ss.data() as { wordCount: number }).wordCount))
          : 0
      transaction.update(sref, { wordCount: wc + 1, updatedAt: serverTimestamp() })
    }

    transaction.update(wordRef, { userStackIds: next, updatedAt: serverTimestamp() })
  })
}

export async function removeWordFromUserStack(wordId: string, stackId: string): Promise<void> {
  const uid = requireUserId()
  const wordRef = doc(db, 'users', uid, 'words', wordId)
  const stackRef = doc(db, 'users', uid, 'myStacks', stackId)

  await runTransaction(db, async (transaction) => {
    const wordSnap = await transaction.get(wordRef)
    if (!wordSnap.exists()) throw new Error('Word not found.')
    const data = wordSnap.data() as Record<string, unknown>
    const prev: string[] = Array.isArray(data.userStackIds)
      ? data.userStackIds.map((x: unknown) => String(x).trim()).filter(Boolean)
      : []
    if (!prev.includes(stackId)) return

    const next = prev.filter((id) => id !== stackId)
    const stackSnap = await transaction.get(stackRef)
    if (stackSnap.exists()) {
      const wc =
        typeof (stackSnap.data() as { wordCount?: unknown }).wordCount === 'number'
          ? Math.max(0, Math.floor((stackSnap.data() as { wordCount: number }).wordCount))
          : 0
      transaction.update(stackRef, { wordCount: Math.max(0, wc - 1), updatedAt: serverTimestamp() })
    }

    transaction.update(wordRef, { userStackIds: next, updatedAt: serverTimestamp() })
  })
}

/** Sets exact user-stack membership (replaces previous); updates stack wordCount deltas. */
export async function replaceWordUserStackMembership(wordId: string, nextStackIds: string[]): Promise<void> {
  const normalized = [...new Set(nextStackIds.map((x) => String(x).trim()).filter(Boolean))].slice(
    0,
    MAX_USER_STACKS_PER_WORD,
  )
  const uid = requireUserId()
  const wordRef = doc(db, 'users', uid, 'words', wordId)

  await runTransaction(db, async (transaction) => {
    const wordSnap = await transaction.get(wordRef)
    if (!wordSnap.exists()) throw new Error('Word not found.')
    const data = wordSnap.data() as Record<string, unknown>
    const prev: string[] = Array.isArray(data.userStackIds)
      ? data.userStackIds.map((x: unknown) => String(x).trim()).filter(Boolean)
      : []

    const removed = prev.filter((id) => !normalized.includes(id))
    const added = normalized.filter((id) => !prev.includes(id))

    for (const sid of removed) {
      const sref = doc(db, 'users', uid, 'myStacks', sid)
      const ss = await transaction.get(sref)
      if (ss.exists()) {
        const wc =
          typeof (ss.data() as { wordCount?: unknown }).wordCount === 'number'
            ? Math.max(0, Math.floor((ss.data() as { wordCount: number }).wordCount))
            : 0
        transaction.update(sref, { wordCount: Math.max(0, wc - 1), updatedAt: serverTimestamp() })
      }
    }
    for (const sid of added) {
      const sref = doc(db, 'users', uid, 'myStacks', sid)
      const ss = await transaction.get(sref)
      if (!ss.exists()) throw new Error(`Stack not found: ${sid}`)
      const wc =
        typeof (ss.data() as { wordCount?: unknown }).wordCount === 'number'
          ? Math.max(0, Math.floor((ss.data() as { wordCount: number }).wordCount))
          : 0
      transaction.update(sref, { wordCount: wc + 1, updatedAt: serverTimestamp() })
    }

    transaction.update(wordRef, { userStackIds: normalized, updatedAt: serverTimestamp() })
  })
}

export async function listWordsInUserStack(stackId: string): Promise<VocabItem[]> {
  const uid = requireUserId()
  const q = query(wordsCol(uid), where('userStackIds', 'array-contains', stackId), orderBy('updatedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const raw = d.data() as Record<string, unknown>
    return normalizeRawVocabDoc(d.id, raw)
  })
}
