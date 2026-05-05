/**
 * HTTP clients for the two RC Cloud Function endpoints. Mirrors the
 * call pattern in [src/pages/LearnPage.tsx](src/pages/LearnPage.tsx)
 * `generateParagraph`: fetch with bearer ID token, JSON body, throw
 * on non-200 with the server's error text so callers can render it.
 */
import { auth } from './firebase'
import type {
  RcPassageRequest,
  RcPassageResponse,
  RcQuestionSetRequest,
  RcQuestionSetResponse,
} from '../../shared/rcTypes'

async function getIdToken(): Promise<string> {
  const t = await auth.currentUser?.getIdToken()
  if (!t) throw new Error('Please sign in first.')
  return t
}

function getFunctionsBaseUrl(): string {
  const baseUrl =
    (import.meta.env.VITE_FUNCTIONS_BASE_URL as string | undefined) ?? ''
  if (!baseUrl) throw new Error('Missing VITE_FUNCTIONS_BASE_URL')
  return baseUrl
}

/**
 * Generate a fresh nonce so successive calls don't collapse to the
 * same passage / question wording. Caller can pass their own to override
 * (useful for tests). Falls back to a Math.random string in environments
 * lacking `crypto.randomUUID` (older Safari).
 */
function buildNonce(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 16)
  }
  return Math.random().toString(36).slice(2, 18)
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const baseUrl = getFunctionsBaseUrl()
  const token = await getIdToken()
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let serverMessage = ''
    try {
      const errJson = (await res.json()) as { error?: string }
      serverMessage = typeof errJson.error === 'string' ? errJson.error : ''
    } catch {
      serverMessage = await res.text().catch(() => '')
    }
    throw new Error(serverMessage || `Request failed (${res.status})`)
  }
  return (await res.json()) as T
}

export async function generateRcPassage(
  args: Pick<RcPassageRequest, 'difficulty' | 'topic' | 'domain'> & { nonce?: string },
): Promise<RcPassageResponse> {
  const payload: RcPassageRequest = {
    difficulty: args.difficulty,
    topic: args.topic?.trim() || undefined,
    domain: args.domain?.trim() || undefined,
    nonce: args.nonce ?? buildNonce(),
  }
  return postJson<RcPassageResponse>('/generateRcPassage', payload)
}

export async function generateRcQuestionSet(
  args: Omit<RcQuestionSetRequest, 'nonce'> & { nonce?: string },
): Promise<RcQuestionSetResponse> {
  const payload: RcQuestionSetRequest = {
    ...args,
    nonce: args.nonce ?? buildNonce(),
  }
  return postJson<RcQuestionSetResponse>('/generateRcQuestionSet', payload)
}
