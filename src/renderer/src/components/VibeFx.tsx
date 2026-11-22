import { useEffect, useMemo, useState } from 'react'
import { getPosition, usePlayer } from '@/store/player'
import { useEffectiveVibe } from '@/hooks/useVibe'
import { EditorFx, MetroFx, RouteFx, WalletFx, WebFx } from '@/components/fx/Looks25'
import { FlapFx, LensFx, PictoFx, WallFx } from './fx/FourFx'
import { SceneWindow } from './fx/SceneWindow'

const PALM = 'M50 300 C48 220 52 150 60 90 C40 100 18 96 0 80 C24 78 44 82 58 74 C52 52 36 40 14 36 C40 30 62 44 66 66 C74 46 92 34 112 34 C96 44 82 58 76 80 C96 84 116 82 140 70 C120 92 94 98 70 98 C62 150 58 220 62 300 Z'


/** Artwork: a gallery wall. The wall is the cover's colours, the video hangs as a framed print under a brass picture light. */
function NoneFx() {
  return (
    <div className="nonefx">
      <div className="nonefx__wall" />
      <div className="nonefx__lamp" />
      <SceneWindow />
      <div className="nonefx__frame" />
      <div className="nonefx__bar" />
      <div className="nonefx__floor" />
    </div>
  )
}

/** Chrome: liquid-metal blobs drift in the dark blue, a highlight runs around the screen edge, the video sits in a chrome bezel. */
function ChromeFx({ sparkles }: { sparkles: { x: number; y: number; s: number; d: number }[] }) {
  return (
    <div className="chromefx">
      <i className="chromefx__blob chromefx__blob--a" />
      <i className="chromefx__blob chromefx__blob--b" />
      <i className="chromefx__blob chromefx__blob--c" />
      {sparkles.map((p, i) => (
        <svg key={i} className="vibefx__spark" viewBox="-12 -12 24 24" style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, animationDelay: `${p.d}s` }}>
          <path d="M0 -11 C1 -3 3 -1 11 0 C3 1 1 3 0 11 C-1 3 -3 1 -11 0 C-3 -1 -1 -3 0 -11Z" />
        </svg>
      ))}
      <div className="chromefx__bezel" />
      <SceneWindow>
        <div className="chromefx__gloss" />
      </SceneWindow>
      <div className="chromefx__edge" />
    </div>
  )
}

/** Arcade: the video plays on a CRT in a cabinet, a score ticks with the song, marquee bulbs chase around the screen. */
function ArcadeFx() {
  const track = usePlayer((x) => x.snapshot?.track ?? null)
  const [t, setT] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setT(getPosition()), 1000)
    return () => clearInterval(id)
  }, [])
  const score = String(Math.floor(t / 1000) * 100).padStart(6, '0')
  const hi = String(Math.floor((track?.durationMs ?? 0) / 1000) * 100).padStart(6, '0')
  return (
    <div className="arcadefx">
      <div className="vibefx__stars" />
      <div className="vibefx__stars vibefx__stars--b" />
      <div className="arcadefx__hud">
        <span>1UP <b>{score}</b></span>
        <span className="arcadefx__coin">INSERT COIN</span>
        <span>HI <b>{hi}</b></span>
      </div>
      <SceneWindow>
        <div className="arcadefx__crt" />
      </SceneWindow>
      <div className="arcadefx__bulbs arcadefx__bulbs--t" />
      <div className="arcadefx__bulbs arcadefx__bulbs--r" />
      <div className="arcadefx__bulbs arcadefx__bulbs--b" />
      <div className="arcadefx__bulbs arcadefx__bulbs--l" />
    </div>
  )
}

/** Sunset Drive, fullscreen: golden hour. Warm haze and soft light rays, dust in the light, the video as a framed print. */
function GoldenHour() {
  const motes = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ left: (i * 41 + 7) % 100, bottom: (i * 29) % 60, size: 2 + (i % 3), dur: 14 + (i % 7) * 3, delay: -((i * 1.7) % 20) })), [])
  return (
    <div className="sunsetfx">
      <i className="sunsetfx__ray sunsetfx__ray--a" />
      <i className="sunsetfx__ray sunsetfx__ray--b" />
      <i className="sunsetfx__ray sunsetfx__ray--c" />
      <i className="sunsetfx__sun" />
      <div className="sunsetfx__hills" />
      {motes.map((m, i) => (
        <i key={i} className="sunsetfx__mote" style={{ left: `${m.left}%`, bottom: `${m.bottom}%`, width: m.size, height: m.size, animationDuration: `${m.dur}s`, animationDelay: `${m.delay}s` }} />
      ))}
      <SceneWindow>
        <div className="sunsetfx__glass" />
      </SceneWindow>
      <div className="sunsetfx__haze" />
    </div>
  )
}

