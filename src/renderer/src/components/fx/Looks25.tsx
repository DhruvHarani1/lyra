import { useMemo, type ReactNode } from 'react'

/** The video window host (same markup as VibeFx's SceneWindow; styles/scene.css positions it from the --sc-* variables). */
function SceneWin({ children }: { children?: ReactNode }) {
  return (
    <div className="scenewin">
      <div className="scenewin__art">
        <span>No video</span>
        <div className="scenewin__eq">
          {[0, 0.2, 0.1, 0.3, 0.15].map((d, i) => (
            <i key={i} style={{ animationDelay: `${d}s` }} />
          ))}
        </div>
      </div>
      {children}
    </div>
  )
}

/** Wallet: a stack of payment cards. Two cards peek from behind the video card, a running "lines paid" balance heads the activity. */
export function WalletFx() {
  return (
    <div className="wlfx">
      <i className="wlfx__card wlfx__card--a">
        <b>LYRA GOLD</b>
        <span>•••• 2208</span>
      </i>
      <i className="wlfx__card wlfx__card--b">
        <b>LYRA PAY</b>
        <span>•••• 0043</span>
      </i>
      <SceneWin>
        <i className="wlfx__chip" />
        <i className="wlfx__waves" />
      </SceneWin>
      <i className="wlfx__sheen" />
      <div className="wlfx__head">
        <small>LYRA PAY · ACTIVITY</small>
        <b className="wlfx__count" />
        <span>lines paid, in full</span>
      </div>
    </div>
  )
}

/** Route: a night map. Streets, a park and a river; the song is the route, a navigation banner on top, a bottom sheet holds the stops. */
export function RouteFx() {
  return (
    <div className="rtfx">
      <div className="rtfx__map" />
      <svg className="rtfx__svg" viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true">
        <path className="river" d="M-20 150 C 160 90 280 220 470 170 S 800 70 1020 130" />
        <path className="casing" d="M40 300 C 180 250 260 330 380 290 S 600 150 730 190 S 900 110 990 60" />
        <path className="road" d="M40 300 C 180 250 260 330 380 290 S 600 150 730 190 S 900 110 990 60" />
        <path className="done" pathLength={1} d="M40 300 C 180 250 260 330 380 290 S 600 150 730 190 S 900 110 990 60" />
      </svg>
      <i className="rtfx__pin rtfx__pin--a" />
      <i className="rtfx__pin rtfx__pin--b" />
      <div className="rtfx__sheet">
        <i className="rtfx__handle" />
        <small>UP NEXT · {'→'} every line is a stop</small>
      </div>
      <SceneWin>
        <span className="rtfx__tag">STREET VIEW</span>
      </SceneWin>
    </div>
  )
}

/** Editor: an IDE. Title bar, tabs, breadcrumb and a preview pane; the activity bar, minimap and progress line are the window edge. */
export function EditorFx() {
  return (
    <div className="edfx">
      <div className="edfx__title">
        <i />
        <i />
        <i />
        <span>lyrics.ts — Glass Hours — Lyra</span>
      </div>
      <div className="edfx__tabs">
        <span className="is-on">lyrics.ts</span>
        <span>notes.md</span>
      </div>
      <div className="edfx__crumb">src {'›'} lyrics {'›'} line</div>
      <div className="edfx__pane">
        <span>
          <b>▶</b> Preview — glass_hours.mp4
        </span>
      </div>
      <SceneWin />
    </div>
  )
}

/** Metro: a station platform. A line-diagram map behind, a platform sign on top, the video as a train window, the card as a ticket. */
export function MetroFx() {
  return (
    <div className="mtfx">
      <svg className="mtfx__map" viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <path d="M-20 470 H300 L400 370 H700 L800 470 H1020" stroke="#35c6ff" />
        <path d="M-20 250 H200 L300 150 H1020" stroke="#ff3b6b" />
        <path d="M640 -20 V120 L720 200 V580" stroke="#ffd23f" />
        {[
          [300, 470],
          [400, 370],
          [700, 370],
          [800, 470],
          [200, 250],
          [300, 150],
          [720, 150],
          [720, 330]
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="9" />
        ))}
      </svg>
      <div className="mtfx__sign">
        <i className="mtfx__badge">L</i>
        <b>LYRA LINE</b>
        <span>NOW BOARDING</span>
        <em />
      </div>
      <SceneWin>
        <i className="mtfx__glass" />
      </SceneWin>
      <i className="mtfx__rivet mtfx__rivet--a" />
      <i className="mtfx__rivet mtfx__rivet--b" />
    </div>
  )
}

/** Web: a corner web, the video a dewdrop hanging from a silk thread, a small spider that climbs it. */
export function WebFx() {
  const web = useMemo(() => {
    const spokes = Array.from({ length: 9 }, (_, i) => {
      const a = (i / 8) * (Math.PI / 2)
      return `M1000 0 L${(1000 - Math.cos(a) * 980).toFixed(1)} ${(Math.sin(a) * 980).toFixed(1)}`
    }).join(' ')
    const rings = Array.from({ length: 11 }, (_, r) => {
      const rad = 70 + r * 78
      return Array.from({ length: 9 }, (_, i) => {
        const a = (i / 8) * (Math.PI / 2)
        const sag = 0.95 + 0.04 * Math.sin(i * 2.1 + r)
        return `${i ? 'L' : 'M'}${(1000 - Math.cos(a) * rad * sag).toFixed(1)} ${(Math.sin(a) * rad * sag).toFixed(1)}`
      }).join(' ')
    }).join(' ')
    return spokes + ' ' + rings
  }, [])
  return (
    <div className="wbfx">
      <svg className="wbfx__web" viewBox="0 0 1000 560" preserveAspectRatio="xMaxYMin slice" aria-hidden="true">
        <path d={web} />
      </svg>
      <div className="wbfx__thread">
        <i className="wbfx__spider" />
      </div>
      <SceneWin />
      {[0, 1, 2, 3, 4].map((i) => (
        <i key={i} className={`wbfx__dew wbfx__dew--${i}`} />
      ))}
    </div>
  )
}
