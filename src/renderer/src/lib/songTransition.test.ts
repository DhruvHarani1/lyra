import { describe, expect, it } from 'vitest'
import { SONG_EFFECTS, pickEffect } from './songTransition'
import { FADE_IN_MS, FADE_OUT_MS, canFade, fadeFloor, fadeInLevel, fadeOutLevel } from './volumeFade'

describe('pickEffect', () => {
  it('never repeats the previous effect and stays in range', () => {
    let last = -1
    let seed = 7
    const rand = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const seen = new Set<number>()
    for (let i = 0; i < 400; i++) {
      const n = pickEffect(last, rand)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(SONG_EFFECTS.length)
      expect(n).not.toBe(last)
      seen.add(n)
      last = n
    }
    expect(seen.size).toBe(SONG_EFFECTS.length)
  })
  it('covers the edges of the random range', () => {
    expect(pickEffect(-1, () => 0)).toBe(0)
    expect(pickEffect(-1, () => 0.9999)).toBe(SONG_EFFECTS.length - 2)
    expect(pickEffect(3, () => 0.9999)).toBe(SONG_EFFECTS.length - 1)
    expect(pickEffect(0, () => 0)).toBe(1)
  })
})

describe('volume fade levels', () => {
  it('goes from the full volume down to the floor over the last moments', () => {
    expect(fadeOutLevel(FADE_OUT_MS + 500, 80)).toBe(80)
    expect(fadeOutLevel(0, 80)).toBe(fadeFloor(80))
    const mid = fadeOutLevel(FADE_OUT_MS / 2, 80)
    expect(mid).toBeLessThan(80)
    expect(mid).toBeGreaterThan(fadeFloor(80))
  })
  it('never rises on the way down and never falls on the way up', () => {
    let prev = 80
    for (let r = FADE_OUT_MS; r >= 0; r -= 50) {
      const v = fadeOutLevel(r, 80)
      expect(v).toBeLessThanOrEqual(prev)
      prev = v
    }
    prev = 0
    for (let e = 0; e <= FADE_IN_MS + 200; e += 50) {
      const v = fadeInLevel(e, 80)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
    expect(fadeInLevel(FADE_IN_MS, 80)).toBe(80)
  })
  it('only fades when it is safe', () => {
    const ok = { enabled: true, isPlaying: true, supportsVolume: true, volume: 60, durationMs: 180000, isAd: false }
    expect(canFade(ok)).toBe(true)
    expect(canFade({ ...ok, enabled: false })).toBe(false)
    expect(canFade({ ...ok, isPlaying: false })).toBe(false)
    expect(canFade({ ...ok, supportsVolume: false })).toBe(false)
    expect(canFade({ ...ok, volume: null })).toBe(false)
    expect(canFade({ ...ok, volume: 5 })).toBe(false)
    expect(canFade({ ...ok, durationMs: 10000 })).toBe(false)
    expect(canFade({ ...ok, isAd: true })).toBe(false)
  })
})