/** Trailer, fullscreen: a letterboxed screen with a grade, light leaks, an anamorphic streak and film grain. */
function TrailerFx() {
  return (
    <div className="trailerfx">
      <SceneWindow>
        <div className="trailerfx__grade" />
        <i className="trailerfx__leak trailerfx__leak--a" />
        <i className="trailerfx__leak trailerfx__leak--b" />
      </SceneWindow>
      <div className="trailerfx__streak" />
      <div className="trailerfx__grain" />
    </div>
  )
}

/** Sketchbook, fullscreen: a notebook spread. A pencil frame draws itself, doodles sketch in and out, the video is a taped print. */
function SketchFx() {
  return (
    <div className="sketchfx">
      <div className="sketchfx__paper" />
      <div className="sketchfx__rules" />
      <div className="sketchfx__spine" />
      <svg className="sketchfx__frame" viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true">
        <rect x="14" y="14" width="972" height="532" rx="6" pathLength="1" />
        <rect x="20" y="19" width="962" height="524" rx="8" pathLength="1" />
      </svg>
      <svg className="sketchfx__doodle" viewBox="0 0 60 60" style={{ left: '3vw', bottom: '5vh', ['--d' as string]: '0s' }} aria-hidden="true">
        <path pathLength="1" className="red" d="M30 6 L36 24 L55 24 L40 35 L46 54 L30 42 L14 54 L20 35 L5 24 L24 24 Z" />
      </svg>
      <svg className="sketchfx__doodle" viewBox="0 0 90 40" style={{ left: '22vw', bottom: '4vh', width: '14vh', ['--d' as string]: '2s' }} aria-hidden="true">
        <path pathLength="1" d="M4 24 C24 8 46 36 70 18 M60 8 L74 18 L58 28" />
      </svg>
      <svg className="sketchfx__doodle" viewBox="0 0 60 60" style={{ left: '44vw', top: '4vh', ['--d' as string]: '4s' }} aria-hidden="true">
        <path pathLength="1" d="M30 30 C30 24 38 24 38 30 C38 40 22 40 22 28 C22 14 42 14 44 32 C46 50 14 52 12 28" />
      </svg>
      <svg className="sketchfx__doodle" viewBox="0 0 60 60" style={{ right: '3vw', bottom: '4vh', ['--d' as string]: '1s' }} aria-hidden="true">
        <path pathLength="1" className="red" d="M30 50 C6 34 8 14 22 14 C28 14 30 20 30 20 C30 20 32 14 38 14 C52 14 54 34 30 50 Z" />
      </svg>
      <svg className="sketchfx__doodle" viewBox="0 0 90 30" style={{ left: '30vw', top: '3.5vh', width: '16vh', ['--d' as string]: '6s' }} aria-hidden="true">
        <path pathLength="1" d="M4 16 C14 4 22 28 32 16 C42 4 50 28 60 16 C70 4 78 24 86 14" />
      </svg>
      <i className="sketchfx__tape sketchfx__tape--l" />
      <i className="sketchfx__tape sketchfx__tape--r" />
      <SceneWindow />
    </div>
  )
}

/** Glitch, fullscreen: a dying tape. Static crawls, a tracking bar rolls up, slices tear, the edges bleed red and cyan. */
function GlitchFx() {
  return (
    <div className="glitchfx">
      <div className="glitchfx__static" />
      <SceneWindow>
        <div className="glitchfx__glass" />
        <div className="glitchfx__slice" />
      </SceneWindow>
      <div className="glitchfx__scan" />
      <div className="glitchfx__track" />
      <div className="glitchfx__tear glitchfx__tear--a" />
      <div className="glitchfx__tear glitchfx__tear--b" />
      <div className="glitchfx__edge" />
      <div className="glitchfx__drop" />
    </div>
  )
}

/** Pop Comic, fullscreen: a printed page. A burst turns slowly, halftone dots, a panel with a caption box, starbursts in the corners. */
function ComicFx() {
  return (
    <div className="comicfx">
      <div className="comicfx__bg">
        <div className="comicfx__rays" />
        <div className="comicfx__dots" />
        <div className="comicfx__dots comicfx__dots--b" />
      </div>
      <SceneWindow />
      <div className="comicfx__caption">Now playing!</div>
      <div className="comicfx__pow comicfx__pow--a"><span>POW!</span></div>
      <div className="comicfx__pow comicfx__pow--b"><span>ZAP!</span></div>
      <div className="comicfx__pow comicfx__pow--c"><span>WOW!</span></div>
      <div className="comicfx__page" />
    </div>
  )
}

