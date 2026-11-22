import { describe, expect, it } from 'vitest'
import { emojiFor, hash, initials, kindOf, reactionsFor, stamp, type DmKind } from './DmKinds'

const KINDS: DmKind[] = ['text', 'voice', 'reply', 'location', 'poll', 'sticker', 'contact', 'fwd', 'photo', 'link', 'gif', 'emoji']

describe('DM helpers', () => {
  it('hash is deterministic, unsigned 32 bit and spreads', () => {
    expect(hash(5)).toBe(hash(5))
    const seen = new Set<number>()
    for (let i = 0; i < 500; i++) {
      const h = hash(i)
      expect(Number.isInteger(h) && h >= 0 && h < 2 ** 32).toBe(true)
      seen.add(h)
    }
    expect(seen.size).toBeGreaterThan(495)
  })

  it('kindOf always returns a known kind, mostly plain text, and covers every kind over a song', () => {
    const seen = new Map<DmKind, number>()
    for (let i = 0; i < 2000; i++) seen.set(kindOf(i), (seen.get(kindOf(i)) ?? 0) + 1)
    for (const k of KINDS) expect(seen.has(k), k).toBe(true)
    for (const k of seen.keys()) expect(KINDS).toContain(k)
    expect(seen.get('text')!).toBeGreaterThan(500)
    expect(kindOf(7)).toBe(kindOf(7))
  })

  it('stamp is a believable clock time', () => {
    for (let i = 0; i < 300; i++) expect(stamp(i)).toMatch(/^(9|10|11):[0-5]\d$/)
  })

  it('reactionsFor gives emoji messages two reactions and others zero or one', () => {
    for (let i = 0; i < 200; i++) {
      expect(reactionsFor('emoji', i)).toHaveLength(2)
      expect(reactionsFor('text', i).length).toBeLessThanOrEqual(1)
      expect(reactionsFor('text', i)).toEqual(reactionsFor('text', i))
    }
    expect(Array.from({ length: 200 }, (_, i) => reactionsFor('text', i).length).some((n) => n === 1)).toBe(true)
  })

  it('emojiFor and initials are stable', () => {
    expect(emojiFor(3)).toBe(emojiFor(3))
    expect(initials('Maya Rivers')).toBe('MR')
    expect(initials('Cher')).toBe('C')
    expect(initials('')).toBe('')
  })
})
