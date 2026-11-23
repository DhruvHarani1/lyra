# Lyra: context for the next session

Read this first. It says what Lyra is, how the repo works, how to test and release, what has been done, what the owner (Dhruv) asked for next, and the rules we work by. Everything here is current as of **2026-11-23** (Windows 0.26.0, Android 0.12.0, 34 looks).

## 1. What Lyra is
A free, open-source, account-free lyrics companion. It shows word-by-word synced lyrics over the music video of what you play, on **Windows** (Electron) and **Android** (a Kotlin shell around the same React UI in a WebView). Sources of what is playing: Windows media controls (Spotify desktop app), the Spotify Web API, the Android media session, or a built-in demo.

## 2. Repository map
| Path | What |
|---|---|
| `src/renderer/src` | The React UI, shared by Windows and Android: `components/` (incl. `fx/` look effect layers, `EdgeFx.tsx` the per-look window edge, `DmKinds.tsx` the DM message kinds, `DevicesPanel.tsx`, `CarMode.tsx`, `KaraokeScreen.tsx`), `hooks/`, `store/` (incl. `connect.ts`, `room.ts`, `jam.ts`), `lib/` (incl. `codeGen.ts` real code for the Editor look, `journalInk.ts` the Journal pens, `car.ts`), `styles/*.css` |
| `src/main`, `src/preload` | Electron main process, IPC, settings, windows, SMTC/Spotify sources, `updater.ts` (electron-updater), `studio.ts` (lyric-video export) |
| `src/main/connect` | Lyra Connect host: `hub.ts` (http + WebSocket state machine), `ws.ts` (own RFC 6455 server), `mdns.ts` (`_lyra-connect._tcp`), `net.ts` (LAN address and origin checks), `viewerHtml.ts` (browser viewer), `overlayPage.ts` (OBS overlay), `pwa.ts`, `service.ts` (glue, device store `connect-devices.json`) |
| `src/core` | Platform-agnostic engine: `lyrics/` (LRCLIB + public-domain providers, ranking, `romanize.ts` for Hindi/Punjabi), `background/` (video choice, YouTube, iTunes, failed videos, black-bar crop), `cache/` (`PersistentCache`, the "Clear cache" registry), `connect/` (protocol, pairing, HMAC, clock sync, role redaction), `karaoke/`, `clock.ts`, `userChoices.ts` (what you picked by hand, per song), `resilience.ts`, `songKey.ts`, `startGate.ts`, `platform.ts` interface |
| `src/shared` | Types, IPC names, shortcuts, `vibes.ts` (the 34 looks + smart picker), `lrc.ts`, `lyraFeed.ts` (what the OBS overlay renders) |
| `src/android-web` | The Android side of `window.lyra` (same core, inside the WebView), plus the `tv`, `car`, `ambient` and `record` entries |
| `android/` | Kotlin (`dev.lyra.android`): `MediaMonitor`, `LyricsNotifier`, `LyraWidget`, recorder, overlay, ambient / always-on (`AmbientActivity`, `AodLyricsView`), `LyraDream` screen saver, and the packages `car/`, `tv/` (`TvActivity`, `PairedSource`, `ConnectTransport`), `update/` (in-app updater: `UpdateManager`, `ApkVerifier`) |
| `scripts/harness` | A browser harness: the real UI with demo data and a mocked `window.lyra` (see section 4) |
| `scripts/ui-test` | `run.mjs` (UI matrix), `settings.mjs`, `scene-check.mjs` (one look, every state and size), `vibe-sheet.mjs` (contact sheets), `video-sync.mjs`, `overlay-check.mjs` (real Connect hub + Chromium) |
| `docs/` | Design notes. **Start with** `docs/handoff/README.md` (a 13-part pack), then `docs/ui-state-matrix.md`, `docs/engine-plan.md`, `docs/roadmap.md`, `docs/connect-redesign.md` |