/** Stencil, fullscreen: a concrete street wall. Stains, a wheat-pasted poster for the video, paint running down from the top. */
function StencilFx() {
  const drips = useMemo(() => Array.from({ length: 9 }, (_, i) => ({ left: 6 + ((i * 11 + 7) % 90), h: 8 + ((i * 7) % 5) * 5, d: -((i * 1.9) % 16) })), [])
  return (
    <div className="stencilfx">
      <div className="stencilfx__concrete" />
      <i className="stencilfx__stain stencilfx__stain--a" />
      <i className="stencilfx__stain stencilfx__stain--b" />
      <SceneWindow>
        <div className="stencilfx__wrinkle" />
      </SceneWindow>
      {drips.map((p, i) => (
        <i key={i} className="stencilfx__drip" style={{ left: `${p.left}%`, ['--h' as string]: `${p.h}vh`, ['--d' as string]: `${p.d}s` }} />
      ))}
      <div className="stencilfx__vignette" />
    </div>
  )
}

/** Film Reel, fullscreen: a strip of film in a projector. Sprocket holes keep running, grain, dust, scratches, flicker, light leaks. */
function FilmFx() {
  return (
    <div className="filmfx">
      <div className="filmfx__leak filmfx__leak--a" />
      <div className="filmfx__leak filmfx__leak--b" />
      <div className="filmfx__strip">
        <div className="filmfx__holes filmfx__holes--t" />
        <div className="filmfx__holes filmfx__holes--b" />
        <div className="filmfx__frames" />
      </div>
      <SceneWindow>
        <div className="filmfx__gate" />
      </SceneWindow>
      <div className="filmfx__edge">KODAK SAFETY FILM · 5063 · 12A</div>
      <i className="filmfx__scratch filmfx__scratch--a" />
      <i className="filmfx__scratch filmfx__scratch--b" />
      <div className="filmfx__flicker" />
      <div className="filmfx__grain" />
    </div>
  )
}

/** Film Strip (draft B): the film moves. The strip advances one frame at a time, right to left, as the song plays. */
function FilmStripFx() {
  const duration = usePlayer((x) => x.snapshot?.track?.durationMs ?? 0)
  useEffect(() => {
    const root = document.documentElement
    const N = 5
    const tick = (): void => {
      const p = duration > 0 ? Math.min(0.999, getPosition() / duration) : 0
      root.style.setProperty('--film-k', String(Math.floor(p * N)))
    }
    tick()
    const id = setInterval(tick, 400)
    return () => {
      clearInterval(id)
      root.style.removeProperty('--film-k')
    }
  }, [duration])
  return (
    <div className="filmstripfx">
      <div className="filmstripfx__strip">
        <div className="filmstripfx__holes filmstripfx__holes--t" />
        <div className="filmstripfx__holes filmstripfx__holes--b" />
        <div className="filmstripfx__frames" />
      </div>
      <SceneWindow>
        <div className="filmstripfx__gate" />
      </SceneWindow>
      <div className="filmstripfx__edge">KODAK SAFETY FILM · 5063 · 12A</div>
      <div className="filmstripfx__grain" />
    </div>
  )
}

/** Dream, fullscreen: the video is a blurred dreamscape, soft orbs drift over it, an aurora glow breathes at the edge. */
function DreamFx() {
  const dust = useMemo(() => Array.from({ length: 18 }, (_, i) => ({ left: (i * 37 + 9) % 100, top: 30 + ((i * 23) % 65), dur: 9 + (i % 6) * 2, delay: -((i * 1.3) % 12) })), [])
  return (
    <div className="dreamfx">
      <i className="vibefx__orb vibefx__orb--a" />
      <i className="vibefx__orb vibefx__orb--b" />
      <i className="vibefx__orb vibefx__orb--c" />
      <SceneWindow />
      {dust.map((d, i) => (
        <i key={i} className="dreamfx__dust" style={{ left: `${d.left}%`, top: `${d.top}%`, animationDuration: `${d.dur}s`, animationDelay: `${d.delay}s` }} />
      ))}
      <div className="dreamfx__aurora" />
    </div>
  )
}

/** Terminal, fullscreen: tmux panes with titles, scanlines, a rolling bar, a curved-glass vignette, a blinking cursor. */
function TermFx() {
  return (
    <div className="termfx">
      <SceneWindow />
      <div className="termfx__pane termfx__pane--video" data-title="video.mp4" />
      <div className="termfx__pane termfx__pane--log" data-title="lyrics.log" />
      <div className="termfx__pane termfx__pane--eq" data-title="spectrum">
        <div className="termfx__bars">
          {Array.from({ length: 28 }, (_, i) => (
            <i key={i} style={{ ['--d' as string]: `${-((i * 0.37) % 1.4).toFixed(2)}s` }} />
          ))}
        </div>
      </div>
      <div className="termfx__cursor" />
      <div className="termfx__roll" />
      <div className="termfx__scan" />
      <div className="termfx__glass" />
    </div>
  )
}

