import { describe, expect, it } from 'vitest'
import { LANGS, buildFile, escapeLiteral, sameCodeRow } from './codeGen'

const st = (n: number) => Array.from({ length: n }, (_, i) => ({ index: i, text: `line ${i}`, timeMs: i * 3000 }))
const LS = String.fromCharCode(0x2028)
const PS = String.fromCharCode(0x2029)
const DEL = String.fromCharCode(0x7f)
const NUL = String.fromCharCode(0)

describe('escapeLiteral edge cases', () => {
  it('never lets a lyric break out of the string, in any language', () => {
    for (const lang of LANGS) {
      const out = escapeLiteral(lang, ['a"b', '\\c', '\nd', '\re', LS, PS, DEL, NUL, 'i'].join(''))
      // no raw line break or control character survives, and every double quote is escaped
      for (const bad of ['\n', '\r', LS, PS, DEL, NUL]) expect(out.includes(bad)).toBe(false)
      expect(out.replace(/\\\\/g, '').match(/(?<!\\)"/g)).toBeNull()
    }
  })
  it('keeps other languages, emoji and an empty string intact', () => {
    expect(escapeLiteral('go', '')).toBe('')
    expect(escapeLiteral('rust', 'héllo 日本語 🎶')).toBe('héllo 日本語 🎶')
    expect(escapeLiteral('java', '$5')).toBe('$5')
  })
  it('doubles backslashes before it escapes quotes (no unescaping trick)', () => {
    expect(escapeLiteral('java', '\\"')).toBe('\\\\\\"')
  })
  it('strips the template marker so a lyric cannot inject a lyric slot', () => {
    expect(escapeLiteral('typescript', 'a\u0001b')).toBe('ab')
  })
})

describe('sameCodeRow', () => {
  it('is true for the same row rebuilt, false when anything it draws changes', () => {
    const a = buildFile('typescript', 'Glass Hours', st(3))
    const b = buildFile('typescript', 'Glass Hours', st(3))
    expect(a.every((r, i) => sameCodeRow(r, b[i]!))).toBe(true)
    const c = buildFile('typescript', 'Glass Hours', st(4))
    const changed = a.filter((r, i) => !sameCodeRow(r, c[i] ?? r)).length
    expect(changed).toBeGreaterThan(0) // the closing lines moved down by one
    expect(sameCodeRow(a[0]!, c[0]!)).toBe(true) // the imports did not
  })
})
