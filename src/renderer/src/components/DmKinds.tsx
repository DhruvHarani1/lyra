import type { ReactNode } from 'react'

/**
 * DM look: the lyric thread is made to read like a real messenger. Every lyric line is one message, and which KIND of message it is
 * comes from a hash of its index, so the thread is varied but always the same for the same song. Nothing here is a real person:
 * names are invented and every number is in the reserved 555-01xx fiction range. All lyric text is rendered through React (escaped).
 */
export type DmKind = 'text' | 'voice' | 'reply' | 'location' | 'poll' | 'sticker' | 'contact' | 'fwd' | 'photo' | 'link' | 'gif' | 'emoji'

const KINDS: DmKind[] = ['text', 'voice', 'text', 'reply', 'location', 'text', 'poll', 'sticker', 'text', 'contact', 'fwd', 'photo', 'text', 'link', 'gif', 'emoji']

export function hash(n: number): number {
  let x = Math.imul(n + 1, 0x9e3779b1) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0
  return (x ^ (x >>> 16)) >>> 0
}

export function kindOf(index: number): DmKind {
  if (import.meta.env.DEV) {
    // dev only: the browser harness can pin the kinds to look at each one (window.__dmKinds = ['poll', ...])
    const pin = (globalThis as { __dmKinds?: DmKind[] }).__dmKinds
    if (pin && pin.length > 0) return pin[index % pin.length]!
  }
  return KINDS[hash(index) % KINDS.length]!
}