/** Stickers, fullscreen: a sticker sheet. A dot grid, loose die-cut stickers drifting, a peeling corner on the video sticker. */
const STICKER_SHAPES = [
  { d: 'M50 6 L61 38 L95 38 L67 58 L78 92 L50 71 L22 92 L33 58 L5 38 L39 38 Z', fill: '#ffd84a' },
  { d: 'M50 88 C10 60 6 30 28 22 C40 18 48 26 50 32 C52 26 60 18 72 22 C94 30 90 60 50 88 Z', fill: '#ff6fb0' },
  { d: 'M50 10 A40 40 0 1 1 49.9 10 Z M34 40 A5 5 0 1 0 34 41 Z M66 40 A5 5 0 1 0 66 41 Z', fill: '#4de3ff' },
  { d: 'M20 80 L50 14 L80 80 Z', fill: '#c6ff3d' },
  { d: 'M12 50 C12 20 40 12 50 36 C60 12 88 20 88 50 C88 80 60 88 50 64 C40 88 12 80 12 50 Z', fill: '#b794ff' }
]
function StickerFx() {
  const loose = useMemo(
    () => Array.from({ length: 9 }, (_, i) => ({ shape: STICKER_SHAPES[i % STICKER_SHAPES.length]!, left: 44 + ((i * 53 + 5) % 48), top: 4 + ((i * 37 + 8) % 82), s: 6 + ((i * 5) % 7), d: -((i * 1.7) % 11), r0: -14 + ((i * 9) % 20), r1: 6 + ((i * 7) % 24) })),
    []
  )
  return (
    <div className="stickerfx">
      <div className="stickerfx__dots" />
      {loose.map((l, i) => (
        <svg key={i} className="stickerfx__loose" viewBox="0 0 100 100" style={{ left: `${l.left}%`, top: `${l.top}%`, ['--s' as string]: `${l.s}vh`, ['--d' as string]: `${l.d}s`, ['--r0' as string]: `${l.r0}deg`, ['--r1' as string]: `${l.r1}deg` }}>
          <path d={l.shape.d} fill={l.shape.fill} fillRule="evenodd" />
        </svg>
      ))}
      <div className="stickerfx__cut" />
      <SceneWindow />
      <div className="stickerfx__peel" />
    </div>
  )
}

/** DM, fullscreen: the video is a story in a slowly turning gradient ring, soft blue glows behind the thread. */
function DmFx() {
  return (
    <div className="dmfx">
      <i className="dmfx__glow dmfx__glow--a" />
      <i className="dmfx__glow dmfx__glow--b" />
      <SceneWindow />
      <div className="dmfx__ring" />
    </div>
  )
}

/** Diary, fullscreen: a cosy night corner. Fairy lights glow out of focus, a twine line with clothespins, a polaroid for the video. */
function DiaryFx() {
  const title = usePlayer((x) => x.snapshot?.track?.title ?? '')
  const bokeh = useMemo(() => Array.from({ length: 16 }, (_, i) => ({ left: 4 + ((i * 41 + 13) % 92), top: 1 + ((i * 17) % 22), s: 2.2 + ((i * 7) % 6) * 0.9, b: (i % 3) * 2 + 1, d: -((i * 0.7) % 4) })), [])
  return (
    <div className="diaryfx">
      {bokeh.map((b, i) => (
        <i key={i} className="diaryfx__bokeh" style={{ left: `${b.left}%`, top: `${b.top}%`, ['--s' as string]: `${b.s}vh`, ['--b' as string]: `${b.b}px`, ['--d' as string]: `${b.d}s` }} />
      ))}
      <svg className="diaryfx__twine" viewBox="0 0 1000 140" preserveAspectRatio="none" aria-hidden="true">
        <path d="M-10 30 C200 110 360 110 520 62 C680 14 820 110 1010 40" />
      </svg>
      <SceneWindow />
      <div className="diaryfx__polaroid" />
      <div className="diaryfx__caption">{title}</div>
    </div>
  )
}

/**
 * Dusk Ridge, fullscreen: twilight over mountains. A star field that twinkles out of step (a few bright ones with a flare, a shooting
 * star now and then), swinging rays from the low sun, three mountain ranges lit from the side by the setting sun (hazy far range,
 * gold-rimmed mid range, dark near range with sparks on its peaks), mist in the valleys and a glow behind the ridge.
 */
