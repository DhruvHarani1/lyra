import { useEffect, useRef } from 'react'
import { findActiveLine } from '@shared/lrc'
import { useLyrics } from '@/store/lyrics'
import { getPosition, usePlayer } from '@/store/player'
import { useLyricOffset } from '@/store/offsets'

/**
 * The window edge. Every look draws its own edge in its own stylesheet (edge-*.css or the look's file) on `.edge` and its four
 * children (.edge__a top, .edge__b right, .edge__c bottom, .edge__d left); this component only supplies the song to those styles.
 * It writes four CSS variables on <html> a few times a second (never re-rendering React):
 *   --lp  0..1   how far through the current lyric line the song is
 *   --li  integer  index of the current lyric line (parity / counting effects)
 *   --lt  0|1      flips on every new line (restart a one-shot animation with two keyframe names)
 *   --ts  seconds  the song position, so an edge can travel in lockstep with the track
 *   --lv  0..1   how loud the line is: 1 while a line is being sung, 0 in a gap
 * Hidden when the user turned the rim light off, in calm (paused) mode it simply stops updating.
 */
export function EdgeFx() {
  const offset = useLyricOffset()
  const state = useLyrics((s) => s.state)
  const playing = usePlayer((s) => s.snapshot?.isPlaying === true)
  const lines = state.phase === 'ready' ? state.result.lines : undefined
  const ref = useRef({ lines, offset })
  ref.current = { lines, offset }

  useEffect(() => {
    const root = document.documentElement.style
    let last = -2
    const tick = (): void => {
      const { lines: ls, offset: off } = ref.current
      const pos = getPosition() + off
      root.setProperty('--ts', (pos / 1000).toFixed(2))
      if (!ls || ls.length === 0) {
        root.setProperty('--lp', '0')
        root.setProperty('--lv', '0')
        return
      }
      const i = findActiveLine(ls, pos)
      if (i < 0) {
        root.setProperty('--lp', '0')
        root.setProperty('--lv', '0')
        return
      }
      const start = ls[i]!.timeMs
      const end = ls[i]!.endMs ?? ls[i + 1]?.timeMs ?? start + 4000
      const p = Math.min(1, Math.max(0, (pos - start) / Math.max(1, end - start)))
      root.setProperty('--lp', p.toFixed(3))
      root.setProperty('--lv', pos < end ? '1' : '0')
      if (i !== last) {
        last = i
        root.setProperty('--li', String(i))
        root.setProperty('--lt', String(i & 1))
      }
    }
    tick()
    const t = setInterval(() => document.visibilityState === 'visible' && tick(), playing ? 60 : 400)
    return () => clearInterval(t)
  }, [playing, lines])

  return (
    <div className="edge" aria-hidden="true">
      <i className="edge__a" />
      <i className="edge__b" />
      <i className="edge__c" />
      <i className="edge__d" />
    </div>
  )
}
