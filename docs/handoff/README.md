# Handoff pack for a new Claude session

Give this whole folder (`docs/handoff/`) plus `CONTEXT.md` to the new session. Read in this order:

| # | File | What it answers |
|---|---|---|
| 1 | [01-project-and-owner.md](01-project-and-owner.md) | What Lyra is, who the owner is, how they work, what they want |
| 2 | [02-architecture.md](02-architecture.md) | Repo map, processes, data flow, platforms |
| 3 | [03-vibes-and-design-language.md](03-vibes-and-design-language.md) | The 34 looks, how a look is built, design rules, every file a look touches |
| 4 | [04-ui-system.md](04-ui-system.md) | Layout archetypes, modes, CSS layers, data attributes, states, devices |
| 5 | [05-lyrics-video-engine.md](05-lyrics-video-engine.md) | Lyrics services, matching, resilience, video, persistent caches, user choices, prefetch, start gate |
| 6 | [06-android.md](06-android.md) | Android shell, WebView bridge, widgets, notification, recording, TV, car, ambient, updater |
| 7 | [07-testing-and-harness.md](07-testing-and-harness.md) | Browser harness, UI tests, how to review a look, pitfalls |
| 8 | [08-release-and-ci.md](08-release-and-ci.md) | CI, the release procedure, release history, versions |
| 9 | [09-website.md](09-website.md) | The Vercel website, its files, screenshots, how to update |
| 10 | [10-coding-conventions.md](10-coding-conventions.md) | How the code is written, naming, patterns, what to avoid |
| 11 | [11-workflow-and-collaboration.md](11-workflow-and-collaboration.md) | How to work with the owner, parallel workers, git rules, PR rules |
| 12 | [12-roadmap-and-open-work.md](12-roadmap-and-open-work.md) | What is done, what is open, ideas queue, known gaps |
| 13 | [13-glossary-and-pitfalls.md](13-glossary-and-pitfalls.md) | Terms and every trap we already fell into |

Refreshed 2026-11-23 for Windows 0.24.1 / Android 0.10.1 against the code and git history. Where a detail matters, verify it in the code (paths are given). Lyra Connect has its own docs: `docs/connect-redesign.md` and `docs/connect-protocol.md`.
