# 12. Roadmap and open work (2026-11-23, after 0.24.1 / Android 0.10.1)

Detailed plan: `docs/roadmap.md`. Engine plan: `docs/engine-plan.md`. State matrix: `docs/ui-state-matrix.md`. Connect: `docs/connect-redesign.md`.

## Done
Everything in `CONTEXT.md` section 7 and the release notes (`website/whats-new.html`): 34 looks, each with its own scene screen, edge, card, mini player, Android dock, share card and Settings skin; fixed look (no layout settings); synced-first lyrics; persistent cache with Clear cache; remembered manual choices; clip cache; failure memory; prefetch; optional start gate; Lyra Connect (pairing, roles, follow-me, party, remote control, browser viewer / PWA, OBS overlay); karaoke screen and recording improvements; Android phone / tablet / foldable layouts, eight widgets, lock-screen card, always-on screen, car mode, TV screen, in-app updater; UI test suite in CI; website redesign; this handoff pack.

## In progress elsewhere
* **TV pairing redesign** (another agent): the Android TV client's pairing with a PC. The TV screen and its pairing were never run on a TV or emulator.
* Release workflows requiring a green CI (another agent).

## Not built / decided against
* Word-level sync from LRCLIB (engine ready, data rare). Romanization for Chinese / Japanese / Korean (Hindi and Punjabi done).
* **Chromecast: skipped.** **macOS: not supported.** Windows installer **unsigned** (#53).
* Encrypted Connect traffic (self-signed certificate per install, fingerprint in the QR, pinned by native clients): planned, not done. Merging Rooms onto the Connect protocol: follow-up.
* A real Android Auto media app: deliberately not declared (`docs/android-car.md`).

## GitHub issues (open, from 2026-11-21; check `gh issue list` for today)
* **#69** one fixed UI per look for every matrix cell: done for full screen and phone; mini player and tablet got their own compositions in 0.24.1 but are mostly checked for clipping / contrast.
* **#74** video lag: Apple clip stutter never measured on a real PC; Android clip cache missing.
* **#75** smooth start: no measured "ready before the song" rate; Android prefetch limited by what players publish.
* **#76** widgets on real launchers (battery optimisation, reboot state, Android 11 layout).
* **#77** more looks (standing issue).
Older: #53 code signing, #54 Vega as a source, #48 Android karaoke, #47/#46/#45 karaoke practice/export/pitch, #33/#30/#28 Android recording robustness/fps/sound check, #27 real-device test coverage, #26/#25/#20/#19 export/sharing, #23/#22 YouTube start/overlay issues, #21 screen turning off, #6 other Windows players, #3 translations. Not re-checked on 2026-11-23: some may be closed.

## Ideas queue (owner likes these)
* More motion-graphics looks; sports / games / music / movie looks (cricket scoreboard, racing dash, RPG dialogue box, DJ booth, radio dial, concert lights, anime opening, mission control, jukebox diner, lo-fi bedroom, rainy window; originals only).
* Delete dead code: `shared/fullLayout.ts`, `layout-*` classes, layout shortcuts in `App.tsx` (no effect since 0.20).
* Dependabot bumps (Electron major is untested).

## Known gaps to state honestly
Nothing was exercised on real Windows or Android hardware by the agents; the owner tests releases. The TV client, car mode, always-on screen, updater and widgets are verified by compile, unit tests and the browser harness only. Apple clip lag and YouTube iframe latency unmeasured. Connect has not been run end to end in the Electron app with a real second device (`docs/connect-redesign.md` section 5).

## How to pick the next task
1. Check the owner's latest message and bug reports first (they test every release).
2. Fix regressions the tests or the owner found.
3. Then the oldest open roadmap issue that does not need hardware.
4. Always finish with docs + CONTEXT.md + a release if the owner asked for one.
