import {
  collection,
  getDocs,
  orderBy,
  query,
  updateDoc,
  doc,
  deleteDoc,
} from 'firebase/firestore'
import { auth, db } from './firebase'

export type VocabStatus = 'do_not_know' | 'learning' | 'know'

export type VocabItem = {
  id: string
  text: string
  textLower?: string
  type: 'word' | 'phrase'
  definition: string
  simpleDefinition: string
  exampleSentence?: string
  synonyms: string[]
  nuanceNote?: string
  gmatUsageNote?: string
  status: VocabStatus
  flagged: boolean
  createdAt?: unknown
  updatedAt?: unknown
}

function requireUserId(): string {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You must be signed in.')
  return uid
}

function normalizeRawDoc(id: string, data: any): VocabItem {
  // Support both the newer VocabItem shape and the older WordDoc/GeneratedResult shape.
  const text: string =
    typeof data.text === 'string' && data.text.trim()
      ? data.text
      : typeof data.word === 'string' && data.word.trim()
        ? data.word
        : id

  const type: 'word' | 'phrase' =
    data.type === 'phrase' || data.type === 'word' ? data.type : 'word'

  let definition = ''
  if (typeof data.definition === 'string' && data.definition.trim()) {
    definition = data.definition.trim()
  } else if (data.result && typeof data.result.definition === 'string' && data.result.definition.trim()) {
    definition = data.result.definition.trim()
  } else if (
    data.result &&
    Array.isArray(data.result.definitions) &&
    data.result.definitions[0]
  ) {
    definition = String(data.result.definitions[0])
  }

  const simpleDefinition: string =
    typeof data.simpleDefinition === 'string' && data.simpleDefinition.trim()
      ? data.simpleDefinition.trim()
      : typeof data.result?.simpleDefinition === 'string' && data.result.simpleDefinition.trim()
        ? data.result.simpleDefinition.trim()
        : definition
          ? definition.split(/\s+/).slice(0, 6).join(' ')
          : ''

  const exampleSentence: string | undefined =
    typeof data.exampleSentence === 'string' && data.exampleSentence.trim()
      ? data.exampleSentence.trim()
      : typeof data.result?.exampleSentence === 'string' && data.result.exampleSentence.trim()
        ? data.result.exampleSentence.trim()
        : Array.isArray(data.result?.examples) && data.result.examples[0]
        ? String(data.result.examples[0])
        : undefined

  const synonyms: string[] = Array.isArray(data.synonyms)
    ? data.synonyms.map((s: unknown) => String(s)).filter(Boolean)
    : Array.isArray(data.result?.synonyms)
      ? data.result.synonyms.map((s: unknown) => String(s)).filter(Boolean)
      : []

  const nuanceNote: string | undefined =
    typeof data.nuanceNote === 'string' && data.nuanceNote.trim()
      ? data.nuanceNote.trim()
      : typeof data.result?.nuanceNote === 'string' && data.result.nuanceNote.trim()
        ? data.result.nuanceNote.trim()
        : typeof data.note === 'string' && data.note.trim()
          ? data.note.trim()
          : undefined

  const gmatUsageNote: string | undefined =
    typeof data.gmatUsageNote === 'string' && data.gmatUsageNote.trim()
      ? data.gmatUsageNote.trim()
      : typeof data.result?.gmatUsageNote === 'string' && data.result.gmatUsageNote.trim()
        ? data.result.gmatUsageNote.trim()
        : undefined

  const status: VocabStatus =
    data.status === 'do_not_know' || data.status === 'know' || data.status === 'learning'
      ? data.status
      : 'learning'

  const flagged: boolean = typeof data.flagged === 'boolean' ? data.flagged : false

  return {
    id,
    text,
    textLower: typeof data.textLower === 'string' ? data.textLower : text.toLowerCase(),
    type,
    definition,
    simpleDefinition,
    exampleSentence,
    synonyms,
    nuanceNote,
    gmatUsageNote,
    status,
    flagged,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

export async function listVocabItems(): Promise<VocabItem[]> {
  const uid = requireUserId()
  const wordsCol = collection(db, 'users', uid, 'words')
  const q = query(wordsCol, orderBy('updatedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => normalizeRawDoc(d.id, d.data()))
}

export async function updateVocabStatus(params: {
  id: string
  status: VocabStatus
}) {
  const uid = requireUserId()
  const ref = doc(db, 'users', uid, 'words', params.id)
  await updateDoc(ref, {
    status: params.status,
    updatedAt: new Date(),
  })
}

export async function toggleVocabFlagged(params: {
  id: string
  flagged: boolean
}) {
  const uid = requireUserId()
  const ref = doc(db, 'users', uid, 'words', params.id)
  await updateDoc(ref, {
    flagged: params.flagged,
    updatedAt: new Date(),
  })
}

export async function deleteVocabItem(id: string) {
  const uid = requireUserId()
  const ref = doc(db, 'users', uid, 'words', id)
  await deleteDoc(ref)
}


