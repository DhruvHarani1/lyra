import { useEffect, useRef } from 'react'
import { useLyrics } from '@/store/lyrics'
import { getPosition } from '@/store/player'
import { useLyricOffset } from '@/store/offsets'
import { subscribeTick } from '@/hooks/useLyricsSync'
import { TS_VIBES, edgeNeeded, edgeStride, edgeValues } from '@/lib/edgeVars'

/**
 * The window edge. Every look draws its own edge in its own stylesheet (edge-*.css or the look's file) on `.edge` and its four
 * children (.edge__a top, .edge__b right, .edge__c bottom, .edge__d left); this component only supplies the song to those styles.
 * It writes CSS variables on <html> from the shared ~12 Hz lyric ticker (never re-rendering React):
 *   --lp  0..1     how far through the current lyric line the song is (0 in a gap or without synced lines)
 *   --li  integer  index of the current lyric line (parity / counting effects); 0 without synced lines
 *   --lt  0|1      flips on every new line (restart a one-shot animation with two keyframe names)
 *   --lv  0|1      1 while a line is sung; 0 in a gap when the line has a real end time (endMs), 0 with no line at all
 *   --ts  seconds  the song position, written only for the looks that read it (TS_VIBES)
 *
 * It works only when someone reads the variables (lib/edgeVars.ts lists who): the rim light is on (and not TV), or the active
 * look has a fx layer outside .edge that reads them. Otherwise it does nothing. It also does nothing while the window is hidden
 * (the shared ticker skips hidden windows). Calm (paused) and reduced motion run at a coarse rate and write only values that
 * changed, so an idle app writes nothing; data-perf='low' halves the rate. On unmount the variables are removed (edge.css
 * registers them with an initial 0); on a song change they go back to neutral values at once.
 */
const ALL_VARS = ['--lp', '--li', '--lt', '--lv', '--ts'] as const

export function EdgeFx() {
  const offset = useLyricOffset()
  const state = useLyrics((s) => s.state)
  const lines = state.phase === 'ready' ? state.result.lines : undefined
  const ref = useRef({ lines, offset })
  ref.current = { lines, offset }
  const writtenRef = useRef(new Map<string, string>())

  useEffect(() => {
    const html = document.documentElement
    const root = html.style
    // what is on <html> now: a value that did not change is never written again (an idle app writes nothing)
    const written = writtenRef.current
    const set = (name: string, value: string): void => {
      if (written.get(name) === value) return
      written.set(name, value)
      root.setProperty(name, value)
    }
    const neutral = (): void => {
      set('--lp', '0')
      set('--lv', '0')
      set('--li', '0')
      set('--lt', '0')
    }
    let n = 0
    const tick = (force = false): void => {
      const d = html.dataset
      if (!edgeNeeded(d)) return
      if (!force && n++ % edgeStride(d) !== 0) return
      const { lines: ls, offset: off } = ref.current
      const pos = getPosition() + off
      if (TS_VIBES.has(d.vibe ?? '')) set('--ts', (pos / 1000).toFixed(2))
      const v = edgeValues(ls, pos)
      // no synced line (a new song without lyrics, before the first line): neutral values, never the last song's
      if (v.i < 0) return neutral()
      set('--lp', v.lp.toFixed(3))
      set('--lv', String(v.lv))
      set('--li', String(v.i))
      set('--lt', String(v.i & 1))
    }
    // a new song / new lyrics: the values are recomputed from the new lines at once
    tick(true)
    const off = subscribeTick(tick)
    // rim light / look / TV switch on: catch up at once instead of waiting for the next stride
    const mo = new MutationObserver(() => tick(true))
    mo.observe(html, { attributes: true, attributeFilter: ['data-rim', 'data-vibe', 'data-platform', 'data-motion'] })
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') tick(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      off()
      mo.disconnect()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [lines, offset])

  // the variables belong to this component: remove them on unmount
  const writtenForCleanup = writtenRef.current
  useEffect(
    () => () => {
      const root = document.documentElement.style
      for (const k of ALL_VARS) root.removeProperty(k)
      writtenForCleanup.clear()
    },
    [writtenForCleanup]
  )

  return (
    <div className="edge" aria-hidden="true">
      <i className="edge__a" />
      <i className="edge__b" />
      <i className="edge__c" />
      <i className="edge__d" />
    </div>
  )
}