const DUSK_STARS = (() => {
  let s = 20261122
  const r = (): number => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  const cols = ['#ffffff', '#fff3d6', '#cfe0ff', '#ffd9a8', '#ffe9f2']
  return Array.from({ length: 78 }, (_, i) => {
    const big = i % 11 === 0
    return { left: r() * 100, top: r() * 100, s: big ? 3.2 + r() * 1.6 : 1.1 + r() * 1.7, c: cols[Math.floor(r() * cols.length)]!, d: 2.6 + r() * 4.4, w: -r() * 7, big }
  })
})()
function DuskFx() {
  const motes = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ left: 4 + ((i * 37) % 90), bottom: 4 + ((i * 53) % 34), size: 2 + (i % 3), dur: 12 + (i % 6) * 3, delay: -(i * 1.7) })), [])
  const FAR = 'M0 320 L0 190 L120 150 L230 185 L360 120 L470 170 L600 130 L740 180 L880 110 L1010 165 L1150 135 L1290 175 L1420 125 L1600 170'
  const MID = 'M0 320 L0 230 L90 210 L200 170 L310 215 L430 190 L560 235 L700 150 L830 220 L960 200 L1100 160 L1230 215 L1370 185 L1500 225 L1600 205'
  const NEAR = 'M0 320 L0 270 L140 250 L260 280 L400 240 L520 270 L660 255 L800 285 L940 245 L1080 275 L1220 250 L1360 280 L1480 255 L1600 275'
  const peaks: Array<[number, number]> = [[360, 120], [880, 110], [1420, 125], [700, 150], [1100, 160], [400, 240], [940, 245], [1220, 250]]
  return (
    <div className="duskfx">
      <div className="duskfx__stars">
        {DUSK_STARS.map((st, i) => (
          <i key={i} className={`duskfx__star${st.big ? ' duskfx__star--big' : ''}`} style={{ left: `${st.left}%`, top: `${st.top}%`, ['--s' as string]: `${st.s}px`, ['--c' as string]: st.c, ['--d' as string]: `${st.d}s`, ['--w' as string]: `${st.w}s` }} />
        ))}
        <i className="duskfx__shoot" />
        <i className="duskfx__shoot duskfx__shoot--b" />
      </div>
      <i className="duskfx__ray duskfx__ray--a" />
      <i className="duskfx__ray duskfx__ray--b" />
      <i className="duskfx__ray duskfx__ray--c" />
      <div className="duskfx__glow" />
      <svg className="duskfx__ridges" viewBox="0 0 1600 320" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="dusk-rim" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ffe2a8" />
            <stop offset="0.45" stopColor="#ff9f7a" />
            <stop offset="1" stopColor="#8d7ad9" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <path className="duskfx__far" d={`${FAR} L1600 320 Z`} />
        <path className="duskfx__rim duskfx__rim--far" d={FAR} />
        <path className="duskfx__mid" d={`${MID} L1600 320 Z`} />
        <path className="duskfx__rim" d={MID} />
        <path className="duskfx__near" d={`${NEAR} L1600 320 Z`} />
        {peaks.map(([x, y], i) => (
          <circle key={i} className="duskfx__spark" cx={x} cy={y} r="2.6" style={{ ['--w' as string]: `${-i * 0.7}s` }} />
        ))}
      </svg>
      <div className="duskfx__mist" />
      {motes.map((m, i) => (
        <i key={i} className="duskfx__mote" style={{ left: `${m.left}%`, bottom: `${m.bottom}%`, width: m.size, height: m.size, animationDuration: `${m.dur}s`, animationDelay: `${m.delay}s` }} />
      ))}
      <div className="duskfx__haze" />
    </div>
  )
}

/**
 * Journal, fullscreen: a page of a paper diary. Ruled lines and a rose margin with punched holes, a date stamp, the video as a
 * polaroid taped to the page with washi tape and a paper clip, a pressed flower, a heart sticker, a coffee ring and doodles that
 * draw themselves in and out. (The night-corner Diary is the other paper look; this one is bright, written by hand in blue-black ink
 * with a yellow highlighter.)
 */
