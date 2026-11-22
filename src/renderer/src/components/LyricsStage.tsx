import { memo, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { LyricLine, LyricStyle } from '@shared/types'
import { useFrame } from '@/hooks/useLyricsSync'
import { useLyricOffset } from '@/store/offsets'
import { lyricPosition } from '@/hooks/useLyricsSync'
import { useArtwork } from '@/hooks/useArtwork'
import { usePlayer } from '@/store/player'
import { clamp } from '@/lib/format'
import { countRepeats, lineInk, normLine, wordInk, type LineInk } from '@/lib/journalInk'

/**
 * Staged lyrics for fullscreen: one phrase at a time instead of a scrolling list.
 *  - kinetic: giant type, words slice in as they are sung, the layout changes from phrase to phrase
 *  - constellation: every word is a star, joined to the last one as it is sung
 */

interface StageWord {
  text: string
  start: number
  end: number
}

/** Real word timing when the source has it, otherwise spread the words across the line by their length. */
function stageWords(line: LyricLine, nextTime: number | undefined): StageWord[] {
  const end = line.endMs ?? nextTime ?? line.timeMs + 4000
  if (line.words && line.words.length > 0) {
    return line.words.map((w, i) => ({
      text: w.text.trim(),
      start: w.timeMs,
      end: Math.min(line.words![i + 1]?.timeMs ?? end, end)
    }))
  }
  const parts = line.text.split(/\s+/).filter(Boolean)
  const total = parts.reduce((n, w) => n + w.length + 1, 0)
  const span = Math.max(600, (end - line.timeMs) * 0.85)
  let acc = 0
  return parts.map((text) => {
    const start = line.timeMs + (acc / total) * span
    acc += text.length + 1
    return { text, start, end: line.timeMs + (acc / total) * span }
  })
}

function hash(n: number, text: string): number {
  let h = 2166136261 ^ n
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}
function rng(seed: number): () => number {
  let a = seed || 1
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** How many of the words have started (re-renders only when that number changes). */
function useRevealed(words: StageWord[], startAtMax = false): number {
  const offset = useLyricOffset()
  const [n, setN] = useState(() => (startAtMax ? words.length : words.filter((w) => w.start <= lyricPosition(offset)).length))
  useFrame(
    (pos) => {
      if (startAtMax) return
      const p = pos + offset
      let c = 0
      for (const w of words) if (w.start - 40 <= p) c++
      setN((cur) => (cur === c ? cur : c))
    },
    !startAtMax,
    [words, offset, startAtMax]
  )
  return n
}

interface StageProps {
  lines: readonly LyricLine[]
  active: number
  mode: Exclude<LyricStyle, 'classic'>
}

export function LyricsStage({ lines, active, mode }: StageProps) {
  const line = active >= 0 ? lines[active] : undefined
  const live = line && line.text !== '' ? line : undefined
  return (
    <div className={`stage stage--${mode}`} aria-live="off">
      {mode === 'zoom' && (
        <AnimatePresence>{live && <Zoom key={active} line={live} index={active} nextTime={lines[active + 1]?.timeMs} />}</AnimatePresence>
      )}
      {mode === 'kinetic' && (
        <AnimatePresence>{live && <Kinetic key={active} line={live} index={active} nextTime={lines[active + 1]?.timeMs} />}</AnimatePresence>
      )}
      {mode === 'constellation' && <Constellations lines={lines} active={active} />}
      {mode === 'sticker' && (
        <AnimatePresence>{live && <Stickers key={active} line={live} index={active} nextTime={lines[active + 1]?.timeMs} />}</AnimatePresence>
      )}
      {mode === 'chat' && <Chat lines={lines} active={active} />}
      {mode === 'type' && <Typewriter lines={lines} active={active} />}
      {mode === 'diary' && <Diary lines={lines} active={active} />}
      {mode === 'subtitle' && <Subtitles lines={lines} active={active} />}
      {mode === 'chatlog' && <ChatLog lines={lines} active={active} />}
      {mode === 'lowerthird' && <LowerThird lines={lines} active={active} />}
      {(mode === 'sign' || mode === 'liquid' || mode === 'pixel' || mode === 'title' || mode === 'ink' || mode === 'glitch' || mode === 'bubble' || mode === 'spray' || mode === 'intertitle' || mode === 'note' || mode === 'jot' || mode === 'scrawl' || mode === 'label' || mode === 'metro' || mode === 'weave' || mode === 'picto' || mode === 'wall' || mode === 'flap') && <Sign lines={lines} active={active} variant={mode} />}
      {mode === 'bloom' && <Bloom lines={lines} active={active} />}
      {mode === 'log' && <TermLog lines={lines} active={active} />}
      {(mode === 'lockscreen' || mode === 'wallet' || mode === 'route' || mode === 'editor') && <Feed lines={lines} active={active} variant={mode} />}
      {active >= 0 && !live && (
        <div className="stage__rest" aria-label="instrumental break">
          <i />
          <i />
          <i />
        </div>
      )}
    </div>
  )
}

// ---------- kinetic ----------

const VARIANTS = ['stack', 'slab', 'outline', 'wide'] as const

function chunkRows(words: StageWord[]): StageWord[][] {
  const rows: StageWord[][] = []
  let cur: StageWord[] = []
  let len = 0
  for (const w of words) {
    if (cur.length && len + w.text.length > 13) {
      rows.push(cur)
      cur = []
      len = 0
    }
    cur.push(w)
    len += w.text.length + 1
  }
  if (cur.length) rows.push(cur)
  return rows
}

const Kinetic = memo(function Kinetic({ line, index, nextTime }: { line: LyricLine; index: number; nextTime: number | undefined }) {
  const words = useMemo(() => stageWords(line, nextTime), [line, nextTime])
  const revealed = useRevealed(words)
  const rows = useMemo(() => chunkRows(words), [words])
  const variant = VARIANTS[hash(index, line.text) % VARIANTS.length]!
  const chars = line.text.length
  const k = chars <= 12 ? 1 : chars <= 24 ? 0.78 : chars <= 40 ? 0.6 : 0.46
  const longest = words.reduce((b, w, i) => (w.text.length > (words[b]?.text.length ?? 0) ? i : b), 0)
  let idx = -1
  return (
    <motion.div
      className={`kin kin--${variant}`}
      style={{ ['--k' as string]: k }}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(22px)', scale: 1.14, y: '-6%', transition: { duration: 0.42, ease: [0.5, 0, 0.9, 0.4] } }}
    >
      {rows.map((row, r) => (
        <div className="kin__row" key={r}>
          {row.map((w) => {
            idx++
            const i = idx
            const cls = ['kin__word', i < revealed ? 'is-in' : '', i === revealed - 1 ? 'is-now' : '', i === longest ? 'is-big' : '']
            const slab = variant === 'slab' && r === rows.length - 1 && w === row[row.length - 1]
            return (
              <span key={i} className={cls.join(' ') + (slab ? ' is-slab' : '')} data-text={w.text}>
                {w.text}
              </span>
            )
          })}
        </div>
      ))}
    </motion.div>
  )
})

// ---------- zoom: one giant word at a time, thrown at the camera ----------

const ZOOM_LOOKS = ['fill', 'outline', 'cut', 'ghost'] as const

/**
 * Motion-graphics lyrics: the word being sung fills the screen, flies in from far too close (big, blurred, tilted) and
 * snaps into place; the next word replaces it. The whole line sits small underneath so you can always read along.
 */
const Zoom = memo(function Zoom({ line, index, nextTime }: { line: LyricLine; index: number; nextTime: number | undefined }) {
  const words = useMemo(() => stageWords(line, nextTime), [line, nextTime])
  const revealed = useRevealed(words)
  const cur = Math.max(0, revealed - 1)
  const w = words[cur]
  const h = hash(index * 31 + cur, w?.text ?? '')
  const look = ZOOM_LOOKS[h % ZOOM_LOOKS.length]!
  const rot = ((h >> 3) % 9) - 4
  const len = Math.max(2, w?.text.length ?? 2)
  const k = Math.min(1, 6.5 / len)
  return (
    <motion.div className="zoom" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: 'blur(14px)', transition: { duration: 0.25 } }}>
      <AnimatePresence mode="popLayout" initial={false}>
        {w && (
          <motion.span
            key={`${index}-${cur}`}
            className={`zoom__word zoom__word--${look}`}
            data-text={w.text}
            style={{ ['--k' as string]: k }}
            initial={{ scale: 2.7, opacity: 0, filter: 'blur(20px)', rotate: rot * 2.2, x: (h % 2 ? -1 : 1) * 60 }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)', rotate: rot, x: 0 }}
            exit={{ scale: 0.72, opacity: 0, filter: 'blur(10px)' }}
            transition={{ duration: 0.26, ease: [0.2, 0.9, 0.2, 1] }}
          >
            {w.text}
          </motion.span>
        )}
      </AnimatePresence>
      <div className="zoom__line" aria-hidden="true">
        {words.map((x, i) => (
          <span key={i} className={i < revealed ? (i === cur ? 'is-now' : 'is-in') : ''}>
            {x.text}
          </span>
        ))}
      </div>
    </motion.div>
  )
})

