/**
 * Editor look: turns a song into a convincing source file. Each lyric line is a real statement (`singer.sing("...");`), wrapped in the
 * class / struct / function of one of seven languages chosen from the song title, with real syntax and a small tokenizer so the
 * stage can colour it like an editor does. Everything here is pure (no DOM, no React) and the lyric text never goes through the
 * tokenizer: the template carries a marker where the string body goes, and the stage fills it with escaped words.
 */

export type Lang = 'java' | 'kotlin' | 'typescript' | 'python' | 'rust' | 'go' | 'csharp'
export const LANGS: readonly Lang[] = ['java', 'kotlin', 'typescript', 'python', 'rust', 'go', 'csharp']

export type TokType = 'kw' | 'type' | 'str' | 'com' | 'num' | 'punc' | 'fn' | 'id' | 'ann' | 'lyric' | 'ws'
export interface Tok {
  t: TokType
  s: string
  /** bracket that matches the one under the caret (drawn with a box) */
  m?: boolean
}

/** where the lyric goes in a template */
export const MARK = '\u0001'

interface Spec {
  label: string
  ext: string
  comment: string
  keywords: ReadonlySet<string>
  /** single quotes also open a string */
  singleQuote: boolean
  braces: boolean
  /** statement terminator */
  semi: string
  /** the statement that sings one line, `{L}` stands for the quoted lyric */
  call: string
  indent: number
}

const set = (s: string): ReadonlySet<string> => new Set(s.split(' '))

const SPECS: Record<Lang, Spec> = {
  java: {
    label: 'Java',
    ext: 'java',
    comment: '//',
    keywords: set('package import public private protected static final class interface implements extends void int long double boolean new return if else for while this null true false throws throw try catch var'),
    singleQuote: false,
    braces: true,
    semi: ';',
    call: 'singer.sing({L})',
    indent: 8
  },
  kotlin: {
    label: 'Kotlin',
    ext: 'kt',
    comment: '//',
    keywords: set('package import class object interface override fun val var if else for while when return null true false is in suspend private public internal data const'),
    singleQuote: false,
    braces: true,
    semi: '',
    call: 'singer.sing({L})',
    indent: 8
  },
  typescript: {
    label: 'TypeScript',
    ext: 'ts',
    comment: '//',
    keywords: set('import export from const let var async await function return if else for while class interface type new null undefined true false of in as readonly'),
    singleQuote: true,
    braces: true,
    semi: '',
    call: 'await singer.sing({L})',
    indent: 4
  },
  python: {
    label: 'Python',
    ext: 'py',
    comment: '#',
    keywords: set('from import class def self return if elif else for while in not and or is None True False async await with as pass lambda'),
    singleQuote: true,
    braces: false,
    semi: '',
    call: 'singer.sing({L})',
    indent: 8
  },
  rust: {
    label: 'Rust',
    ext: 'rs',
    comment: '//',
    keywords: set('use pub struct impl fn let mut const static self mod trait for in if else match return true false as where crate'),
    singleQuote: false,
    braces: true,
    semi: ';',
    call: 'singer.sing({L})',
    indent: 8
  },
  go: {
    label: 'Go',
    ext: 'go',
    comment: '//',
    keywords: set('package import func const var type struct interface return if else for range go defer nil true false map chan switch case'),
    singleQuote: false,
    braces: true,
    semi: '',
    call: 's.Sing({L})',
    indent: 4
  },
  csharp: {
    label: 'C#',
    ext: 'cs',
    comment: '//',
    keywords: set('using namespace public private protected internal sealed static class interface void int long double bool new return if else for foreach while this null true false var async await override'),
    singleQuote: false,
    braces: true,
    semi: ';',
    call: 'singer.Sing({L})',
    indent: 8
  }
}

export function langInfo(lang: Lang): { label: string; ext: string } {
  return { label: SPECS[lang].label, ext: SPECS[lang].ext }
}

