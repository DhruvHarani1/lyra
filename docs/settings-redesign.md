# Settings redesign (desktop)

> **Status (2026-11-23):** shipped in 0.19 / 0.20 and redesigned again in 0.23 (the page has search and wears the active look). Desktop tabs today: Look, Lyrics & video, Player, Connect, About (Android: Look, Lyrics, Video, Phone, Connect, About). The LAN settings in the audit table below were replaced by Lyra Connect.

Goal: a calm page for ordinary people. Anything that only changes how the app looks is decided by the vibe, not by a
setting. Functional options stay, in plain words, with a one-line helper under each.

## Audit: every setting

| Setting (`Settings` key) | Decision | Where it lives now |
|---|---|---|
| `vibe`, `vibeMode`, `vibePool`, `songVibes` | keep | Look: the vibe cards and "Vibe changes" |
| `lyricStyle` | keep (set by the vibe card, no control of its own) | follows the chosen vibe |
| `theme` | merge | Look > Comfort, shown only for the Artwork vibe ("Artwork colours"); every other vibe brings its own colours |
| `reducedMotion` | keep, promoted | Look > Comfort ("Reduce motion") |
| `performance` | keep, folded | Look > Comfort > Advanced ("Effects") |
| `lyricFont`, `lyricFontSize`, `lineSpacing`, `lyricAnimation`, `rimLight` | remove | no UI (already ignored by the renderer); now reset to defaults on load in `sanitize` |
| `romanizeLyrics`, `wordByWord` | keep | Lyrics & video > Lyrics |
| `lyricOffsetMs` | keep, folded | Lyrics & video > Lyrics > Advanced ("Default sync offset") |
| lyrics services status | keep, folded | Lyrics & video > Lyrics > Advanced |
| `backgroundStyle` (on/off) | keep | Lyrics & video > Background ("Video behind the lyrics") |
| `backgroundDim`, `customBackground`, per-song file, YouTube key | keep | Lyrics & video > Background |
| `autoDim`, `startGate`, `backgroundInMini` | keep, folded | Background > Advanced |
| `source` | keep | Player > Music source (plus Language) |
| `defaultMode` | keep | Player > Window ("Resting size") |
| `alwaysOnTop`, `hideOnScreenShare` | keep | Player > Window |
| `opacity`, `autoHide` | keep, folded | Player > Window > Advanced ("See-through", "Fade when idle") |
| `compactWidth` | remove control (value still used by the window code; dragging the window edge sets it) | none |
| `launchAtStartup`, `trackNotifications`, `globalShortcuts` | keep | Player > Startup & keys |
| `systemVolume` | keep, folded | Startup & keys > Advanced |
| `shortcuts` (overrides) | keep, folded | Startup & keys > Advanced |
| `lanViewer`, `lanAudio` (+ `lanPort`, `lanToken` internal) | **replaced by `connectEnabled` (off by default); sound streaming removed** (see `docs/connect-redesign.md`) | Connect > Devices (`DevicesPanel.tsx`) |
| rooms (host/join) | keep | Connect |
| about, update, diagnostics, reset, hide, quit | keep | About |
| `keepScreenOn`, `keepRunning`, `ambient*` | keep (phone only, unchanged) | Phone tab on Android |
| `onboarded`, `miniSize`, `position`, `spotifyClientId` | internal, no UI | n/a |

There is no cache-clear control in the app today, so none was added (backend cache work is owned by another change).

## Page structure (desktop)

Search box on top (type to see every matching row from all sections; Esc clears), then four tabs plus About:
Look, Lyrics & video, Player, Connect, About. Rare options sit under an "Advanced" fold inside their section.
Android keeps its own tab set and is otherwise untouched.

## Skinning

`src/renderer/src/styles/settings.css` is the only new stylesheet. It reads the panel colours that `skins.css`
already sets per vibe (`--panel --fg --line --accent`) and adds four tokens per vibe: `--st-font`, `--st-r`
(corner size), `--st-ink` (text on the accent) and `--st-w` (border weight). Cards, switches, segmented choices,
buttons, sliders and the search box derive from these, so a new vibe needs one token line. `film`'s panel skin now
also covers `filmstrip`.

## Migration

`sanitize()` in `src/main/settings.ts` now drops keys that no longer exist, resets the removed look settings to
their defaults, and whitelists `theme`, `reducedMotion` and `source`. Old `settings.json` files load unchanged
otherwise.
