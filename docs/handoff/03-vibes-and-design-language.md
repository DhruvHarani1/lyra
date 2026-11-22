# 3. Vibes (looks) and the design language

A **vibe** is a complete look. It changes: lyric typography and the way each word arrives (the *lyric stage*), the background and animated effects (VibeFx), the layout archetype of card/lyrics/controls, the player card plate, the cover (poster) frame, the video treatment, the unsynced / no-lyrics / video screens, the Settings panel skin, the share card, the Android widget palette, and the smart-picker keywords. The owner's rule: **the look is designed, not configured** (no user layout/typeface/size/animation settings; saved values are ignored by `lockLook`).

## The 34 looks (id, name, lyric stage, idea)
Every look uses the `scene` layout archetype (see doc 4); the older archetypes are legacy. Copied from `src/shared/vibes.ts` on 2026-11-23: if they differ, the code wins.

| id | name | lyric stage | idea |
|---|---|---|---|
| none | Artwork | classic | A gallery wall lit in the colours of the cover |
| neon | Neon | sign | Rain alley, neon signs |
| chrome | Chrome | liquid | Y2K liquid metal |
| dream | Dream | constellation | Pastel star map |
| crt | Terminal | log | tmux panes, a lyric log, a status bar |
| sticker | Stickers | sticker | Die-cut pop |
| chat | DM | chat | The song texts you |
| paper | Diary | note | A cosy night corner, a polaroid, handwriting |
| journal | Journal | jot | A ruled page, a taped polaroid, marker highlights |
| doodle | Doodle | scrawl | Fat marker, bright shapes, scribbles that draw themselves |
| arcade | Arcade | pixel | 8-bit cabinet |
| noir | Cinema | subtitle | Subtitles in black & white |
| sunset | Sunset Drive | bloom | Golden hour, warm glow |
| dusk | Dusk Ridge | bloom | A star-filled sky over sunlit mountains |
| blocks | Blocks | chatlog | A sandbox with a chat log |
| stadium | Stadium | lowerthird | Live broadcast scoreboard |
| cassette | Cassette | label | Tape deck, label-maker strips |
| trailer | Trailer | title | Movie title cards |
| sketch | Sketchbook | ink | Written by hand in ink and pencil |
| glitch | Glitch | glitch | Signal lost: static, tears, colour split |
| comic | Pop Comic | bubble | Halftone page, speech bubbles, POW |
| stencil | Stencil | spray | Sprayed on a concrete wall |
| film | Film Reel | intertitle | Running film stock, silent-film titles |
| filmstrip | Film Strip | intertitle | The film advances frame by frame (draft B) |
| lock | Lock Screen | lockscreen | Each line arrives as a notification |
| wallet | Wallet | wallet | The song as a run of payments |
| route | Route | route | A pin for every line on a map |
| editor | Editor | editor | The lyric as code in an editor |
| metro | Metro | metro | A transit line, a station per word |
| web | Web | weave | Every line spun on a web |
| lens | Lens | bloom | Words bulge through a glass lens |
| picto | Picto | picto | A small icon beside the words that have one |
| wall | Drift Wall | wall | Words land on a wall that drifts in 3D |
| flap | Split-flap | flap | An airport board, every letter flips |

Source of truth: `src/shared/vibes.ts` (`VIBES`, `ALL_VIBES`, `vibeInfo`, `stepVibe`, `pickVibe` smart scorer with per-vibe keyword regexes `WORDS`). Type union `Vibe` in `src/shared/types.ts`; `LyricStyle` there too.

## Vibe modes (how a vibe is chosen)
`vibeMode`: `fixed` (the chosen vibe), `cycle` (rotate through a pool, `V` key = next vibe), `smart` (`pickVibe` from words, pace, year, cover colour; deterministic per song). Per-song choices are remembered (`songVibes`). `hooks/useVibe.ts`: `useEffectiveVibe`, `cycleVibe`, `useVibeConductor`.

## Lyric stages (`components/LyricsStage.tsx`, `LyricsView.tsx`)
35 kinds in `LyricStyle` (`src/shared/types.ts`): classic list, kinetic, constellation, sticker, chat, type, diary, subtitle, chatlog, lowerthird, sign, liquid, pixel, bloom, title, ink, glitch, bubble, spray, intertitle, log, note, jot, scrawl, label, lockscreen, wallet, route, editor, metro, weave, picto, wall, flap, and **zoom** (one giant word at a time thrown at the camera: scale 2.7 -> 1 with blur and tilt, whole line small underneath; looks: fill / outline / cut / ghost, chosen deterministically per word). Stages use container query units (`cqw/cqh`) inside `.stage` (`container-type: size`).

