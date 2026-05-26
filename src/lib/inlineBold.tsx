import type { ReactNode } from 'react'

/**
 * Render a string containing **bold** segments as React nodes. Used by the
 * CR practice + review pages for analysis-type arguments, where the model
 * emits Markdown-style ** markers inline (see buildCrPrompt in functions/).
 *
 * Intentionally minimal — handles ONLY **...** segments. Not a Markdown
 * renderer. Unmatched ** are left as literal text.
 */
export function renderInlineBold(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const re = /\*\*([^*]+?)\*\*/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    parts.push(<strong key={key++}>{m[1]}</strong>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}
