import { findActiveLine } from '@shared/lrc'
import type { LyricLine } from '@shared/types'

/**
 * The pure part of components/EdgeFx.tsx: who needs the song variables, and what their values are.
 *
 * Consumers (grep the CSS for var(--lp) etc.):
 *   --ts  lens, route (edge + fx), cassette (fx needle)                    -> TS_VIBES
 *   --lv  cassette + dusk fx layers, and every edge-*.css
 *   --lp  flap, lens, trailer, wallet fx layers, and every edge-*.css
 *   --li  wallet counter, glitch counter, and every edge-*.css
 *   --lt  edge-*.css only
 */

/** looks whose edge or fx layer travels with the song position (--ts); every other look never reads it */
export const TS_VIBES: ReadonlySet<string> = new Set(['lens', 'route', 'cassette'])
/** looks with a fx layer outside .edge that reads the variables even when the rim light is off or on TV */
export const FX_VIBES: ReadonlySet<string> = new Set(['cassette', 'dusk', 'flap', 'lens', 'trailer', 'wallet', 'glitch', 'route'])

/** Do the variables need to be written for this look / rim / platform? */
export function edgeNeeded(d: { rim?: string; vibe?: string; platform?: string }): boolean {
  if (d.rim === 'on' && d.platform !== 'tv') return true
  return FX_VIBES.has(d.vibe ?? '')
}

export interface EdgeValues {
  /** index of the active line, -1 when none */
  i: number
  /** 0..1 through the line, 0 when none */
  lp: number
  /** 1 while a line is sung, 0 in a gap (only known when the line has an endMs) and 0 with no line */
  lv: 0 | 1
}

export function edgeValues(lines: readonly LyricLine[] | undefined, pos: number): EdgeValues {
  const none: EdgeValues = { i: -1, lp: 0, lv: 0 }
  if (!lines || lines.length === 0) return none
  const i = findActiveLine(lines, pos)
  if (i < 0) return none
  const line = lines[i]!
  const end = line.endMs ?? lines[i + 1]?.timeMs ?? line.timeMs + 4000
  const lp = Math.min(1, Math.max(0, (pos - line.timeMs) / Math.max(1, end - line.timeMs)))
  // a real gap exists only when the line says when it ends; without endMs the line is simply "active" until the next one
  return { i, lp, lv: line.endMs !== undefined && pos >= line.endMs ? 0 : 1 }
}

/** how many shared ticks (80 ms) to skip between writes: calm and reduced motion only follow seeks, low performance halves the rate */
export function edgeStride(d: { calm?: string; motion?: string; perf?: string }): number {
  return (d.calm !== undefined || d.motion === 'off' ? 6 : 1) * (d.perf === 'low' ? 2 : 1)
}