## Everything a look touches (checklist when adding a look)
1. `src/shared/types.ts` `Vibe` union (+ `LyricStyle` if you invent a stage); `src/shared/vibes.ts` entry + the `WORDS` regex for the smart picker (+ `vibes.test.ts` if counts are asserted).
2. The look's own CSS, imported in `renderer/src/main.tsx` in cascade order: the original `styles/<look>.css` (or `<look>-v2.css`, `x-<look>.css`, `p-<look>.css` for restyles of the same look), its geometry variables for `scene.css`, and `styles/edge-<look>.css` (the window edge; one file per look so looks never share an edge).
3. Effect layers: `components/VibeFx.tsx` and `components/fx/` (`FourFx.tsx`, `Looks25.tsx`); the edge logic in `components/EdgeFx.tsx` (variables `--lp --li --lt --ts --lv`). Special renderers: `DmKinds.tsx` (DM message kinds), `lib/codeGen.ts` (Editor code), `lib/journalInk.ts` (Journal pens).
4. `styles/vibes.css`: `:root[data-vibe='x']` tokens (`--accent --glow --font --fg ...`; light looks set `--fg` dark and need the word/contrast overrides at the bottom).
5. `styles/states.css`: unsynced (`.lyrics__notice`, `.plain__stanza`), no lyrics / waiting (`.lfb*`), video-playing tweaks. Minimum text size 10 px.
6. `styles/skins.css` (Settings panel and plates) and `styles/cards.css` (mini player / phone dock / side plates: **generated** by `scripts/gen-cards.py`; edit its table and re-run, never hand-edit).
7. `styles/posters.css` (animated cover frame, `Artwork.tsx`), `lib/shareCard.ts` (`THEMES[id]`), `styles/redesign.css` (gallery swatch `.vibecard--x`).
8. Small-window and platform files: `styles/mini-looks.css` (the 420x700 mini window composition per look, Windows only), `styles/android-looks.css` and `styles/android-scenes.css` (phone, tablet, foldable), `styles/fit-full.css` and `styles/fit-mini.css` (last-word size fixes found by the UI test), `styles/minsizes.css` (10 px floor), `styles/tv.css` and `styles/car.css`.
9. Android widget palette: `WidgetPalettes.of` in `android/.../LyraWidget.kt` (verified: it is still there).
10. Website: `website/vibes-data.js` entry + screenshots (`scripts/make-site-shots.mjs --only=<id>`), `website/whats-new.html`.
11. Tests: nothing to register, `scripts/ui-test/run.mjs` reads `vibes.ts`; add selectors to `stageSel` / `nowSel` if you invent a new stage.

## Design principles (apply to every look)
* **Distinct, not themed**: change type, motion, shape language and materials, not just colour. Each look has a signature gesture (neon flicker, pencil jitter, typewriter cursor, tape reels...).
* **Doodle/hand-drawn language where it fits** (Stickers, Diary, Sketchbook, Pop Comic, share cards): wobbly lines, hard offset shadows, tilted labels, marker highlights. The doodle share card is the reference: underline, circle, strike-through with a scribbled replacement, burst, little face.
* **Hard shadows and thick outlines** for poster looks; **glow and bloom** for light-emitting looks; **grain** for film/tape.
* Readability beats style: dark halo behind bright type on bright backdrops, paper cards behind ink text when a video is dark, `paint-order: stroke fill` for outlined type, tight glow not wide bloom on neon.
* Unsynced = **static** (no flicker, no highlight, no auto-scroll). No-lyrics = a designed message in the look's own voice (`ERR>` in the terminal, a LCD on the cassette, a title card in cinema).
* Videos are part of the look (cinema = black and white, trailer = graded, cassette = sepia, noir panes translucent in the terminal).
* Stop endless animation when `data-calm` is set (song paused / window hidden) and under reduced motion.
* Original art, no trademarks. Inspiration is allowed, copies are not.
* Fonts available: Inter, Nunito, Unbounded (display), Fraunces (italic), VT323, Caveat, Press Start 2P (all via `@fontsource`, imported in `renderer/src/main.tsx`).

## Light inked vibes (special care)
sticker, paper, journal, cassette, sketch, comic (and chrome plate): dark ink on light ground. The generic rule forces the active word white in dark themes (`lyrics.css`) so each of these needs overrides (see the bottom of `vibes.css`). With a dark video behind, text must sit on paper cards (see `states.css` DIARY/SKETCHBOOK/POP COMIC blocks).
