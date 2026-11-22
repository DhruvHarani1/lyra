import { describe, expect, it } from 'vitest'
import { countRepeats, inkHash, lineInk, normLine, plainInk, STRIKE_NOTES, wordInk, WORD_MARKS } from './journalInk'

const words = 'Watching every moment pass by in the quiet evening light'.split(' ')

describe('journalInk', () => {
  it('is deterministic', () => {
    expect(inkHash(3, 'abc')).toBe(inkHash(3, 'abc'))
    expect(wordInk(4, 'Watching every moment', words)).toEqual(wordInk(4, 'Watching every moment', words))
    expect(lineInk(4, 'hello there', 1)).toEqual(lineInk(4, 'hello there', 1))
    expect(plainInk(1, 2, 'a line of words')).toEqual(plainInk(1, 2, 'a line of words'))
  })

  it('marks at most two words, never neighbours and never short words', () => {
    for (let i = 0; i < 300; i++) {
      const out = wordInk(i, `line ${i}`, words)
      const marked = out.map((o, k) => (o.mark ? k : -1)).filter((k) => k >= 0)
      expect(marked.length).toBeLessThanOrEqual(2)
      if (marked.length === 2) expect(Math.abs(marked[0]! - marked[1]!)).toBeGreaterThan(1)
      for (const k of marked) expect(words[k]!.length).toBeGreaterThanOrEqual(3)
    }
    expect(wordInk(1, 'I a to', ['I', 'a', 'to']).every((o) => o.mark === null)).toBe(true)
  })

  it('uses every kind of pen across a song and only fixed notes', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 400; i++) {
      for (const o of wordInk(i, `line number ${i}`, words)) {
        if (o.mark) seen.add(o.mark)
        if (o.mark === 'strike') expect(STRIKE_NOTES).toContain(o.note)
        else expect(o.note).toBeUndefined()
      }
    }
    for (const m of WORD_MARKS) expect(seen.has(m)).toBe(true)
  })

  it('finds chorus lines ignoring case and punctuation', () => {
    const r = countRepeats([{ text: 'Hold on, tight' }, { text: 'verse one' }, { text: 'hold on tight!' }, { text: 'ok' }])
    expect(r.get(normLine('Hold on, tight'))).toBe(2)
    expect(r.has('ok')).toBe(false)
    expect(lineInk(2, 'Hold on, tight', 2)).toMatchObject({
      chorus: 2,
      ink: 'blue',
      tag: null
    })
  })

  it('writes quoted lines in green and varies the margin marks', () => {
    expect(lineInk(0, '"never again"', 1).ink).toBe('green')
    const tags = new Set<string | null>()
    for (let i = 0; i < 100; i++) tags.add(lineInk(i, `l ${i}`, 1).tag)
    expect(tags.size).toBeGreaterThanOrEqual(4)
  })
})
