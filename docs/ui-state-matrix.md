# Fixed UI per vibe: the state matrix

> **Status (2026-11-23, 0.24.1):** every one of the 34 looks has its own designed screens for synced / unsynced / no lyrics / waiting / video, composed as a scene on Windows full screen (`styles/scene.css` plus the look's own files), its own mini-player composition (`styles/mini-looks.css`) and its own Android phone / tablet layout (`styles/android-looks.css`, `android-scenes.css`). Checked with `test:ui:states`, `test:ui:quick` and `scene-check.mjs` (layout only). The note below is the 0.21.0 status, kept for history.
>
> **Status (0.21.0):** every vibe has designed unsynced / no-lyrics / video screens on Windows full screen and the phone (`styles/states.css`; sheets in `docs/img/`). Mini player and tablet still reuse the same CSS, reviewed only for clipping and contrast. Earlier note (0.20.0): user layout settings removed; `npm run test:ui:states` renders every vibe x phone/tablet/Windows 768/mini x lyrics plain/none/offline. Designed per-cell screens and the video states are still open.

**Decision (owner, 2026-11-21):** users do not arrange the UI. For every vibe we ship one fixed, designed screen for every combination of *state* and *device*, and improve them from feedback. Remove user layout controls from Settings.

## 1. Axes

### State
| Axis | Values |
|---|---|
| Video | `playing` (YouTube / Apple clip / user file) - `loading` (searching or starting) - `none` (no video exists / no key) - `failed` (blocked, timeout, error, offline) |
| Lyrics | `synced` (line or word timing) - `plain` (text without timing) - `none` (not found) - `instrumental` - `loading` - `error` (service down, retrying) - `imported` (user's own; treat as synced or plain by content) |
| Playback | `playing` - `paused` - `ad` - `idle` (nothing) |

The video x lyrics grid is 4 x 6 per vibe. Many cells share a design (e.g. all `failed` videos look like `none` plus the status card), so each vibe defines **8 canonical screens**:

| # | Screen | Video | Lyrics |
|---|---|---|---|
| A | Full experience | playing | synced |
| B | Lyrics only | none / failed | synced |
| C | Video, unsynced words | playing | plain |
| D | Text only | none / failed | plain |
| E | Video, no words | playing | none / instrumental |
| F | Nothing but the music | none | none / instrumental |
| G | Waiting | loading | loading / error (shows the retry countdown) |
| H | Idle / ad | n/a | n/a |

### Device classes (each screen exists for each)
1. Windows **fullscreen** (wide, 16:9, 21:9, small 1024x600, portrait window)
2. Windows **expanded player** (420x700, resizable)
3. Windows **compact** (380x140) and **minimal** (296x64): one live line or the title only
4. Android **phone portrait**, 5. **phone landscape**, 6. **tablet / unfolded foldable** (two panes)
7. Android **home-screen widget** (native; compact / medium / large)
8. Android **ambient / overlay** (existing)

## 2. Rules every screen follows
* Lyrics are the hero; text never clipped; contrast >= 3:1 (current line) - enforced by `npm run test:ui`.
* **Unsynced lyrics are never shown as if they follow the song.** Plain text is a readable page (no active-line highlight, no auto-scroll pretending to track), with a small honest label "Not synced". Prefer a calm, static layout per vibe.
* A missing video never leaves a hole: the vibe's own background (its FX) fills the space, and the status pill says why (once, dismissible).
* A missing lyric never leaves a hole: the designed fallback scene (poster title + equaliser + actions) in the vibe's type style.
* The card, controls and lyrics occupy the same *regions* across screens A-H of one vibe, so the layout does not jump when state changes (e.g. when the video arrives after 3 seconds).
* No user layout settings. State changes only change what is inside the regions.

## 3. Per-vibe brief (to be designed; keep original, no trademarks)
For each vibe define: **layout archetype**, **video treatment** (where the video plays and how it is framed), **lyric style** (stage), **card design**, **share card**, **settings skin**, **unsynced treatment**, **no-video background**, **no-lyrics scene**.

| Vibe | Video treatment | Card | Unsynced text | Notes |
|---|---|---|---|---|
| Artwork (default) | full-bleed behind, dimmed | glass card, cover large | scrolling page, dim | the neutral one |
| Neon | video inside the "sun" disc / behind with scanlines | neon tube bar, doodle neon arrows | text in tube font, steady | dock layout |
| Chrome | video in a glossy "monitor" frame | chrome pill with sticker shine | plain chrome type | dock |
| Dream | video as a soft blurred dreamscape | cover as an orb, star doodles | poem-like italic page | orb |
| Terminal | video as a "window" pane | `now.playing` pane, ASCII bar | log of lines, no cursor | term |
| Stickers | video in a polaroid/sticker frame | sticker with tape, doodle arrows | stickers stacked, no pop | side |
| DM | video as a story/reel thumbnail in the chat | message bar | messages already "delivered" | chat |
| Diary | video as a taped photo | polaroid + handwritten title, doodles | handwritten page | side |
| Arcade | video as a CRT screen | player-1 HUD | pixel text page | dock |
| Cinema | the video IS the screen between letterbox bars | minimal bar | subtitles stay off, text page | bar |
| Sunset | video through the "windshield" | car radio panel | radio lyrics ticker | dock |
| Blocks | video in a framed painting | inventory slot card | chat log (static) | side |
| Stadium | video as the pitch / big screen, scoreboard on top | control-room bar | commentary ticker | dock |
| Cassette | video on a small TV next to the deck | cassette card | J-card text | side |
| Trailer | video full, title cards over it | letterbox bar | credits roll (slow, honest) | bar |

## 4. Settings skin
The Settings sheet adopts the vibe (fonts, borders, colours, the doodle language). It keeps the same six tabs and the same simple controls.

## 5. What to remove from Settings (layout/style freedom)
Fullscreen layout (Auto/Cinema/Split/Poster/Focus), Lyric style, Typeface, Size, Line spacing, Animation, Rim light, Performance and Reduce motion move to "Accessibility & battery" with sensible defaults (keep Reduce motion and Performance: they are accessibility, not taste). Keep: vibe choice/mode, theme (artwork/dark/light), lyric timing offset, romanisation, highlight each word.

## 6. Test plan
Extend `scripts/ui-test/run.mjs` so the harness can render each canonical screen (A-H) x vibe x device (switches `?vs=` and `?ly=` already exist; add `?ly=plain`) and assert: regions do not move between A-H, no clipping, contrast, no hole (non-empty visual area).
