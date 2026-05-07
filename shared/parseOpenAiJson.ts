/** Extract ```json ... ``` or ``` ... ``` fence content if present. */
function stripMarkdownFencedJson(s: string): string {
  const fenced = /```(?:json)?\s*\n?([\s\S]*?)```/i.exec(s.trim())
  if (fenced) return fenced[1].trim()
  return s.trim()
}

/**
 * First top-level `{ ... }` blob, respecting JSON string rules so `}` inside
 * quoted passage text does not truncate the object.
 */
function extractFirstBalancedJsonObject(s: string): string | null {
  const start = s.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < s.length; i++) {
    const ch = s[i]
    if (escape) {
      escape = false
      continue
    }
    if (inString) {
      if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  return null
}

/**
 * Parse model output that may be raw JSON, fenced markdown, or prose with a
 * trailing/embedded JSON object. Used by Cloud Functions and scripts.
 */
export function parseJsonFromOutputText<T>(outputText: string): T | null {
  const raw = stripMarkdownFencedJson(outputText)
  if (!raw) return null

  try {
    return JSON.parse(raw) as T
  } catch {
    /* continue */
  }

  const balanced = extractFirstBalancedJsonObject(raw)
  if (balanced) {
    try {
      return JSON.parse(balanced) as T
    } catch {
      /* continue */
    }
  }

  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1)) as T
    } catch {
      return null
    }
  }

  return null
}
