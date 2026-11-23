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
/*
 * CSS cascade map: the order of the style imports below IS the cascade (later wins at equal specificity), so keep it.
 *   1. tokens, base, widget, player, lyrics, panels, android, polish, redesign, stage, vibes, layouts, skins, posters, states, cards
 *      -> the shared UI: tokens, controls, the lyric stage, the shared fullscreen layout (layouts.css) and its overrides
 *   2. scene.css -> the shared "scene" mechanics: the video window, card and lyric region are placed from each look's --sc-* variables
 *   3. one file per look (a look's own scene, card, lyric styling, and where a look needed a second pass, that pass is in the same file
 *      after the first), each immediately followed by its edge-<look>.css (the animated frame that EdgeFx draws around the window):
 *        edge, dusk, none, neon, chrome, dream, terminal(edge-crt), sticker, sunset, blocks, stadium, cassette, trailer, sketch,
 *        looks2 (the lock/wallet/route/editor/metro/web/lens/picto/wall/flap row card) + wallet, route, editor, metro, web, lens, flap,
 *        wall, picto, dm(edge-chat), diary(edge-paper), journal(+journal-ink), doodle, arcade, noir, then videofit, android-scenes,
 *        car, tv (platform screens), then glitch, comic, stencil, film, filmstrip, lock
 *   4. android-looks, mini-looks, minsizes: loaded last on purpose, they win over the looks (the per-look last-word size fixes sit at the
 *      end of each look's own file)
 */
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
import './styles/edge.css'
import './styles/song-transition.css'
import './styles/dusk.css'
import './styles/edge-dusk.css'
import './styles/none.css'
import './styles/edge-none.css'
import './styles/neon.css'
import './styles/edge-neon.css'
import './styles/chrome.css'
import './styles/edge-chrome.css'
import './styles/dream.css'
import './styles/edge-dream.css'
import './styles/terminal.css'
import './styles/edge-crt.css'
import './styles/sticker.css'
import './styles/edge-sticker.css'
import './styles/sunset.css'
import './styles/edge-sunset.css'
import './styles/blocks.css'
import './styles/edge-blocks.css'
import './styles/stadium.css'
import './styles/edge-stadium.css'
import './styles/cassette.css'
import './styles/edge-cassette.css'
import './styles/trailer.css'
import './styles/edge-trailer.css'
import './styles/sketch.css'
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
import './styles/lens.css'
import './styles/edge-lens.css'
import './styles/edge-flap.css'
import './styles/flap.css'
import './styles/edge-wall.css'
import './styles/wall.css'
import './styles/edge-picto.css'
import './styles/picto.css'
import './styles/widgets2.css'
import './styles/artdoodle.css'
import './styles/settings.css'
import './styles/dm.css'
import './styles/edge-chat.css'
import './styles/diary.css'
import './styles/edge-paper.css'
import './styles/journal.css'
import './styles/journal-ink.css'
import './styles/edge-journal.css'
import './styles/doodle.css'
import './styles/edge-doodle.css'
import './styles/arcade.css'
import './styles/edge-arcade.css'
import './styles/noir.css'
import './styles/edge-noir.css'
import './styles/videofit.css'
import './styles/android-scenes.css'
import './styles/car.css'
import './styles/tv.css'
import { effectiveVibe } from './hooks/useVibe'
import { useSettings } from './store/settings'
import { usePlayer } from './store/player'
import { useUi } from './store/ui'
import { useBgState } from './store/bgState'
import './styles/glitch.css'
import './styles/edge-glitch.css'
import './styles/comic.css'
import './styles/edge-comic.css'
import './styles/stencil.css'
import './styles/edge-stencil.css'
import './styles/film.css'
import './styles/edge-film.css'
import './styles/filmstrip.css'
import './styles/edge-filmstrip.css'
import './styles/lock.css'
import './styles/edge-lock.css'
import './styles/android-looks.css'
import './styles/mini-looks.css'
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
  root.dataset.arch = 'scene'
  root.dataset.rim = st.rimLight ? 'on' : 'off'
  root.dataset.smooth = st.smoothSongChange ? 'on' : 'off'
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
