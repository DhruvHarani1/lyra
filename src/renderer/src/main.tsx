import '@fontsource-variable/inter'
import '@fontsource-variable/nunito'
import '@fontsource-variable/unbounded'
import '@fontsource-variable/fraunces/standard-italic.css'
import '@fontsource/vt323'
import '@fontsource/caveat'
import '@fontsource/press-start-2p'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/tokens.css'
import './styles/base.css'
import './styles/widget.css'
import './styles/player.css'
import './styles/lyrics.css'
import './styles/panels.css'
import './styles/android.css'
import './styles/polish.css'
import './styles/redesign.css'
import './styles/stage.css'
import './styles/vibes.css'
import './styles/layouts.css'
import './styles/skins.css'
import './styles/posters.css'
import './styles/states.css'
import './styles/cards.css'
import './styles/scene.css'
import './styles/neon.css'
import './styles/chrome.css'
import './styles/arcade.css'
import './styles/sunset.css'
import './styles/trailer.css'
import './styles/sketch.css'
import './styles/glitch.css'
import './styles/comic.css'
import './styles/stencil.css'
import './styles/film.css'
import './styles/filmstrip.css'
import './styles/dream.css'
import './styles/terminal.css'
import './styles/sticker.css'
import './styles/dm.css'
import './styles/diary.css'
import './styles/journal.css'
import './styles/doodle.css'
import './styles/edge.css'
import './styles/none.css'
import './styles/edge-none.css'
import './styles/edge-neon.css'
import './styles/edge-chrome.css'
import './styles/edge-dream.css'
import './styles/edge-crt.css'
import './styles/edge-sticker.css'
import './styles/recomp1.css'
import './styles/noir.css'
import './styles/stadium.css'
import './styles/cassette.css'
import './styles/blocks.css'
import './styles/sunset-v2.css'
import './styles/edge-sunset.css'
import './styles/blocks-v2.css'
import './styles/edge-blocks.css'
import './styles/stadium-v2.css'
import './styles/edge-stadium.css'
import './styles/cassette-v2.css'
import './styles/edge-cassette.css'
import './styles/trailer-v2.css'
import './styles/edge-trailer.css'
import './styles/sketch-v2.css'
import './styles/edge-sketch.css'
import './styles/looks2.css'
import './styles/wallet.css'
import './styles/route.css'
import './styles/editor.css'
import './styles/metro.css'
import './styles/web.css'
import './styles/edge-wallet.css'
import './styles/edge-route.css'
import './styles/edge-editor.css'
import './styles/edge-metro.css'
import './styles/edge-web.css'
import './styles/widgets2.css'
import './styles/artdoodle.css'
import './styles/settings.css'
import './styles/x-chat.css'
import './styles/edge-chat.css'
import './styles/x-paper.css'
import './styles/edge-paper.css'
import './styles/x-journal.css'
import './styles/edge-journal.css'
import './styles/x-doodle.css'
import './styles/edge-doodle.css'
import './styles/x-arcade.css'
import './styles/edge-arcade.css'
import './styles/x-noir.css'
import './styles/edge-noir.css'
import './styles/videofit.css'
import './styles/android-scenes.css'
import './styles/car.css'
import './styles/tv.css'
import { effectiveVibe } from './hooks/useVibe'
import { vibeInfo } from '@shared/vibes'
import { useSettings } from './store/settings'
import { usePlayer } from './store/player'
import { useUi } from './store/ui'
import { useBgState } from './store/bgState'
import './styles/p-glitch.css'
import './styles/edge-glitch.css'
import './styles/p-comic.css'
import './styles/edge-comic.css'
import './styles/p-stencil.css'
import './styles/edge-stencil.css'
import './styles/p-film.css'
import './styles/edge-film.css'
import './styles/p-filmstrip.css'
import './styles/edge-filmstrip.css'
import './styles/p-lock.css'
import './styles/edge-lock.css'
import './styles/minsizes.css'

// Let CSS honour the in-app settings: reduced motion, rim light and the vibe in effect (a cycled / smart vibe is
// temporary and lives in the UI store; the OS reduced-motion preference is handled by media queries).
// weak hardware (few cores or little memory) and phones get the Light look unless the user says otherwise
const weakDevice = (): boolean => {
  const nav = navigator as Navigator & { deviceMemory?: number }
  return (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4 || document.documentElement.dataset.platform === 'android'
}

const applyLook = (): void => {
  const st = useSettings.getState().settings
  const root = document.documentElement
  root.dataset.motion = st.reducedMotion === 'on' ? 'off' : 'on'
  const vibe = effectiveVibe(st, useUi.getState().vibeNow).vibe
  root.dataset.vibe = vibe
  root.dataset.arch = vibeInfo(vibe).layout
  root.dataset.rim = st.rimLight ? 'on' : 'off'
  root.dataset.mode = useUi.getState().mode
  root.dataset.perf = st.performance === 'light' || (st.performance === 'auto' && weakDevice()) ? 'low' : 'high'
  syncCalm()
}

/** "Calm": nothing is playing or the window is hidden, so every endless animation pauses. */
const syncCalm = (): void => {
  const playing = usePlayer.getState().snapshot?.isPlaying ?? false
  // a running export draws its own pictures: the app's endless CSS animations behind the dialog only steal frame time
  const calm = !playing || document.visibilityState === 'hidden' || useBgState.getState().exporting
  if (calm) document.documentElement.dataset.calm = ''
  else delete document.documentElement.dataset.calm
}
usePlayer.subscribe(syncCalm)
useBgState.subscribe(syncCalm)
document.addEventListener('visibilitychange', syncCalm)
useSettings.subscribe(applyLook)
useUi.subscribe(applyLook)
applyLook()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
