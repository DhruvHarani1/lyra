import { describe, expect, it, vi } from 'vitest'

// settings.ts only needs electron through the JSON store; sanitize itself is pure
vi.mock('./jsonStore', () => ({ JsonStore: class {} }))
vi.mock('electron', () => ({ app: {} }))

import { LYRIC_STYLES, VIBE_IDS, DEFAULT_SETTINGS, type Settings } from '@shared/types'
import { ALL_VIBES } from '@shared/vibes'
import { sanitize } from './settings'

const withSettings = (patch: Record<string, unknown>): Settings => ({ ...DEFAULT_SETTINGS, ...patch }) as Settings

describe('settings sanitize', () => {
  it('keeps every vibe id and every lyric style', () => {
    for (const vibe of VIBE_IDS) expect(sanitize(withSettings({ vibe })).vibe).toBe(vibe)
    for (const lyricStyle of LYRIC_STYLES) expect(sanitize(withSettings({ lyricStyle })).lyricStyle).toBe(lyricStyle)
  })

  it('has one vibe list: the shared ids, the registry and the settings whitelist all agree', () => {
    expect([...ALL_VIBES].sort()).toEqual([...VIBE_IDS].sort())
    expect(new Set(VIBE_IDS).size).toBe(VIBE_IDS.length)
    expect(new Set(LYRIC_STYLES).size).toBe(LYRIC_STYLES.length)
  })

  it('resets junk to the defaults', () => {
    const out = sanitize(withSettings({ vibe: 'nope', lyricStyle: 'nope', theme: 'purple', reducedMotion: 5, performance: 'ludicrous', vibeMode: '?', backgroundStyle: 'x', defaultMode: 'huge' }))
    expect(out.vibe).toBe(DEFAULT_SETTINGS.vibe)
    expect(out.lyricStyle).toBe(DEFAULT_SETTINGS.lyricStyle)
    expect(out.theme).toBe(DEFAULT_SETTINGS.theme)
    expect(out.reducedMotion).toBe(DEFAULT_SETTINGS.reducedMotion)
    expect(out.performance).toBe(DEFAULT_SETTINGS.performance)
    expect(out.vibeMode).toBe(DEFAULT_SETTINGS.vibeMode)
    expect(out.backgroundStyle).toBe(DEFAULT_SETTINGS.backgroundStyle)
    expect(out.defaultMode).toBe(DEFAULT_SETTINGS.defaultMode)
  })

  it('clamps numbers and survives non-finite ones', () => {
    const out = sanitize(withSettings({ opacity: 9, lyricOffsetMs: -99999, compactWidth: Number.NaN, backgroundDim: -1, ambientBrightness: 5 }))
    expect(out.opacity).toBe(1)
    expect(out.lyricOffsetMs).toBe(-5000)
    expect(out.compactWidth).toBe(320)
    expect(out.backgroundDim).toBe(0.2)
    expect(out.ambientBrightness).toBe(0.6)
  })

  it('filters song vibes and the pool to known vibes', () => {
    const out = sanitize(withSettings({ songVibes: { a: 'neon', b: 'ghost' }, vibePool: ['neon', 'ghost', 'lens'] }))
    expect(out.songVibes).toEqual({ a: 'neon' })
    expect(out.vibePool).toEqual(['neon', 'lens'])
  })

  it('resets the settings the page no longer offers and drops unknown keys', () => {
    const out = sanitize(withSettings({ lyricFont: 'mono', lyricFontSize: 99, lineSpacing: 9, lyricAnimation: 'fade', rimLight: false, removedLongAgo: 1 })) as unknown as Record<string, unknown>
    expect(out.lyricFont).toBe(DEFAULT_SETTINGS.lyricFont)
    expect(out.lyricFontSize).toBe(DEFAULT_SETTINGS.lyricFontSize)
    expect(out.lineSpacing).toBe(DEFAULT_SETTINGS.lineSpacing)
    expect(out.lyricAnimation).toBe(DEFAULT_SETTINGS.lyricAnimation)
    expect(out.rimLight).toBe(true)
    expect('removedLongAgo' in out).toBe(false)
  })

  it('rejects a custom background file name that is not a hashed local file', () => {
    expect(sanitize(withSettings({ customBackground: { file: '../../etc/passwd', name: 'x', kind: 'video' } })).customBackground).toBeNull()
    expect(sanitize(withSettings({ customBackground: { file: '0123456789abcdef.mp4', name: 'x', kind: 'video' } })).customBackground).toEqual({ file: '0123456789abcdef.mp4', name: 'x', kind: 'video' })
  })

  it('survives a settings file that is not an object at all', () => {
    expect(() => sanitize(null as unknown as Settings)).not.toThrow()
  })
})