function JournalFx() {
  const title = usePlayer((x) => x.snapshot?.track?.title ?? '')
  const stamp = useMemo(() => {
    const d = new Date()
    return `${d.toLocaleDateString('en', { weekday: 'short' })} · ${d.getDate()} ${d.toLocaleDateString('en', { month: 'short' })}`.toUpperCase()
  }, [])
  return (
    <div className="jfx">
      <div className="jfx__paper" />
      <div className="jfx__rules" />
      <div className="jfx__margin" />
      {[16, 50, 84].map((t) => (
        <i key={t} className="jfx__hole" style={{ top: `${t}%` }} />
      ))}
      <div className="jfx__stamp">{stamp}</div>
      <div className="jfx__coffee" />
      <svg className="jfx__doodle jfx__doodle--heart" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 41 C8 29 5 17 14 11 C19 8 23 11 24 15 C25 11 29 8 34 11 C43 17 40 29 24 41 Z" />
      </svg>
      <svg className="jfx__doodle jfx__doodle--star" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 5 L29 19 L44 19 L32 28 L36 43 L24 34 L12 43 L16 28 L4 19 L19 19 Z" />
      </svg>
      <svg className="jfx__doodle jfx__doodle--squig" viewBox="0 0 120 30" aria-hidden="true">
        <path d="M4 18 C14 4 22 4 30 18 S46 32 56 18 S74 4 84 18 S104 30 116 14" />
      </svg>
      <svg className="jfx__flower" viewBox="0 0 80 120" aria-hidden="true">
        <path className="stem" d="M40 118 C38 88 44 66 40 40" />
        <path className="leaf" d="M40 86 C26 84 18 74 16 62 C30 62 38 72 40 86 Z" />
        <path className="leaf" d="M41 70 C54 66 62 56 62 44 C50 46 42 56 41 70 Z" />
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} className="petal" cx="40" cy="20" rx="8" ry="15" transform={`rotate(${a} 40 32)`} />
        ))}
        <circle className="core" cx="40" cy="32" r="6" />
      </svg>
      <SceneWindow />
      <div className="jfx__polaroid" />
      <div className="jfx__caption">{title}</div>
      <i className="jfx__tape jfx__tape--l" />
      <i className="jfx__tape jfx__tape--r" />
      <i className="jfx__clip" />
      <i className="jfx__corner" />
    </div>
  )
}

/**
 * Doodle, fullscreen: a kid's drawing page. Off-white paper with a dot grid, fat black marker outlines, flat bright colour shapes
 * (sun, cloud, stars, spiral, arrows) that draw themselves in and out, the video in a wobbly hand-drawn frame with a colour offset
 * and arrows pointing at it. Words are marker lettering; the one being sung gets a hand-drawn circle.
 */
function DoodleFx() {
  return (
    <div className="dfx">
      <div className="dfx__dots" />
      <div className="dfx__frame" />
      <svg className="dfx__d dfx__sun" viewBox="0 0 100 100" aria-hidden="true">
        <circle className="fill" cx="50" cy="50" r="22" />
        <circle cx="50" cy="50" r="22" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <path key={a} d="M50 14 L50 24" transform={`rotate(${a} 50 50)`} />
        ))}
      </svg>
      <svg className="dfx__d dfx__cloud" viewBox="0 0 140 80" aria-hidden="true">
        <path className="fill" d="M30 64 C10 64 8 40 28 38 C26 18 54 12 62 30 C72 14 100 20 98 40 C122 38 126 64 104 64 Z" />
        <path d="M30 64 C10 64 8 40 28 38 C26 18 54 12 62 30 C72 14 100 20 98 40 C122 38 126 64 104 64 Z" />
      </svg>
      <svg className="dfx__d dfx__star dfx__star--a" viewBox="0 0 48 48" aria-hidden="true">
        <path className="fill" d="M24 4 L29 18 L44 18 L32 27 L37 42 L24 33 L11 42 L16 27 L4 18 L19 18 Z" />
        <path d="M24 4 L29 18 L44 18 L32 27 L37 42 L24 33 L11 42 L16 27 L4 18 L19 18 Z" />
      </svg>
      <svg className="dfx__d dfx__star dfx__star--b" viewBox="0 0 48 48" aria-hidden="true">
        <path className="fill" d="M24 4 L29 18 L44 18 L32 27 L37 42 L24 33 L11 42 L16 27 L4 18 L19 18 Z" />
        <path d="M24 4 L29 18 L44 18 L32 27 L37 42 L24 33 L11 42 L16 27 L4 18 L19 18 Z" />
      </svg>
      <svg className="dfx__d dfx__spiral" viewBox="0 0 80 80" aria-hidden="true">
        <path d="M40 40 C40 34 48 34 48 42 C48 54 30 54 30 40 C30 24 56 24 58 44 C60 66 26 68 22 42 C18 16 62 8 68 44" />
      </svg>
      <svg className="dfx__d dfx__arrow" viewBox="0 0 120 70" aria-hidden="true">
        <path d="M6 54 C30 60 70 50 100 20" />
        <path d="M82 18 L102 18 L98 40" />
      </svg>
      <svg className="dfx__d dfx__zig" viewBox="0 0 160 30" aria-hidden="true">
        <path d="M4 22 L24 6 L44 22 L64 6 L84 22 L104 6 L124 22 L144 6 L156 16" />
      </svg>
    </div>
  )
}

