# 1. The project and the owner

## What Lyra is
Lyra is a free, open-source (MIT) lyrics companion. It reads what the user is playing (Spotify desktop on Windows through the Windows media session; any media-card player on Android) and shows the lyrics **word by word**, in sync, over the **music video** of the song, in one of **34 hand-designed looks** ("vibes"). Windows app (Electron) and Android app (native shell + WebView) share one TypeScript/React UI.

Repository: `github.com/DhruvHarani1/lyra`. Sister project: **Vega** (`DhruvHarani1/vega`), a standalone music app that embeds Lyra's lyrics player. Website: `lyra-website-rho.vercel.app` (folder `website/`, deployed by Vercel).

Current versions (2026-11-23): Windows **0.24.1**, Android **0.10.1**. Every release is on GitHub Releases (`vX.Y.Z` Windows installer, `android-vX.Y.Z` APK).

## Core promises
* Free forever, no account, no tracking, no ads. Everything the user chooses stays on the device. Network use is listed exactly in `PRIVACY.md`: lyrics services (LRCLIB first), MusicBrainz, Apple preview and (with the user's own key) YouTube lookups, GitHub Releases for update checks and website download links, and the opt-in internet Rooms. Lyra Connect is LAN-only and off by default.
* Lyrics are the hero. They never clip, always have contrast >= 3:1, and unsynced lyrics never pretend to follow the song.
* A missing thing (lyrics, video, network) never leaves a hole: there is a designed screen for it.
* Original designs only. Looks are *inspired by* worlds (synthwave, Minecraft, stadium broadcast...) but never copy trademarks, logos, characters or art.

## The owner (the human)
* GitHub: `DhruvHarani1`. Solo founder/designer-developer, Windows PC + Android phone, tests every release by hand on those and reports bugs in chat (often with screenshots/videos).
* Taste: modern, premium, "Gen-Z", unique, not generic; animated and expressive; hates the default glass card and anything that looks like a template. Loves motion graphics lyric videos, doodle/hand-drawn styles, sticker/poster looks, game and sports and movie inspired looks. Wants things "ultra high visual".
* Wants the product to feel **designed**, not configurable: one fixed beautiful UI per look, per state and per device; no layout knobs for the user. The owner improves the fixed UIs from feedback.
* Wants Settings simple and human (six plain tabs, jargon free).
* Gives big multi-part asks and expects the agent to plan, build, test, ship and report without asking permission for each step ("full freedom", "don't wait for my request"). Wants screenshots as evidence and honest reports of what is *not* tested.
* Writes informally (voice-to-text style, many typos). Read intent, not wording.
* Typical loop: owner asks -> agent builds and verifies in a browser harness -> PR -> CI -> merge -> dispatch release workflows -> owner installs on real devices -> owner sends bugs/screenshots -> repeat.

## Languages and audiences
Songs in English, Hindi and Punjabi (Gurmukhi). Romanised lyrics line under Hindi/Punjabi is a feature. UI is English. Audience: music lovers on Windows/Android, many in India.

## What the owner will judge you on
1. Does it look unique and polished on a real PC and phone?
2. Is it robust (retries, fallbacks, no black boxes, no jumping layout)?
3. Are releases flowing (tested, merged, published with working installer/APK)?
4. Honesty: say plainly what was not run on real hardware.
