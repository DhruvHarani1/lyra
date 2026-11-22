# Engine plan: lyrics, video, start-up

> **Status (2026-11-23, 0.24.1):** all three sections are built. Since 0.20: next-song prefetch (0.21, Spotify queue), an optional start gate (0.22, off by default), a persistent cache for lyrics / YouTube picks / karaoke searches / Apple clip lookups with a Clear cache button, remembered manual choices per song (`core/userChoices.ts`), video ranking and black-bar trimming (0.23). Still open: Apple clip stutter and the "ready before the song" rate are not measured on a real PC (#74, #75), Android has no clip cache. See `docs/handoff/05-lyrics-video-engine.md`. The text below is the original plan and the 0.20.0 status.
>
> **Original status (0.20.0):** section 1 (synced first) done. Section 2: Apple clip disk cache, failure memory (renderer, 14 days) and fade-in done on Windows; pause/resume works on Windows, phone YouTube still plays while paused; no prefetch yet. Section 3 (smooth start) not started.

## 1. Lyrics: synced always wins
Today `LyricsService.lookup` asks providers in order and returns the first `found`, even if it is plain text. Change:
1. Ask providers in order but **do not stop at a plain result**. Keep it as `fallback`, continue to the remaining providers (and to other candidate matches in the same provider: LRCLIB `/search` often has a synced entry when `/get` returned plain).
2. Pick by rank: `synced + word timing` > `synced` > `plain` > `none`; within a rank prefer the closest duration match.
3. If only plain was found, return it with `synced:false` **and keep looking in the background** (a delayed retry after 10 s, 60 s, then on the next play). If a synced result appears, replace the cached entry and push the upgrade to the UI (renderer already supports `apply`).
4. Never cache a plain result as final for more than 24 h (`PLAIN_TTL`).
5. The UI labels it honestly: "Synced" / "Not synced" (docs/ui-state-matrix.md rule on unsynced text).
6. Tests (fake providers + fake clock, like `service.test.ts`): synced beats plain from an earlier provider; plain upgraded to synced later; pin and imported lyrics still win; circuit breaker interactions.

## 2. Video
### 2.1 Pause / resume with the music
`Backdrop.tsx` derives `run = visible && playing && !exporting`. Verify and fix for each source: HTML `<video>` (`LoopVideo`): `pause()`/`play()`; YouTube iframe: `pauseVideo`/`playVideo` over postMessage (already used; handle the startup race where `runRef` changes before `onReady`); keep video time aligned with the song position (seek the clip when resuming if drift > 400 ms, using `useFrameStats`/`getPosition`). Measure: pause -> video frozen < 300 ms.
### 2.2 Apple 30 s preview lags
Causes to check: the clip is proxied through the `lyra-media://preview/` protocol (`net.fetch` per range request, no cache); `useFrameStats` reads frames to detect brightness/letterbox every frame; CSS filters on the video. Plan: (a) download the clip once to a local cache file (`userData/clips`, keyed by URL hash, size-capped) and serve from disk with range support; (b) decode at the display size (`playsInline`, `preload=auto`, `disablePictureInPicture`), no live CSS filter, brightness sampling at 2 fps on a 16x9 canvas; (c) loop with a cross-fade instead of the hard loop seek; (d) `will-change: transform` only, no blend modes.
### 2.3 Other videos lag
YouTube embed: request 720p on weak machines (`vq=hd720` when `perf=low`), drop `hd1080`; keep the masked start (6.5 s) but show the cover meanwhile; pause when not visible.
### 2.4 Remember failures
Extend `youtube-cache` / `itunes-cache` entries with `failures: [{videoId, reason, at}]`. A video that failed with a *deterministic* reason (embedding blocked: error 101/150/152/153) is never offered again for that song (skip to the next candidate immediately); a timeout is retried once after 24 h; a network error is not recorded. The result is keyed by song identity (`core/songKey.ts`).
### 2.5 Prefetch
When a track starts, resolve video + lyrics for the **next** track in the queue (Spotify API gives the queue; Android media session may not) and warm the caches (art, lyrics, YouTube candidates, download the Apple clip). Cap to one prefetch at a time; skip on metered/low battery.

## 3. Smooth start (no long waits)
Goal: when a song starts, lyrics and video are already there.
* Prefetch (2.5) removes the wait for normal playlist playback.
* For the very first track or after a skip to an unknown track: show the vibe's G screen (Waiting) immediately with the music playing. **Do not pause the music by default.**
* Optional "start gate" (off by default, maybe a Settings switch in "Accessibility & battery"): hold playback for **at most 1.5 s** only if both lyrics and video are still loading and the track's first lyric line is more than 5 s into the song (so nothing is missed). Implementation needs a pause/resume command to the player (Spotify API `pause`/`play`, Android `transportControls`); never used for tracks the user seeks within.
* The video fades in over 600 ms when ready; lyrics fade in per line; neither moves the layout (docs/ui-state-matrix.md "same regions").

### Status of section 3 (start gate and the pause/resume test)
* **Start gate: implemented, OFF by default.** Pure decision in `src/core/startGate.ts` (12 unit tests in `startGate.test.ts`), driven by `src/renderer/src/hooks/useStartGate.ts`, switch "Wait a moment for lyrics" under Settings > Video > More (setting `startGate`, desktop only). It holds only if: the switch is on, the song just started (first 2.5 s), the user did not pause/seek, lyrics AND the video (when wanted) are still loading, and the first lyric line is known to be > 5 s in; the hold is <= 1.5 s, ends >= 1 s before that line, and ends early when the lyrics arrive.
* **Limitations:** the first-line time is *remembered from an earlier play* of the song (`localStorage` `lyra.firstLine.v1`, stored when lyrics load), because while lyrics are loading it is unknown. So the gate never fires the first time a song is ever played. It uses the normal `pause` / `play` player commands, so it is Windows-only (the Android path is skipped: no reliable transport control from the WebView yet). Not tested against a real Spotify/Windows player.
* **Pause/resume latency test:** `npm run test:video` (`scripts/ui-test/video-sync.mjs`, ~5 s, needs ffmpeg for a 20 s test clip it generates once). It toggles the fake player live (`window.__setPlaying` in the harness) and checks the visible `<video>` freezes within 300 ms of pause and moves within 300 ms of resume (measured ~40 ms each). Part of the CI `ui` job. It covers the HTML video only, not the YouTube iframe.

## 4. Order of work
1 (synced first) -> 2.4 (remember failures) -> 2.1 (pause/resume) -> 2.2/2.3 (lag) -> 2.5 + 3 (prefetch/start) -> then the UI matrix work.
