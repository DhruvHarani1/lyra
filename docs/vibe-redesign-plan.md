# Vibe redesign plan (fullscreen first, then mini player, Android last)

> **Status (2026-11-23): done.** Every look was rebuilt as its own scene in 0.23 and 0.24 (34 looks, Windows 0.24.1), the mini player compositions and Android looks followed in 0.24.1 (`styles/mini-looks.css`, `styles/android-looks.css`). The table below is the original plan for the first 20 looks and is kept as history; the current list is `src/shared/vibes.ts` and `docs/handoff/03-vibes-and-design-language.md`. Journal, Doodle, Dusk Ridge, Lock Screen, Wallet, Route, Editor, Metro, Web, Lens, Picto, Drift Wall, Split-flap and Film Strip came after this plan. Per-vibe CSS ended up as several files per look (`<look>.css`, `edge-<look>.css`, sometimes `x-` / `p-` / `-v2`), not one.

Owner decisions (2026-11-21): every vibe is a complete, unique scene. Different background, lyric motion, video treatment, player card and edge effect. Vibes that are near copies get rebuilt or removed. Every state of one vibe keeps the same regions (`docs/ui-state-matrix.md`), and the video position is decided per vibe. Work one vibe at a time: concept mockup in `docs/mockups/`, then build, then check in the browser harness. The full test suite runs once, after all vibes are done.

## Where each vibe puts the video (decided by Claude, owner approved the approach)
Rule of thumb: lyrics are the hero. A video goes in a framed window of the vibe's own world, and only vibes where the video *is* the screen play it full bleed. In "video, no words" the window grows to a hero size.

| Vibe | Video | Edge effect | Lyric motion (new) |
|---|---|---|---|
| Artwork (none) | full bleed, dimmed (the neutral one) | soft breathing glow | classic scroll |
| Neon: Rain Alley (DONE) | shop window, 40% wide, grows when no words | car light sweeps the wall | words power on along a sign |
| Chrome | glossy Y2K monitor | specular highlight sweeping the bezel | liquid-metal words sliding in |
| Dream | soft blurred dreamscape behind everything | aurora shimmer | words drift up like bubbles |
| Terminal | a pane in the terminal | blinking cursor border | typed line by line |
| Stickers | sticker with peeling corner | marching cut line | stickers slapped on |
| DM | story/reel bubble in the thread | none | messages with typing dots |
| Diary | taped photo | inked doodle border | handwritten word by word |
| Arcade | CRT cabinet screen | light-chase marquee | pixel words with score ticks |
| Cinema (noir) | full bleed between letterbox bars | projector flicker | subtitles |
| Sunset | the windshield of a car at dusk | dashboard glow | radio-dial ticker |
| Blocks | framed painting on a block wall | stepping pixel border | words placed block by block |
| Stadium | the jumbotron | light bar pulse per line | scoreboard lower third |
| Cassette | small tape-deck TV | tape ribbon running with progress | label-maker print |
| Trailer | full bleed, letterbox, light leaks | light leaks | title cards |
| Sketch | pinned frame in a notebook | pencil outline drawing itself | words drawn with a pen |
| Glitch | RGB-split slices | glitch tears | corrupted-then-resolved words |
| Comic | a comic panel with halftone | panel gutters | speech-bubble pops |
| Stencil | spray-painted wall cutout | spray drips | stencil-sprayed words |
| Film | 35 mm filmstrip frame | sprocket holes scrolling with progress | frame-by-frame cuts |

## Build checklist per vibe
1. Concept mockup with the 8 state screens (full, lyrics only, video + unsynced, text only, video no words, music only, waiting, idle).
2. `styles/<vibe>.css` (one file per vibe, imported last), a stage component in `LyricsStage.tsx` if the lyric motion is new, effects in `VibeFx.tsx`.
3. Remove the old rules for that vibe from `vibes.css`, `states.css`, `skins.css`, `posters.css`.
4. Check key states in the harness (`?mode=full`, `?vs=live`, `?ly=plain|none|offline`, `reducedMotion` off) and typecheck. Mini player, Settings skin and Android come in their later passes.

## Order and status (Claude decides the order; copies of one another go first)
Historical status when written: done were Neon (Rain Alley), Chrome, Arcade, Trailer and Sunset Drive; planned next, in this order: Sketch, Glitch, Comic, Stencil, Film (the old orb/zoom family), then Dream, Terminal, Stickers, DM, Diary, Cinema, Blocks, Stadium, Cassette, and Artwork last.
Each vibe is committed on its own. Shared mechanics live in `styles/scene.css` (scene layout variables, video window, card spot) and `LyricsStage.tsx` (stages).

## Video fit (done in 0.23, per the release notes)
Scene windows are 16:9 (arcade 16:10, trailer 2.39:1 on purpose), so YouTube and Apple clips fill them. Videos are shown with `object-fit: cover` and black-bar detection, so a clip with baked-in bars is cropped to its picture. Odd shapes (vertical, square, 4:3, living art) are still cropped by `cover`. Done in 0.23 (`styles/videofit.css`; release notes): sources that are not close to 16:9 show the whole picture over a blurred copy of it. Not re-verified against the code for this edit.