/** FNV-1a: the same title always gives the same language and BPM. */
function fnv(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

export function pickLang(seed: string): Lang {
  return LANGS[fnv(seed.trim().toLowerCase()) % LANGS.length]!
}

/** Class / function name from a title: `Glass Hours (Live)` -> `GlassHoursLive`. Always a valid identifier. */
export function identOf(title: string): string {
  const words = title.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 4)
  const id = words.map((w) => w[0]!.toUpperCase() + w.slice(1)).join('').replace(/[^A-Za-z0-9]/g, '')
  if (!id) return 'Song'
  return /^[0-9]/.test(id) ? 'Song' + id : id.slice(0, 28)
}

/** String literal body: a lyric is untrusted text, so quotes, backslashes, control characters and `$` (Kotlin) are neutralised. */
export function escapeLiteral(lang: Lang, text: string): string {
  let out = ''
  for (const ch of text.replace(/\u0001/g, '')) {
    const c = ch.charCodeAt(0)
    if (ch === '\\') out += '\\\\'
    else if (ch === '"') out += '\\"'
    else if (ch === '$' && lang === 'kotlin') out += '\\$'
    else if (c < 32 || c === 127 || c === 0x2028 || c === 0x2029) out += ' '
    else out += ch
  }
  return out
}

// ---------------------------------------------------------------------------------------------- tokenizer

const IDENT = /[A-Za-z_][A-Za-z0-9_]*/y
const NUM = /\d[\d_]*(?:\.\d+)?[A-Za-z]*/y

