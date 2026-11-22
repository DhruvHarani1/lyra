import { useEffect, useRef, useState } from 'react'
import { findActiveLine } from '@shared/lrc'
import type { LyricLine } from '@shared/types'
import { getPosition } from '@/store/player'
import { useLyricOffset } from '@/store/offsets'

/** Live position in ms with the user's lyric offset applied. */
export function lyricPosition(offsetMs: number): number {
  return getPosition() + offsetMs
}

/** One shared ~12 Hz timer for every active-line hook (several can be mounted at once); idle when nobody listens or the window is hidden. */
const tickers = new Set<() => void>()
let tickTimer: ReturnType<typeof setInterval> | null = null
export function subscribeTick(fn: () => void): () => void {
  tickers.add(fn)
  if (tickTimer === null) {
    tickTimer = setInterval(() => {
      if (document.visibilityState === 'hidden') return
      tickers.forEach((f) => f())
    }, 80)
  }
  return () => {
    tickers.delete(fn)
    if (tickers.size === 0 && tickTimer !== null) {
      clearInterval(tickTimer)
      tickTimer = null
    }
  }
}

/**
 * Index of the active lyric line. Re-renders only when the index changes. The position always comes from the shared
 * song clock, so lyrics that arrive late (or after a pause, seek or track change) light up the right line at once.
 */
export function useActiveLine(lines: readonly LyricLine[], enabled = true): number {
  const offset = useLyricOffset()
  const [idx, setIdx] = useState(() => findActiveLine(lines, lyricPosition(offset)))
  const linesRef = useRef(lines)
  linesRef.current = lines

  useEffect(() => {
    if (!enabled) return
    const tick = (): void => {
      const next = findActiveLine(linesRef.current, lyricPosition(offset))
      setIdx((cur) => (cur === next ? cur : next))
    }
    tick() // snap to the right line immediately (late-loaded lyrics, offset change)
    const off = subscribeTick(tick)
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      off()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, offset, lines])

  return idx
}

/** Runs `cb(positionMs)` on every animation frame while `active`. */
export function useFrame(cb: (positionMs: number) => void, active: boolean, deps: unknown[] = []): void {
  const ref = useRef(cb)
  ref.current = cb
  useEffect(() => {
    if (!active) return
    let raf = 0
    const loop = (): void => {
      ref.current(getPosition())
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...deps])
}
