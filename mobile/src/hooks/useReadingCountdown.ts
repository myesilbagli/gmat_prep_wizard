import { useEffect, useState } from 'react'

/**
 * Timed reading mode: 90s from `anchorMs` when `enabled`.
 * Re-renders on a single interval (500ms); cleanup on unmount or when deps change.
 */
export function useReadingCountdown(enabled: boolean, anchorMs: number | null): number {
  const [remainingSec, setRemainingSec] = useState(90)

  useEffect(() => {
    if (!enabled || anchorMs == null) {
      setRemainingSec(90)
      return
    }
    const deadlineMs = anchorMs + 90_000
    const tick = () => {
      setRemainingSec(Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000)))
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [enabled, anchorMs])

  return remainingSec
}
