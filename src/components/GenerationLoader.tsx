/**
 * Reusable animated loader for long generation waits (RC passage, RC
 * question set, CR set). Shows a continuously spinning gradient ring with
 * a rotating status message underneath. Cycles back to the start if a
 * generation outlasts the message list.
 *
 * Respects `prefers-reduced-motion`: the spin and the text cross-fade are
 * suppressed (both via JS short-circuit and via a CSS media-query fallback
 * in src/index.css). Under reduced motion, the first message stays on
 * screen for the full wait — still informative, just not animated.
 *
 * Styling lives in src/index.css under `.generationLoader*`.
 */
import { useEffect, useState } from 'react'

export type GenerationLoaderProps = {
  /** Status lines to rotate through. The first is shown for the full
   *  interval before any rotation, so users see an honest line first. */
  messages: string[]
  /** Milliseconds between message changes. Default 2800ms. */
  intervalMs?: number
  /** Optional fixed header (e.g. "Generating your CR set"). */
  title?: string
}

function getPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function GenerationLoader({
  messages,
  intervalMs = 2800,
  title,
}: GenerationLoaderProps) {
  const [reduced, setReduced] = useState<boolean>(() => getPrefersReducedMotion())
  const [index, setIndex] = useState(0)
  const [opacity, setOpacity] = useState(1)

  // Track changes to the user's reduced-motion preference at runtime.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler)
      return () => mql.removeEventListener('change', handler)
    }
    // Older Safari fallback.
    mql.addListener(handler)
    return () => mql.removeListener(handler)
  }, [])

  // Cycle the visible message. Skip entirely under reduced motion or when
  // there's only one message.
  useEffect(() => {
    if (reduced) return
    if (messages.length <= 1) return
    const fadeOut = window.setTimeout(() => setOpacity(0), Math.max(300, intervalMs - 300))
    const swap = window.setTimeout(() => {
      setIndex((i) => (i + 1) % messages.length)
      setOpacity(1)
    }, intervalMs)
    return () => {
      window.clearTimeout(fadeOut)
      window.clearTimeout(swap)
    }
  }, [index, intervalMs, messages.length, reduced])

  const safeIndex = messages.length === 0 ? 0 : index % messages.length
  const currentMessage = messages[safeIndex] ?? ''

  return (
    <div className="generationLoader" role="status" aria-live="polite" aria-atomic="true">
      <div className={`generationLoader__ring${reduced ? ' is-reduced' : ''}`}>
        <svg
          className="generationLoader__svg"
          width={64}
          height={64}
          viewBox="0 0 64 64"
          aria-hidden
        >
          <circle
            cx={32}
            cy={32}
            r={26}
            stroke="var(--border)"
            strokeWidth={3}
            fill="none"
          />
          <circle
            cx={32}
            cy={32}
            r={26}
            stroke="url(#genLoaderGrad)"
            strokeWidth={3}
            fill="none"
            strokeDasharray="70 120"
            strokeLinecap="round"
          />
          <defs>
            <linearGradient
              id="genLoaderGrad"
              x1="0"
              y1="0"
              x2="64"
              y2="64"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="var(--accent-gradient-start)" />
              <stop offset="100%" stopColor="var(--accent-gradient-end)" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {title ? <div className="generationLoader__title text-card-title">{title}</div> : null}

      <div
        className="generationLoader__message"
        style={reduced ? undefined : { opacity }}
      >
        {currentMessage}
      </div>
    </div>
  )
}
