import { describe, expect, it } from 'vitest'
import type { LyricLine } from '@shared/types'
import { FX_VIBES, TS_VIBES, edgeNeeded, edgeStride, edgeValues } from './edgeVars'

const L = (timeMs: number, endMs?: number): LyricLine => ({ timeMs, text: 'x', ...(endMs !== undefined ? { endMs } : {}) }) as LyricLine

describe('edgeNeeded', () => {
  it('does nothing with the rim light off unless the look has its own fx layer reading the variables', () => {
    expect(edgeNeeded({ rim: 'off', vibe: 'neon' })).toBe(false)
    expect(edgeNeeded({ rim: 'off', vibe: 'lens' })).toBe(true)
    expect(edgeNeeded({ rim: 'off', vibe: 'wallet' })).toBe(true)
  })
  it('works for every look when the rim light is on, except on TV', () => {
    expect(edgeNeeded({ rim: 'on', vibe: 'neon' })).toBe(true)
    expect(edgeNeeded({ rim: 'on', vibe: 'neon', platform: 'tv' })).toBe(false)
    expect(edgeNeeded({ rim: 'on', vibe: 'route', platform: 'tv' })).toBe(true)
  })
  it('only the looks that read --ts are in TS_VIBES, and they all have a reason to run', () => {
    for (const v of TS_VIBES) expect(['lens', 'route', 'cassette']).toContain(v)
    for (const v of ['cassette', 'route', 'lens']) expect(FX_VIBES.has(v)).toBe(true)
  })
})

describe('edgeValues', () => {
  it('is neutral without lines and before the first line', () => {
    expect(edgeValues(undefined, 5000)).toEqual({ i: -1, lp: 0, lv: 0 })
    expect(edgeValues([], 5000)).toEqual({ i: -1, lp: 0, lv: 0 })
    expect(edgeValues([L(1000)], 500)).toEqual({ i: -1, lp: 0, lv: 0 })
  })
  it('is loud while a line without endMs is active (no gap information)', () => {
    const ls = [L(0), L(4000)]
    expect(edgeValues(ls, 3900)).toMatchObject({ i: 0, lv: 1 })
    expect(edgeValues(ls, 3900).lp).toBeCloseTo(0.975, 3)
  })
  it('is quiet in a real gap and loud again on the next line', () => {
    const ls = [L(0, 2000), L(6000, 8000)]
    expect(edgeValues(ls, 1000)).toMatchObject({ i: 0, lv: 1 })
    expect(edgeValues(ls, 3000)).toMatchObject({ i: 0, lv: 0, lp: 1 })
    expect(edgeValues(ls, 6500)).toMatchObject({ i: 1, lv: 1 })
  })
  it('keeps progress inside 0..1 and survives zero-length lines', () => {
    expect(edgeValues([L(1000, 1000)], 1000).lp).toBe(0)
    expect(edgeValues([L(0, 100)], 99999).lp).toBe(1)
  })
})

describe('edgeStride', () => {
  it('slows down in calm, reduced motion and low performance', () => {
    expect(edgeStride({})).toBe(1)
    expect(edgeStride({ perf: 'low' })).toBe(2)
    expect(edgeStride({ calm: '' })).toBe(6)
    expect(edgeStride({ motion: 'off', perf: 'low' })).toBe(12)
  })
})