export function tokenize(lang: Lang, src: string): Tok[] {
  const sp = SPECS[lang]
  const toks: Tok[] = []
  let i = 0
  const push = (t: TokType, s: string): void => {
    if (s) toks.push({ t, s })
  }
  while (i < src.length) {
    const ch = src[i]!
    if (ch === ' ' || ch === '\t') {
      let j = i
      while (j < src.length && (src[j] === ' ' || src[j] === '\t')) j++
      push('ws', src.slice(i, j))
      i = j
    } else if (src.startsWith(sp.comment, i)) {
      push('com', src.slice(i))
      i = src.length
    } else if (ch === '"' || (ch === "'" && sp.singleQuote)) {
      let j = i + 1
      while (j < src.length && src[j] !== ch) j += src[j] === '\\' ? 2 : 1
      j = Math.min(src.length, j + 1)
      push('str', src.slice(i, j))
      i = j
    } else if (ch === '@' && /[A-Za-z]/.test(src[i + 1] ?? '')) {
      IDENT.lastIndex = i + 1
      const m = IDENT.exec(src)
      const end = m ? i + 1 + m[0].length : i + 1
      push('ann', src.slice(i, end))
      i = end
    } else if (/\d/.test(ch)) {
      NUM.lastIndex = i
      const m = NUM.exec(src)!
      push('num', m[0])
      i += m[0].length
    } else if (/[A-Za-z_]/.test(ch)) {
      IDENT.lastIndex = i
      const word = IDENT.exec(src)![0]
      const rest = src.slice(i + word.length)
      const prev = toks.length ? toks[toks.length - 1]!.s : ''
      let t: TokType = 'id'
      if (sp.keywords.has(word)) t = 'kw'
      else if (/^\s*\(/.test(rest) && prev !== 'new') t = 'fn'
      else if (/^[A-Z]/.test(word)) t = 'type'
      else if (prev === ':' || prev === '->' || prev === '<' || prev === ',') t = /^[A-Z]/.test(word) ? 'type' : 'id'
      push(t, word)
      i += word.length
    } else {
      // punctuation, keeping `->`, `::`, `=>` and `&&` together
      const two = src.slice(i, i + 2)
      const len = two === '->' || two === '::' || two === '=>' || two === '&&' || two === '||' ? 2 : 1
      push('punc', src.slice(i, i + len))
      i += len
    }
  }
  return toks
}

/** Tokenize a template that carries MARK inside a string: the string splits into `"`, the lyric, and `")`. */
export function tokenizeTemplate(lang: Lang, src: string): Tok[] {
  const out: Tok[] = []
  for (const tok of tokenize(lang, src)) {
    const at = tok.s.indexOf(MARK)
    if (tok.t === 'str' && at >= 0) {
      out.push({ t: 'str', s: tok.s.slice(0, at) }, { t: 'lyric', s: '' }, { t: 'str', s: tok.s.slice(at + 1) })
    } else out.push(tok)
  }
  return out
}

// ---------------------------------------------------------------------------------------------- the file

export interface CodeLine {
  /** real line number in the file */
  n: number
  kind: 'code' | 'lyric' | 'comment' | 'blank' | 'fold'
  toks: Tok[]
  /** lyric rows: the index in the song */
  lyric?: number
  /** fold rows: how many lines are hidden */
  folded?: number
  /** git gutter: added, modified, none */
  git?: 'add' | 'mod'
  /** indent guide depth (Python reads by indentation) */
  depth: number
}

/** Do two rows draw the same thing? Rows are rebuilt on every lyric line, so React.memo needs this instead of identity. */
export function sameCodeRow(a: CodeLine, b: CodeLine): boolean {
  if (a === b) return true
  if (a.n !== b.n || a.kind !== b.kind || a.depth !== b.depth || a.git !== b.git || a.folded !== b.folded || a.toks.length !== b.toks.length) return false
  for (let i = 0; i < a.toks.length; i++) {
    const x = a.toks[i]!
    const y = b.toks[i]!
    if (x.t !== y.t || x.s !== y.s || x.m !== y.m) return false
  }
  return true
}

export interface Statement {
  index: number
  text: string
  timeMs: number
}

const pad = (n: number): string => ' '.repeat(n)

/** the source lines before the first statement, and after the last one */
export function skeleton(lang: Lang, title: string): { imports: string[]; decl: string[]; foot: string[]; bpm: number } {
  const Id = identOf(title)
  const id = Id[0]!.toLowerCase() + Id.slice(1)
  const bpm = 72 + (fnv(title.trim().toLowerCase() + '#') % 68)
  switch (lang) {
    case 'java':
      return {
        imports: ['package dev.lyra.songs;', '', 'import dev.lyra.core.Singer;', 'import dev.lyra.core.Song;'],
        decl: [``, `public final class ${Id} implements Song {`, `    private static final int BPM = ${bpm};`, ``, `    @Override`, `    public void play(Singer singer) {`],
        foot: ['    }', '}'],
        bpm
      }
    case 'kotlin':
      return {
        imports: ['package dev.lyra.songs', '', 'import dev.lyra.core.Singer', 'import dev.lyra.core.Song'],
        decl: [``, `class ${Id} : Song {`, `    val bpm = ${bpm}`, ``, `    override fun play(singer: Singer) {`],
        foot: ['    }', '}'],
        bpm
      }
    case 'typescript':
      return {
        imports: [`import { Singer, Song } from '@lyra/core'`],
        decl: [``, `export const bpm: number = ${bpm}`, ``, `export const ${id}: Song = {`, `  bpm,`, `  async play(singer: Singer): Promise<void> {`],
        foot: ['  },', '}'],
        bpm
      }
    case 'python':
      return {
        imports: ['from lyra.core import Singer, Song'],
        decl: [``, ``, `class ${Id}(Song):`, `    bpm: int = ${bpm}`, ``, `    def play(self, singer: Singer) -> None:`],
        foot: [],
        bpm
      }
    case 'rust':
      return {
        imports: ['use lyra::core::{Singer, Song};'],
        decl: [``, `pub struct ${Id};`, ``, `impl Song for ${Id} {`, `    fn play(&self, singer: &mut Singer) {`],
        foot: ['    }', '}'],
        bpm
      }
    case 'go':
      return {
        imports: ['package songs', '', 'import "lyra/core"'],
        decl: [``, `const BPM = ${bpm}`, ``, `func ${Id}(s *core.Singer) {`],
        foot: ['}'],
        bpm
      }
    case 'csharp':
      return {
        imports: ['using Lyra.Core;', '', 'namespace Lyra.Songs;'],
        decl: [``, `public sealed class ${Id} : ISong`, `{`, `    public int Bpm => ${bpm};`, ``, `    public void Play(ISinger singer)`, `    {`],
        foot: ['    }', '}'],
        bpm
      }
  }
}

/** m:true on the bracket that pairs with the caret's block: the last `{` of the method line and the first `}` of its closer. */
function markBracket(toks: Tok[], open: boolean): Tok[] {
  const want = open ? '{' : '}'
  const idx = open ? toks.map((t) => t.s).lastIndexOf(want) : toks.findIndex((t) => t.s === want)
  if (idx < 0) return toks
  return toks.map((t, i) => (i === idx ? { ...t, m: true } : t))
}

export interface FileOptions {
  /** statements kept in view, earlier ones fold into one row */
  keep?: number
}

/**
 * The visible file at this moment: the imports and the declaration, a folded run of earlier statements, the newest few statements
 * and the closing lines. `statements` are the lyric lines up to the current one, in order.
 */
export function buildFile(lang: Lang, title: string, statements: readonly Statement[], opts: FileOptions = {}): CodeLine[] {
  const sp = SPECS[lang]
  const keep = opts.keep ?? 4
  const sk = skeleton(lang, title)
  const rows: CodeLine[] = []
  let n = 1
  const src = (s: string): Tok[] => tokenize(lang, s)
  const depthOf = (s: string): number => Math.floor((s.length - s.trimStart().length) / 4)

  // imports show in full: a file always starts at line 1
  for (const line of sk.imports) {
    rows.push({ n, kind: line === '' ? 'blank' : 'code', toks: src(line), depth: 0 })
    n++
  }
  sk.decl.forEach((line, i) => {
    const isOpener = i === sk.decl.length - 1 && sp.braces
    let toks = src(line)
    if (isOpener) toks = markBracket(toks, true)
    rows.push({ n, kind: line === '' ? 'blank' : 'code', toks, depth: depthOf(line), git: isOpener ? 'mod' : undefined })
    n++
  })
  const base = n

  const body = (st: Statement): CodeLine => {
    const num = base + st.index
    if (st.text.trim() === '') {
      return { n: num, kind: 'comment', lyric: st.index, toks: src(`${pad(sp.indent)}${sp.comment} ♪ interlude`), depth: Math.floor(sp.indent / 4), git: 'add' }
    }
    const stmt = sp.call.replace('{L}', `"${MARK}"`) + sp.semi
    const mm = Math.floor(st.timeMs / 60000)
    const ss = String(Math.floor((st.timeMs % 60000) / 1000)).padStart(2, '0')
    // the time stamp rides along only when it fits on the line (an orphaned comment on a wrapped line reads badly)
    const comment = `${sp.comment} ${mm}:${ss}`
    const trail = sp.indent + stmt.length - 1 + st.text.length + 2 + comment.length <= 62 ? `  ${comment}` : ''
    return {
      n: num,
      kind: 'lyric',
      lyric: st.index,
      toks: tokenizeTemplate(lang, `${pad(sp.indent)}${stmt}${trail}`),
      depth: Math.floor(sp.indent / 4),
      git: 'add'
    }
  }

  const hidden = Math.max(0, statements.length - keep)
  if (hidden > 0) {
    rows.push({ n: base + statements[0]!.index, kind: 'fold', toks: [{ t: 'ws', s: pad(sp.indent) }, { t: 'com', s: `${sp.comment} …` }], folded: hidden, depth: Math.floor(sp.indent / 4), git: 'add' })
  }
  for (const st of statements.slice(hidden)) rows.push(body(st))

  const last = statements.length ? statements[statements.length - 1]!.index + 1 : 0
  let fn = base + last
  sk.foot.forEach((line, i) => {
    let toks = src(line)
    if (i === 0 && sp.braces && sk.foot.length > 1) toks = markBracket(toks, false)
    rows.push({ n: fn++, kind: 'code', toks, depth: depthOf(line) })
  })
  return rows
}

/** Column of the caret at the end of a statement (1-based), for the status bar. */
export function caretColumn(lang: Lang, text: string): number {
  const sp = SPECS[lang]
  const body = text.trim() === '' ? `${sp.comment} ♪ interlude` : sp.call.replace('{L}', `"${escapeLiteral(lang, text)}"`) + sp.semi
  return sp.indent + body.length + 1
}

/** line number of the first statement, for the status bar's `Ln` */
export function lineBase(lang: Lang, title: string): number {
  const sk = skeleton(lang, title)
  return 1 + sk.imports.length + sk.decl.length
}
