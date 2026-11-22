# Roadmap

Owner's goals in order. Each phase lists what "done" means. Issues are labelled `roadmap` on GitHub.

## Phase 0: ship and learn (now)
Current release (2026-11-23): Windows 0.24.1 / Android 0.10.1, 34 looks. Releases since the last edit of this page: 0.20 to 0.24.1 (see `docs/handoff/08-release-and-ci.md`). The owner tests on a real PC and Android phone and reports bugs. Fix them first.

## Phase 1: engine truth (no visual change)
**Status:** synced-first DONE; video: clip cache + failure memory DONE (Windows), pause/resume on Windows DONE, phone pause and measured latency OPEN; smooth start OPEN.
1. **Synced first** (docs/engine-plan.md section 1): rank all candidates, prefer synced; upgrade plain to synced later. Done when: a unit test proves synced beats plain across providers and that a plain result is replaced when a synced one appears; the UI shows "Synced" / "Not synced" honestly.
2. **Video playback quality** (section 2): sync with the music, smooth Apple clip, remember failures, prefetch. Done when: pause/resume lag < 300 ms in a measured test, the Apple clip plays without stutter on a mid-range PC, a song that failed once never retries the same failing source for 7 days.
3. **Smooth start** (section 3): preload the next track; a short start gate only when needed. Done when: on a normal connection the next song's lyrics + video are ready before it starts in 95 % of cases, and no track is ever delayed more than 1.5 s.

## Phase 2: one fixed UI per vibe and state (the big design phase)
**Status:** per-look state screens DONE for all 34 looks (every look composes its own scene screen since 0.24; mini player compositions in 0.24.1); settings controls removed DONE; lyrics-state test matrix (`test:ui:states`) DONE; per-cell polish on the mini player and tablet remains OPEN (#69).
Spec: docs/ui-state-matrix.md. Done when: every cell of the matrix has a designed, tested screen for every device class; the UI tests render the whole matrix; Settings has no layout or style controls.

## Phase 3: personalised cards and themed everything
**Status:** share cards, Settings skins and poster frames DONE for all 34 looks; player card plates per vibe DONE for dock/pill/bar layouts (0.22.0); mini-player / side-layout cards and widget colours DONE in 0.22.0.
Per-vibe player card, share card, settings skin, video treatment. Done when each vibe has its own card design (doodle language where it fits) in the player and in the share dialog, and screenshots for all of them are in `docs/screenshots/`.

## Phase 3b: Connect and the Android surfaces (0.23 to 0.24.1)
**Status:** Lyra Connect DONE (pairing, roles, follow-me, party, OBS overlay, browser viewer; plain unencrypted LAN, see `docs/connect-redesign.md`); Android TV screen, car mode, always-on screen, eight widgets, in-app updater BUILT but not all run on real hardware; **TV pairing redesign IN PROGRESS** (another agent).

## Phase 4: platform polish
Widget on real launchers (#76), Android karaoke (#48), code signing (#53), Apple Music / other Windows players (#6), Vega source (#54), more looks (#77), translations (#3), encrypted Connect traffic, word-level LRCLIB sync, CJK romanization. Skipped or unsupported: Chromecast, macOS.

## Always
Keep `npm run test:ui` green; keep Settings short; keep releases flowing through the workflow route in CONTEXT.md.

## Ideas queue (owner likes motion-graphics lyric videos)
More `zoom`-stage vibes (comic-book pop, film-strip, spray stencil), 3D camera fly-through of words, beat-reactive scale. Reference video: owner's Instagram sketch-typography clip (it led to the Sketchbook look). Several of these exist now (Comic, Stencil, Film, Film Strip, Drift Wall).