## 3. Key concepts
* **Vibe / look** (`src/shared/vibes.ts`): a complete look. There are **34** (`VIBES`). Each has its own lyric *stage* (`LyricsStage.tsx`, 35 `LyricStyle` kinds), background FX (`VibeFx.tsx`, `components/fx/`), a window **edge** (`EdgeFx.tsx` + `styles/edge-<look>.css`, driven by the line being sung), a video window, a player card, a mini-player composition, an Android dock, a share card and a Settings skin. Since 0.24 every look uses the `scene` layout archetype (`styles/scene.css` is the shared mechanics, each look sets its own geometry as CSS variables); the older archetypes (side / dock / orb / bar / chat / term) remain in `LayoutArch` and `layouts.css` for the legacy paths. Modes: Fixed, Every song (cycle a chosen pool), Smart (`pickVibe` scores words, pace, year, cover colours). `V` / `Shift+V` cycles. The look is designed, not configured: `lockLook` in `store/settings.ts` ignores old layout/typeface values.
* **Song identity** (`core/songKey.ts`): `artist|title` normalised. Lyric picks, video picks, imported lyrics, vibe picks and timing nudges are stored under it so they survive switching player. `core/userChoices.ts` is the one place for "what the user picked by hand" and wins over automatic ranking.
* **Resilience** (`core/resilience.ts`): backoff + jitter, retry, circuit breaker. Used by the lyrics service and the video lookups. Lyrics: stale-if-error, no false "no lyrics", imports (`.lrc/.srt/.txt`), per-service health in Settings.
* **Persistent cache** (`core/cache/persistentCache.ts`): versioned, size-capped, TTL'd stores for lyrics, YouTube picks, karaoke searches and Apple clip lookups; one registry so Settings -> **Clear cache** can forget them (pinned and imported lyrics and user choices are not cleared). Lyrics are synced-first: a plain result never beats a synced one and is re-checked after 24 h.
* **Lyra Connect** (Windows host, off by default): pairs other screens on the LAN (QR or 8-character code, per-device tokens, challenge-response, signed commands, roles viewer / controller / overlay, party mode, follow-me by a shared clock, OBS overlay link, browser/PWA viewer). Spec `docs/connect-protocol.md`, rationale and honest limits `docs/connect-redesign.md`. Plain unencrypted ws/http by design for now. Rooms / Jam over PeerJS is a separate, older internet feature (`store/room.ts`, `store/jam.ts`).
* **VideoStatus** (`components/VideoStatus.tsx`, `store/bgState.ts`): one place that says what the video behind the lyrics is doing.
* **Clock** (`core/clock.ts`): one position clock for playback interpolation; the karaoke screen smooths it (`core/karaoke/clockSmooth.ts`).
* **Performance**: `data-perf` (Auto/Smooth/Light), `data-calm` pauses endless animations when paused/hidden; the backdrop picture is pre-blurred (`useTinyArt`).
* **Android parts**: widgets (eight), notification + lock-screen card, always-on lyrics screen and screen saver (`docs/android-ambient.md`), car mode for passengers (`docs/android-car.md`; Lyra declares no Android Auto media app on purpose), TV screen (`docs/android-tv.md`, one APK), in-app updater for GitHub-installed APKs (`android/.../update/`; skips Play / F-Droid builds).

## 4. How to run things
```
npm ci
npm run typecheck && npm test                 # unit tests (vitest, 31 *.test.ts files plus Kotlin unit tests under android/)
npm run dev                                    # Electron (Windows)
npx vite -c scripts/harness/vite.config.ts --port 5199   # the browser harness
npm run test:ui            # every look x 13 sizes (34 x 13 = 442 screens)
npm run test:ui:quick      # 5 sizes x 34 looks = 170 screens (CI)
npm run test:ui:states     # lyric states (plain / none / offline) on 4 sizes (CI)
npm run test:settings      # clicks every setting (CI)
npm run test:video         # video pauses with the music, needs ffmpeg (CI)
node scripts/ui-test/scene-check.mjs --vibe=neon --port=5199   # one look: every state x size (layout only, see section 9)
node --experimental-transform-types scripts/ui-test/overlay-check.mjs   # OBS overlay + viewer against the real Connect hub
npm run build && npm run build:android-ui
npm run check:docs         # relative links and referenced src paths in the docs exist
```
Harness URL switches: `?mode=mini|compact|minimal|full`, `?android=1`, `?paused=1&t=<ms>`, `?video=night|day`, `?vs=searching|nokey|none|error|live|preview`, `?ly=offline|resting|error|none|stale|plain`, `?lang=hi|pa`, `?s=<json settings>`, `?panel=settings|queue|lyrics`. `window.__next()` plays the next demo song. Playwright + Chromium work in the cloud container; `ffmpeg` generates the test clips (`scripts/harness/make-video.sh`). Details: `docs/ui-testing.md`.

