import { useEffect, useRef, useState } from 'react'
import { LOCAL_SHORTCUTS } from '@shared/shortcuts'
import type { Settings, SourceHealth, YoutubeVideo } from '@shared/types'
import { useBackgroundVersion } from '@/hooks/useBackground'
import { usePlayer } from '@/store/player'
import { ShortcutEditor } from './ShortcutEditor'
import { UpdateRow } from './UpdateRow'
import { AndroidUpdateRow } from './AndroidUpdateRow'
import { useSettings } from '@/store/settings'
import { roomLink, useRoom } from '@/store/room'
import { useJam } from '@/store/jam'
import { DevicesPanel } from './DevicesPanel'
import QRCode from 'qrcode'
import { VIBES } from '@shared/vibes'
import { useUi } from '@/store/ui'
import { CarModeRow } from '@/components/CarMode'
import { setLanguage, useTranslation, type Language } from '@/i18n'

/** Copy text and tell the user it worked (or didn't). */
async function copyWithToast(text: string, what: string): Promise<void> {
  let ok = false
  try {
    ok = await window.lyra.app.copy(text)
  } catch {
    ok = false
  }
  if (!ok) {
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      ok = false
    }
  }
  useUi.getState().toast(ok ? `${what} copied` : 'Couldn’t copy. Select the link and copy it by hand', ok ? undefined : 'error')
}

