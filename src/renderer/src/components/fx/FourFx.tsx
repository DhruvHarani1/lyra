import { useEffect, useState } from 'react'
import { getPosition } from '@/store/player'

/** Lens: a camera viewfinder. Focus brackets and a hunting focus square around the video, REC + timecode, exposure scale whose marker follows the line (--lp). */
export function LensFx() {
  const [tc, setTc] = useState('00:00:00')
  useEffect(() => {
    const f = (): void => {
      const s = Math.max(0, Math.floor(getPosition() / 1000))
      setTc(`00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`)
    }
    f()
    const t = setInterval(f, 500)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="lnfx">
      <div className="lnfx__hud">
        <i className="lnfx__br lnfx__br--tl" />
        <i className="lnfx__br lnfx__br--tr" />
        <i className="lnfx__br lnfx__br--bl" />
        <i className="lnfx__br lnfx__br--br" />
        <div className="lnfx__rec"><i />REC <b>{tc}</b></div>
        <div className="lnfx__spec"><span>4K</span><span>30</span><em className="lnfx__bat"><i /></em></div>
        <div className="lnfx__af"><i /><i /><i /><i /></div>
        <div className="lnfx__grid"><i /><i /><i /><i /></div>
        <div className="lnfx__ev">
          <div className="lnfx__ticks">{Array.from({ length: 13 }, (_, i) => <i key={i} className={i % 6 === 0 ? 'is-big' : ''} />)}</div>
          <i className="lnfx__mark" />
          <span>−3</span><span>0</span><span>+3</span>
        </div>
        <div className="lnfx__exp"><span>f/1.8</span><span>1/60</span><span>ISO 400</span><span>AF‑C</span></div>
      </div>
    </div>
  )
}

/** Picto: a bento board. Tiles behind the video, the player and the words, an orange pictogram tile and live equaliser bars. */
export function PictoFx() {
  return (
    <div className="pcfx">
      <div className="pcfx__tile pcfx__tile--icon">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="11" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <path key={a} d="M32 7 V15" transform={`rotate(${a} 32 32)`} />
          ))}
        </svg>
      </div>
      <div className="pcfx__tile pcfx__tile--player">
        <span className="pcfx__label">Now playing</span>
        <div className="pcfx__eq">
          {Array.from({ length: 14 }, (_, i) => <i key={i} style={{ animationDelay: `-${(i * 0.13) % 1.1}s` }} />)}
        </div>
      </div>
      <div className="pcfx__tile pcfx__tile--words" />
      <i className="pcfx__dot pcfx__dot--a" />
      <i className="pcfx__dot pcfx__dot--b" />
      <i className="pcfx__dot pcfx__dot--c" />
    </div>
  )
}

/** Drift Wall: rows of colour slabs sliding past each other behind the words. */
export function WallFx() {
  return (
    <div className="wafx">
      {[0, 1, 2, 3].map((r) => (
        <div key={r} className={`wafx__row wafx__row--${r}`}>
          <i />
        </div>
      ))}
      <span className="wafx__tag">Drift wall · No. 07</span>
    </div>
  )
}

/** Split-flap: the departures board header and rules, a gate-camera caption, and a row of flap tiles along the bottom that flips open with the line. */
export function FlapFx() {
  return (
    <div className="flfx">
      <div className="flfx__head">
        <b>Departures</b>
        <span>Time</span>
        <span>Gate</span>
        <span>Remarks</span>
      </div>
      <div className="flfx__rules"><i /><i /><i /></div>
      <div className="flfx__cam">Gate 4 · camera <em>On time</em></div>
      <div className="flfx__edge">
        {Array.from({ length: 40 }, (_, k) => (
          <i key={k} style={{ ['--k' as string]: k }} />
        ))}
      </div>
    </div>
  )
}
