import type { LyricStyle, Vibe } from './types'

/**
 * Where the card and the lyrics go in fullscreen (and with a video behind):
 *  side  card on the left, lyrics on the right (the classic arrangement)
 *  dock  the card becomes a slim bar along the bottom, the lyrics own the stage above it
 *  orb   a small floating pill in the corner, the lyrics fill the whole screen
 *  bar   controls live inside the bottom letterbox bar, the lyrics are subtitles above
 *  chat  one centred column like a messaging app, the controls are the message bar
 *  term  a framed sidebar next to a framed log, like two terminal panes
 */
export type LayoutArch = 'side' | 'dock' | 'orb' | 'bar' | 'chat' | 'term' | 'scene'

export interface VibeInfo {
  id: Vibe
  layout: LayoutArch
  /** how the lyrics are staged by default in this vibe */
  style: LyricStyle
  name: string
  tag: string
}

export const VIBES: readonly VibeInfo[] = [
  { id: 'none', layout: 'scene', style: 'classic', name: 'Artwork', tag: 'A gallery wall lit in the colours of the cover' },
  { id: 'neon', layout: 'scene', style: 'sign', name: 'Neon', tag: 'Rain alley, neon signs' },
  { id: 'chrome', layout: 'scene', style: 'liquid', name: 'Chrome', tag: 'Y2K liquid metal' },
  { id: 'dream', layout: 'scene', style: 'constellation', name: 'Dream', tag: 'Pastel star map' },
  { id: 'crt', layout: 'scene', style: 'log', name: 'Terminal', tag: 'tmux panes, a lyric log, a status bar' },
  { id: 'sticker', layout: 'scene', style: 'sticker', name: 'Stickers', tag: 'Die-cut pop' },
  { id: 'chat', layout: 'scene', style: 'chat', name: 'DM', tag: 'The song texts you' },
  { id: 'paper', layout: 'scene', style: 'note', name: 'Diary', tag: 'A cosy night corner, a polaroid, handwriting' },
  { id: 'journal', layout: 'scene', style: 'jot', name: 'Journal', tag: 'A ruled page, a taped polaroid, marker highlights' },
  { id: 'doodle', layout: 'scene', style: 'scrawl', name: 'Doodle', tag: 'Fat marker, bright shapes, scribbles that draw themselves' },
  { id: 'arcade', layout: 'scene', style: 'pixel', name: 'Arcade', tag: '8-bit cabinet' },
  { id: 'noir', layout: 'scene', style: 'subtitle', name: 'Cinema', tag: 'Subtitles in black & white' },
  { id: 'sunset', layout: 'scene', style: 'bloom', name: 'Sunset Drive', tag: 'Golden hour, warm glow' },
  { id: 'dusk', layout: 'scene', style: 'bloom', name: 'Dusk Ridge', tag: 'A star-filled sky over sunlit mountains' },
  { id: 'blocks', layout: 'scene', style: 'chatlog', name: 'Blocks', tag: 'A sandbox with a chat log' },
  { id: 'stadium', layout: 'scene', style: 'lowerthird', name: 'Stadium', tag: 'Live broadcast scoreboard' },
  { id: 'cassette', layout: 'scene', style: 'label', name: 'Cassette', tag: 'Tape deck, label-maker strips' },
  { id: 'trailer', layout: 'scene', style: 'title', name: 'Trailer', tag: 'Movie title cards' },
  { id: 'sketch', layout: 'scene', style: 'ink', name: 'Sketchbook', tag: 'Written by hand in ink and pencil' },
  { id: 'glitch', layout: 'scene', style: 'glitch', name: 'Glitch', tag: 'Signal lost: static, tears, colour split' },
  { id: 'comic', layout: 'scene', style: 'bubble', name: 'Pop Comic', tag: 'Halftone page, speech bubbles, POW' },
  { id: 'stencil', layout: 'scene', style: 'spray', name: 'Stencil', tag: 'Sprayed on a concrete wall' },
  { id: 'film', layout: 'scene', style: 'intertitle', name: 'Film Reel', tag: 'Running film stock, silent-film titles' },
  { id: 'filmstrip', layout: 'scene', style: 'intertitle', name: 'Film Strip', tag: 'The film advances frame by frame (draft B)' },
  { id: 'lock', layout: 'scene', style: 'lockscreen', name: 'Lock Screen', tag: 'Each line arrives as a notification' },
  { id: 'wallet', layout: 'scene', style: 'wallet', name: 'Wallet', tag: 'The song as a run of payments' },
  { id: 'route', layout: 'scene', style: 'route', name: 'Route', tag: 'A pin for every line on a map' },
  { id: 'editor', layout: 'scene', style: 'editor', name: 'Editor', tag: 'The lyric as code in an editor' },
  { id: 'metro', layout: 'scene', style: 'metro', name: 'Metro', tag: 'A transit line, a station per word' },
  { id: 'web', layout: 'scene', style: 'weave', name: 'Web', tag: 'Every line spun on a web' },
  { id: 'lens', layout: 'scene', style: 'bloom', name: 'Lens', tag: 'Words bulge through a glass lens' },
  { id: 'picto', layout: 'scene', style: 'picto', name: 'Picto', tag: 'A small icon beside the words that have one' },
  { id: 'wall', layout: 'scene', style: 'wall', name: 'Drift Wall', tag: 'Words land on a wall that drifts in 3D' },
  { id: 'flap', layout: 'scene', style: 'flap', name: 'Split-flap', tag: 'An airport board, every letter flips' }
]