## 5. Release procedure
1. Work on a branch, open a PR, wait for CI (`check`, `ui`, CodeQL), squash-merge.
2. Bump `package.json` (+ lock) and `android/app/version.properties` (versionCode must rise).
3. Dispatch the workflows **on main with `publish=true`**: `release.yml` (Windows installer, `latest.yml`, becomes "latest", the updater serves it) and `android.yml` (APK, `--latest=false`). GitHub creates the tag and release itself. Pre-release is decided from the **version** (a dash means pre-release), not the tag name. **The release workflows require a green CI for the commit, with a force override** (being added by another agent in this round: check `.github/workflows/release.yml` and `android.yml` for the exact input name before relying on it; not verified at the time of writing).
4. Verify both releases exist with their files (`gh release list`; `v<ver>` has the `.exe`, `.blockmap`, `latest.yml`; `android-v<ver>` has the `.apk`).
Tag pushes and `git push --force` are blocked in the cloud environment; use the workflow route.

## 6. Rules of engagement (from the owner)
* Do the work, verify it, ship it; do not wait to be asked. Share screenshots and honest reports. Be explicit about what is **not** tested (no Windows machine, no Android device in the cloud).
* The owner tests the releases on a real PC and Android phone and sends bugs.
* Original designs only (no trademarked logos or art); pop-culture vibes are *inspired by*, never copies.
* Keep Settings simple and human; remove what is not needed.
* PRs follow `.github/pull_request_template.md`; commits end with the Co-Authored-By trailer given by the session.

