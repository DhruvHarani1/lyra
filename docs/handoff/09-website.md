# 9. Website

Static site in `website/`, deployed by Vercel from `main` (`vercel.json`: clean URLs, immutable cache for `/assets`). Live: `lyra-website-rho.vercel.app`. Redesigned in 0.22/0.23 (PR #82); 0.24 and 0.24.1 refreshed copy and screenshots (PRs #84, #85). Another agent owns the website in the current round, so check `website/` itself for the latest state.

## Files
| file | role |
|---|---|
| `index.html` | home: hero (word-by-word headline, rotating look collage), ticker, stats, **34-look showcase** (device + video toggles), **state story** (sticky, 4 screens of one look), share-card rail, Settings rail, features bento, recordings reel, whole-song video, live demo, Android, Vega, downloads, footer |
| `vibes.html` + `vibes.js` | gallery with filters; each look opens a modal with all its states, card, Settings, mini player; deep link `vibes#<id>` |
| `whats-new.html` | release notes, add a card per release (newest first) |
| `site.css` | design system (tokens, nav, hero, sections, rails, bento, modal, responsive) |
| `site.js` | hero rotation, showcase, story, rails, count-up, spotlight, GitHub release links (Windows/Android/Vega) |
| `demo.css` + `demo.js` | the live lyric demo replicas (widget, phone, fullscreen) with made-up songs |
| `vibes-data.js` | `window.LYRA_VIBES` (id, name, tag, layout, stage, accent colour, light). Generated from `src/shared/vibes.ts`; add the accent by hand |
| `room.html` | "Listening together" page for the internet Rooms feature (PeerJS), self-contained, keep it working (it is not part of Lyra Connect) |
| `assets/` | icon, recordings (`clip-*.mp4`), posters, `song-barsaat.mp4`, `vega-home.jpg`, `peerjs.min.js`, and `assets/shots/` (generated JPEGs; the count and size changed with 34 looks, see the folder) |

## Screenshots (`assets/shots/`)
Names: `<id>-full.jpg` (with video), `-full-novideo`, `-phone`, `-mini`, `-plain`, `-nolyrics`, `settings-<id>.jpg`, `card-<id>.jpg`, `sheet-vibes.jpg`, `manifest.json`. Generate: start the harness (`npx vite -c scripts/harness/vite.config.ts --port 5411`), put a calm `site.mp4` in `scripts/harness/public/`, run `node scripts/make-site-shots.mjs --port=5411 [--only=neon,chrome]`. Keep each full shot <=220 KB and the folder small. Regenerate the affected ones whenever a look changes.

## Design of the site
Dark (#06050a), Unbounded display type, Inter body, JetBrains Mono labels. The accent colour (`--acc`) follows whichever look is on show (hero rotation, showcase, story) and tints the aurora backdrop, glow and buttons. Glass nav pill, big outlined ticker, bento cards, sticky storytelling, drag rails, cursor spotlight, count-up stats. Reveal-on-scroll with IntersectionObserver; reduced motion disables animation. Missing screenshots hide themselves (`error` capture).

## Testing the site
Serve `website/` (`python3 -m http.server`), screenshot with Playwright at 1440 and 390 wide, scroll to trigger reveals. Check the console for errors.

## Rules
No tracking scripts. Download buttons read the GitHub releases API with graceful fallback to the releases page. Song names in the demo are made up; the Barsaat clip is shown only as a demo with a credit line.