export const ALL_VIBES: readonly Vibe[] = VIBES.map((v) => v.id)
export const vibeInfo = (id: Vibe): VibeInfo => VIBES.find((v) => v.id === id) ?? VIBES[0]!

/** The next (dir 1) or previous (dir -1) vibe inside the pool. An empty pool means every vibe. */
export function stepVibe(current: Vibe, pool: readonly Vibe[], dir: 1 | -1 = 1): Vibe {
  const list = pool.length ? pool : ALL_VIBES
  const i = list.indexOf(current)
  if (i < 0) return dir === 1 ? list[0]! : list[list.length - 1]!
  return list[(i + dir + list.length) % list.length]!
}

// ---------------------------------------------------------------------------------------------
// Smart pick: choose the vibe that suits a song from what we know about it (words, pace, age and the
// colours of the cover). Deterministic: the same song always gets the same vibe.

export interface SmartInput {
  title: string
  artists: string[]
  year?: number | null
  /** every line of the lyrics (empty when there are none) */
  lines: string[]
  /** timing of lines in ms, to measure how fast the song is sung */
  lineTimes?: number[]
  durationMs?: number
  /** cover colour: hue 0-360, saturation 0-1, lightness 0-1 */
  hue?: number
  sat?: number
  light?: number
}

const WORDS: Partial<Record<Vibe, { re: RegExp; why: string }>> = {
  neon: { re: /\b(night|nights|city|cities|lights?|neon|midnight|drive|driving|club|dance|dancing|electric|downtown|street|streets|fast|speed)\b/g, why: 'night-city words' },
  dream: { re: /\b(dream|dreams|dreaming|star|stars|moon|sky|skies|heaven|float|floating|sleep|cloud|clouds|ocean|sea|angel|wish|galaxy|universe|forever)\b/g, why: 'dreamy words' },
  chat: { re: /\b(call|called|calling|text|texted|phone|message|miss|missed|hey|baby|babe|tell|told|answer|reply|hello|dm|number)\b/g, why: 'talking-to-you words' },
  sticker: { re: /\b(party|fun|crazy|wild|yeah|hey|sweet|candy|sugar|cute|kiss|smile|happy|love|loving|pink|dance)\b/g, why: 'playful words' },
  paper: { re: /\b(letter|letters|write|wrote|writing|diary|memory|memories|remember|years|home|mother|mama|rain|paper|yesterday|childhood|old)\b/g, why: 'memory words' },
  crt: { re: /\b(code|machine|machines|digital|robot|system|wire|wires|signal|computer|screen|online|data|program|static|electric)\b/g, why: 'machine words' },
  arcade: { re: /\b(game|games|play|player|win|winner|level|score|fight|fighter|run|running|hero|fire|king|queen|power|champion|boss)\b/g, why: 'game-like words' },
  noir: { re: /\b(dark|darkness|shadow|shadows|cry|crying|alone|blood|black|cold|ghost|gone|die|dead|death|lonely|pain|smoke|rain)\b/g, why: 'dark, lonely words' },
  dusk: { re: /\b(stars?|starlight|night|midnight|moon|moonlight|mountains?|hills?|sky|skies|dusk|twilight|horizon|evening|dream|dreams|dreaming|shine|shining|light|lights|far|away|wish|wishes)\b/g, why: 'night-sky words' },
  sunset: { re: /\b(sun|sunset|summer|beach|palm|road|ride|driving|highway|city|miami|california|heat|gold|golden|paradise|cruise|cruising|money|cash)\b/g, why: 'sunset-drive words' },
  blocks: { re: /\b(build|building|mine|mining|craft|world|block|blocks|diamond|dig|island|kingdom|castle|adventure|explore|zombie|creeper)\b/g, why: 'adventure words' },
  stadium: { re: /\b(champion|champions|win|winner|victory|team|goal|crowd|stadium|game|score|play|player|fight|roar|legend|glory|title)\b/g, why: 'stadium words' },
  cassette: { re: /\b(tape|radio|vinyl|record|song|songs|rewind|play|memory|memories|old|yesterday|walkman|mixtape|nostalgia|stereo|volume)\b/g, why: 'retro words' },
  trailer: { re: /\b(war|fate|destiny|world|rise|fall|battle|hero|legend|empire|king|queen|storm|thunder|end|begin|beginning|forever|eternal)\b/g, why: 'epic words' },
  journal: { re: /\b(dear|today|yesterday|tomorrow|tonight|morning|remember|remembered|memory|memories|smile|smiled|heart|hearts|miss|missed|wrote|write|letter|dreamt|wish|wishes|hope|kiss|summer|home)\b/g, why: 'diary-page words' },
  doodle: { re: /\b(play|playing|fun|funny|crazy|wild|dance|dancing|jump|laugh|laughing|silly|color|colour|colors|paint|draw|drawing|sun|sunshine|star|stars|rainbow|cloud|clouds|party)\b/g, why: 'playful words' },
  sketch: { re: /\b(love|heart|hearts|eyes|eye|face|tears|cry|crying|tell|told|never|always|save|stay|leave|left|hold|miss|kiss|hand|hands|scared|afraid|feel|feelings)\b/g, why: 'raw, personal words' },
  glitch: { re: /\b(broken|break|breaking|static|noise|lost|crash|crashing|fall|falling|burn|burning|fire|scream|screaming|run|running|chaos|mess|wrong|numb|signal)\b/g, why: 'broken, noisy words' },
  comic: { re: /\b(boom|bang|pow|wow|crazy|wild|super|hero|power|fight|crash|jump|shout|loud|fire|thunder|yeah|hey|go|run)\b/g, why: 'loud, punchy words' },
  stencil: { re: /\b(street|streets|city|wall|walls|fight|rebel|rise|riot|noise|loud|fire|burn|young|wild|run|running|freedom|revolution|gang|block|hood|concrete|power)\b/g, why: 'street words' },
  lock: { re: /(phone|call|text|message|messages|night|alone|wait|waiting|miss|missing|late|tonight)/g, why: 'late-night words' },
  wallet: { re: /(money|pay|paid|cash|gold|rich|cost|price|bank|worth|spend|dollar|dollars|coin|coins)/g, why: 'money words' },
  route: { re: /(road|roads|map|lost|found|north|south|east|west|home|miles|far|travel|journey|way|walk|walking)/g, why: 'journey words' },
  editor: { re: /(code|machine|digital|system|data|loop|run|running|signal|binary|wire|robot)/g, why: 'machine words' },
  metro: { re: /(train|station|track|tracks|line|lines|city|move|moving|ride|riding|stop|stops|travel)/g, why: 'train words' },
  web: { re: /(web|thread|threads|spin|caught|trap|tangled|silk|spider|net|tie|bound)/g, why: 'web words' },
  lens: { re: /(eye|eyes|look|see|seeing|vision|focus|blur|glass|mirror|watch|watching)/g, why: 'seeing words' },
  picto: { re: /(moon|sun|star|stars|heart|fire|rain|love|light|sky|dream)/g, why: 'picture words' },
  wall: { re: /(wall|walls|stone|build|built|break|brick|door|doors|room|rooms|house)/g, why: 'wall words' },
  flap: { re: /(fly|flying|flight|gone|leave|leaving|goodbye|travel|airport|sky|plane|going)/g, why: 'departure words' },
  filmstrip: { re: /(film|movie|scene|camera|memory|memories|yesterday|old|golden|shadow|shadows|remember|years|time|story|once|reel)/g, why: 'film words' },
  film: { re: /\b(film|movie|scene|camera|memory|memories|yesterday|old|golden|lights?|shadow|shadows|summer|dance|dancing|remember|years|time|story|once)\b/g, why: 'cinematic, nostalgic words' },
  chrome: { re: /\b(future|shine|shiny|silver|chrome|gold|diamond|mirror|glass|crystal|space|rocket|baby|girl|boy|money)\b/g, why: 'shiny words' }
}

