import { describe, expect, it } from 'vitest'
import { LYRIC_STYLES, VIBE_IDS } from './types'
import { ALL_VIBES, VIBES, WORDS, pickVibe, vibeInfo } from './vibes'

describe('vibe registry', () => {
  it('lists every vibe id exactly once, in the shared id list', () => {
    expect([...ALL_VIBES].sort()).toEqual([...VIBE_IDS].sort())
    expect(new Set(ALL_VIBES).size).toBe(ALL_VIBES.length)
  })

  it('gives every vibe a name, a tag and a lyric style that a stage exists for', () => {
    for (const v of VIBES) {
      expect(v.name.length).toBeGreaterThan(0)
      expect(v.tag.length).toBeGreaterThan(0)
      // LyricsStage.renderStage is exhaustive over LyricStyle (typecheck); here: the style is a real one
      expect(LYRIC_STYLES).toContain(v.style)
      expect(vibeInfo(v.id)).toBe(v)
    }
  })

  it('has a smart-pick word list for every vibe except the plain artwork one', () => {
    for (const id of ALL_VIBES) {
      if (id === 'none') expect(WORDS[id]).toBeUndefined()
      else expect(WORDS[id], `WORDS.${id}`).toBeDefined()
    }
  })
})

describe('smart-pick word lists', () => {
  it('are whole-word and global: no list can fire inside a longer word', () => {
    for (const [id, rule] of Object.entries(WORDS)) {
      expect(rule!.re.flags, id).toContain('g')
      expect(rule!.re.source.startsWith('\\b('), `${id} start`).toBe(true)
      expect(rule!.re.source.endsWith(')\\b'), `${id} end`).toBe(true)
    }
  })

  const miss: Array<[keyof typeof WORDS, string]> = [
    ['web', 'never'],
    ['web', 'cabinet'],
    ['web', 'tied up'],
    ['web', 'bounded'],
    ['filmstrip', 'told'],
    ['filmstrip', 'cold'],
    ['filmstrip', 'sometimes'],
    ['wall', 'install'],
    ['wall', 'housewife'],
    ['lock', 'texture'],
    ['lock', 'waiter'],
    ['route', 'highway'],
    ['route', 'northern'],
    ['route', 'homeless'],
    ['lens', 'seen'],
    ['lens', 'overlook'],
    ['picto', 'sunday'],
    ['picto', 'fireman'],
    ['editor', 'looping'],
    ['metro', 'stopped'],
    ['metro', 'online'],
    ['flap', 'flyer'],
    ['flap', 'forgone'],
    ['wallet', 'payment'],
    ['wallet', 'costume']
  ]
  it.each(miss)('%s does not fire on "%s"', (id, text) => {
    expect(text.toLowerCase().match(WORDS[id]!.re)).toBeNull()
  })

  const hit: Array<[keyof typeof WORDS, string]> = [
    ['web', 'a spider in the web'],
    ['web', 'caught in the net'],
    ['filmstrip', 'we were old'],
    ['wall', 'against the wall'],
    ['lock', 'waiting tonight'],
    ['route', 'miles of road'],
    ['lens', 'i see your eyes'],
    ['picto', 'the moon and the sun'],
    ['flap', 'goodbye airport'],
    ['wallet', 'pay the price']
  ]
  it.each(hit)('%s fires on "%s"', (id, text) => {
    expect(text.toLowerCase().match(WORDS[id]!.re)?.length ?? 0).toBeGreaterThan(0)
  })
})

describe('smart pick with everyday words', () => {
  const base = { title: 'x', artists: ['y'] }
  it('does not pick Web for a song about never giving up', () => {
    const r = pickVibe({ ...base, lines: ['I will never give up', 'never let it go', 'never stop'] }, ['web', 'neon', 'sketch'])
    expect(r.vibe).not.toBe('web')
  })
  it('does not pick Film Strip for "told" and "cold"', () => {
    const r = pickVibe({ ...base, lines: ['you told me it was cold', 'cold as ice you told'] }, ['filmstrip', 'noir', 'chat'])
    expect(r.vibe).not.toBe('filmstrip')
  })
  it('still picks Web for real web words', () => {
    const r = pickVibe({ ...base, lines: ['caught in a spider web', 'tangled threads of silk', 'trapped in the net'] }, ['web', 'neon', 'sketch'])
    expect(r.vibe).toBe('web')
  })
  it('is deterministic', () => {
    const input = { ...base, lines: ['midnight in the city'], hue: 280, sat: 0.6, light: 0.3 }
    expect(pickVibe(input)).toEqual(pickVibe(input))
  })
})