/** Cinema, fullscreen: a black-and-white screening. Venetian-blind light drifts, grain, a projector flicker, a beam with dust. */
function NoirFx() {
  const dust = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ left: 8 + ((i * 37 + 5) % 84), top: 30 + ((i * 19) % 62), dur: 8 + (i % 6) * 2, delay: -((i * 1.1) % 12) })), [])
  return (
    <div className="noirfx">
      <i className="noirfx__beam" />
      <SceneWindow />
      <div className="noirfx__blinds" />
      {dust.map((d, i) => (
        <i key={i} className="noirfx__dust" style={{ left: `${d.left}%`, top: `${d.top}%`, animationDuration: `${d.dur}s`, animationDelay: `${d.delay}s` }} />
      ))}
      <div className="noirfx__vignette" />
      <div className="noirfx__flicker" />
      <div className="noirfx__grain" />
    </div>
  )
}

/** Stadium, fullscreen: a night match. Floodlight beams sweep, the video is the jumbotron with an LED dot grid, a lamp row on its top. */
function StadiumFx() {
  return (
    <div className="stadiumfx">
      <i className="stadiumfx__beam stadiumfx__beam--a" />
      <i className="stadiumfx__beam stadiumfx__beam--b" />
      <div className="stadiumfx__turf" />
      <div className="stadiumfx__lamps" />
      <SceneWindow>
        <div className="stadiumfx__led" />
      </SceneWindow>
      <div className="stadiumfx__bar" />
    </div>
  )
}

/** Cassette, fullscreen: a tape deck on a wooden shelf. Warm light, a small TV for the video, a length of tape running along the bottom. */
function CassetteFx() {
  return (
    <div className="cassettefx">
      <div className="cassettefx__plate" />
      <i className="cassettefx__screw cassettefx__screw--a" />
      <i className="cassettefx__screw cassettefx__screw--b" />
      <i className="cassettefx__screw cassettefx__screw--c" />
      <i className="cassettefx__screw cassettefx__screw--d" />
      <div className="cassettefx__vu">
        <div className="cassettefx__dial"><i className="cassettefx__needle" /></div>
        <div className="cassettefx__dial cassettefx__dial--r"><i className="cassettefx__needle" /></div>
      </div>
      <div className="cassettefx__wood" />
      <div className="cassettefx__light" />
      <SceneWindow>
        <div className="cassettefx__glass" />
        <div className="cassettefx__scan" />
      </SceneWindow>
      <div className="cassettefx__tape" />
    </div>
  )
}

/** Blocks, fullscreen: a blocky sandbox. Square clouds drift, a grass-and-dirt ground, leaf blocks along the top edge. */
function BlocksFx() {
  return (
    <div className="blocksfx">
      <i className="blocksfx__cloud blocksfx__cloud--a" />
      <i className="blocksfx__cloud blocksfx__cloud--b" />
      <i className="blocksfx__cloud blocksfx__cloud--c" />
      <i className="blocksfx__sun" />
      <i className="blocksfx__torch blocksfx__torch--l" />
      <i className="blocksfx__torch blocksfx__torch--r" />
      <div className="blocksfx__ground" />
      <div className="blocksfx__leaves" />
      <SceneWindow />
    </div>
  )
}

/** The lock / lens / picto / wall / flap looks: a shared shell, each one adds its own few pieces. (wallet, route, editor, metro and web draw their own scene, components/fx/Looks25.tsx) */
const NEW_LOOKS = ['lock', 'lens', 'picto', 'wall', 'flap']
function NewLookFx({ vibe }: { vibe: string }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (vibe !== 'lock') return
    const id = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(id)
  }, [vibe])
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const date = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <div className="nvfx">
      {vibe === 'lock' && (
        <div className="nvfx__clock">
          <b>{hh}:{mm}</b>
          <span>{date}</span>
        </div>
      )}
      {vibe === 'lens' && <LensFx />}
      {vibe === 'picto' && <PictoFx />}
      {vibe === 'wall' && <WallFx />}
      {vibe === 'flap' && <FlapFx />}
      <SceneWindow />
    </div>
  )
}

/** Neon: a rainy alley. The wall, street and fog are the backdrop; this is what moves in front: rain, ripples, the window frame
 *  (the video plays inside it) and a passing car's light sweeping the wall. */
