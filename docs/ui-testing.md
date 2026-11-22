# UI tests

Everything runs in a real Chromium through the browser harness (`scripts/harness`): the real stylesheets and components with demo data and a mocked `window.lyra`. No Electron or device is needed.

| Command | What it checks |
|---|---|
| `npm run test:ui` | every look (34) on 13 sizes (phone, small phone, landscape phone, tablet, tablet landscape, foldable, Windows minimal / compact / mini, fullscreen 1080p / 768p / small / portrait): 442 screens |
| `npm run test:ui:quick` | 5 sizes (phone, tablet landscape, Windows mini, fullscreen 768p, fullscreen small) x 34 looks = 170 screens (used in CI) |
| `npm run test:ui:states` | lyric outcomes `?ly=plain`, `none`, `offline` on 4 sizes (phone, tablet landscape, Windows 1366x768, mini) x 34 looks (used in CI) |
| `npm run test:settings` | clicks every setting and checks that it changes the app (used in CI) |
| `npm run test:video` | pause / resume latency of the HTML video, needs ffmpeg (used in CI) |
| `node scripts/ui-test/scene-check.mjs --vibe=neon [--size=1366x768,1920x1080] [--state=A,B] [--port=5199]` | one look, every state x window size: **layout only** |
| `node --experimental-transform-types scripts/ui-test/overlay-check.mjs [--out=ui-test-out/overlay]` | the OBS overlay and browser viewer of Lyra Connect against the real hub on loopback (needs no harness server, not in CI) |
| `node scripts/ui-test/vibe-sheet.mjs --vibe=<id> --out=<dir>` | contact sheets per device for design review |

A screen fails when: text is clipped or leaves the window, controls are outside the window, the page scrolls sideways, lyric lines collide, lyrics overlap the card, the lyric you are hearing has less than 3:1 contrast (measured on the real pixels), a touch target is under 36 px, text is under 10 px, or the page throws.

Failing screenshots land in `ui-test-out/shots/` (git-ignored, as is all of `ui-test-out/`). Options for `run.mjs`: `--vibe=neon,dream`, `--device=phone,win-full`, `--video`, `--shots` (keep every screenshot), `--workers=4`.

The harness has switches for edge cases: `?vs=` (video: searching, nokey, none, error, live, preview), `?ly=` (lyrics: plain, offline, resting, error, none, stale), `?lang=hi|pa`, `?android=1`, `?paused=1&t=<ms>` (freeze at a position).

## What the checkers do not do (read before trusting a green run)
* **`scene-check.mjs` only measures layout**: controls outside the card, lyrics leaving their region, card / lyrics / video window sitting on top of each other. It does not measure contrast or whether text clips inside its own box, and it cannot tell you the look is good. Open the screenshots and run `run.mjs` for the same look.
* **`test:ui:quick` / `run.mjs` find the lyric text through two selector lists** (`stageSel` and `nowSel` in `scripts/ui-test/run.mjs`). A new lyric stage that is not listed fails with a false "no lyric text". Add its selectors when you add a stage.
* **CI is Linux, the owner's PC is Windows.** Fonts rasterise differently, so contrast and clip measures can differ and occasionally flake on CI while passing locally (or the reverse). Re-run once, look at the uploaded `ui-test-failures` artifact, keep a margin on contrast and do not tune a threshold to one machine.
* `video-sync.mjs` checks the HTML video only; the YouTube iframe latency is unmeasured.
* None of this runs on real Windows or Android hardware.

## Ports and parallel runs
Each script starts its own Vite harness unless you started one. Ports: `run.mjs` uses `UI_PORT` / `LYRA_UI_PORT` (default 5199), `settings.mjs` is fixed at 5199, `vibe-sheet.mjs` uses `UI_PORT` (default 5197), `video-sync.mjs` is fixed at 5198, `scene-check.mjs` takes `--port` (default 5199 or `UI_PORT`) and expects a harness to be running already. Two runs on one port kill each other, so every parallel run gets its own.

## Running the full suites locally: three harnesses in parallel
The 442-screen matrix is slow, so split it across three ports, each in its own terminal:
```
# bash syntax; in PowerShell set $env:UI_PORT first
UI_PORT=5301 npm run test:ui:quick
UI_PORT=5302 npm run test:ui:states
npm run test:settings                      # uses 5199
```
(then `npm run test:video` on its own, port 5198, and `npm run test:ui` when you need the full matrix, on a free port). In a git worktree: junction `node_modules` from the main checkout, copy the git-ignored `scripts/harness/public/*.mp4` clips (`scripts/harness/make-video.sh` regenerates them with ffmpeg), and kill stale `vite` servers first. While building a look, run one visual check per look (`vibe-sheet.mjs`, `scene-check.mjs`); run the full suites once at the end.

## Lyrics-state matrix
`npm run test:ui:states` renders every look on phone, tablet landscape, Windows 1366x768 and the mini player with `?ly=plain`, `?ly=none` and `?ly=offline`; it fails on clipping, contrast, an empty screen, or plain lyrics not shown (`.plain__stanza`).

## Video follows the music
`npm run test:video` plays a generated clip through the harness, pauses and resumes the fake player live and checks the video freezes / moves within 300 ms (HTML video only; needs ffmpeg). It is part of the CI `ui` job.
