<p align="center">
  <img src="docs/images/icon.png" width="96" alt="Lyra" />
</p>

<h1 align="center">Lyra</h1>
<p align="center"><b>Lyrics that move with the music.</b><br />
Word-by-word synced lyrics over the music video of what you play. For Windows and Android. Free, open source, no account.</p>

<p align="center">
  <a href="https://github.com/DhruvHarani1/lyra/releases/latest"><img alt="Download for Windows" src="https://img.shields.io/github/v/release/DhruvHarani1/lyra?label=Windows&logo=windows&style=for-the-badge" /></a>
  <a href="https://github.com/DhruvHarani1/lyra/releases?q=android"><img alt="Download for Android" src="https://img.shields.io/badge/Android-APK-3DDC84?logo=android&logoColor=white&style=for-the-badge" /></a>
  <a href="https://lyra-website-rho.vercel.app"><img alt="Website" src="https://img.shields.io/badge/Website-live%20demo-111?style=for-the-badge" /></a>
</p>
<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue" />
  <img alt="No account, no tracking" src="https://img.shields.io/badge/no%20account-no%20tracking-success" />
  <a href="https://github.com/DhruvHarani1/lyra/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/DhruvHarani1/lyra/total" /></a>
  <a href="https://github.com/DhruvHarani1/lyra/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/DhruvHarani1/lyra?style=flat" /></a>
</p>

<p align="center">
  <img src="docs/images/demo.gif" width="560" alt="Lyra showing synced lyrics over a music video" />
</p>

## Why Lyra

- **Every word, on time.** Words fill in as they are sung, including Hindi, Punjabi and other scripts.
- **Over the music video.** The official video (or your own clip) plays softly behind the lyrics, and the whole UI takes on the cover's colours.
- **A floating widget on Windows, a screen saver on Android.** Fullscreen lyrics, a lock-screen card, and an ambient mode with a clock for the desk.
- **Export a lyric video.** One button makes a finished MP4 of the chorus or the whole song, from what is playing or from your own audio file (faster than real time) (Reels 9:16, 4:5, square or 16:9 up to 1440p) with the music, word-by-word lyrics and a small Lyra badge. The official YouTube video can play behind the lyrics. Windows.
- **Share a lyric card.** Tap the share icon on any line to make a story-sized image with the song, the cover colours and your lines.
- **Listen together.** Share a room link and friends see your synced lyrics live in any browser. Friends with Lyra can join and keep their own player in sync with yours.
- **Lyra Connect (Windows, off by default).** *Settings → Connect → Devices* pairs other screens on your Wi-Fi with a QR code or a short code. Each device gets its own token and a role (viewer, or controller that can play, pause, skip and change the look), and you can disconnect any of them. A device that follows you shows the same song, lyrics, video and look in time. Party mode shares one viewer-only code with a group, an OBS overlay link gives streamers a transparent lyrics page, and any browser can be a viewer (it can be installed as a web app). Connect is plain unencrypted LAN traffic: pair on a network you trust ([PRIVACY.md](PRIVACY.md)). Sound is never streamed: each device plays its own music.
- **34 looks, each its own screen.** Neon, Cinema, DM, Terminal, Editor, Journal, Split-flap, Dusk Ridge and more: every look has its own lyric style, video window, player card, window edge, mini player and share card. Lyra can pick one for you per song, or you can pin one.
- **Smarter picks, remembered.** Synced lyrics always outrank plain ones, videos are ranked (official first), what you pick by hand is remembered per song, and a persistent cache means a song you played before starts instantly. *Settings → Clear cache* wipes it.
- **Karaoke and recording.** A karaoke screen with a count-in and word-by-word fill; lyric-video recording picks a preset for your PC and uses less memory.
- **More on Android.** Phone and tablet layouts for every look, eight home-screen widgets, a lock-screen card, an always-on lyrics screen, a car mode for passengers, a screen saver, an Android TV screen with D-pad control, and an in-app updater for the GitHub APK (it verifies SHA-256 and the signing certificate). Honest status: much of this was built and tested in a browser harness, unit tests and CI only. TV pairing with a PC and the TV screen itself were never run on a real TV or emulator, and the widgets, car mode, always-on screen and updater are verified by compile, unit tests and the browser harness rather than on every device (a TV pairing redesign is in progress).
- **Private.** No account, no ads, no analytics. Everything runs on your device. See [PRIVACY.md](PRIVACY.md).

