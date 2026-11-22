# 11. How to work with the owner and with parallel workers

## With the owner
* **Act, then report.** The owner gave standing "full freedom": plan, build, test, merge, release, then tell them. Do not ask for permission for routine steps (PRs, merges, release dispatch). Ask only when a decision is truly theirs and cannot be defaulted.
* **Evidence**: send screenshots (contact sheets are ideal) and links (releases, PRs). Use `SendUserFile` for images the owner should see.
* **Honest reports**: lead with the outcome, then what was verified, then what was *not* (never run on a real PC/phone, Kotlin only compiled in CI, etc.). Never claim a release is out before verifying the release page and assets.
* **Plain language** in chat; short; no jargon dumps. The owner reads on a phone.
* **One thing at a time when asked** ("take one vibe, finish it, then the next"). Do not batch all looks at once.
* **Keep a task list** and an issue trail: open in-depth GitHub issues for big plans, comment with progress, close finished ones with a note on what remains.
* Keep `CONTEXT.md` and the docs current in every substantial PR.
* When the owner shares a video or screenshots as a reference: study frames (ffmpeg -> contact sheet), name the pattern, then build an **original** version, never a copy.

## Git and permissions in the cloud session
* Develop on the branch the session names (last: `ccr-988f7a52-sj85yz`); push only there unless the owner explicitly says to push elsewhere (the last request to put docs on `main` was explicit).
* Tag pushes, force pushes and history rewrites are blocked: use merge commits, `git checkout --ours` for conflicts against squash-merged main, and the workflow-dispatch release route.
* No `gh` CLI; use the GitHub MCP tools (`mcp__github__*`): create PR, read checks (`pull_request_read get_check_runs`), merge (`merge_pull_request` squash), `actions_run_trigger`, `issue_write`, `add_issue_comment`, `get_release_by_tag`. Only comment on GitHub when the owner asked or the rules say so; end comments with the Claude Code footer line.
* Do not create a PR unless asked; the owner asks regularly ("make a release") which implies PR + merge + dispatch.

## Parallel workers (forks)
Used in 0.22 and again for 0.23 / 0.24 (looks, Connect, Android, website, docs in parallel). Pattern:
1. Split by **file ownership** so branches do not conflict: e.g. one worker owns a new CSS file (`cards.css`), one owns Kotlin + `android-web`, one owns new vibes (and is the only one allowed to touch `vibes.ts`/`types.ts`), one owns test scripts + engine hooks, one owns generated website assets.
2. Spawn forks with worktree isolation, tell each: do not push, do not open PRs, commit on your own branch, run these checks, reply with the branch name and a short summary including what is unverified.
3. Give each worker its own dev-server port (`UI_PORT`); stale servers and a shared port made runs kill each other.
4. Merge their branches into the dev branch, resolve conflicts (append-only CSS usually just needs both sides), then **re-run the whole test set** on the merged result.
5. Workers' claims ("failures also happen on a clean checkout") need checking: they were environment artefacts (symlinked `node_modules`).
Do not duplicate a worker's work while it runs; wait for its notification.

Lessons added in 0.23 / 0.24 (also in `CONTEXT.md` sections 9 and 10):
* Separate ports per worker (`vibe-sheet.mjs` 5197, `video-sync.mjs` 5198 fixed, the rest 5199 / `UI_PORT`); `node_modules` through a Windows junction, with Vite's font-path restriction in mind; copy the git-ignored harness clips into each worktree.
* The checkers are narrower than they look: `scene-check.mjs` measures layout only; `test:ui:quick` needs the lyric-stage selectors (`stageSel` / `nowSel` in `run.mjs`); contrast and clip measures can differ between CI (Linux fonts) and a Windows PC, so leave margin.
* One visual check per look while building, the full suites once at the end, three harnesses in parallel on different ports (`docs/ui-testing.md`).
* Review and merge real contributor PRs; never copy a PR's change by hand and close it.

## Scheduled follow-ups
For waiting on CI use `ScheduleWakeup` (~270-480 s) with a self-contained prompt (what to check, what to do on green/red). Do not poll in a loop.

## Reports checklist
Status line first; links; what changed (by user-visible effect); what was tested; what was not; what is next. Keep it under ~25 lines unless the owner asked for detail.
