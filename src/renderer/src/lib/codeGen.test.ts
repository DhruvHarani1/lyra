import { describe, expect, it } from 'vitest'
import { LANGS, MARK, buildFile, caretColumn, escapeLiteral, identOf, lineBase, pickLang, skeleton, tokenize, tokenizeTemplate } from './codeGen'

const text = (toks: { s: string }[]): string => toks.map((t) => t.s).join('')

describe('pickLang', () => {
  it('is deterministic and covers every language over many titles', () => {
    expect(pickLang('Glass Hours')).toBe(pickLang('  glass hours '))
    const seen = new Set(Array.from({ length: 300 }, (_, i) => pickLang(`Song number ${i}`)))
    expect([...seen].sort()).toEqual([...LANGS].sort())
  })
})

describe('identOf', () => {
  it('makes a valid identifier from any title', () => {
    expect(identOf('Glass Hours (Live)')).toBe('GlassHoursLive')
    expect(identOf('99 Problems')).toBe('Song99Problems')
    expect(identOf('!!! ???')).toBe('Song')
    expect(identOf('Ça va très bien')).toMatch(/^[A-Za-z0-9]+$/)
  })
})

describe('escapeLiteral', () => {
  it('neutralises quotes, backslashes, control characters and kotlin templates', () => {
    expect(escapeLiteral('java', 'say "hi" \\ there')).toBe('say \\"hi\\" \\\\ there')
    expect(escapeLiteral('java', 'a\nb\tc')).toBe('a b c')
    expect(escapeLiteral('kotlin', 'cost $5 ${x}')).toBe('cost \\$5 \\${x}')
    expect(escapeLiteral('python', 'x\u0001y')).toBe('xy')
  })
})

describe('tokenize', () => {
  it('splits Java into keywords, types, functions, strings and punctuation', () => {
    const toks = tokenize('java', 'public final class Song implements Runnable {')
    expect(toks.filter((t) => t.t === 'kw').map((t) => t.s)).toEqual(['public', 'final', 'class', 'implements'])
    expect(toks.filter((t) => t.t === 'type').map((t) => t.s)).toEqual(['Song', 'Runnable'])
    const call = tokenize('java', 'singer.sing("hi \\" there"); // 0:34')
    expect(call.find((t) => t.t === 'fn')?.s).toBe('sing')
    expect(call.find((t) => t.t === 'str')?.s).toBe('"hi \\" there"')
    expect(call[call.length - 1]).toEqual({ t: 'com', s: '// 0:34' })
  })
  it('treats # as a comment in Python and single quotes as strings in TypeScript', () => {
    expect(tokenize('python', 'x = 1  # note').pop()).toEqual({ t: 'com', s: '# note' })
    expect(tokenize('typescript', "import { A } from '@lyra/core'").find((t) => t.t === 'str')?.s).toBe("'@lyra/core'")
  })
  it('keeps the source text intact for every language', () => {
    for (const lang of LANGS) {
      const sk = skeleton(lang, 'Glass Hours')
      for (const line of [...sk.imports, ...sk.decl, ...sk.foot]) expect(text(tokenize(lang, line))).toBe(line)
    }
  })
})

describe('tokenizeTemplate', () => {
  it('puts the lyric between the quotes', () => {
    const toks = tokenizeTemplate('rust', `    singer.sing("${MARK}");`)
    const i = toks.findIndex((t) => t.t === 'lyric')
    expect(toks[i - 1]).toEqual({ t: 'str', s: '"' })
    expect(toks[i + 1]).toEqual({ t: 'str', s: '"' })
    expect(text(toks)).toBe('    singer.sing("");')
  })
})

describe('buildFile', () => {
  const stmts = (n: number) => Array.from({ length: n }, (_, i) => ({ index: i, text: `line ${i}`, timeMs: i * 4000 }))
  it('numbers statements from the end of the declaration and keeps the newest ones', () => {
    for (const lang of LANGS) {
      const rows = buildFile(lang, 'Glass Hours', stmts(9), { keep: 4 })
      const lyric = rows.filter((r) => r.kind === 'lyric')
      expect(lyric.map((r) => r.lyric)).toEqual([5, 6, 7, 8])
      expect(lyric[0]!.n).toBe(lineBase(lang, 'Glass Hours') + 5)
      expect(rows.some((r) => r.kind === 'fold' && r.folded === 5)).toBe(true)
      expect(rows[0]!.n).toBe(1)
    }
  })
  it('writes an empty lyric line as a comment and uses a real call for the rest', () => {
    const rows = buildFile('go', 'Glass Hours', [{ index: 0, text: '', timeMs: 0 }, { index: 1, text: 'hello', timeMs: 5000 }])
    expect(rows.find((r) => r.kind === 'comment')).toBeTruthy()
    expect(text(rows.find((r) => r.kind === 'lyric')!.toks)).toContain('s.Sing("")')
  })
  it('closes the blocks it opened', () => {
    const rows = buildFile('java', 'Glass Hours', stmts(1))
    expect(text(rows[rows.length - 1]!.toks)).toBe('}')
    const braceRows = rows.filter((r) => r.toks.some((t) => t.m))
    expect(braceRows.length).toBe(2)
  })
})

describe('caretColumn', () => {
  it('is the end of the escaped statement', () => {
    expect(caretColumn('java', 'hi')).toBe(8 + 'singer.sing("hi");'.length + 1)
    expect(caretColumn('python', 'say "x"')).toBe(8 + 'singer.sing("say \\"x\\"")'.length + 1)
  })
})