<p align="center">
  <img src="docs/images/fullscreen.jpg" width="62%" alt="Fullscreen lyrics" />
  <img src="docs/images/widget.jpg" width="22%" alt="Widget" />
</p>
<p align="center"><img src="docs/images/demo-hindi.gif" width="420" alt="Hindi lyrics over a video" /></p>

## Install

| Platform | How |
|---|---|
| **Windows 10/11** | Download `Lyra-Setup-x.y.z.exe` from the [latest release](https://github.com/DhruvHarani1/lyra/releases/latest), or `winget install DhruvHarani1.Lyra` once it is listed. Windows may show a SmartScreen notice because the app is not code-signed yet: choose *More info → Run anyway*. |
| **Android 8+** | Download `Lyra-Android-x.y.z.apk` from the [Android releases](https://github.com/DhruvHarani1/lyra/releases?q=android) and open it. Grant *Notification access* so Lyra can see what is playing. F-Droid / IzzyOnDroid listings are being prepared. |

Lyra reads the **Spotify desktop app** on Windows by default (through Windows media controls). Turn on *Settings → Startup & keys → Advanced → Follow other players* to follow the current Windows media session instead, including Apple Music and supported browsers. Android reads media sessions from any media app. Lyrics come from the free [LRCLIB](https://lrclib.net) database.

## Help it grow

Star the repo, tell a friend, or open an issue. Good first issues are labelled. Translations, new lyric sources and bug reports are all welcome: see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Build and run from source
Requirements: Node 20+, the **Spotify desktop app** (not the web player).

```bash
npm install
node node_modules/electron/install.js   # only if you get "Electron uninstall"
npm run dev        # development
npm test           # unit tests (vitest)
npm run typecheck
npm run build && npm start   # production build preview
npm run dist       # Windows NSIS installer in ./release
npm run dist:local # same, but works around antivirus EPERM rename failures
```
Play a song in Spotify — the widget shows it. Click the widget to expand; fullscreen button (or `F`) for immersive lyrics. No Spotify handy? *Settings → Music source → Demo*.

## Music sources
| Source | Needs | Gives | Missing |
|---|---|---|---|
| **Windows (default)** | Spotify desktop app | title, artist, album, artwork, position, play/pause/next/previous/seek, **system volume**, release year (MusicBrainz), Lyra-local favorites ♥ | queue, shuffle/repeat (buttons hidden), syncing likes to Spotify |
| Spotify API (optional) | your own Spotify Developer app (Client ID) | everything above + volume, queue, likes, devices | **Premium** for any control; Dev Mode needs a Premium app owner and your account under *User Management* |
| Demo | nothing | simulated playback with sample lyrics | — |

How the default works: a tiny native helper (`resources/lyra-media.exe`, ~14 KB, C#) subscribes to the Windows System Media Transport Controls events and streams JSON to the app (`src/main/smtc`, `native/lyra-media`). It is event-driven (≈0% CPU idle) and only follows a session whose app id contains "Spotify". The opt-in *Follow other players* setting uses the current Windows media session, falling back to the first playing session; metadata and controls depend on what each player exposes. Rebuild it with `npm run build:helper` (needs the Windows SDK; the built exe is committed). If the exe is missing the app falls back to a PowerShell bridge. Volume (opt-in: *Settings → System → Control system volume*) is the Windows master volume via Core Audio. Release year is looked up once per song on MusicBrainz and cached. Favorites are stored locally in `favorites.json`.

### Optional: Spotify API setup (on hold — implemented but not yet tested against a real account)
1. https://developer.spotify.com/dashboard → *Create app* (Web API).
2. Redirect URI, exactly: `http://127.0.0.1:53682/callback`
3. Copy the **Client ID** (PKCE — no secret). Paste it in *Settings → Music source → Spotify API*, or set `SPOTIFY_CLIENT_ID` in `.env` (see `.env.example`).
4. Add your account under *User Management*.

Tokens are encrypted with Windows DPAPI (`safeStorage`); passwords are never seen. The API source polls (3 s playing / 6 s paused / 5–15 s idle, honours `Retry-After`).

## Lyrics
**LRCLIB** (free, keyless, timestamped LRC; descriptive User-Agent; no scraping). Line-synced; word-level timing is supported by the engine (enhanced LRC) but LRCLIB rarely has it — the demo shows it. Results are cached on disk. Plain-only lyrics are shown unsynced, with a notice. Use the `−`/`+` footer (or `[` `]`) to nudge sync. Providers are pluggable: implement `LyricsProvider` in `src/core/lyrics/provider.ts`, add it to the chain in `src/core/lyrics/service.ts` (today: LRCLIB, then a public-domain fallback).

## Animated backgrounds (cinematic mode)
Spotify's own looping "Canvas" videos have no public API, so Lyra offers three legitimate sources, all optional (Settings → Background, one on/off switch):
1. **Living artwork** (default) — the cover art drifts and breathes with the palette. No network, no key.
2. **Your own file** — a GIF, image, MP4 or WebM, for every song or just one song. Copied into Lyra's folder.
3. **Official video** — paste a free YouTube Data API v3 key and the official music video plays muted behind the lyrics (cached per song to save quota; pick another video if it guessed wrong).

Auto order: your per-song file → your global file → a free 30 s Apple music-video preview when one exists → YouTube (only if you added a key) → living artwork. Videos pause while the window is hidden or reduce-motion is on.

## Android
Lyra also runs on Android (8.0+). It is the same UI and the same shared core (`src/core`), inside a small Kotlin shell (`android/`). Current: Android 0.10.1. Details: `docs/android-*.md`, `docs/DISTRIBUTION.md`.

## Notes & limits
- Windows can't blur the desktop behind a transparent window, so "glass" = translucent panel + blurred artwork layer, not true acrylic.
- Always-on-top uses the highest topmost level and is re-asserted on blur and every 2.5 s.
- Spotify changed Development-Mode API rules in 2025–26; API features degrade (disabled buttons, explanations) instead of failing.

## Layout
```
src/shared     types, IPC contract, LRC parser (+tests), shortcut list, vibes.ts (the 34 looks), lyraFeed
src/core       platform-free engine (shared with Android): lyrics/ (providers, ranking, romanize), background/ (video choice),
               cache/ (persistent cache), connect/ (protocol, pairing, clock sync), karaoke/, clock.ts, userChoices.ts, resilience.ts
src/main       window (modes, tween, drag, monitors) · tray · shortcuts · settings · updater
               smtc/ (Windows media bridge) · spotify/ (PKCE API) · connect/ (Lyra Connect host: http + WebSocket, mDNS, viewer, OBS overlay)
               lyrics/ · background/ · meta/ · demo/ · artwork · studio (lyric-video export) · ipc
src/preload    typed contextBridge API
src/renderer   store/ · hooks/ · components/ (incl. fx/, EdgeFx, DevicesPanel) · styles/ (one set of CSS files per look)
src/android-web  the Android side of window.lyra, TV / car / ambient entries
android/       Kotlin shell: media session, notification, widgets, recorder, ambient/always-on, car/, tv/, update/ (in-app updater)
scripts        browser harness + Playwright UI tests, gen-cards.py, make-site-shots.mjs
docs           design notes; docs/handoff/ is the pack for a new maintainer; CONTEXT.md is the first thing to read
```
## Keys
Global: Ctrl+Alt+Space play/pause · Ctrl+Alt+←/→ prev/next · Ctrl+Alt+L expand · Ctrl+Alt+F fullscreen · Ctrl+Alt+H show/hide.
In-app: Space, ←/→ seek, Shift+←/→ tracks, ↑/↓ volume (API source), F, Esc, D (distraction-free), `[` `]` lyric offset.

## Roadmap
Open work lives in the GitHub issues and `docs/roadmap.md`. Not built yet: word-level timing from LRCLIB (the engine supports it, the data rarely exists), romanization for Chinese/Japanese/Korean (Hindi and Punjabi are done), Chromecast, macOS (not supported), a signed Windows installer (it is unsigned today), encrypted Connect traffic, and a redesigned TV pairing (in progress).

## Legal & privacy
MIT licensed ([LICENSE](LICENSE)). See [PRIVACY.md](PRIVACY.md) for exactly what leaves your PC and [THIRD_PARTY.md](THIRD_PARTY.md) for credits. Lyra is not affiliated with Spotify; Spotify is a trademark of Spotify AB.
