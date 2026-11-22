import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { ClockOffset, backoffMs, pingDelayMs, sampleFrom } from '../../core/connect/clockSync'
import { OVERLAY_CORE_JS } from './overlayPage'
import { VIEWER_HTML } from './viewerHtml'

/**
 * The Connect pages (viewer and OBS overlay) have no build step, so they carry their own copy of the clock-offset estimator and
 * the ping / backoff schedule as inline JS. core/connect/clockSync.ts is the tested original; these tests run the inline copies
 * (in a node vm, with stubs) and compare them with it, so the copies cannot drift apart unnoticed.
 */

// a deterministic stream of numbers in [0, 1)
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

interface InlineClock {
  add(c0: number, s1: number, s2: number, c3: number): void
  offset(): number
  pingDelay(n: number): number
  backoff(attempt: number, rand: number): number
}

function overlayClock(): InlineClock {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const api = new Function(OVERLAY_CORE_JS + '; return { emptyClock, clockAdd, clockOffset, pingDelay, backoff }')() as {
    emptyClock: () => unknown
    clockAdd: (c: unknown, c0: number, s1: number, s2: number, c3: number) => boolean
    clockOffset: (c: unknown) => number
    pingDelay: (n: number) => number
    backoff: (a: number, r: number) => number
  }
  const clock = api.emptyClock()
  return {
    add: (c0, s1, s2, c3) => void api.clockAdd(clock, c0, s1, s2, c3),
    offset: () => api.clockOffset(clock),
    pingDelay: api.pingDelay,
    backoff: api.backoff
  }
}

/** the viewer's inline script keeps its state in globals; pull the four one-line functions out and run them in a vm */
function viewerClock(): InlineClock {
  const script = VIEWER_HTML.slice(VIEWER_HTML.indexOf('<script>'))
  const pick = (name: string): string => {
    const m = new RegExp(`^function ${name}\\(.*$`, 'm').exec(script)
    if (!m) throw new Error(`viewer script has no function ${name}`)
    return m[0]
  }
  const ctxRand = { v: 0 }
  const ctx = { Math: Object.assign(Object.create(Math) as Math, { random: () => ctxRand.v }) }
  runInNewContext(`var samples=[],attempt=0;${pick('addSample')}\n${pick('offset')}\n${pick('pingDelay')}\n${pick('backoff')}`, ctx)
  const g = ctx as unknown as {
    addSample: (c0: number, s1: number, s2: number, c3: number) => void
    offset: () => number
    pingDelay: (n: number) => number
    backoff: () => number
    attempt: number
  }
  return {
    add: (c0, s1, s2, c3) => g.addSample(c0, s1, s2, c3),
    offset: () => g.offset(),
    pingDelay: (n) => g.pingDelay(n),
    backoff: (attempt, rand) => {
      g.attempt = attempt
      ctxRand.v = rand
      return g.backoff()
    }
  }
}

describe.each([
  ['overlay', overlayClock],
  ['viewer', viewerClock]
] as const)('Connect %s inline clock logic matches core/connect/clockSync', (_name, make) => {
  it('estimates the same offset from the same ping/pong exchanges, window of 8, best round trip wins', () => {
    const rand = rng(7)
    for (let round = 0; round < 40; round++) {
      const inline = make()
      const core = new ClockOffset()
      const hostSkew = Math.round((rand() - 0.5) * 20_000)
      let t = 1_700_000_000_000
      const n = 1 + Math.floor(rand() * 20)
      for (let i = 0; i < n; i++) {
        const c0 = (t += 150 + Math.floor(rand() * 900))
        const up = Math.floor(rand() * 120)
        const down = Math.floor(rand() * 120)
        const s1 = c0 + up + hostSkew
        const s2 = s1 + Math.floor(rand() * 3)
        const c3 = c0 + up + down + (s2 - s1)
        inline.add(c0, s1, s2, c3)
        core.add(sampleFrom(c0, s1, s2, c3))
        // all samples are fresh (a few seconds old), so the 2-minute age filter of the original does not apply
        expect(inline.offset()).toBeCloseTo(core.offset(c3), 9)
      }
    }
  })

  it('drops impossible samples exactly like the original (negative round trip, a clock jump)', () => {
    const inline = make()
    const core = new ClockOffset()
    const rows: Array<[number, number, number, number]> = [
      [1000, 5000, 5001, 1100], // fine
      [1000, 5000, 5001, 900], // answer before the question
      [1000, 5000, 5001, 400_000], // ancient answer
      [2000, 6000, 6000, 2040] // fine, quicker
    ]
    for (const [c0, s1, s2, c3] of rows) {
      inline.add(c0, s1, s2, c3)
      core.add(sampleFrom(c0, s1, s2, c3))
      expect(inline.offset()).toBeCloseTo(core.offset(c3), 9)
    }
  })

  it('pings and backs off on the same schedule', () => {
    const inline = make()
    for (let n = 0; n < 40; n++) expect(inline.pingDelay(n)).toBe(pingDelayMs(n))
    for (let attempt = 0; attempt < 12; attempt++) {
      for (const r of [0, 0.25, 0.5, 0.999]) expect(inline.backoff(attempt, r)).toBe(backoffMs(attempt, r))
    }
  })
})
