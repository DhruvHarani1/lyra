# 8. Release and CI

## CI (`.github/workflows/`)
* `ci.yml` on PRs/push: job `check` (npm ci, typecheck, vitest, build) and job `ui` (Playwright chromium, `test:ui:quick`, `test:settings`, `test:ui:states`, install ffmpeg, `test:video`; uploads `ui-test-out` on failure). Plus `codeql.yml` (analyze). Vercel posts a preview comment; CodeRabbit is skipped.
* Read a failing job: `get_job_logs` with `tail_lines` ~110 and `return_content=true` (small tails return little); the summary lines start with "UI test:".
* **The release workflows require a green CI for the commit, with a force override** (a rule being added by another agent in the current round; check `.github/workflows/release.yml` and `android.yml` for the real input names before you rely on it, not verified when this was written).
* `release.yml`: builds the Windows NSIS installer (`Lyra-Setup-<v>.exe`, `.blockmap`, `latest.yml`); `android.yml`: builds `Lyra-Android-<v>.apk`.

## Release procedure (tags cannot be pushed from the cloud session; use the workflow route)
1. Work on a branch, open a PR (use `.github/pull_request_template.md` headings), wait for CI green (`check`, `ui`, `analyze`, CodeQL), **squash-merge**.
2. Bump versions **before** the PR merges: `package.json` + `package-lock.json` (two places) for Windows; `android/app/version.properties` (`versionName`, raise `versionCode`).
3. Dispatch both workflows **on main with `publish=true`** (`actions_run_trigger run_workflow`, inputs `{"publish":"true"}`). GitHub creates the tag and the release itself. Windows becomes "latest" (the desktop auto-updater serves it); Android is created with `--latest=false`. A dash in the **version** (e.g. `0.4.0-beta.1`) means pre-release; the tag name is not used.
4. Verify `v<ver>` has the `.exe`, `.blockmap`, `latest.yml` and `android-v<ver>` has the `.apk` and is not a pre-release; report the links.
5. After a squash merge the dev branch has diverging history: `git fetch origin main && git merge origin/main`, resolve conflicts with `git checkout --ours` (the branch is a superset), commit, push. **Never force-push** (blocked) and do not rewrite history.

## Versioning so far
0.18 vibes -> 0.19 per-vibe layouts/tablet/widget/UI tests -> 0.20 fixed look, share cards, skins, posters, clip cache -> 0.21 per-vibe states, Sketchbook/Glitch/Pop Comic, prefetch -> 0.22 card plates, Stencil/Film Reel, widget palettes, video test, start gate -> 0.23 30 looks, Lyra Connect, persistent cache and remembered choices, OBS overlay, Android TV / car / always-on / updater -> 0.24.0 33 looks, per-look edges, Editor code, Journal pens, DM chat -> 0.24.1 Dusk Ridge (34th), mini player and Android looks.

| Windows | Android | Date | GitHub release |
|---|---|---|---|
| 0.22.0 | 0.8.0 | 2026-11-21 | `v0.22.0`, `android-v0.8.0` |
| 0.23.0 | 0.9.0 | 2026-11-22 | `v0.23.0`, `android-v0.9.0` |
| 0.24.0 | 0.10.0 | 2026-11-22 | `v0.24.0`, `android-v0.10.0` |
| 0.24.1 | 0.10.1 | 2026-11-22 | `v0.24.1` (latest), `android-v0.10.1` |

(Dates and names from `gh release list`, 2026-11-23. Release bodies on GitHub are only auto-generated PR lists; the human notes are `website/whats-new.html`.) Current `package.json` 0.24.1, `android/app/version.properties` `versionName=0.10.1`, `versionCode=10001`.

## Distribution notes
Windows installer is not code-signed (SmartScreen warning, issue #53). The Android in-app updater (GitHub installs only) verifies SHA-256 and the signing certificate; the Windows updater is electron-updater on the same GitHub releases. macOS is not supported and Chromecast was skipped. Android: Play Protect can block browser installs (website explains workarounds); F-Droid/IzzyOnDroid metadata in `fdroid/`, `fastlane/`, `docs/FDROID.md`, `docs/DISTRIBUTION.md`.

## Commit/PR attribution
Commits end with the session's `Co-Authored-By` and `Claude-Session` trailer lines; PR bodies end with the "Generated with Claude Code" line and session URL (given in the session's system reminder). Do not put model identifiers anywhere in the repo.
