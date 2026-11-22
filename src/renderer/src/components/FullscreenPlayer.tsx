import { useState } from 'react'
import { cycleVibe } from '@/hooks/useVibe'
import { useWindowDrag } from '@/hooks/useWindowDrag'
import { useEffectiveVibe } from '@/hooks/useVibe'
import { useIdle } from '@/hooks/useIdle'
import { usePlayerView } from '@/hooks/usePlayerView'
import { joinArtists } from '@/lib/format'
import { cardTheme } from '@/lib/shareCard'
import { useBgState } from '@/store/bgState'
import { usePlayer } from '@/store/player'
import { requestMode, useUi } from '@/store/ui'
import { Artwork } from './Artwork'
import { IconButton, Transport, VolumeControl, useCaps } from './Controls'
import { LyricsView } from './LyricsView'
import { LikeButton, OverflowMenu } from './MiniPlayer'
import { KaraokeScreen } from './KaraokeScreen'
import { StudioDialog } from './StudioDialog'
import { ProgressBar } from './ProgressBar'
import { VideoPicker } from './VideoPicker'
import { VideoStatus } from './VideoStatus'
import { ConnectScreen, LoadingScreen, NoMusicScreen, OfflineBanner, OfflineScreen } from './StateScreens'

export function FullscreenPlayer({ mini = false }: { mini?: boolean }) {
  const drag = useWindowDrag()
  const [karaoke, setKaraoke] = useState(false)
  const [studio, setStudio] = useState(false)
  const view = usePlayerView()
  const track = usePlayer((s) => s.snapshot?.track ?? null)
  const device = usePlayer((s) => s.snapshot?.device ?? null)
  const idle = useIdle(3500)
  const caps = useCaps()
  const panel = useUi((s) => s.panel)
  const togglePanel = useUi((s) => s.togglePanel)
  const df = useUi((s) => s.distractionFree)
  const toggleDf = useUi((s) => s.toggleDistractionFree)

  const quiet = !mini && idle && panel === 'none'
  // cinema layout: a video is playing, so get the UI out of its way
  const cinema = useBgState((s) => s.media === 'full' || (mini && s.media === 'mini'))
  const ytVideo = useBgState((s) => s.kind === 'youtube')
  // each vibe arranges the card and the lyrics its own way
  const effVibe = useEffectiveVibe().vibe

  return (
    <div className={`full ${quiet ? 'is-idle' : ''} ${df ? 'is-df' : ''} ${cinema ? 'is-cinema' : ''}`} data-arch="scene">
      <VideoStatus />
      {karaoke && <KaraokeScreen onClose={() => setKaraoke(false)} />}
      {studio && <StudioDialog onClose={() => setStudio(false)} />}
      <header className="full__top" {...(mini ? drag : {})}>
        <span className="full__device">{device ? (mini ? device.name : `Playing on ${device.name}`) : 'Lyra'}</span>
        {mini ? (
          <div className="full__tools" data-nodrag>
            <IconButton icon="settings" label="Settings" active={panel === 'settings'} size={16} onClick={() => togglePanel('settings')} />
            <IconButton icon="fullscreen" label="Fullscreen lyrics" size={16} onClick={() => requestMode('full')} />
            <OverflowMenu
              items={[
                ...(caps.queue ? [{ icon: 'queue' as const, label: 'Queue', run: () => togglePanel('queue') }] : []),
                { icon: 'bookmark' as const, label: 'Saved lyric moments', run: () => togglePanel('moments') },
                { icon: 'mic' as const, label: 'Karaoke', run: () => setKaraoke(true) },
                { icon: 'film' as const, label: 'Export lyric video', run: () => setStudio(true) },
                { icon: 'vibe' as const, label: 'Next vibe', run: () => cycleVibe(1) }
              ]}
            />
            <IconButton icon="minus" label="Minimize" size={16} onClick={() => window.lyra.window.minimize()} />
            <IconButton icon="collapse" label="Collapse to widget" size={16} onClick={() => requestMode('compact')} />
            <IconButton icon="close" label="Quit Lyra" size={16} onClick={() => window.lyra.window.quit()} />
          </div>
        ) : (
          <div className="full__tools">
            {cinema && ytVideo && <VideoPicker />}
            <IconButton icon="type" label="Distraction-free: artwork and lyrics only" active={df} onClick={toggleDf} />
            {caps.queue && <IconButton icon="queue" label="Queue" active={panel === 'queue'} onClick={() => togglePanel('queue')} />}
            <IconButton icon="bookmark" label="Saved lyric moments" active={panel === 'moments'} onClick={() => togglePanel('moments')} />
            <IconButton icon="settings" label="Settings" active={panel === 'settings'} onClick={() => togglePanel('settings')} />
            <IconButton icon="exitFullscreen" label="Exit fullscreen (Esc)" onClick={() => requestMode('mini')} />
          </div>
        )}
      </header>

      {view === 'playing' && track ? (
        <div className="full__body">
          <aside className="full__side">
            <Artwork doodle={{ vibe: effVibe, seed: `${track.title}|${track.artists.join(',')}`, kit: cardTheme(effVibe).kit ?? 'marker' }} url={track.artworkUrl} size="100%" radius={16} className="artwork--lift" />
            <div className="full__chrome">
              <div className="full__titlerow">
                <div className="full__titles">
                  <h1 title={track.title}>{track.title}</h1>
                  <p className="full__artist">{joinArtists(track.artists)}</p>
                  <p className="full__album">
                    {track.album}
                    {track.releaseYear ? ` · ${track.releaseYear}` : ''}
                  </p>
                </div>
                <LikeButton size={22} />
              </div>
              <ProgressBar showTimes remaining />
              <div className="full__controls">
                <Transport size="lg" extras />
              </div>
              <div className="full__volume">
                <VolumeControl wide />
                <IconButton icon="external" label="Open in Spotify" size={16} onClick={() => void window.lyra.player.openInSpotify(track)} />
              </div>
            </div>
          </aside>
          <section className="full__lyrics">
            <LyricsView variant="full" />
          </section>
          <OfflineBanner />
        </div>
      ) : (
        <div className="full__screen">
          {view === 'loading' && <LoadingScreen />}
          {view === 'connect' && <ConnectScreen />}
          {view === 'offline' && <OfflineScreen />}
          {(view === 'idle' || view === 'ad') && <NoMusicScreen ad={view === 'ad'} />}
        </div>
      )}
    </div>
  )
}