## 7. State of the world (2026-11-23, Windows 0.24.1 / Android 0.10.1)
**Releases** (from `gh release list` and `website/whats-new.html`; Windows `vX` and Android `android-vX` ship together):
| Windows | Android | Date | What |
|---|---|---|---|
| 0.22.0 | 0.8.0 | 2026-11-21 | player-card plate per look, Stencil and Film Reel (20 looks), widget palettes, Android queue, optional start gate, video pause/resume test |
| 0.23.0 | 0.9.0 | 2026-11-22 | 30 looks each with its own screen, video window, card and edge; Lyra Connect (pairing, roles, follow-me, party, remote control); smarter picks and persistent cache; karaoke and recording work; OBS overlay; Android TV screen; eight widgets, lock-screen card, always-on screen, car mode, in-app updater; Settings redesign with search; website redesign (PR #82) |
| 0.24.0 | 0.10.0 | 2026-11-22 | 33 looks (Journal, Doodle added), per-look edges moving with the song, Editor shows real code, Journal pens, DM as a real chat (PR #84) |
| 0.24.1 | 0.10.1 | 2026-11-22 | Dusk Ridge (34th look), mini player composition per look, Android looks (docks, play buttons, progress bars), new website screenshots (PR #85) |
| 0.25.0 | 0.11.0 | 2026-11-23 | Wallet fixed, Lyra Connect hardening, TV pairing client, lighter edges, one CSS file per look, WebP website shots (made by another session) |
| 0.26.0 | 0.12.0 | 2026-11-23 | song-change effects (10 view-transition effects, a different one each time) and an optional volume fade between songs (`docs/song-transitions.md`) |
Earlier: 0.18 vibes, 0.19 per-look layouts and tablet, 0.20 fixed look and clip cache, 0.21 per-look states and prefetch. Android 0.4 to 0.10 ran in step.

**What exists now:** 34 looks with designed screens for synced / unsynced / no lyrics / video on Windows full screen, mini player, and the Android phone and tablet; Lyra Connect (docs above); synced-first lyrics engine with persistent caches, remembered manual choices, karaoke screen with count-in and word fill, lyric-video export (Windows), share cards per look, Hindi / Punjabi romanization (offline), Android widgets / notification / lock-screen card / always-on / car / TV / updater, the website, UI tests in CI (`test:ui:quick`, `test:ui:states`, `test:settings`, `test:video`).

**Website** (lyra-website-rho.vercel.app, deployed by Vercel from `website/` on main): `index.html`, `vibes.html` + `vibes.js`, `whats-new.html` (add an entry per release), `site.css`, `site.js`, `demo.*`, `vibes-data.js` (regenerate from `src/shared/vibes.ts` when a look is added), `room.html` (Listening together). Screenshots in `website/assets/shots/` come from `scripts/make-site-shots.mjs` (needs the harness and a calm `site.mp4`, git-ignored).

**Open items (honest):**
* **TV pairing is being redesigned by another agent**; the Android TV screen and its pairing with a PC were never run on a real TV or emulator.
* Several Android parts were verified by compile, unit tests and the browser harness only, not on real devices: widgets on real launchers (#76), car mode, always-on screen, in-app updater, recording on many phones.
* **Not built:** word-level sync from LRCLIB (the engine reads enhanced LRC, LRCLIB rarely has it), romanization for Chinese / Japanese / Korean (Hindi and Punjabi exist), **Chromecast (skipped)**, **macOS (not supported)**, encrypted Connect traffic (TLS with a pinned certificate is planned), merging Rooms onto the Connect protocol.
* **Windows installer is unsigned** (#53): SmartScreen warns.
* Apple clip stutter and YouTube iframe latency never measured on a real PC (#74); no measured "ready before the song" rate (#75); more looks (#77, standing).
* Dead `fullLayout` code paths remain (no effect); Electron major bumps from Dependabot are unreviewed.

## 8. What the owner asked for NEXT (organised)
See `docs/roadmap.md`. The earlier big asks are done: a fixed designed UI per look for every state (still open in spirit: per-cell polish on mini and tablet), no UI-manipulation settings, everything per look (card, share card, Settings skin, edge, mini player), synced-first lyrics, video that follows the music, smooth start. Ongoing: more looks (sports / games / music / movie themes), real-device testing by the owner, and the TV pairing redesign.

## 9. Pitfalls we hit
* `paused=1` in the harness must freeze the position or tests drift into instrumental gaps.
* A generic rule forces the active lyric word white in non-light themes (`lyrics.css`); light looks must override it.
* Android `RemoteViews` supports only a few view types; widgets compile in CI but are untested on devices.
* 3D transforms on lyric lines made neighbours collide; depth is size + opacity only.
* **`scene-check.mjs` only measures layout** (controls outside the card, regions overlapping). It says nothing about contrast, clipping of text inside boxes or whether the look is good: look at the screenshots and run `run.mjs` too.
* **`test:ui:quick` needs the lyric-stage selectors**: `run.mjs` finds the lyric text through `stageSel` / `nowSel` (about line 74 and 86). A new lyric stage that is not in those lists gives a false "no lyric text" failure; add its selectors when you add a stage.
* **CI renders on Linux, the owner's PC is Windows.** Font rasterisation differs, so contrast and clip measures that pass locally can flake on CI (and the reverse). Re-run before assuming a real regression, keep margin on contrast (commit c968130 deepened the DM outgoing bubble "so the lyric contrast has margin") and do not tighten thresholds to the pixel.

## 10. How to work with several agents at once
Forked workers in git worktrees each take one area on their own branch and the main session merges. Lessons from 0.22 to 0.24:
* Give every worker its **own dev-server port** (`UI_PORT`, `--port`): two runs on one port kill each other. `vibe-sheet.mjs` defaults to 5197, `video-sync.mjs` is fixed at 5198, the others to 5199.
* A worktree has no `node_modules`: use a **junction** to the main checkout's (Windows: `mklink /J`), and remember Vite then refuses to serve fonts from the real path (fake clipping or contrast failures): allow the path or copy.
* Also copy the git-ignored harness clips (`scripts/harness/public/*.mp4`).
* Kill stale `vite` servers before a visual check; an old server serves old CSS. Write contact sheets to a fresh path.
* Split files by owner (one agent per area: looks, Connect, Android, website, docs) so merges do not collide; shared files (`vibes.ts`, `main.tsx` CSS import order) need one person.
* Run one **visual check per look**, the full test suites once at the end (see `docs/ui-testing.md`: three harnesses in parallel on different ports).
* Review and merge real contributor PRs; do not copy the change and close them.

## 11. How to review a look
`node scripts/ui-test/vibe-sheet.mjs --vibe=neon --out=/tmp/x` writes one contact sheet per device (video / no video x synced / unsynced / no lyrics). Then `node scripts/ui-test/scene-check.mjs --vibe=neon` for layout, `npm run test:ui:states`, and `node scripts/ui-test/run.mjs --vibe=<id>`.
