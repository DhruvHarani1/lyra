# 4. UI system

## CSS layers (import order in `renderer/src/main.tsx`)
tokens -> base -> widget -> player -> lyrics -> panels -> android -> polish -> redesign -> stage -> vibes -> layouts -> skins -> posters -> states -> cards -> scene -> then, per look, its own file(s) and `edge-<look>.css` -> settings -> videofit -> android-scenes -> car -> tv -> fit-full, fit-mini -> android-looks, mini-looks -> minsizes (last). The exact order is the import list in `renderer/src/main.tsx`: read it, it is long (about 120 stylesheets). Later files win; use specificity or `!important` only where the earlier layout rule also forces a value (known cases: `.full__side` plates, `.lyrics__inner--plain` padding vs `.full.is-cinema .lyrics__inner`).

## Data attributes on `<html>` (set in `main.tsx`)
`data-mode` (minimal/compact/mini/full), `data-vibe`, `data-platform` (android), `data-perf` (low/high), `data-calm` (present = nothing is playing/hidden: pause endless animations), `data-rim`, `data-motion` (on/off), `data-bg-media` (`full`/`mini` when a video/GIF plays), `data-theme` (adaptive/dark/light), `data-ambient`.

## Layout archetypes (`LayoutArch` in `vibes.ts`; CSS `styles/layouts.css` and, for scene, `styles/scene.css`; `FullscreenPlayer` sets `data-arch`)
**Since 0.24 all 34 looks use `scene`**: the look composes its own screen. `scene.css` is the shared mechanics; each look sets geometry variables on `:root[data-vibe=...]` (`--sc-w*` video window, `--sc-c*` player card, `--sc-l*` lyrics region). The archetypes below are the older ones that `layouts.css` still defines.
* `side`: card left, lyrics right (poster). With a video (`is-cinema`) the card shrinks to a dock.
* `dock`: slim bar along the bottom, lyrics own the stage. `orb`: small floating pill, lyrics fill the screen. `bar`: controls inside a bottom letterbox bar, subtitles above. `chat`: one centred column like a messaging app. `term`: two framed panes (terminal) - uses class `is-video` instead of `is-cinema` when a video plays.
* Phone: lyrics first, a dock at the bottom; tablet/foldable (`useWideScreen`): two panes.

## The regions rule
Card, lyrics and controls keep the **same regions** across all states of one look (synced / unsynced / none / video / no video) so nothing jumps when a video arrives late.

## States (every look has all of them) - spec `docs/ui-state-matrix.md`
Video: playing / loading / none / failed. Lyrics: synced / plain (unsynced) / none / instrumental / loading / error / imported. Playback: playing / paused / ad / idle. The 8 canonical screens: full experience, lyrics only, video + unsynced, text only, video + no words, nothing but music, waiting (retry countdown), idle/ad. Components: `LyricsView.tsx` (PlainLyrics), `LyricsFallback.tsx` (`.lfb`), `VideoStatus.tsx` (status pill/card), `StateScreens.tsx`.

## Device classes
Windows fullscreen (16:9 1366x768 / 1920x1080, small 1024x600, portrait), mini player 420x700 (each look composes it differently: `mini-looks.css`), compact 380x140, minimal 296x64, Android phone portrait/landscape/small, tablet, unfolded foldable, home-screen widgets, ambient screen, Android TV (`data-platform=tv`), car mode, the browser viewer and OBS overlay of Lyra Connect.

## Component notes
* `Artwork.tsx`: cover with crossfade; big covers (`artwork--lift`) get three decoration layers for the poster frames.
* `Backdrop.tsx`: blurred cover + gradient blobs (cheap), media layers (`LoopVideo` two stacked videos that crossfade-loop, `YoutubeLayer` iframe with start mask because YouTube flashes controls), frame stats (brightness, letterbox crop), dim logic, status reporting to `useBgState`.
* `MiniPlayer.tsx`: phone strip + dock, wide two-pane, overflow menu with "Next vibe".
* `SettingsPanel.tsx`: tabs (desktop: Look, Lyrics & video, Player, Connect, About; Android: Look, Lyrics, Video, Phone, Connect, About; the Connect tab holds the Devices panel; the page has search and wears the active look), `More` collapsible; vibe gallery cards with swatches.
* `ShareCard.tsx` + `lib/shareCard.ts`: 1080x1920 canvas card, Classic or Doodle in the look's theme.

## Performance
`data-perf=low` (setting Performance auto/smooth/light; weak devices and phones default to low): no live blur, no endless motion. Backdrops use a pre-blurred tiny copy (`useTinyArt`), gradient blobs instead of CSS blur filters. Keep animations on `transform/opacity`.

## Accessibility and robustness
Contrast >= 3:1 for lyrics, text >= 10 px, touch targets >= 44 px on phones, reduced-motion respected, no horizontal page scroll, no text clipped by its box (Gurmukhi/Devanagari glyph tails need `padding-inline-end`).
