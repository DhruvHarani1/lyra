import { flushSync } from 'react-dom'

/**
 * Song changes. When the track changes the whole window cross-animates from the old screen to the new one, and every change
 * uses a different effect (never the same one twice in a row), so a playlist feels like a sequence of scenes, not a list.
 * It uses the browser's View Transitions: the old screen is kept as a picture while the new one is built, then the two are
 * animated against each other (styles/song-transition.css has one set of keyframes per effect). Where that is not available
 * (older WebView), when motion is reduced or off, when the window is hidden or in Light performance, the change is instant.
 */
export const SONG_EFFECTS = ['fade', 'dissolve', 'slide-left', 'slide-right', 'rise', 'zoom-in', 'zoom-out', 'iris', 'wipe', 'split'] as const
export type SongEffect = (typeof SONG_EFFECTS)[number]

/** Pick an effect different from `last` (an index into SONG_EFFECTS, or -1). `rand` is injectable for tests. */
export function pickEffect(last: number, rand: () => number = Math.random): number {
  const n = SONG_EFFECTS.length
  if (n < 2) return 0
  const r = Math.floor(rand() * (n - 1))
  const next = r >= last && last >= 0 ? r + 1 : r
  return Math.min(n - 1, Math.max(0, next))
}

let lastEffect = -1
let running = false

/** Whether a transition may run right now. */
export function canTransition(root: HTMLElement = document.documentElement): boolean {
  if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function') return false
  if (document.visibilityState !== 'visible') return false
  const d = root.dataset
  if (d.motion === 'off' || d.perf === 'low' || d.smooth === 'off') return false
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches && d.motion !== 'on') return false
  return true
}

/** Run `apply` (the state change that swaps the song) inside a transition when allowed, else just run it. */
export function runSongTransition(apply: () => void): void {
  const root = document.documentElement
  if (running || !canTransition(root)) {
    apply()
    return
  }
  lastEffect = pickEffect(lastEffect)
  const name = SONG_EFFECTS[lastEffect]!
  running = true
  root.dataset.xfx = name
  let finished: Promise<unknown> | undefined
  try {
    const t = document.startViewTransition(() => {
      flushSync(apply)
    })
    finished = t.finished
  } catch {
    apply()
  }
  const done = (): void => {
    running = false
    delete root.dataset.xfx
  }
  if (finished) void finished.then(done, done)
  else done()
}
