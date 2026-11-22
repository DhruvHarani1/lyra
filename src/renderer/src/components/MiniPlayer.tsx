import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useIdle } from '@/hooks/useIdle'
import { usePlayerView } from '@/hooks/usePlayerView'
import { useWindowDrag } from '@/hooks/useWindowDrag'
import { joinArtists } from '@/lib/format'
import { useBgState } from '@/store/bgState'
import { usePlayer } from '@/store/player'
import { requestMode, useUi } from '@/store/ui'
import { Artwork } from './Artwork'
import { Icon, type IconName } from './Icon'
import { VideoStatus } from './VideoStatus'
import { IconButton, Transport, VolumeControl, useCaps } from './Controls'
import { cycleVibe } from '@/hooks/useVibe'
import { FullscreenPlayer } from './FullscreenPlayer'
import { LyricsView } from './LyricsView'
import { KaraokeScreen } from './KaraokeScreen'
import { RecordDialog } from './RecordDialog'
import { StudioDialog } from './StudioDialog'
import { ProgressBar } from './ProgressBar'
import { ConnectScreen, LoadingScreen, NoMusicScreen, OfflineBanner, OfflineScreen } from './StateScreens'

export function LikeButton({ size = 18 }: { size?: number }) {
  const liked = usePlayer((s) => s.liked)
  const toggle = usePlayer((s) => s.toggleLike)
  const status = usePlayer((s) => s.status)
  const local = status?.state === 'local'
  const unavailable = liked === null
  return (
    <IconButton
      icon="heart"
      label={local ? (liked ? 'Remove from Lyra favorites' : 'Save to Lyra favorites') : liked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
      title={unavailable ? (status?.state === 'demo' ? 'Like' : 'Liking isn’t available for this item') : undefined}
      active={!!liked}
      filled={!!liked}
      disabled={unavailable}
      size={size}
      className="likebtn"
      onClick={() => void toggle()}
    />
  )
}

/** True on tablets and an unfolded foldable (wide AND tall); a landscape phone is wide but short, so it keeps the phone layout. */
function useWideScreen(): boolean {
  const q = '(min-width: 720px) and (min-height: 600px)'
  const [wide, setWide] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = (): void => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

/** A labelled menu for the secondary actions, so the header is not a row of nine tiny icons. */
export function OverflowMenu({ items }: { items: Array<{ icon: IconName; label: string; run(): void }> }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent): void => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', away)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('pointerdown', away)
      window.removeEventListener('keydown', esc)
    }
  }, [open])
  return (
    <div className="menu" ref={box}>
      <IconButton icon="more" label="More" active={open} size={16} onClick={() => setOpen((o) => !o)} />
      <AnimatePresence>
        {open && (
          <motion.div className="menu__pop" role="menu" initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
            {items.map((it) => (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  it.run()
                }}
              >
                <Icon name={it.icon} size={16} />
                {it.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Android: a small switch to turn ambient mode on or off. */
function AmbientSwitch() {
  const on = document.documentElement.dataset.ambient === '1'
  return (
    <span className="ambsw" title="Ambient mode">
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path fill="currentColor" d="M12.1 22c-5.5 0-10-4.5-10-10 0-4.8 3.4-8.9 8-9.8.4-.1.8.3.6.7-.5 1.1-.7 2.3-.7 3.4 0 4.4 3.6 8 8 8 .6 0 1.2-.1 1.8-.2.4-.1.8.3.6.7-1.3 4.2-5.3 7.2-9.8 7.2z" />
      </svg>
      <button type="button" role="switch" aria-checked={on} aria-label="Ambient mode" className="switch switch--sm" onClick={() => void window.lyra.android?.toggleAmbient()}>
        <i />
      </button>
    </span>
  )
}

function MiniClassic() {
  const view = usePlayerView()
  const track = usePlayer((s) => s.snapshot?.track ?? null)
  const device = usePlayer((s) => s.snapshot?.device ?? null)
  const panel = useUi((s) => s.panel)
  const togglePanel = useUi((s) => s.togglePanel)
  const drag = useWindowDrag()
  const caps = useCaps()
  const videoBehind = useBgState((x) => x.media === 'mini')
  // with a video behind it, the header / title / controls fade away after a few seconds and return on touch
  // a touch screen hides after 4 s; with a mouse, give it a little longer
  const [studio, setStudio] = useState(false)
  const [karaoke, setKaraoke] = useState(false)
  const [cover, setCover] = useState(false)
  const phone = document.documentElement.dataset.platform === 'android'
  const wide = useWideScreen() && phone
  const idle = useIdle(phone ? 4000 : 6000)

  const more: Array<{ icon: IconName; label: string; run(): void }> = [
    ...(caps.queue ? [{ icon: 'queue' as const, label: 'Queue', run: () => togglePanel('queue') }] : []),
    { icon: 'bookmark', label: 'Saved lyric moments', run: () => togglePanel('moments') },
    ...(phone ? [] : [{ icon: 'mic' as const, label: 'Karaoke', run: () => setKaraoke(true) }]),
    { icon: 'film', label: phone ? 'Record lyric video' : 'Export lyric video', run: () => setStudio(true) },
    { icon: 'vibe', label: 'Next vibe', run: () => cycleVibe(1) }
  ]

  return (
    <>
    {karaoke && <KaraokeScreen onClose={() => setKaraoke(false)} />}
    {studio && (phone ? <RecordDialog onClose={() => setStudio(false)} /> : <StudioDialog onClose={() => setStudio(false)} />)}
    <div className={`mini ${phone ? 'mini--phone' : ''} ${wide ? 'mini--wide' : ''} ${videoBehind && idle && panel === 'none' ? 'is-idle' : ''}`}>
      {phone ? (
        <header className="mini__head phone__bar">
          {wide ? (
            <span className="phone__brand">Lyra</span>
          ) : (
          <button type="button" className="phone__now" aria-expanded={cover} aria-label={cover ? 'Hide the cover' : 'Show the cover'} onClick={() => setCover((c) => !c)} disabled={!track}>
            {track && <Artwork url={track.artworkUrl} size={46} radius={13} />}
            <span className="phone__text">
              <b>{track ? track.title : 'Lyra'}</b>
              <i>
                {track ? joinArtists(track.artists) : 'Nothing playing'}
                {device ? ` · ${device.name}` : ''}
              </i>
            </span>
          </button>
          )}
          <div className="phone__tools" data-nodrag>
            <AmbientSwitch />
            {track && !wide && <LikeButton size={22} />}
            <IconButton icon="settings" label="Settings" active={panel === 'settings'} size={22} onClick={() => togglePanel('settings')} />
          </div>
        </header>
      ) : (
        <header className="mini__head" {...drag}>
          <span className="mini__device" title={device ? `Playing on ${device.name}` : undefined}>
            {device ? device.name : 'Lyra'}
          </span>
          <div className="mini__tools" data-nodrag>
            <IconButton icon="settings" label="Settings" active={panel === 'settings'} size={16} onClick={() => togglePanel('settings')} />
            <IconButton icon="fullscreen" label="Fullscreen lyrics" size={16} onClick={() => requestMode('full')} />
            <OverflowMenu items={more} />
            <span className="mini__sep" aria-hidden="true" />
            <IconButton icon="minus" label="Minimize" size={16} onClick={() => window.lyra.window.minimize()} />
            <IconButton icon="collapse" label="Collapse to widget" size={16} onClick={() => requestMode('compact')} />
            <IconButton icon="close" label="Quit Lyra" size={16} onClick={() => window.lyra.window.quit()} />
          </div>
        </header>
      )}
      <VideoStatus />

      {view === 'playing' && track && wide ? (
        <>
          <OfflineBanner />
          <div className="wide__body">
            <aside className="wide__side">
              <div className="wide__cover">
                <Artwork url={track.artworkUrl} size="100%" radius={26} className="artwork--lift" />
              </div>
              <div className="wide__titles">
                <div>
                  <b title={track.title}>{track.title}</b>
                  <i>
                    {joinArtists(track.artists)}
                    {device ? ` · ${device.name}` : ''}
                  </i>
                </div>
                <LikeButton size={24} />
              </div>
              <div className="mini__card phone__dock wide__dock" data-nodrag>
                <ProgressBar showTimes />
                <Transport size="lg" extras />
                <div className="phone__actions">
                  {more.map((m) => (
                    <button key={m.label} type="button" className="phone__act" onClick={m.run} aria-label={m.label}>
                      <Icon name={m.icon} size={22} />
                      <span>{m.label.replace('Saved lyric moments', 'Saved').replace('Record lyric video', 'Record')}</span>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
            <div className="mini__lyrics">
              <LyricsView variant="mini" />
            </div>
          </div>
        </>
      ) : view === 'playing' && track && phone ? (
        <>
          <OfflineBanner />
          <AnimatePresence initial={false}>
            {cover && (
              <motion.div className="phone__cover" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
                <Artwork url={track.artworkUrl} size="min(72vw, 34vh)" radius={22} className="artwork--lift" />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="mini__lyrics">
            <LyricsView variant="mini" />
          </div>
          <div className="mini__card phone__dock" data-nodrag>
            <ProgressBar showTimes />
            <Transport size="lg" extras />
            <div className="phone__actions">
              {more.map((m) => (
                <button key={m.label} type="button" className="phone__act" onClick={m.run} aria-label={m.label}>
                  <Icon name={m.icon} size={20} />
                  <span>{m.label.replace('Saved lyric moments', 'Saved').replace('Record lyric video', 'Record')}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      ) : view === 'playing' && track ? (
        <>
          <OfflineBanner />
          {!videoBehind && (
            <div className="mini__art" {...drag}>
              <Artwork url={track.artworkUrl} size="min(232px, 31vh)" radius={14} className="artwork--lift" />
            </div>
          )}
          <div className="mini__card">
          <div className="mini__info">
            {videoBehind && <Artwork url={track.artworkUrl} size="58px" radius={11} className="artwork--lift" />}
            <div className="mini__text">
              <h1 title={track.title}>
                {track.title}
                {track.explicit && <span className="tag">E</span>}
              </h1>
              <p title={joinArtists(track.artists)}>{joinArtists(track.artists)}</p>
            </div>
            <div className="mini__info-actions" data-nodrag>
              <LikeButton />
            </div>
          </div>
          <div className="mini__progress" data-nodrag>
            <ProgressBar showTimes />
          </div>
          <div className="mini__transport" data-nodrag>
            <Transport size="md" extras />
          </div>
          <div className="mini__volume" data-nodrag>
            <VolumeControl wide />
          </div>
          </div>
          <div className="mini__lyrics">
            <LyricsView variant="mini" />
          </div>
        </>
      ) : (
        <div className="mini__screen" {...drag}>
          {view === 'loading' && <LoadingScreen />}
          {view === 'connect' && <ConnectScreen />}
          {view === 'offline' && <OfflineScreen />}
          {(view === 'idle' || view === 'ad') && <NoMusicScreen ad={view === 'ad'} />}
        </div>
      )}
    </div>
    </>
  )
}

/** The small window. Looks that compose their own screen (scene) use the same screen as fullscreen, laid out for a tall window. */
export function MiniPlayer() {
  const phone = document.documentElement.dataset.platform === 'android'
  if (!phone) return <FullscreenPlayer mini />
  return <MiniClassic />
}
