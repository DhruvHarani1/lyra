/**
 * Journal look: which pen did what. A real journal is not marked with one highlighter, so every lyric line gets its own notes:
 * a few words are underlined (black pen, single / double / wavy), circled or boxed (blue ballpoint), highlighted (yellow, pink,
 * green marker), struck out in red with a small note above, scribbled out or dotted with an ink blot; the line itself may get a star,
 * an arrow, an exclamation mark or a small number in the margin, a repeated line (a chorus) gets a brace and a "chorus x2" note and is
 * written in blue ballpoint, a quoted line in green.
 * Everything is picked from a hash of the line index and the text, so the same song always looks the same (no randomness).
 * Only fixed strings from this file are ever used as notes; lyric text is never put into an attribute or a style.
 */

export type WordMark = 'ul' | 'ul2' | 'wavy' | 'circle' | 'box' | 'hl-yellow' | 'hl-pink' | 'hl-green' | 'strike' | 'scrib' | 'blot'
export type LineTag = 'star' | 'arrow' | 'excl' | 'num' | null
export type InkColor = 'navy' | 'blue' | 'green'

export const WORD_MARKS: readonly WordMark[] = [
  'ul',
  'hl-yellow',
  'circle',
  'hl-pink',
  'wavy',
  'box',
  'ul2',
  'hl-green',
  'strike',
  'blot',
  'scrib'
]
/** a small hand-written note over a struck-out word */
export const STRIKE_NOTES: readonly string[] = ['really?', 'yes!', 'again', 'hmm', 'oh well', 'sure…', 'no no', 'ha']

export function inkHash(n: number, text: string): number {
  let h = 2166136261 ^ n
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  h ^= h >>> 15
  h = Math.imul(h, 2246822519)
  h ^= h >>> 13
  return h >>> 0
}

/** the words that can carry a mark: three or more letters, so "I", "a", "to" are never circled */
function markable(w: string): boolean {
  return Array.from(w).filter((c) => /[\p{L}\p{N}]/u.test(c)).length >= 3
}

export interface WordInk {
  mark: WordMark | null
  /** only for 'strike' */
  note?: string
}

/** One entry per word. Zero to two words of a line are marked, never two neighbours. */
export function wordInk(lineIndex: number, text: string, words: readonly string[]): WordInk[] {
  const out: WordInk[] = words.map(() => ({ mark: null }))
  const idx = words.map((w, i) => (markable(w) ? i : -1)).filter((i) => i >= 0)
  if (idx.length === 0) return out
  const h = inkHash(lineIndex, text)
  // one line in seven is left plain: handwriting that is all marked is noise
  if (h % 7 === 0) return out
  const count = idx.length > 3 && h % 3 === 0 ? 2 : 1
  const first = idx[(h >>> 4) % idx.length]!
  const picks = [first]
  if (count === 2) {
    const rest = idx.filter((i) => Math.abs(i - first) > 1)
    if (rest.length) picks.push(rest[(h >>> 9) % rest.length]!)
  }
  picks.forEach((wi, k) => {
    const hw = inkHash(lineIndex * 31 + wi + k * 7, words[wi]!)
    const mark = WORD_MARKS[hw % WORD_MARKS.length]!
    out[wi] = mark === 'strike' ? { mark, note: STRIKE_NOTES[(hw >>> 5) % STRIKE_NOTES.length]! } : { mark }
  })
  return out
}

export function normLine(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** how many times each line (ignoring case and punctuation) occurs in the song: a line that comes back is a chorus line */
export function countRepeats(lines: readonly { text: string }[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const l of lines) {
    const k = normLine(l.text)
    if (k.length >= 6) m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

export interface LineInk {
  tag: LineTag
  /** the number shown for 'num' */
  num: number
  ink: InkColor
  /** chorus: a brace and a note; the count is how often the line occurs (0 = not a chorus line) */
  chorus: number
  /** a small tilt, in tenths of a degree, -3..3 */
  tilt: number
}

const isQuoted = (t: string): boolean => /^\s*["“'‘(].*["”')]\s*$/.test(t)

export function lineInk(lineIndex: number, text: string, occurrences: number): LineInk {
  const h = inkHash(lineIndex + 101, text)
  const chorus = occurrences >= 2 ? occurrences : 0
  const tags: LineTag[] = ['star', null, 'arrow', 'num', null, 'excl', null, 'num']
  let tag: LineTag = tags[h % tags.length] ?? null
  if (/!\s*$/.test(text) && h % 2 === 0) tag = 'excl'
  if (chorus) tag = null // the brace is the margin mark
  const ink: InkColor = chorus ? 'blue' : isQuoted(text) ? 'green' : 'navy'
  return {
    tag,
    num: (lineIndex % 9) + 1,
    ink,
    chorus,
    tilt: ((h >>> 8) % 7) - 3
  }
}

export type PlainMark = 'hl-yellow' | 'hl-pink' | 'hl-green' | 'ul' | 'ul2' | 'wavy' | 'box' | null

export interface PlainInk {
  mark: PlainMark
  tag: LineTag
  ink: InkColor
}

const PLAIN_MARKS: PlainMark[] = ['hl-yellow', null, 'ul', 'hl-pink', null, 'wavy', 'box', null, 'hl-green', 'ul2', null]

/** Unsynced lyrics: the same variety, one decoration per line (a stanza index and a line index make the seed). */
export function plainInk(stanza: number, line: number, text: string): PlainInk {
  const h = inkHash(stanza * 53 + line, text)
  const tags: LineTag[] = [null, null, 'star', null, 'arrow', null, 'excl']
  return {
    mark: text.trim().length < 4 ? null : PLAIN_MARKS[h % PLAIN_MARKS.length]!,
    tag: tags[(h >>> 6) % tags.length]!,
    ink: isQuoted(text) ? 'green' : (h >>> 12) % 5 === 0 ? 'blue' : 'navy'
  }
}