// ---------- constellation ----------

function layout(line: LyricLine, index: number, count: number): Array<{ x: number; y: number }> {
  const rand = rng(hash(index, line.text))
  const pts: Array<{ x: number; y: number }> = []
  let lastY = 50
  for (let i = 0; i < count; i++) {
    const x = count === 1 ? 50 : 10 + (80 * i) / (count - 1) + (rand() - 0.5) * 7
    let y = 22 + rand() * 56
    if (Math.abs(y - lastY) < 14) y = y > 50 ? y - 20 : y + 20
    y = Math.min(84, Math.max(16, y))
    pts.push({ x, y })
    lastY = y
  }
  return pts
}

function Constellations({ lines, active }: { lines: readonly LyricLine[]; active: number }) {
  const idxs: number[] = []
  for (const i of [active - 1, active]) if (i >= 0 && lines[i] && lines[i]!.text !== '') idxs.push(i)
  return (
    <AnimatePresence>
      {idxs.map((i) => (
        <Constellation key={i} line={lines[i]!} index={i} nextTime={lines[i + 1]?.timeMs} ghost={i !== active} />
      ))}
    </AnimatePresence>
  )
}

const Constellation = memo(function Constellation({ line, index, nextTime, ghost }: { line: LyricLine; index: number; nextTime: number | undefined; ghost: boolean }) {
  const words = useMemo(() => stageWords(line, nextTime), [line, nextTime])
  const revealed = useRevealed(words, ghost)
  const pts = useMemo(() => layout(line, index, words.length), [line, index, words.length])
  return (
    <motion.div
      className={`con ${ghost ? 'is-ghost' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: ghost ? 0.3 : 1, scale: ghost ? 0.94 : 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(8px)' }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <svg className="con__lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {pts.slice(1).map((p, i) => (
          <line
            key={i}
            x1={pts[i]!.x}
            y1={pts[i]!.y}
            x2={p.x}
            y2={p.y}
            pathLength={1}
            vectorEffect="non-scaling-stroke"
            className={i + 1 < revealed ? 'is-drawn' : ''}
          />
        ))}
      </svg>
      {words.map((w, i) => {
        const p = pts[i]!
        const left = p.x > 72
        return (
          <div
            key={i}
            className={`con__star ${i < revealed ? 'is-in' : ''} ${i === revealed - 1 && !ghost ? 'is-now' : ''} ${left ? 'is-left' : ''}`}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            <svg viewBox="-12 -12 24 24" aria-hidden="true">
              <path d="M0 -11 C1 -3 3 -1 11 0 C3 1 1 3 0 11 C-1 3 -3 1 -11 0 C-3 -1 -1 -3 0 -11Z" />
            </svg>
            <span>{w.text}</span>
          </div>
        )
      })}
    </motion.div>
  )
})

// ---------- sticker bomb ----------

const STICKER_COLORS = ['#c6ff3d', '#ff5fa2', '#4fd0ff', '#ffd23d', '#b48cff', '#ff8a3d']
const DECOS = [
  // burst
  'M50 4l9 20 21-9-7 22 22 5-19 12 14 17-23-2-1 23-16-16-16 16-1-23-23 2 14-17L2 42l22-5-7-22 21 9z',
  // heart
  'M50 90C8 58 6 30 28 18c12-6 22 0 22 12 0-12 10-18 22-12 22 12 20 40-22 72z',
  // smiley (face outline + eyes as one path)
  'M50 6a44 44 0 1 0 0 88 44 44 0 0 0 0-88zM34 36a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm32 0a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM28 62c6 14 38 14 44 0-8 4-36 4-44 0z'
]

const Stickers = memo(function Stickers({ line, index, nextTime }: { line: LyricLine; index: number; nextTime: number | undefined }) {
  const words = useMemo(() => stageWords(line, nextTime), [line, nextTime])
  const revealed = useRevealed(words)
  const seed = hash(index, line.text)
  const rand = useMemo(() => rng(seed), [seed])
  const look = useMemo(
    () => words.map((_, i) => ({ rot: (rand() - 0.5) * 11, scale: 0.9 + rand() * 0.28, color: STICKER_COLORS[(i + seed) % STICKER_COLORS.length]! })),
    [words, rand, seed]
  )
  const decos = useMemo(
    () => [0, 1].map((n) => ({ d: DECOS[(seed + n) % DECOS.length]!, x: n ? 78 + rand() * 12 : 4 + rand() * 12, y: n ? 62 + rand() * 20 : 6 + rand() * 14, rot: (rand() - 0.5) * 50, c: STICKER_COLORS[(seed + n * 2 + 1) % STICKER_COLORS.length]! })),
    [seed, rand]
  )
  const chars = line.text.length
  const k = chars <= 12 ? 1 : chars <= 24 ? 0.82 : chars <= 40 ? 0.64 : 0.5
  return (
    <motion.div
      className="stk"
      style={{ ['--k' as string]: k }}
      exit={{ opacity: 0, rotate: 7, y: -80, scale: 0.92, transition: { duration: 0.4, ease: [0.5, 0, 0.9, 0.4] } }}
    >
      {decos.map((d, i) => (
        <svg key={i} className={`stk__deco ${revealed > i ? 'is-in' : ''}`} viewBox="0 0 100 100" style={{ left: `${d.x}%`, top: `${d.y}%`, ['--r' as string]: `${d.rot}deg`, fill: d.c }}>
          <path d={d.d} fillRule="evenodd" />
        </svg>
      ))}
      <div className="stk__words">
        {words.map((w, i) => (
          <span
            key={i}
            className={`stk__word ${i < revealed ? 'is-in' : ''} ${i === revealed - 1 ? 'is-now' : ''}`}
            style={{ ['--r' as string]: `${look[i]!.rot}deg`, ['--s' as string]: look[i]!.scale, background: look[i]!.color }}
          >
            {w.text}
          </span>
        ))}
      </div>
    </motion.div>
  )
})

// ---------- DM thread ----------

function Chat({ lines, active }: { lines: readonly LyricLine[]; active: number }) {
  const track = usePlayer((s) => s.snapshot?.track ?? null)
  const art = useArtwork(track?.artworkUrl ?? null)
  const shown: number[] = []
  for (let i = active; i >= 0 && shown.length < 4; i--) if (lines[i] && lines[i]!.text !== '') shown.unshift(i)
  const cur = shown[shown.length - 1]
  return (
    <div className="chat">
      <header className="chat__head">
        {art ? <img src={art} alt="" /> : <i />}
        <div>
          <b>{track?.artists[0] ?? 'Lyra'}</b>
          <span>{track?.title ?? ''}</span>
        </div>
      </header>
      <div className="chat__shared">
        {art ? <img src={art} alt="" /> : <i />}
        <div>
          <b>{track?.title ?? ''}</b>
          <span>{track?.artists.join(', ') ?? ''} · Shared from Lyra</span>
        </div>
      </div>
      <div className="chat__feed">
        <AnimatePresence initial={false}>
          {shown.map((i, n) => (
            <Bubble key={i} line={lines[i]!} nextTime={lines[i + 1]?.timeMs} side={i % 2 === 0 ? 'in' : 'out'} age={shown.length - 1 - n} live={i === cur} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

const Bubble = memo(function Bubble({ line, nextTime, side, age, live }: { line: LyricLine; nextTime: number | undefined; side: 'in' | 'out'; age: number; live: boolean }) {
  const words = useMemo(() => stageWords(line, nextTime), [line, nextTime])
  const revealed = useRevealed(words, !live)
  const typing = live && revealed === 0
  return (
    <motion.div
      layout="position"
      className={`bub bub--${side} ${live ? 'is-live' : ''}`}
      initial={{ opacity: 0, y: 40, scale: 0.7 }}
      animate={{ opacity: live ? 1 : Math.max(0.5, 0.85 - age * 0.14), y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -50, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30, mass: 0.8 }}
    >
      <div className={`bub__body ${typing ? 'is-typing' : ''}`}>
        {typing && (
          <span className="bub__dots">
            <i />
            <i />
            <i />
          </span>
        )}
        <span className="bub__text">
          {words.map((w, i) => (
            <span key={i} className={i < revealed ? 'is-in' : ''}>
              {w.text}{' '}
            </span>
          ))}
        </span>
      </div>
      {live && revealed >= words.length && <small className="bub__read">Read ✓✓</small>}
    </motion.div>
  )
})

// ---------- terminal ----------

function Typewriter({ lines, active }: { lines: readonly LyricLine[]; active: number }) {
  const track = usePlayer((s) => s.snapshot?.track ?? null)
  const offset = useLyricOffset()
  const typed = useRef<HTMLSpanElement>(null)
  const bar = useRef<HTMLSpanElement>(null)
  const cur = active >= 0 ? lines[active] : undefined
  const text = cur?.text ?? ''
  const prev: number[] = []
  for (let i = active - 1; i >= 0 && prev.length < 4; i--) if (lines[i] && lines[i]!.text !== '') prev.unshift(i)
  const end = cur ? (cur.endMs ?? lines[active + 1]?.timeMs ?? cur.timeMs + 4000) : 0

  useFrame(
    (pos) => {
      if (!cur || !typed.current) return
      const p = clamp((pos + offset - cur.timeMs) / Math.max(400, (end - cur.timeMs) * 0.8), 0, 1)
      typed.current.textContent = text.slice(0, Math.ceil(p * text.length))
      const dur = track?.durationMs
      if (bar.current && dur) {
        const filled = Math.round(clamp((pos + offset) / dur, 0, 1) * 24)
        bar.current.textContent = '█'.repeat(filled) + '░'.repeat(24 - filled)
      }
    },
    true,
    [cur, text, end, offset, track?.durationMs]
  )
  return (
    <div className="term">
      <div className="term__head">
        <span>LYRA.SYS</span>
        <span>▸ {track ? `${track.title} — ${track.artists[0]}` : 'standby'}</span>
        <span className="term__bar" ref={bar} />
      </div>
      <div className="term__log">
        {prev.map((i) => (
          <div key={i} className="term__old">
            <em>{String(i + 1).padStart(3, '0')}</em> {lines[i]!.text}
          </div>
        ))}
        {cur && text !== '' ? (
          <div className="term__now" key={active}>
            <em>{String(active + 1).padStart(3, '0')}</em> <b>&gt;</b> <span ref={typed} />
            <i className="term__caret" />
          </div>
        ) : (
          <div className="term__now">
            <b>&gt;</b> <i className="term__caret" />
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- diary: handwritten, with a highlighter that follows the singing ----------

function Diary({ lines, active }: { lines: readonly LyricLine[]; active: number }) {
  const prev: number[] = []
  for (let i = active - 1; i >= 0 && prev.length < 3; i--) if (lines[i] && lines[i]!.text !== '') prev.unshift(i)
  const cur = active >= 0 ? lines[active] : undefined
  return (
    <div className="diary">
      <div className="diary__page">
        <i className="diary__tape" />
        {prev.map((i, n) => (
          <p key={i} className="diary__old" style={{ opacity: 0.35 + (n + 1) * 0.15, transform: `rotate(${((i % 3) - 1) * 0.6}deg)` }}>
            {lines[i]!.text}
          </p>
        ))}
        <AnimatePresence mode="wait" initial={false}>
          {cur && cur.text !== '' ? <DiaryLine key={active} line={cur} index={active} nextTime={lines[active + 1]?.timeMs} /> : null}
        </AnimatePresence>
      </div>
    </div>
  )
}

const DiaryLine = memo(function DiaryLine({ line, index, nextTime }: { line: LyricLine; index: number; nextTime: number | undefined }) {
  const words = useMemo(() => stageWords(line, nextTime), [line, nextTime])
  const revealed = useRevealed(words)
  return (
    <motion.p
      className="diary__now"
      style={{ rotate: `${((index % 5) - 2) * 0.5}deg` }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {words.map((w, i) => (
        <span key={i} className={`diary__w ${i < revealed ? 'is-in' : ''}`}>
          {w.text}{' '}
        </span>
      ))}
    </motion.p>
  )
})

// ---------- cinema: subtitles inside black bars ----------

function Subtitles({ lines, active }: { lines: readonly LyricLine[]; active: number }) {
  const cur = active >= 0 ? lines[active] : undefined
  const live = cur && cur.text !== '' ? cur : undefined
  return (
    <div className="sub">
      <AnimatePresence mode="wait" initial={false}>
        {live ? (
          <SubLine key={active} line={live} nextTime={lines[active + 1]?.timeMs} />
        ) : active >= 0 ? (
          <motion.div key="gap" className="sub__gap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            [ music ]
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

const SubLine = memo(function SubLine({ line, nextTime }: { line: LyricLine; nextTime: number | undefined }) {
  const words = useMemo(() => stageWords(line, nextTime), [line, nextTime])
  const revealed = useRevealed(words)
  return (
    <motion.div className="sub__line" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.28 }}>
      {words.map((w, i) => (
        <span key={i} className={i < revealed ? 'is-in' : ''}>
          {w.text}{' '}
        </span>
      ))}
    </motion.div>
  )
})

// ---------- chat log (sandbox game style) ----------

function ChatLog({ lines, active }: { lines: readonly LyricLine[]; active: number }) {
  const track = usePlayer((x) => x.snapshot?.track ?? null)
  const shown: number[] = []
  for (let i = active; i >= 0 && shown.length < 6; i--) if (lines[i] && lines[i]!.text !== '') shown.unshift(i)
  const cur = shown[shown.length - 1]
  return (
    <div className="mc">
      <AnimatePresence initial={false}>
        {active >= 0 && active < 2 && track && (
          <motion.div key="adv" className="mc__adv" initial={{ x: 120, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 120, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
            <i />
            <span>
              <b>Now playing!</b>
              {track.title}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mc__log">
        <AnimatePresence initial={false}>
          {shown.map((i, n) => (
            <McRow key={i} line={lines[i]!} nextTime={lines[i + 1]?.timeMs} who={track?.artists[0] ?? 'Lyra'} live={i === cur} age={shown.length - 1 - n} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

const McRow = memo(function McRow({ line, nextTime, who, live, age }: { line: LyricLine; nextTime: number | undefined; who: string; live: boolean; age: number }) {
  const words = useMemo(() => stageWords(line, nextTime), [line, nextTime])
  const revealed = useRevealed(words, !live)
  return (
    <motion.div layout="position" className={`mc__row ${live ? 'is-live' : ''}`} initial={{ opacity: 0, x: -40 }} animate={{ opacity: Math.max(0.45, 1 - age * 0.12), x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <span className="mc__who">&lt;{who}&gt;</span>{' '}
      {words.map((w, i) => (
        <span key={i} className={i < revealed ? 'is-in' : ''}>
          {w.text}{' '}
        </span>
      ))}
    </motion.div>
  )
})

// ---------- broadcast lower-third ----------

function LowerThird({ lines, active }: { lines: readonly LyricLine[]; active: number }) {
  const cur = active >= 0 ? lines[active] : undefined
  const live = cur && cur.text !== '' ? cur : undefined
  const prev: number[] = []
  for (let i = active - 1; i >= 0 && prev.length < 3; i--) if (lines[i] && lines[i]!.text !== '') prev.unshift(i)
  return (
    <div className="lt">
      <div className="lt__ticker">
        {prev.map((i) => (
          <span key={i}>{lines[i]!.text}</span>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {live && <LtBar key={active} line={live} nextTime={lines[active + 1]?.timeMs} />}
      </AnimatePresence>
    </div>
  )
}

const LtBar = memo(function LtBar({ line, nextTime }: { line: LyricLine; nextTime: number | undefined }) {
  const words = useMemo(() => stageWords(line, nextTime), [line, nextTime])
  const revealed = useRevealed(words)
  return (
    <motion.div className="lt__bar" initial={{ x: -80, opacity: 0, clipPath: 'inset(0 100% 0 0)' }} animate={{ x: 0, opacity: 1, clipPath: 'inset(0 0% 0 0)' }} exit={{ x: 60, opacity: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
      <small>NOW SINGING</small>
      <p>
        {words.map((w, i) => (
          <span key={i} className={i < revealed ? 'is-in' : ''}>
            {w.text}{' '}
          </span>
        ))}
      </p>
    </motion.div>
  )
})

/** Journal: the margin marks of a line: a star, an arrow, an exclamation mark, a small number, or a brace and a note for a chorus line. */
function JotMargin({ ink }: { ink: LineInk }) {
  if (ink.chorus) {
    return (
      <>
        <svg className="jl__brace" viewBox="0 0 20 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M16 2 C8 2 10 10 10 26 C10 40 8 46 2 50 C8 54 10 60 10 74 C10 90 8 98 16 98" />
        </svg>
        <span className="jl__chorus">{`chorus ×${ink.chorus}`}</span>
      </>
    )
  }
  if (ink.tag === 'star')
    return (
      <svg className="jl__tag jl__tag--star" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 5 L29 19 L44 19 L32 28 L36 43 L24 34 L12 43 L16 28 L4 19 L19 19 Z" />
      </svg>
    )
  if (ink.tag === 'arrow')
    return (
      <svg className="jl__tag jl__tag--arrow" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M4 30 C16 36 30 30 40 16" />
        <path d="M28 14 L41 14 L38 27" />
      </svg>
    )
  if (ink.tag === 'excl')
    return (
      <svg className="jl__tag jl__tag--excl" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M22 6 C21 18 22 26 24 32" />
        <path d="M24 40 L24.5 41" />
      </svg>
    )
  if (ink.tag === 'num') return <span className="jl__num">{ink.num}</span>
  return null
}

// ---------- sign: the song is lit word by word on a wall sign, the next line waits underneath ----------
const Sign = memo(function Sign({ lines, active, variant }: { lines: readonly LyricLine[]; active: number; variant: string }) {
  const repeats = useMemo(() => (variant === 'jot' ? countRepeats(lines) : null), [lines, variant])
  const line = active >= 0 ? lines[active] : undefined
  const live = line && line.text !== '' ? line : undefined
  const next = lines.slice(active + 1).find((l) => l.text !== '')
  return (
    <div className={`sign sign--${variant}`}>
      <AnimatePresence mode="wait" initial={false}>
        {live && <SignLine key={active} line={live} index={active} nextTime={lines[active + 1]?.timeMs} next={next?.text} variant={variant} occurrences={repeats?.get(normLine(live.text)) ?? 0} />}
      </AnimatePresence>
    </div>
  )
})
const SignLine = memo(function SignLine({ line, index, nextTime, next, variant, occurrences }: { line: LyricLine; index: number; nextTime: number | undefined; next: string | undefined; variant: string; occurrences: number }) {
  const words = useMemo(() => stageWords(line, nextTime), [line, nextTime])
  // Journal: every line is marked up with its own pens (see lib/journalInk.ts)
  const jot = variant === 'jot'
  const inks = useMemo(() => (jot ? wordInk(index, line.text, words.map((w) => w.text)) : null), [jot, index, line.text, words])
  const lineMark = useMemo(() => (jot ? lineInk(index, line.text, occurrences) : null), [jot, index, line.text, occurrences])
  const revealed = useRevealed(words)
  // one word per line flickers now and then, like a tired tube (picked from the line itself so it stays put)
  const tired = hash(index, line.text) % words.length
  const row = (
    <>
      {words.map((w, i) => (
        <span
          key={i}
          className={['sign__word', i < revealed ? 'is-in' : '', i === revealed - 1 ? 'is-now' : '', i === tired ? 'is-tired' : '', inks?.[i]?.mark ? `jm jm--${inks[i]!.mark}` : ''].join(' ')}
          style={{ ['--wi' as string]: i, ['--wn' as string]: words.length }}
          data-note={inks?.[i]?.note}
        >
          {variant === 'flap'
            ? Array.from(w.text).map((c, j) => (
                <span key={j} className="sign__ch" style={{ ['--i' as string]: j }}>
                  {c}
                </span>
              ))
            : w.text}
          {variant === 'picto' && pictoFor(w.text) && (
            <svg className="sign__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d={pictoFor(w.text)!} />
            </svg>
          )}
        </span>
      ))}
    </>
  )
  return (
    <motion.div
      className={lineMark ? `sign__line jl jl--${lineMark.ink}${lineMark.chorus ? ' jl--chorus' : ''}` : 'sign__line'}
      style={{ ['--r' as string]: words.length ? revealed / words.length : 0, ...(lineMark ? { ['--jt' as string]: `${lineMark.tilt / 10}deg` } : {}) }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, transition: { duration: 0.22 } }}
      transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {lineMark && <JotMargin ink={lineMark} />}
      <div className="sign__row">{row}</div>
      {next && <div className="sign__next">{next}</div>}
      <div className="sign__refl" aria-hidden="true">
        <div className="sign__row">{row}</div>
      </div>
    </motion.div>
  )
})

// ---------- bloom: three lines like a photo caption, the one being sung blooms word by word ----------
const Bloom = memo(function Bloom({ lines, active }: { lines: readonly LyricLine[]; active: number }) {
  const line = active >= 0 ? lines[active] : undefined
  const live = line && line.text !== '' ? line : undefined
  const before = lines.slice(0, Math.max(0, active)).reverse().find((l) => l.text !== '')
  const after = lines.slice(active + 1).find((l) => l.text !== '')
  return (
    <div className="bloom">
      <div className="bloom__side bloom__side--prev">{before?.text}</div>
      <AnimatePresence mode="wait" initial={false}>
        {live && <BloomLine key={active} line={live} nextTime={lines[active + 1]?.timeMs} />}
      </AnimatePresence>
      <div className="bloom__side bloom__side--next">{after?.text}</div>
    </div>
  )
})
const BloomLine = memo(function BloomLine({ line, nextTime }: { line: LyricLine; nextTime: number | undefined }) {
  const words = useMemo(() => stageWords(line, nextTime), [line, nextTime])
  const revealed = useRevealed(words)
  return (
    <motion.div
      className="bloom__line"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14, transition: { duration: 0.24 } }}
      transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {words.map((w, i) => (
        <span key={i} className={['bloom__word', i < revealed ? 'is-in' : '', i === revealed - 1 ? 'is-now' : ''].join(' ')}>
          {w.text}
        </span>
      ))}
    </motion.div>
  )
})

// ---------- log: a terminal log, the newest line at the bottom with a cursor, older lines dim above it ----------
const fmtStamp = (ms: number): string => `[${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}]`
const TermLog = memo(function TermLog({ lines, active }: { lines: readonly LyricLine[]; active: number }) {
  const ids: number[] = []
  for (let i = active; i >= 0 && ids.length < 6; i--) if (lines[i] && lines[i]!.text !== '') ids.unshift(i)
  return (
    <div className="termlog">
      {ids.map((i) => (
        <TermRow key={i} line={lines[i]!} current={i === active} nextTime={lines[i + 1]?.timeMs} />
      ))}
    </div>
  )
})
const TermRow = memo(function TermRow({ line, current, nextTime }: { line: LyricLine; current: boolean; nextTime: number | undefined }) {
  const words = useMemo(() => stageWords(line, nextTime), [line, nextTime])
  const revealed = useRevealed(words, !current)
  return (
    <div className={`termlog__row ${current ? 'is-current' : ''}`}>
      <span className="termlog__ts">{fmtStamp(line.timeMs)}</span>
      <span className="termlog__text">
        {words.map((w, i) => (
          <span key={i} className={['termlog__word', i < revealed ? 'is-in' : '', current && i === revealed - 1 ? 'is-now' : ''].join(' ')}>
            {w.text}{' '}
          </span>
        ))}
      </span>
    </div>
  )
})

// ---------- picto: a small icon of our own beside the words that have one ----------
const PICTO: Record<string, string> = {
  moon: 'M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10Z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z',
  fire: 'M12 3c1 3 4 4.5 4 8.5A4 4 0 0 1 8 12c0-1.5.6-2.6 1.5-3.5C10 7 11.5 5.5 12 3Z',
  drop: 'M12 3s6 6 6 10.5A6 6 0 0 1 6 13.5C6 9 12 3 12 3Z',
  bolt: 'M13 2 5 13h6l-1 9 8-11h-6l1-9Z',
  note: 'M9 18V6l10-2v12M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3Zm10-2a3 3 0 1 1-3-3 3 3 0 0 1 3 3Z',
  road: 'M7 22 10 2m7 20L14 2M12 4v3m0 4v3m0 4v3',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z'
}
const PICTO_WORDS: Record<string, string> = {
  moon: 'moon', moonlight: 'moon', night: 'moon', sun: 'sun', sunshine: 'sun', sunset: 'sun', morning: 'sun', day: 'sun',
  heart: 'heart', hearts: 'heart', love: 'heart', loved: 'heart', star: 'star', stars: 'star', shine: 'star', shining: 'star',
  fire: 'fire', burn: 'fire', burning: 'fire', flame: 'fire', hot: 'fire', rain: 'drop', tears: 'drop', cry: 'drop', crying: 'drop',
  river: 'drop', rivers: 'drop', water: 'drop', ocean: 'drop', sea: 'drop', lightning: 'bolt', thunder: 'bolt', storm: 'bolt',
  electric: 'bolt', power: 'bolt', song: 'note', sing: 'note', music: 'note', melody: 'note', dance: 'note', dancing: 'note',
  sound: 'note', road: 'road', roads: 'road', drive: 'road', driving: 'road', highway: 'road', street: 'road', streets: 'road',
  walk: 'road', eyes: 'eye', eye: 'eye', see: 'eye', look: 'eye', watch: 'eye', watching: 'eye'
}
function pictoFor(word: string): string | null {
  const key = PICTO_WORDS[word.toLowerCase().replace(/[^a-z']/g, '')]
  return key ? PICTO[key]! : null
}

// ---------- feed: the song as a growing list of cards / rows (lock screen notifications, wallet payments, code lines, route pins) ----------
const Feed = memo(function Feed({ lines, active, variant }: { lines: readonly LyricLine[]; active: number; variant: string }) {
  const ids: number[] = []
  for (let i = active; i >= 0 && ids.length < 5; i--) if (lines[i] && lines[i]!.text !== '') ids.unshift(i)
  return (
    <div className={`feed feed--${variant}`}>
      <AnimatePresence initial={false}>
        {ids.map((i, n) => (
          <FeedRow key={i} line={lines[i]!} index={i} nextTime={lines[i + 1]?.timeMs} age={ids.length - 1 - n} />
        ))}
      </AnimatePresence>
    </div>
  )
})
const FeedRow = memo(function FeedRow({ line, index, nextTime, age }: { line: LyricLine; index: number; nextTime: number | undefined; age: number }) {
  const words = useMemo(() => stageWords(line, nextTime), [line, nextTime])
  const revealed = useRevealed(words, age > 0)
  const mm = String(Math.floor(line.timeMs / 60000)).padStart(1, '0')
  const ss = String(Math.floor((line.timeMs % 60000) / 1000)).padStart(2, '0')
  const amount = (words.length * 0.37 + (index % 7) * 0.11).toFixed(2)
  return (
    <motion.div
      layout
      className={`feed__row ${age === 0 ? 'is-current' : ''}`}
      data-age={Math.min(age, 4)}
      style={{ ['--age' as string]: age, ['--ln' as string]: index + 1 }}
      initial={{ opacity: 0, y: -26, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
    >
      <span className="feed__time">{mm}:{ss}</span>
      <span className="feed__txt">
        {words.map((w, i) => (
          <span key={i} className={['feed__word', i < revealed ? 'is-in' : '', age === 0 && i === revealed - 1 ? 'is-now' : ''].join(' ')}>
            {w.text}{' '}
          </span>
        ))}
      </span>
      <span className="feed__amt">+{amount}</span>
    </motion.div>
  )
})