/** a believable clock time for a message */
export function stamp(index: number): string {
  const h = 9 + (hash(index + 3) % 3)
  const m = (hash(index + 11) % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

const NAMES = ['Maya Rivers', 'Noor Hale', 'Theo Marsh', 'Ines Okafor', 'Leo Brandt', 'Sana Mori']
const PLACES: Array<[string, string]> = [
  ['Rooftop Café', '12 Harbour Walk'],
  ['Night Market', 'Pier 9'],
  ['Old Cinema', 'Elm Street'],
  ['The Glass Hour', 'Canal Row']
]
const REACTS = ['❤️', '😂', '🔥', '👍', '😮', '🎶']
const EMOJI = ['😍', '🥹', '✨', '🌙', '🎧', '💫']

export function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
}

/** Clock time, and two ticks that turn blue once read. */
export function Meta({ index, out, read }: { index: number; out: boolean; read: boolean }) {
  return (
    <span className="bub__meta">
      {stamp(index)}
      {out && <b className={read ? 'is-read' : ''}>✓✓</b>}
    </span>
  )
}

function Wave({ index, fill }: { index: number; fill: number }) {
  const bars = Array.from({ length: 26 }, (_, i) => 22 + (hash(index * 31 + i) % 78))
  return (
    <span className="bk-wave" aria-hidden="true">
      {bars.map((h, i) => (
        <i key={i} className={i / bars.length < fill ? 'is-on' : ''} style={{ height: `${h}%` }} />
      ))}
    </span>
  )
}

function Sticker({ index }: { index: number }) {
  const v = hash(index + 7) % 4
  return (
    <svg className="bk-sticker" viewBox="0 0 100 100" aria-hidden="true">
      {v === 0 && (
        <>
          <circle cx="50" cy="52" r="38" fill="#ffd23f" stroke="#1a1204" strokeWidth="4" />
          <path d="M26 42 q8 -10 16 0 M58 42 q8 -10 16 0" fill="none" stroke="#1a1204" strokeWidth="5" strokeLinecap="round" />
          <path d="M30 60 q20 26 40 0 z" fill="#c2253a" stroke="#1a1204" strokeWidth="4" strokeLinejoin="round" />
        </>
      )}
      {v === 1 && (
        <>
          <path d="M50 88 C14 62 8 34 28 24 C40 18 48 26 50 34 C52 26 60 18 72 24 C92 34 86 62 50 88 Z" fill="#ff4d79" stroke="#1a1204" strokeWidth="4" strokeLinejoin="round" />
          <path d="M30 34 q6 -6 12 -2" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        </>
      )}
      {v === 2 && (
        <>
          <path d="M50 8 L61 36 L92 38 L68 58 L77 90 L50 72 L23 90 L32 58 L8 38 L39 36 Z" fill="#ffd23f" stroke="#1a1204" strokeWidth="4" strokeLinejoin="round" />
          <circle cx="42" cy="50" r="4" fill="#1a1204" />
          <circle cx="58" cy="50" r="4" fill="#1a1204" />
          <path d="M42 62 q8 8 16 0" fill="none" stroke="#1a1204" strokeWidth="4" strokeLinecap="round" />
        </>
      )}
      {v === 3 && (
        <>
          <path d="M50 10 C70 34 82 46 74 66 C68 82 32 82 26 66 C18 46 34 36 50 10 Z" fill="#ff7a1a" stroke="#1a1204" strokeWidth="4" strokeLinejoin="round" />
          <path d="M50 44 C60 58 64 64 56 72 C48 78 38 72 42 62 C44 56 48 52 50 44 Z" fill="#ffd23f" />
        </>
      )}
    </svg>
  )
}

function MapTile({ index }: { index: number }) {
  const sx = 20 + (hash(index) % 40)
  const px = 140 - (sx % 20)
  return (
    <svg className="bk-map" viewBox="0 0 200 110" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="200" height="110" fill="#e8eef0" />
      <rect x="0" y="70" width="200" height="40" fill="#cfe3d2" />
      <path d={`M0 ${40 + (sx % 20)} C60 ${20 + (sx % 30)} 120 80 200 ${44 + (sx % 14)}`} fill="none" stroke="#fff" strokeWidth="9" />
      <path d={`M${sx * 2} 0 L${sx * 2 + 30} 110`} stroke="#fff" strokeWidth="7" />
      <path d={`M${sx} 0 L${sx - 10} 110 M150 0 L170 110`} stroke="#f6d27a" strokeWidth="3" fill="none" />
      <circle cx={px} cy="44" r="16" fill="rgba(60,130,255,0.18)" />
      <path d={`M${px} 56 C${px - 12} 42 ${px - 10} 30 ${px} 30 C${px + 10} 30 ${px + 12} 42 ${px} 56 Z`} fill="#e5384d" stroke="#fff" strokeWidth="2" />
      <circle cx={px} cy="38" r="4" fill="#fff" />
    </svg>
  )
}

/** The card part of a message (above the sung words). `shown` is how many of the words are sung so far. */
export function KindCard({
  kind,
  index,
  words,
  shown,
  title,
  artist,
  art,
  prev
}: {
  kind: DmKind
  index: number
  words: string[]
  shown: number
  title: string
  artist: string
  art: string | null
  prev: string
}): ReactNode {
  const fill = words.length ? shown / words.length : 0
  switch (kind) {
    case 'voice': {
      const secs = 4 + (hash(index) % 18)
      const left = Math.max(0, Math.round(secs * (1 - fill)))
      return (
        <div className="bk bk-voice">
          <span className="bk-voice__play" aria-hidden="true">
            ▶
          </span>
          <Wave index={index} fill={fill} />
          <small>0:{left.toString().padStart(2, '0')}</small>
        </div>
      )
    }
    case 'reply':
      return (
        <div className="bk bk-quote">
          <b>{NAMES[hash(index) % NAMES.length]}</b>
          <span>{prev || 'Voice message'}</span>
        </div>
      )
    case 'fwd':
      return <div className="bk bk-fwd">↪ Forwarded</div>
    case 'location': {
      const [place, street] = PLACES[hash(index) % PLACES.length]!
      return (
        <div className="bk bk-loc">
          <MapTile index={index} />
          <div>
            <b>{place}</b>
            <span>{street}</span>
            <em>Live location · 15 min</em>
          </div>
        </div>
      )
    }
    case 'poll': {
      const half = Math.ceil(words.length / 2)
      const a = words.slice(0, half).join(' ') || '…'
      const b = words.slice(half).join(' ') || 'Both'
      const pa = 38 + (hash(index) % 40)
      const on = shown > 0
      return (
        <div className="bk bk-poll">
          <small>📊 Poll · select one</small>
          <div className="bk-poll__opt">
            <i style={{ width: on ? `${pa}%` : '0%' }} />
            <span>{a}</span>
            <b>{on ? `${pa}%` : '0%'}</b>
          </div>
          <div className="bk-poll__opt">
            <i style={{ width: on ? `${100 - pa}%` : '0%' }} />
            <span>{b}</span>
            <b>{on ? `${100 - pa}%` : '0%'}</b>
          </div>
        </div>
      )
    }
    case 'sticker':
      return <Sticker index={index} />
    case 'contact': {
      const name = NAMES[hash(index + 2) % NAMES.length]!
      return (
        <div className="bk bk-contact">
          <div className="bk-contact__top">
            <span className="bk-contact__av">{initials(name)}</span>
            <div>
              <b>{name}</b>
              <span>+1 555-01{(10 + (hash(index) % 80)).toString()}</span>
            </div>
          </div>
          <div className="bk-contact__act">
            <span>Message</span>
            <span>Add contact</span>
          </div>
        </div>
      )
    }
    case 'photo':
      return (
        <div className="bk bk-photo">
          {art ? <img src={art} alt="" /> : <i />}
          <small>📷 Photo</small>
        </div>
      )
    case 'link':
      return (
        <div className="bk bk-link">
          {art ? <img src={art} alt="" /> : <i />}
          <div>
            <b>{title}</b>
            <span>{artist} · listen on music.example</span>
          </div>
        </div>
      )
    case 'gif':
      return (
        <div className="bk bk-gif" style={{ ['--h' as string]: `${hash(index) % 360}` }}>
          <i />
          <b>GIF</b>
        </div>
      )
    default:
      return null
  }
}

export function reactionsFor(kind: DmKind, index: number): string[] {
  if (kind === 'emoji') return [REACTS[hash(index) % REACTS.length]!, REACTS[hash(index + 5) % REACTS.length]!]
  if (hash(index + 9) % 5 === 0) return [REACTS[hash(index + 1) % REACTS.length]!]
  return []
}

export function emojiFor(index: number): string {
  return EMOJI[hash(index) % EMOJI.length]!
}