function RoomPanel() {
  const { t } = useTranslation()
  const { code, guests, state, error, start, stop } = useRoom()
  const [qr, setQr] = useState<string | null>(null)
  const link = code ? roomLink(code) : ''
  useEffect(() => {
    if (!link) return setQr(null)
    void QRCode.toDataURL(link, { margin: 1, width: 240, color: { dark: '#0a0a0a', light: '#ffffff' } }).then(setQr)
  }, [link])
  return (
    <>
      <Row label={t('Host a room')} hint={t('Share a link: friends open it in any browser and see your synced lyrics live. Friends with Lyra can also join to listen in sync with you')}>
        {state === 'idle' || state === 'error' ? (
          <button
            type="button"
            className="pill"
            onClick={() => {
              useJam.getState().leave()
              start()
            }}
          >
            {t('Start a room')}
          </button>
        ) : (
          <button type="button" className="pill" onClick={stop}>
            {t('Stop room')}
          </button>
        )}
      </Row>
      {error && <p className="hint">{error}</p>}
      {state === 'starting' && <p className="hint">{t('Opening the room…')}</p>}
      {state === 'live' && code && (
        <div className="tvlink">
          {qr && <img src={qr} width={150} height={150} alt="QR code for the room link" />}
          <div>
            <p className="hint">
              {t('Room')} <b>{code}</b> · {guests} {t(guests === 1 ? 'person' : 'people')} {t('watching. Guests connect straight to this device, so they can see its network address. Stop the room any time.')}
            </p>
            <code onClick={(e) => window.getSelection()?.selectAllChildren(e.currentTarget)}>{link}</code>
            <button type="button" className="pill" onClick={() => void copyWithToast(link, t('Room link'))}>
              {t('Copy link')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/** Join someone else's room from inside Lyra and listen in sync. */
function JamPanel() {
  const { t } = useTranslation()
  const { status, message, host, needSong, syncing, syncOn, setSync, join, leave } = useJam()
  const [text, setText] = useState('')
  const active = status === 'joining' || status === 'connected'
  return (
    <>
      <Row label={t('Join a room')} hint={t('Paste a room link or code. Everyone plays the same song in their own Spotify; Lyra keeps your play, pause and position in step with the host')}>
        {active ? (
          <button type="button" className="pill" onClick={leave}>
            {t('Leave room')}
          </button>
        ) : null}
      </Row>
      {!active && (
        <form
          className="joinrow"
          onSubmit={(e) => {
            e.preventDefault()
            useRoom.getState().stop()
            join(text)
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Room link or code')} aria-label={t('Room link or code')} spellCheck={false} />
          <button type="submit" className="pill" disabled={!text.trim()}>
            {t('Join')}
          </button>
        </form>
      )}
      {message && <p className="hint">{message}</p>}
      {status === 'joining' && <p className="hint">{t('Joining…')}</p>}
      {status === 'connected' && (
        <div className="jam">
          <p className="hint">
            In the room · {host?.trackId ? <b>{host.title}</b> : t('the host is not playing yet')}
            {host?.trackId ? ` · ${host.artists} · ${t(host.playing ? 'playing' : 'paused')}` : ''}
          </p>
          {needSong && (
            <p className="hint">
              {t('Play {title} by {artists} in your player.', { title: needSong.title, artists: needSong.artists })}{' '}
              <a href={`https://open.spotify.com/search/${encodeURIComponent(`${needSong.title} ${needSong.artists}`)}`} target="_blank" rel="noreferrer">
                {t('Find it in Spotify')}
              </a>
            </p>
          )}
          {!needSong && host?.trackId && <p className="hint">{syncOn ? (syncing ? t('Syncing with the host…') : t('In sync ✓')) : t('Sync is off: you are playing on your own.')}</p>}
          <Row label={t('Keep my player in sync')} hint={t("Matches the host's play, pause and position")}>
            <Toggle label={t('Keep my player in sync')} checked={syncOn} onChange={setSync} />
          </Row>
        </div>
      )}
    </>
  )
}

/** Hosting and joining live side by side so it is obvious what each one does. */
function RoomHub() {
  const { t } = useTranslation()
  const roomState = useRoom((r) => r.state)
  const jamStatus = useJam((j) => j.status)
  const [mode, setMode] = useState<'host' | 'join'>(jamStatus === 'idle' ? 'host' : 'join')
  const shown = roomState === 'live' || roomState === 'starting' ? 'host' : jamStatus === 'connected' || jamStatus === 'joining' ? 'join' : mode
  return (
    <>
      <Segmented<'host' | 'join'>
        label={t('Room role')}
        value={shown}
        onChange={setMode}
        options={[
          { v: 'host', label: t('Host a room') },
          { v: 'join', label: t('Join a room') }
        ]}
      />
      {shown === 'host' ? <RoomPanel /> : <JamPanel />}
    </>
  )
}

/** Storage: forget what Lyra looked up online (lyrics, videos). Your own picks, pasted lyrics and files stay. */
function StorageRow() {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const clear = (): void => {
    setBusy(true)
    window.lyra.cache
      .clear()
      .then((r) => useUi.getState().toast(r.cleared > 0 ? t('Cleared {n} saved lookups', { n: String(r.cleared) }) : t('The cache was already empty')))
      .catch(() => useUi.getState().toast(t('Couldn’t clear the cache'), 'error'))
      .finally(() => setBusy(false))
  }
  return (
    <Row label={t('Storage')} hint={t('Forget saved lyrics and video lookups. Your own picks and files stay.')}>
      <button type="button" className="pill" disabled={busy} onClick={clear}>
        {t('Clear cache')}
      </button>
    </Row>
  )
}

function Row({ label, hint, info, children }: { label: string; hint?: string; info?: string; children: React.ReactNode }) {
  return (
    <div className="srow">
      <div className="srow__label">
        <span>
          {label}
          {info && (
            <i className="info" tabIndex={0} role="note" aria-label={info} data-tip={info}>
              i
            </i>
          )}
        </span>
        {hint && <small>{hint}</small>}
      </div>
      <div className="srow__ctl">{children}</div>
    </div>
  )
}

/** Is each lyrics service working? A problem is never a mystery: it says what and when Lyra tries again. */
function SourceHealthList() {
  const [items, setItems] = useState<SourceHealth[] | null>(null)
  useEffect(() => {
    let live = true
    const load = (): void => void window.lyra.lyrics.health().then((h) => live && setItems(h)).catch(() => undefined)
    load()
    const id = setInterval(load, 4000)
    return () => {
      live = false
      clearInterval(id)
    }
  }, [])
  if (!items) return null
  return (
    <div className="health" role="list" aria-label="Lyrics services">
      {items.map((h) => (
        <div key={h.id} className="health__row" data-state={h.state} role="listitem" title={h.lastError || undefined}>
          <i className="health__dot" />
          <span>{h.name}</span>
          <small>{h.state === 'ok' ? 'working' : h.state === 'slow' ? 'checking…' : `resting, back in ${h.retryInSec}s`}</small>
        </div>
      ))}
    </div>
  )
}

/** Rarely needed options, folded away so the page stays short. */
function More({ children, label = 'More options' }: { children: React.ReactNode; label?: string }) {
  return (
    <details className="more">
      <summary>{label}</summary>
      {children}
    </details>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)}>
      <i />
    </button>
  )
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ v: T; label: string }>; onChange(v: T): void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o, index) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          // roving focus: the chosen option is the tab stop (the first one when none matches, so the group is never unreachable)
          tabIndex={value === o.v || (index === 0 && !options.some((x) => x.v === value)) ? 0 : -1}
          className={value === o.v ? 'is-on' : ''}
          onClick={() => onChange(o.v)}
          onKeyDown={(e) => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return
            e.preventDefault()
            const nextIndex =
              e.key === 'Home'
                ? 0
                : e.key === 'End'
                  ? options.length - 1
                  : (index + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
            const next = options[nextIndex]!
            onChange(next.v)
            e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus()
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Slider({ value, min, max, step, onChange, label, format }: { value: number; min: number; max: number; step: number; onChange(v: number): void; label: string; format(v: number): string }) {
  return (
    <div className="sl">
      <input
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        style={{ ['--fill' as string]: `${((value - min) / (max - min)) * 100}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output>{format(value)}</output>
    </div>
  )
}

function ResetButton() {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      type="button"
      className={`pill ${armed ? 'pill--danger' : ''}`}
      onClick={() => {
        if (!armed) return setArmed(true)
        setArmed(false)
        void window.lyra.settings
          .reset()
          .then(() => useUi.getState().toast('Settings reset to defaults'))
          .catch(() => useUi.getState().toast('Couldn’t reset settings', 'error'))
      }}
    >
      {armed ? 'Click again to confirm' : 'Reset settings'}
    </button>
  )
}

function BackgroundSection() {
  const s = useSettings((x) => x.settings)
  const set = useSettings((x) => x.set)
  const track = usePlayer((x) => x.snapshot?.track ?? null)
  const bump = useBackgroundVersion((x) => x.bump)
  const toast = useUi((x) => x.toast)
  const [hasKey, setHasKey] = useState(false)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [cands, setCands] = useState<YoutubeVideo[] | null>(null)
  const videoOn = s.backgroundStyle !== 'still'
  const motionBlocked = s.reducedMotion === 'on' || (s.reducedMotion === 'system' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    void window.lyra.background.hasYoutubeKey().then(setHasKey)
  }, [])

  const run = async (fn: () => Promise<{ ok: boolean; error?: string } | void>): Promise<void> => {
    setBusy(true)
    setMsg(null)
    try {
      const r = await fn()
      if (r && !r.ok && r.error) setMsg(r.error)
      bump()
    } catch {
      setMsg('Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h4>Background</h4>
      <Row
        label="Video behind the lyrics"
        info="Plays a looping video behind the lyrics in cinematic mode. Lyra tries, in order: your own file, a free 30 s official clip from Apple, YouTube (only if you add a key), then animated cover art. Off = plain blurred cover."
        hint="The music video when Lyra can find one"
      >
        <Toggle label="Video behind the lyrics" checked={videoOn} onChange={(v) => set({ backgroundStyle: v ? 'auto' : 'still' })} />
      </Row>
      {videoOn && motionBlocked && (
        <Row label="Reduce motion is on" hint="Videos can't play while it's on">
          <button type="button" className="pill" onClick={() => set({ reducedMotion: 'off' })}>
            Turn it off
          </button>
        </Row>
      )}
      {videoOn && (
        <>
      <Row label="Darken the video" hint="Keeps the lyrics easy to read">
        <Slider label="Background dim" value={s.backgroundDim} min={0.2} max={0.9} step={0.02} onChange={(v) => set({ backgroundDim: v })} format={(v) => `${Math.round(v * 100)}%`} />
      </Row>
      <Row label="Your own video or picture" info="Pick a GIF, image, MP4 or WebM to use behind every song. A copy is stored in Lyra's folder and never uploaded." hint={s.customBackground ? `${s.customBackground.name} · for every song` : 'GIF, picture, MP4 or WebM, for every song'}>
        <button type="button" className="pill" disabled={busy} onClick={() => void run(() => window.lyra.background.pick('global'))}>
          {s.customBackground ? 'Change' : 'Choose'}
        </button>
        {s.customBackground && (
          <button type="button" className="pill" disabled={busy} onClick={() => void run(() => window.lyra.background.clear('global'))}>
            Remove
          </button>
        )}
      </Row>
      <Row label="Own video for this song" info="Pick a file used only for the song that is playing now. It beats every other background." hint={track ? `${track.title}: a file just for this track` : 'Play a song first'}>
        <button type="button" className="pill" disabled={busy || !track} onClick={() => track && void run(() => window.lyra.background.pick('song', track.id))}>
          Choose
        </button>
        <button type="button" className="pill" disabled={busy || !track} onClick={() => track && void run(() => window.lyra.background.clear('song', track.id))}>
          Remove
        </button>
      </Row>
      <Row label="YouTube key" info="Optional. A free YouTube Data API v3 key (Google Cloud Console) lets Lyra find the official music video and play it muted. The key is encrypted on this PC. Without it, Lyra uses Apple clips or animated art." hint={hasKey ? 'Saved (encrypted). Full videos play muted' : 'Optional: paste a free YouTube Data API v3 key for full videos'}>
        {hasKey ? (
          <button
            type="button"
            className="pill"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await window.lyra.background.clearYoutubeKey()
                setHasKey(false)
                toast('YouTube key removed')
              })
            }
          >
            Remove key
          </button>
        ) : (
          <>
            <input className="field" type="password" autoComplete="off" spellCheck={false} placeholder="API key" value={key} onChange={(e) => setKey(e.target.value)} style={{ width: 150 }} />
            <button
              type="button"
              className="pill"
              disabled={busy || key.trim().length < 20}
              onClick={() =>
                void run(async () => {
                  const r = await window.lyra.background.setYoutubeKey(key)
                  if (r.ok) {
                    setHasKey(true)
                    setKey('')
                    toast('YouTube key saved')
                  }
                  return r
                })
              }
            >
              Save
            </button>
          </>
        )}
      </Row>
      {hasKey && track && (
        <Row label="Wrong video?" info="Lyra guesses the official video by title, artist and length. If it picked wrong, choose another here for this song." hint="Pick another for this song">
          <button
            type="button"
            className="pill"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const r = await window.lyra.background.youtubeCandidates(track)
                setCands(r.items)
                if (r.error) return { ok: false, error: r.error }
              })
            }
          >
            Show options
          </button>
        </Row>
      )}
      {cands && track && (
        <div className="srow srow--actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          {cands.length === 0 && <small>No embeddable videos found.</small>}
          {cands.map((c) => (
            <button
              key={c.videoId}
              type="button"
              className="pill"
              style={{ textAlign: 'left', whiteSpace: 'normal' }}
              onClick={() =>
                void run(async () => {
                  await window.lyra.background.youtubeChoose(track.id, c.videoId)
                  setCands(null)
                })
              }
            >
              {c.title} · {c.channel}
            </button>
          ))}
          <button
            type="button"
            className="pill"
            onClick={() =>
              void run(async () => {
                await window.lyra.background.youtubeChoose(track.id, null)
                setCands(null)
              })
            }
          >
            Use automatic pick
          </button>
        </div>
      )}
        </>
      )}
      {msg && (
        <small role="alert" style={{ color: 'var(--danger, #ff8a8a)' }}>
          {msg}
        </small>
      )}
      <small style={{ opacity: 0.7, display: 'block', paddingTop: 6 }}>
        Without a key Lyra plays a free 30-second clip from Apple when there is one, or a moving version of the cover. Finding a video sends the song title and artist to Apple or Google.
      </small>
      <More>
      <Row label="Auto dim" info="Lets Lyra darken bright scenes and ease off on dark ones, using the dim level above as the starting point, so lyrics stay readable without a dull picture.">
          <Toggle label="Auto dim" checked={s.autoDim} onChange={(v) => set({ autoDim: v })} />
        </Row>
      {document.documentElement.dataset.platform !== 'android' && (
        <Row label="Wait a moment for lyrics" info="When a song starts and neither its lyrics nor its video are ready, Lyra can pause the music for up to 1.5 seconds so you don't miss the start. It only does this when the first line is more than 5 seconds into the song, never after you pause or skip within a song, and it is off unless you turn it on.">
          <Toggle label="Wait a moment for lyrics" checked={s.startGate} onChange={(v) => set({ startGate: v })} />
        </Row>
      )}
      {document.documentElement.dataset.platform !== 'android' && (
        <Row label="Also in the expanded player" info="Show the video in the expanded player too, not only in fullscreen. Uses a little more CPU/GPU.">
          <Toggle label="Video in the expanded player" checked={s.backgroundInMini} onChange={(v) => set({ backgroundInMini: v })} />
        </Row>
      )}
      </More>
    </section>
  )
}

/** Android only: keep the screen on / keep Lyra from being closed while you listen. */
function PhoneSection() {
  const { t } = useTranslation()
  const s = useSettings((x) => x.settings)
  const set = useSettings((x) => x.set)
  const toast = useUi((x) => x.toast)
  const [overlay, setOverlay] = useState(false)
  useEffect(() => {
    void window.lyra.android?.overlayState().then((st) => setOverlay(st.enabled && st.canDraw))
  }, [])
  const [lyricsNote, setLyricsNote] = useState({ enabled: false, public: true })
  useEffect(() => {
    void window.lyra.android?.lyricsNotification().then(setLyricsNote)
  }, [])
  const changeLyricsNote = async (next: { enabled: boolean; public: boolean }): Promise<void> => {
    setLyricsNote(next)
    await window.lyra.android?.setLyricsNotification(next.enabled, next.public)
  }
  const toggleOverlay = async (on: boolean): Promise<void> => {
    const r = await window.lyra.android?.setOverlay(on)
    if (r?.needsPermission) toast('Turn on “Display over other apps” for Lyra, then come back and switch this on again.')
    else setOverlay(on)
  }
  return (
    <section>
      <h4>Phone</h4>
      <Row label="Keep screen on while playing" info="Stops the screen from turning off while a song is playing and Lyra is open, so the lyrics stay visible. Uses more battery." hint="Only while music plays">
        <Toggle label="Keep screen on while playing" checked={s.keepScreenOn} onChange={(v) => set({ keepScreenOn: v })} />
      </Row>
      <Row label="Keep Lyra running" info="Runs a small background service (with one quiet notification) so Android doesn’t close Lyra while you listen. Turn it off any time." hint="Shows a notification">
        <Toggle label="Keep Lyra running" checked={s.keepRunning} onChange={(v) => set({ keepRunning: v })} />
      </Row>
      <Row label="Lyrics notification" info="One quiet notification with the current line, the next lines, the cover and play controls. It appears in the notification shade and on the lock screen; tap it to open Lyra over the lock screen without unlocking." hint="Shade and lock screen">
        <Toggle label="Lyrics notification" checked={lyricsNote.enabled} onChange={(v) => void changeLyricsNote({ ...lyricsNote, enabled: v })} />
      </Row>
      {lyricsNote.enabled && (
        <Row label="Show lyrics on lock screen" info="When off, the lock screen only says “Lyrics are on” and hides the lines until you unlock. Turn it off if you don’t want people nearby to read what you listen to." hint="Visible to anyone who sees the screen">
          <Toggle label="Show lyrics on lock screen" checked={lyricsNote.public} onChange={(v) => void changeLyricsNote({ ...lyricsNote, public: v })} />
        </Row>
      )}
      <Row label="Ambient style" info="Minimal: pure black with dim lyrics, drawn natively (lightest on battery; tap or put the phone in a pocket to leave). Glow: the cover’s colours as a very dim moving glow. Video: the music video (or your own) played very dim. All keep the screen at minimum brightness.">
        <Segmented
          label="Ambient style"
          value={s.ambientStyle}
          onChange={(v) => set({ ambientStyle: v })}
          options={[
            { v: 'minimal', label: 'Minimal' },
            { v: 'glow', label: 'Glow' },
            { v: 'video', label: 'Video' }
          ]}
        />
      </Row>
      <Row label="Auto brightness" info="Uses the phone’s light sensor: ambient mode is very dim in a dark room and a little brighter in daylight. The brightness slider below is still what you set: Auto just lowers it a little in a dark room." hint="Follows the room light">
        <Toggle label="Auto brightness" checked={s.ambientAutoBrightness} onChange={(v) => set({ ambientAutoBrightness: v })} />
      </Row>
      <Row label="Ambient brightness" info="How bright the phone screen is in ambient mode. Keep it low for the bedside and to save battery. You can also change it on the ambient screen itself: touch it once.">
        <Slider label="Ambient brightness" value={s.ambientBrightness} min={0.04} max={0.6} step={0.01} onChange={(v) => set({ ambientBrightness: v })} format={(v) => `${Math.round(v * 100)}%`} />
      </Row>
      <Row label="Ambient screen" info="A very dim lyrics screen for your desk or bedside, like an always-on display. It uses minimum brightness and slowly shifts so an OLED screen isn’t worn. Touching the screen does nothing: switch it off with the same button, the Quick Settings tile, the home-screen widget or Back. You can also pick Lyra under Settings → Display → Screen saver so it appears by itself while charging." hint="On / off">
        <button type="button" className="pill" onClick={() => void window.lyra.android?.toggleAmbient()}>
          Switch on / off
        </button>
      </Row>
      <Row label="Ambient shortcuts" info="Add the Lyra ambient tile to Quick Settings for a one-tap switch. For the home screen, long-press the home screen → Widgets → Lyra → Ambient, or long-press the Lyra app icon → Ambient." hint="Tile, widget, app-icon shortcut">
        <button type="button" className="pill" onClick={() => void window.lyra.android?.addAmbientTile()}>
          Add tile
        </button>
      </Row>
      <Row label="Open ambient on charge" info="On charge: when you plug the phone in while music plays, the ambient screen opens by itself (needs “Display over other apps”; Android blocks it otherwise). On demand: only from the button, tile or widget. For a permission-free version pick Lyra under Settings → Display → Screen saver." hint="When the charger is connected">
        <Segmented
          label="Open ambient on charge"
          value={s.ambientTrigger}
          onChange={(v) => set({ ambientTrigger: v })}
          options={[
            { v: 'demand', label: 'On demand' },
            { v: 'charge', label: 'On charge' }
          ]}
        />
      </Row>
      <Row label="Ambient clock" info="Show a dim clock at the top of the Minimal ambient screen.">
        <Toggle label="Ambient clock" checked={s.ambientClock} onChange={(v) => set({ ambientClock: v })} />
      </Row>
      <Row label="Pixel shift" info="Moves the Minimal ambient screen a few pixels once a minute so an OLED screen is not burned in.">
        <Toggle label="Pixel shift" checked={s.ambientPixelShift} onChange={(v) => set({ ambientPixelShift: v })} />
      </Row>
      <Row label="Lyric on lock-screen card with screen off" info="Keeps updating the lyric on the lock screen / always-on-display media card while the screen is off, once per line, only while music plays. Which phones show it there depends on the maker; Pixel and Samsung always-on displays are drawn by the system." hint="One update per line">
        <Toggle label="Lock-screen card while screen off" checked={s.ambientCardWhenOff} onChange={(v) => set({ ambientCardWhenOff: v })} />
      </Row>
      <Row label="Floating lyrics" info="Shows a small lyrics widget over other apps while music plays, so you can read along while using something else. It hides while Lyra is open. Needs Android’s “Display over other apps” permission." hint="Over other apps">
        <Toggle label="Floating lyrics widget" checked={overlay} onChange={(v) => void toggleOverlay(v)} />
      </Row>
      <Row label="Battery" info="Samsung and other phones may still close apps to save power. Set Lyra to “Unrestricted” (or choose “Don’t optimise”) so it keeps working with the screen off." hint="Allow background use">
        <button type="button" className="pill" onClick={() => void window.lyra.android?.openBatterySettings()}>
          Open
        </button>
      </Row>
      <Row label={t('Notification access')} hint={t('Lets Lyra see what is playing')}>
        <button type="button" className="pill" onClick={() => void window.lyra.android?.openAccessSettings()}>
          Open
        </button>
      </Row>
    </section>
  )
}

export function SettingsPanel() {
  const { t, language } = useTranslation()
  const android = document.documentElement.dataset.platform === 'android'
  const s = useSettings((x) => x.settings)
  const set = useSettings((x) => x.set)
  const status = usePlayer((x) => x.status)
  const vibeWhy = useUi((x) => x.vibeWhy)
  const [version, setVersion] = useState('')
  useEffect(() => {
    void window.lyra.app.info().then((i) => setVersion(i.version))
  }, [])
  const up = <K extends keyof Settings>(k: K) => (v: Settings[K]) => set({ [k]: v } as Partial<Settings>)
  // six plain tabs; rarely needed options live under "More options" inside them
  const tabs: Array<{ id: string; label: string }> = android
    ? [
        { id: 'look', label: t('Look') },
        { id: 'lyrics', label: t('Lyrics') },
        { id: 'bg', label: t('Video') },
        { id: 'phone', label: t('Phone') },
        { id: 'share', label: t('Connect') },
        { id: 'about', label: t('About') }
      ]
    : [
        { id: 'look', label: t('Look') },
        { id: 'lyrics', label: t('Lyrics & video') },
        { id: 'general', label: t('Player') },
        { id: 'share', label: t('Connect') },
        { id: 'about', label: t('About') }
      ]
  const [q, setQ] = useState('')
  const searching = !android && q.trim().length > 0
  const show = (id: string): boolean => searching || tab === id
  const panelRef = useRef<HTMLDivElement>(null)
  const [tab, setTabState] = useState<string>(() => {
    const saved = sessionStorage.getItem('lyra.settingsTab')
    return tabs.some((t) => t.id === saved) ? (saved as string) : tabs[0]!.id
  })
  const setTab = (id: string): void => {
    setTabState(id)
    sessionStorage.setItem('lyra.settingsTab', id)
  }
  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number): void => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const nextIndex =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? tabs.length - 1
          : (index + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + tabs.length) % tabs.length
    const next = tabs[nextIndex]!
    setTab(next.id)
    e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus()
  }

  const active: 'local' | 'api' | 'demo' =
    status?.state === 'demo' ? 'demo' : status?.state === 'local' || (status?.state === 'offline' && s.source === 'local') ? 'local' : 'api'
  const account =
    status?.state === 'demo'
      ? 'Demo mode'
      : status?.state === 'local'
        ? 'Spotify desktop app'
        : status?.state === 'connected'
        ? `${status.userName ?? 'Connected'}${status.product ? ` · ${status.product}` : ''}`
        : status?.state === 'offline'
          ? 'Offline'
          : 'Not connected'


  // Search: show every section and hide the rows that do not match (Advanced folds open so nothing hides in them)
  useEffect(() => {
    const root = panelRef.current
    if (!root) return
    const needle = q.trim().toLowerCase()
    const apply = (): void => {
      root.querySelectorAll<HTMLElement>('section').forEach((sec) => {
        const rows = Array.from(sec.querySelectorAll<HTMLElement>('.srow:not(.srow--actions)'))
        let any = false
        rows.forEach((r) => {
          const hit = !needle || (r.textContent ?? '').toLowerCase().includes(needle)
          r.hidden = !hit
          any ||= hit
        })
        sec.querySelectorAll<HTMLElement>(':scope > .hint, :scope > .tvlink, :scope > .health, :scope > .vibes, :scope > .more > .hint').forEach((el) => (el.hidden = !!needle))
        const titleHit = !!needle && (sec.querySelector('h4')?.textContent ?? '').toLowerCase().includes(needle)
        if (titleHit) rows.forEach((r) => (r.hidden = false))
        sec.hidden = !!needle && !any && !titleHit
        if (needle) sec.querySelectorAll<HTMLDetailsElement>('details.more').forEach((d) => d.querySelector('.srow:not([hidden])') && (d.open = true))
      })
    }
    apply()
    const mo = new MutationObserver(apply)
    mo.observe(root, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [q, tab])

  const tabRail = useRef<HTMLElement>(null)
  // keep the chosen tab in view in the sideways-scrolling row
  useEffect(() => {
    tabRail.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [tab])

  return (
    <div className="settings" data-nodrag>
      {!android && (
        <div className="ssearch" role="search">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQ('')}
            placeholder={t('Search settings')}
            aria-label={t('Search settings')}
            spellCheck={false}
          />
        </div>
      )}
      <nav className="stabs" role="tablist" hidden={searching} aria-label={t('Settings sections')} ref={tabRail}>
        {tabs.map((t, index) => (
          <button
            key={t.id}
            id={`settings-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls="settings-panel"
            tabIndex={tab === t.id ? 0 : -1}
            className={tab === t.id ? 'is-on' : ''}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => handleTabKeyDown(e, index)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div id="settings-panel" ref={panelRef} role="tabpanel" aria-labelledby={`settings-tab-${tab}`} tabIndex={0}>
      {android && show('phone') && (
        <>
          <PhoneSection />
          <CarModeRow />
        </>
      )}

      {show('look') && (
      <section>
        <h4>Vibes</h4>
        <p className="hint">A vibe changes the whole look: colours, type, background effects and how the lyrics appear. Press V anywhere to switch.</p>
        <Row label="Vibe changes" hint={s.vibeMode === 'fixed' ? 'Stay on the one you pick' : s.vibeMode === 'cycle' ? 'A new vibe from your picks on every song' : vibeWhy ? `Now: ${vibeWhy}` : 'Lyra picks what suits each song'}>
          <Segmented
            label="Vibe mode"
            value={s.vibeMode}
            onChange={(m) => set({ vibeMode: m })}
            options={[
              { v: 'fixed', label: 'Fixed' },
              { v: 'cycle', label: 'Every song' },
              { v: 'smart', label: 'Smart' }
            ]}
          />
        </Row>
        <div className="vibes" role={s.vibeMode === 'fixed' ? 'radiogroup' : 'group'} aria-label="Vibes">
          {VIBES.filter((v) => s.vibeMode === 'fixed' || v.id !== 'none').map((v) => {
            const inPool = s.vibePool.length === 0 || s.vibePool.includes(v.id)
            const on = s.vibeMode === 'fixed' ? s.vibe === v.id : inPool
            return (
              <button
                key={v.id}
                type="button"
                role={s.vibeMode === 'fixed' ? 'radio' : 'checkbox'}
                aria-checked={on}
                className={`vibecard vibecard--${v.id} ${on ? 'is-on' : ''} ${s.vibeMode !== 'fixed' ? 'is-multi' : ''}`}
                onClick={() => {
                  if (s.vibeMode === 'fixed') return set({ vibe: v.id, lyricStyle: v.style })
                  // empty pool means "all": the first click starts from everything and removes that one
                  const all = VIBES.map((x) => x.id).filter((x) => x !== 'none')
                  const cur = s.vibePool.length === 0 ? all : s.vibePool
                  const next = cur.includes(v.id) ? cur.filter((x) => x !== v.id) : [...cur, v.id]
                  set({ vibePool: next.length === all.length ? [] : next.length ? next : cur })
                }}
              >
                <i className="vibecard__sw" />
                <b>{v.name}</b>
                <small>{v.tag}</small>
                {s.vibeMode !== 'fixed' && <span className="vibecard__tick" aria-hidden="true">{on ? '✓' : ''}</span>}
              </button>
            )
          })}
        </div>
        {s.vibeMode !== 'fixed' && <p className="hint">{s.vibePool.length === 0 ? 'Using every vibe.' : `Using ${s.vibePool.length} vibe${s.vibePool.length === 1 ? '' : 's'}.`} Tap a card to add or remove it.</p>}
      </section>
      )}
      {show('look') && (
      <section>
        <h4>Comfort</h4>
        {s.vibe === 'none' && (
          <Row label="Artwork colours" hint="Only the Artwork look has a light and dark side; every other look brings its own colours">
            <Segmented
              label="Theme"
              value={s.theme}
              onChange={up('theme')}
              options={[
                { v: 'adaptive', label: 'Auto' },
                { v: 'dark', label: 'Dark' },
                { v: 'light', label: 'Light' }
              ]}
            />
          </Row>
        )}
        <Row label="Reduce motion" hint="Calmer screen, no moving videos. Follows Windows unless you change it">
          <Segmented
            label="Reduce motion"
            value={s.reducedMotion}
            onChange={up('reducedMotion')}
            options={[
              { v: 'system', label: 'Windows' },
              { v: 'on', label: 'On' },
              { v: 'off', label: 'Off' }
            ]}
          />
        </Row>
        <Row label="Song change effects" hint="A different smooth effect each time the song changes">
          <Toggle label="Song change effects" checked={s.smoothSongChange} onChange={up('smoothSongChange')} />
        </Row>
        <Row label="Fade volume between songs" hint="Eases the volume out at the end of a song and back in on the next. Only where Lyra can set your volume">
          <Toggle label="Fade volume between songs" checked={s.volumeFade} onChange={up('volumeFade')} />
        </Row>
        <More label="Advanced">
        <Row label="Effects" hint="Light saves battery and graphics power: no live blur, no endless motion">
          <Segmented
            label="Performance"
            value={s.performance}
            onChange={up('performance')}
            options={[
              { v: 'auto', label: 'Auto' },
              { v: 'smooth', label: 'Smooth' },
              { v: 'light', label: 'Light' }
            ]}
          />
        </Row>
        </More>
      </section>
      )}
      {show('lyrics') && (
      <section>
        <h4>Lyrics</h4>
        <Row label="Roman letters" hint="Under Hindi and Punjabi lyrics (reading help, not a translation)">
          <Toggle label="Romanized lyrics" checked={s.romanizeLyrics} onChange={up('romanizeLyrics')} />
        </Row>
        <Row
          label="Highlight each word"
          info="Highlights each word as it is sung. Free lyrics only have one time per line, so Lyra estimates the word timing from syllables and pauses: close, but not perfect. If a source has real word timing, that is used instead."
          hint="Estimated timing"
        >
          <Toggle label="Highlight each word" checked={s.wordByWord} onChange={up('wordByWord')} />
        </Row>
        <More label="Advanced">
        <Row label="Default sync offset" hint="Nudge every song earlier or later. Fine-tune one song under its lyrics">
          <Slider label="Sync offset" value={s.lyricOffsetMs} min={-3000} max={3000} step={50} onChange={up('lyricOffsetMs')} format={(v) => `${v > 0 ? '+' : ''}${(v / 1000).toFixed(2)}s`} />
        </Row>
        <p className="hint">Lyrics services: if one is down Lyra uses the next, keeps your saved copies, and tries again by itself.</p>
        <SourceHealthList />
        </More>
      </section>
      )}

      {(android ? show('bg') : show('lyrics')) && <BackgroundSection />}

      {!android && show('general') && (
      <section>
        <Row label={t('Language')} hint={t('Choose the language used in Lyra settings')}>
          <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} aria-label={t('Language')}>
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
          </select>
        </Row>
        <h4>{t('Music source')}</h4>
        <Segmented
          label={t('Music source')}
          value={active}
          onChange={(v) => {
            if (v === 'local') void window.lyra.spotify.useLocal()
            else if (v === 'demo') void window.lyra.spotify.startDemo()
            else void window.lyra.spotify.connect()
          }}
          options={[
            { v: 'local', label: 'Windows (no login)' },
            { v: 'api', label: 'Spotify API' },
            { v: 'demo', label: 'Demo' }
          ]}
        />
        <Row
          label="Status"
          hint={
            status?.state === 'local'
              ? s.followAnyPlayer
                ? 'Reads the current Windows media session. Available controls depend on the player.'
                : 'Reads the Spotify app via Windows media controls. No queue; likes are saved locally.'
              : status?.controlsLimited
                ? 'Free accounts can’t be remote-controlled — display only'
                : undefined
          }
        >
          <span className="value">{account}</span>
        </Row>
      </section>
      )}

      {!android && show('general') && (
      <section>
        <h4>Window</h4>
        <Row label="Resting size">
          <Segmented
            label="Resting size"
            value={s.defaultMode}
            onChange={(v) => {
              set({ defaultMode: v })
              void window.lyra.window.setMode(v)
            }}
            options={[
              { v: 'minimal', label: 'Minimal' },
              { v: 'compact', label: 'Compact' },
              { v: 'mini', label: 'Expanded' }
            ]}
          />
        </Row>
        <Row label="Stay on top of other windows">
          <Toggle label="Always on top" checked={s.alwaysOnTop} onChange={up('alwaysOnTop')} />
        </Row>
        <Row label="Hide while screen sharing" hint="Lyra won't show in recordings or shared screens">
          <Toggle label="Hide while screen sharing" checked={s.hideOnScreenShare} onChange={up('hideOnScreenShare')} />
        </Row>
        <More label="Advanced">
        <Row label="See-through" hint="Lower it to see what is behind Lyra">
          <Slider label="Opacity" value={s.opacity} min={0.4} max={1} step={0.02} onChange={up('opacity')} format={(v) => `${Math.round(v * 100)}%`} />
        </Row>
        <Row label="Fade when idle" hint="Dim the widget when the cursor leaves">
          <Toggle label="Fade when idle" checked={s.autoHide} onChange={up('autoHide')} />
        </Row>
        </More>
      </section>
      )}

      {!android && show('general') && (
      <section>
        <h4>{t('Startup & keys')}</h4>
        <Row label={t('Launch at startup')} hint={t('Applies to installed builds')}>
          <Toggle label={t('Launch at startup')} checked={s.launchAtStartup} onChange={up('launchAtStartup')} />
        </Row>
        <Row label={t('Track change notifications')} hint={t('A small pop-up when the song changes')}>
          <Toggle label={t('Track change notifications')} checked={s.trackNotifications} onChange={up('trackNotifications')} />
        </Row>
        <Row label={t('Global shortcuts')} hint={t('Keys that work even when Lyra is in the background')}>
          <Toggle label={t('Global shortcuts')} checked={s.globalShortcuts} onChange={up('globalShortcuts')} />
        </Row>
        <StorageRow />
        <More label="Advanced">
        <Row label={t('Control system volume')} hint={t('Windows source. Loads a helper that some antivirus tools flag')}>
          <Toggle label={t('Control system volume')} checked={s.systemVolume} onChange={up('systemVolume')} />
        </Row>
        <Row label={t('Follow other players')} hint={t('Windows source. Follows the current media session, including Apple Music and browsers.')}>
          <Toggle label={t('Follow other players')} checked={s.followAnyPlayer} onChange={up('followAnyPlayer')} />
        </Row>
        <ShortcutEditor />
        <More label="All keys inside Lyra">
        <dl className="keys">
          {LOCAL_SHORTCUTS.map((k) => (
            <div key={k.keys}>
              <dt>{k.label}</dt>
              <dd>{k.keys}</dd>
            </div>
          ))}
        </dl>
        </More>
        </More>
      </section>
      )}


      {show('share') && (
      <section>
        <h4>{t('Rooms: listen together')}</h4>
        <RoomHub />
      </section>
      )}

      {!android && show('share') && (
      <section>
        <h4>{t('Devices')}</h4>
        <DevicesPanel />
      </section>
      )}

      {show('about') && (
      <>
      <div className="srow srow--actions">
        <button type="button" className="pill" onClick={() => window.lyra.window.hide()}>
          Hide to tray
        </button>
        <button
          type="button"
          className="pill"
          onClick={() =>
            void window.lyra.app
              .diagnostics()
              .then((t) => window.lyra.app.copy(t))
              .then(() => useUi.getState().toast('Diagnostics copied — paste it into your bug report'))
              .catch(() => useUi.getState().toast('Couldn’t copy diagnostics', 'error'))
          }
        >
          Copy diagnostics
        </button>
        <ResetButton />
        <button type="button" className="pill" onClick={() => window.lyra.window.quit()}>
          Quit Lyra
        </button>
      </div>

      <section className="about">
        <h4>About</h4>
        {window.lyra.android ? <AndroidUpdateRow /> : <UpdateRow />}
        <p className="about__name">
          <b>Lyra</b> <span>{version ? `v${version}` : ''}</span>
        </p>
        <p>A free, account-free lyrics companion for the Spotify desktop app. Everything runs on your PC.</p>
        <ul>
          <li>
            Lyrics from{' '}
            <a href="https://lrclib.net" target="_blank" rel="noreferrer">
              LRCLIB
            </a>
            , release years from{' '}
            <a href="https://musicbrainz.org" target="_blank" rel="noreferrer">
              MusicBrainz
            </a>
            . Lyrics belong to their rights holders.
          </li>
          <li>Only the song title, artist, album and length are sent to those services — nothing else leaves your PC. No accounts, no analytics.</li>
          <li>Lyra is an independent project, not affiliated with or endorsed by Spotify. Spotify is a trademark of Spotify AB.</li>
        </ul>
        <p>
          <a href="https://github.com/DhruvHarani1/lyra" target="_blank" rel="noreferrer">
            Source code &amp; privacy details
          </a>{' '}
          · MIT licensed
        </p>
      </section>
      </>
      )}
      </div>
    </div>
  )
}