function NeonAlley() {
  const rain = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => {
        const far = i % 3 !== 0
        return {
          left: (i * 37) % 112,
          w: far ? 1 : 1.8,
          h: far ? 5 + (i % 4) : 9 + (i % 4),
          dur: far ? 0.9 + (i % 5) * 0.1 : 0.55 + (i % 4) * 0.07,
          delay: -((i * 0.13) % 2),
          o: far ? 0.18 + (i % 4) / 16 : 0.35 + (i % 3) / 9
        }
      }),
    []
  )
  const rings = useMemo(() => Array.from({ length: 8 }, (_, i) => ({ left: 6 + ((i * 41) % 84), bottom: 2 + ((i * 5) % 14), delay: (i * 0.57) % 2.8 })), [])
  const drops = useMemo(() => Array.from({ length: 7 }, (_, i) => ({ left: (i * 47 + 9) % 92, top: (i * 23) % 50, dur: 5 + (i % 4) * 1.4, delay: -(i * 1.3), s: 0.7 + (i % 3) * 0.4 })), [])
  return (
    <div className="neonfx">
      <div className="neonfx__sweep" />
      <SceneWindow>
        <div className="neonfx__glass" />
        {drops.map((d, i) => (
          <i key={i} className="neonfx__drop" style={{ left: `${d.left}%`, top: `${d.top}%`, animationDuration: `${d.dur}s`, animationDelay: `${d.delay}s`, scale: d.s }} />
        ))}
      </SceneWindow>
      {rings.map((r, i) => (
        <i key={i} className="neonfx__ring" style={{ left: `${r.left}%`, bottom: `${r.bottom}%`, animationDelay: `${r.delay}s` }} />
      ))}
      <div className="neonfx__rain">
        {rain.map((r, i) => (
          <i key={i} style={{ left: `${r.left}%`, width: r.w, height: `${r.h}vh`, animationDuration: `${r.dur}s`, animationDelay: `${r.delay}s`, opacity: r.o }} />
        ))}
      </div>
    </div>
  )
}

/** Background effects of the active vibe. Pure decoration: sits behind the content and never takes input. */
export function VibeFx() {
  const { vibe } = useEffectiveVibe()
  const sparkles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        x: (i * 37 + 11) % 100,
        y: (i * 53 + 7) % 100,
        s: 10 + ((i * 7) % 18),
        d: (i * 0.37) % 3
      })),
    []
  )
  if (vibe === 'none') return <NoneFx />
  return (
    <div className={`vibefx vibefx--${vibe}`} aria-hidden="true">
      <i className="vibeflash" key={vibe} />
      {vibe === 'arcade' && <ArcadeFx />}
      {vibe === 'sunset' && (
        <>
          <div className="vibefx__sunset-sun" />
          <svg className="vibefx__palm vibefx__palm--l" viewBox="0 0 140 300"><path d={PALM} /></svg>
          <svg className="vibefx__palm vibefx__palm--r" viewBox="0 0 140 300"><path d={PALM} /></svg>
          <div className="vibefx__road" />
          <div className="vibefx__radio"><i /><i /><i /><b>LYRA FM 98.7</b></div>
          <div className="vibefx__stars-hud">★★★<s>★★</s></div>
          <GoldenHour />
        </>
      )}
      {vibe === 'dusk' && <DuskFx />}
      {vibe === 'blocks' && <BlocksFx />}
      {vibe === 'stadium' && <StadiumFx />}
      {vibe === 'cassette' && <CassetteFx />}
      {vibe === 'trailer' && (
        <>
          <div className="vibefx__bar vibefx__bar--t" />
          <div className="vibefx__bar vibefx__bar--b" />
          <div className="vibefx__flare" />
          <TrailerFx />
        </>
      )}
      {vibe === 'noir' && <NoirFx />}
      {vibe === 'paper' && <DiaryFx />}
      {vibe === 'journal' && <JournalFx />}
      {vibe === 'doodle' && <DoodleFx />}
      {vibe === 'sketch' && <SketchFx />}
      {vibe === 'stencil' && <StencilFx />}
      {vibe === 'film' && <FilmFx />}
      {vibe === 'comic' && <ComicFx />}
      {vibe === 'glitch' && <GlitchFx />}
      {vibe === 'neon' && <NeonAlley />}
      {vibe === 'crt' && <TermFx />}
      {vibe === 'dream' && <DreamFx />}
      {vibe === 'filmstrip' && <FilmStripFx />}
      {vibe === 'chrome' && <ChromeFx sparkles={sparkles} />}
      {vibe === 'sticker' && <StickerFx />}
      {vibe === 'chat' && <DmFx />}
      {NEW_LOOKS.includes(vibe) && <NewLookFx vibe={vibe} />}
      {vibe === 'wallet' && <WalletFx />}
      {vibe === 'route' && <RouteFx />}
      {vibe === 'editor' && <EditorFx />}
      {vibe === 'metro' && <MetroFx />}
      {vibe === 'web' && <WebFx />}
    </div>
  )
}