const count = (re: RegExp, text: string): number => (text.match(re) ?? []).length

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Score every vibe of the pool and return the best, with a short human reason ("night-city words"). */
export function pickVibe(input: SmartInput, pool: readonly Vibe[] = ALL_VIBES): { vibe: Vibe; why: string } {
  const list = (pool.length ? pool : ALL_VIBES).filter((v) => v !== 'none')
  const candidates: readonly Vibe[] = list.length ? list : (['neon'] as const)
  const text = input.lines.join(' ').toLowerCase()
  const nWords = Math.max(1, text.split(/\s+/).filter(Boolean).length)
  const score = new Map<Vibe, number>()
  const why = new Map<Vibe, string>()
  const strongest = new Map<Vibe, number>()
  /** add points to a vibe; the biggest single contribution becomes the reason we show */
  const add = (v: Vibe, n: number, reason: string): void => {
    if (n <= 0) return
    score.set(v, (score.get(v) ?? 0) + n)
    if (n > (strongest.get(v) ?? 0)) {
      strongest.set(v, n)
      why.set(v, reason)
    }
  }

  // 1 / the words
  for (const [v, rule] of Object.entries(WORDS) as Array<[Vibe, { re: RegExp; why: string }]>) {
    const hits = count(rule.re, text)
    add(v, Math.min(6, (hits / nWords) * 60 + Math.min(hits, 4) * 0.5), rule.why)
  }

  // 2 / pace: lines per minute and words per line
  const dur = (input.durationMs ?? 0) / 60000
  const lpm = dur > 0 ? input.lines.filter(Boolean).length / dur : 0
  const wpl = nWords / Math.max(1, input.lines.filter(Boolean).length)
  if (lpm > 30 || wpl > 7) {
    add('neon', 2, 'fast, packed lyrics')
    add('arcade', 1.5, 'fast, packed lyrics')
    add('chrome', 1.2, 'fast, packed lyrics')
  } else if (lpm > 0 && lpm < 16) {
    add('dream', 2, 'a slow, spacious song')
    add('noir', 1.4, 'a slow, spacious song')
    add('paper', 1.4, 'a slow, spacious song')
  }

  // 3 / age
  const y = input.year ?? 0
  if (y > 0 && y <= 2004) {
    add('chrome', 2.2, `a ${y} classic`)
    add('crt', 1.2, `a ${y} classic`)
  } else if (y >= 1970 && y <= 1989) {
    add('cassette', 2.2, `a ${y} song`)
    add('sunset', 1.4, `a ${y} song`)
  } else if (y >= 2005 && y <= 2012) {
    add('arcade', 1, 'late-2000s energy')
    add('chrome', 0.8, 'late-2000s energy')
  } else if (y >= 2020) {
    add('sticker', 0.9, 'a very recent song')
    add('chat', 0.9, 'a very recent song')
  }

  // 4 / the cover
  const { hue = -1, sat = -1, light = -1 } = input
  if (sat >= 0) {
    if (sat < 0.14) {
      add('noir', 2.6, 'a black-and-white cover')
      add('paper', 0.8, 'a quiet cover')
    }
    if (sat > 0.55 && light < 0.5) add('neon', 2, 'a bold, dark cover')
    if (light > 0.68 && sat < 0.6) {
      add('dream', 1.6, 'a soft pastel cover')
      add('paper', 1.4, 'a soft pastel cover')
    }
    if (hue >= 190 && hue <= 260 && sat > 0.25) {
      add('chat', 1.2, 'a blue cover')
      add('chrome', 1.2, 'a blue cover')
    }
    if ((hue >= 35 && hue <= 70) || hue >= 320) add('sticker', 1.2, 'a bright, warm cover')
    if (hue >= 80 && hue <= 160 && light < 0.45) add('crt', 1.4, 'a green cover')
  }

  // tiny deterministic tie-break so the same song always lands on the same vibe, but different songs spread out
  const seed = hash(`${input.title}|${input.artists.join(',')}`)
  let best: Vibe = candidates[seed % candidates.length]!
  let bestScore = -1
  candidates.forEach((v, i) => {
    const s = (score.get(v) ?? 0) + ((seed >>> (i % 12)) % 7) / 100
    if (s > bestScore) {
      bestScore = s
      best = v
    }
  })
  const reason = (score.get(best) ?? 0) > 0.6 ? (why.get(best) ?? 'a good match') : 'a surprise pick'
  return { vibe: best, why: reason }
}
