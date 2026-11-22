# 2. Architecture

## Repo map
```
src/
  shared/        types, vibes catalogue, LRC parsing, word timing, ipc channel names (used by every side)
  core/          pure logic with unit tests: lyrics service + providers, background resolver (video), persistent cache, user choices, Connect protocol, karaoke, clock, resilience, songKey, startGate
  main/          Electron main process: window, tray, shortcuts, Spotify/SMTC source, lyrics + background services, settings, updater, Lyra Connect host (`main/connect/`), studio export
  preload/       contextBridge API (window.lyra) -> ipc
  renderer/src/  React UI (components/, hooks/, store/, styles/, lib/)
  android-web/   Android entry: same React UI + a JS implementation of window.lyra backed by the Kotlin bridge (api.ts, rpc.ts)
android/         Kotlin app: MediaMonitor, LyricsNotifier, LyraWidget, RecordService, AmbientActivity, car/, tv/, update/ (in-app updater), WebView host
native/          Windows helper (lyra-media.exe, SMTC/volume)
website/         marketing site (static HTML/CSS/JS)
scripts/         harness/ (browser mock app), ui-test/ (Playwright tests), make-site-shots.mjs, gen-cards.py, icon tools
docs/            plans, specs, images; docs/handoff/ is this pack
build/ packaging/ fastlane/ fdroid/ resources/   packaging and store assets
```

## Processes (Windows)
Electron: **main** (Node) <-> **preload** (contextBridge `window.lyra`) <-> **renderer** (React). IPC channel names live in `src/shared/ipc.ts`; types in `src/shared/types.ts`. The renderer never touches Node; it calls `window.lyra.*` (spotify, player, lyrics, background, settings, art, moments, app, studio...).

## Platforms share the UI
The same renderer code runs on Android. `src/android-web/api.ts` implements the same `window.lyra` interface with `fetch` for lyrics services and an RPC bridge (`rpc.ts`) to Kotlin for media session, settings, notification, widget, recording. `document.documentElement.dataset.platform` is `'android'` there; CSS and code branch on it. Android build: `npm run build:android-ui` (vite, `vite.android.config.ts`) writes into `android/app/src/main/assets/`.

## Windows modes
`data-mode` on `<html>`: `minimal` (296x64 pill), `compact` (380x140), `mini` (~420x700 player with lyrics), `full` (fullscreen). Components: `CompactWidget.tsx`, `MiniPlayer.tsx`, `FullscreenPlayer.tsx`. Android has `MiniPlayer` (phone strip + dock, tablet two-pane via `useWideScreen`), ambient screen (`ambient.tsx`), record screen.

## Data flow for one song
1. Player source emits a `PlaybackSnapshot` (track, position, isPlaying) -> `store/player.ts` (zustand). `getPosition()` interpolates between snapshots.
2. `store/lyrics.ts` asks `window.lyra.lyrics.get(track)`; main's `LyricsService` (core) tries providers with retry/circuit breaker/cache; result `LyricsResult` status `synced|plain|none|error`.
3. `useLyricsSync` finds the active line; `LyricsView` renders classic list or a staged style (`LyricsStage`) depending on the vibe's `style`.
4. `Backdrop.tsx` asks `useBackground` -> `window.lyra.background.resolve(track)` -> resolver picks user file / Apple clip / YouTube / living art; renders `<video>` or YouTube iframe behind everything.
5. `useEffectiveVibe` decides which vibe is on; `main.tsx` mirrors it to `<html data-vibe>`; CSS does the rest.
6. `usePrefetchNext` warms the next queued song; `useStartGate` (off by default) may hold playback <=1.5 s.

## State stores (zustand)
`store/settings.ts` (settings + `lockLook`), `store/player.ts`, `store/lyrics.ts`, `store/ui.ts` (mode, panel, toasts, `vibeNow`), plus a small `useBgState` inside `Backdrop.tsx` (video status).

## Persistence
Main: `JsonStore` files in userData (`settings.json`, `backgrounds.json`, lyrics cache, favourites, moments, youtube/itunes caches). Renderer: only tiny conveniences in `localStorage` (e.g. `lib/failMemory.ts`). Android: SharedPreferences for the widget vibe and settings via the bridge.

## Key invariants
* Settings are sanitised in `src/main/settings.ts` (`sanitize`) so corrupt files never break the UI.
* The renderer must work in the browser harness with a mocked `window.lyra` (`scripts/harness/entry.ts`).
* `src/shared` and `src/core` must stay free of Electron/DOM imports.

## Subsystems added in 0.23 and 0.24
* **Lyra Connect** (`src/core/connect` pure + tested, `src/main/connect` host, `renderer/.../DevicesPanel.tsx` UI, `store/connect.ts` publisher). The main process owns playback, so song, position, lyrics and art come from it; the vibe in effect, the resolved video id and the per-song offset are renderer knowledge and are reported over `connect:view` (see `src/shared/ipc.ts` for the `connect:*` channels). Spec: `docs/connect-protocol.md`; why and limits: `docs/connect-redesign.md`. Clients: the browser viewer (`viewerHtml.ts`, installable as a PWA via `pwa.ts`), the OBS overlay (`overlayPage.ts`, `shared/lyraFeed.ts`), the Android TV client (`android/.../tv/`; its pairing is being redesigned).
* **Persistent cache and user choices** (`core/cache/persistentCache.ts`, `core/userChoices.ts`): see doc 5.
* **EdgeFx** (`components/EdgeFx.tsx` + `styles/edge-<look>.css`): a fixed frame over the window that animates with the line being sung (five CSS variables written on `<html>`: `--lp` progress through the line, `--li` line index, `--lt` flips each new line, `--ts` song position in seconds, `--lv` 1 while a line is sung). One CSS file per look.
* **fx components** (`components/fx/FourFx.tsx`, `Looks25.tsx`): the effect layers of the newer looks; `VibeFx.tsx` dispatches by look. `DmKinds.tsx` renders DM message kinds (voice note, poll, location, sticker, contact, photo, link preview, reply, reaction); `lib/codeGen.ts` turns lyrics into syntax-highlighted code for Editor; `lib/journalInk.ts` picks the Journal pens.
* **Updater**: Windows uses electron-updater against GitHub Releases (`main/updater.ts`, checks on a timer). Android builds installed from GitHub use `android/.../update/` (`UpdateManager`: WorkManager check at most every 12 h, resumable download, SHA-256, same signing certificate, PackageInstaller); store builds do not run it. `src/renderer/src/components/UpdateRow.tsx` / `AndroidUpdateRow.tsx` are the Settings rows.
* **TV** (`android/.../tv/`, `src/android-web/tv.ts`, `styles/tv.css`, `docs/android-tv.md`): one APK, `?tv=1` page boots the desktop full-screen mode, D-pad navigation, `TvDream` screen saver. Source: the TV's own media session, or paired with a PC. **Never run on a TV or emulator.**
* **Car mode** (`CarMode.tsx`, `lib/car.ts`, `store/car.ts`, `android/.../car/`, `docs/android-car.md`): a passenger screen, opened by hand, never automatic. Lyra deliberately declares no Android Auto media app.
* **Ambient / always-on** (`AmbientActivity`, `AodLyricsView`, `LyraDream`, `docs/android-ambient.md`): Android does not let third-party apps draw on the system always-on display; Lyra offers a native always-on lyrics screen and the lock-screen card instead.
