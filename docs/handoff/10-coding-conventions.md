# 10. Coding conventions (how the code is written here)

## Language and tooling
TypeScript strict everywhere (`tsconfig.node.json` for main/core/shared, `tsconfig.web.json` for renderer/android-web), React 18 function components + hooks, zustand stores, framer-motion for component animation, Vite (electron-vite for desktop), Vitest, Playwright for UI tests. Kotlin for Android. Plain HTML/CSS/JS (no build) for the website. Formatting: 2 spaces, single quotes, no semicolons, trailing commas avoided, `printWidth` ~ 140 (long single-line CSS rules are normal in the style files).

## Structure rules
* `src/shared` and `src/core` are pure (no DOM/Electron). Anything with a decision in it goes in `core` with a unit test (e.g. `startGate.ts`, `resilience.ts`, `rank.ts`).
* Renderer code reaches the system **only** through `window.lyra`. A new capability = add the channel in `src/shared/ipc.ts`, the type in `types.ts`, the handler in `main/ipc.ts`, the preload binding, the Android implementation in `android-web/api.ts` (and Kotlin if native), and the harness mock in `scripts/harness/entry.ts`.
* Settings: add the field + default in `types.ts` (`DEFAULT_SETTINGS`), validate in `main/settings.ts` `sanitize`, UI in `SettingsPanel.tsx`, test in `scripts/ui-test/settings.mjs`. Prefer *not* adding settings: the product is designed, not configured.
* Hooks live in `renderer/src/hooks/` (one concern each: `useVibe`, `useBackground`, `useLyricsSync`, `usePrefetchNext`, `useStartGate`...). Components are small and named for what they show.
* Comments explain **why** (a surprising constraint, a trap), not what. Doc comments on exported functions describe behaviour in plain words (they are written like short paragraphs).

## CSS patterns
* Look-specific CSS is scoped with `[data-vibe='id']` or `:root[data-vibe='id']`; global rules never mention a vibe. Since 0.24 each look has its own files (`<look>.css`, `edge-<look>.css`, sometimes `x-<look>.css` / `p-<look>.css`), imported in cascade order in `main.tsx`; do not put a look's rules in another look's file. Group by vibe with a banner comment (`/* ===== NEON ===== */`).
* Tokens first: `--accent --glow --glow-soft --font --fg --fg-2 --fg-3 --line --glass --on-fg --word-dim --bg-0 --edge --rimc` are set on `[data-vibe] .shell`.
* Use container query units inside stages (`cqw/cqh`), `clamp()` for type, `color-mix()` for tints.
* Animations: `transform`/`opacity` only, name keyframes with a prefix (`pz-*` posters, `glitch-*`, `neon-*`), stop them for `:root[data-calm]` and reduced motion.
* Specificity: layout files use long selectors (`:root:not([data-platform='android']) .full.full[data-arch='dock'] ...`); to override them use `!important` on the property they set and say why in a comment.
* No inline SVG sprites for decorations: use CSS gradients or small URL-encoded SVG data URIs (see `posters.css`).
* Never use trademarked fonts/logos; fonts come from `@fontsource`.

## React patterns
* Per-frame work uses the `useFrame` helper and writes CSS variables or state only when values change (e.g. `useRevealed` in `LyricsStage`).
* Components that exit animate with `AnimatePresence` and keyed children.
* Avoid global re-renders from the player snapshot: select narrow slices (`usePlayer((s) => s.snapshot?.track?.id)`).

## Error handling and resilience
Network calls go through `retry`/`CircuitBreaker`; user-facing failures are designed screens, never raw errors; never throw from rendering for missing data. Wrap `localStorage`/IndexedDB in try/catch (can be unavailable). Parsing external data is defensive and bounded (sizes, counts, TTLs).

## Naming
Files: components `PascalCase.tsx`, hooks `useThing.ts`, stores `thing.ts`, CSS by layer. CSS classes: BEM-ish (`block__element--modifier`) for new code (`zoom__word--fill`, `lfb__poster`), a few legacy short names (`mc__row`, `kin__word`, `bub`). Vibe ids are short lower-case (`crt` = Terminal, `noir` = Cinema, `paper` = Diary, `chat` = DM).

## Git
Small focused commits with a clear conventional-style subject (`feat(vibes): Neon pass - ...`, `fix(ui): ...`, `chore(release): ...`, `docs: ...`, `ci: ...`), body only when needed, session trailer lines at the end. One concern per PR.

## Quality bar before saying "done"
typecheck clean, vitest green, UI tests green for what you touched (quick + states + the vibe), screenshots looked at (not just test output), docs updated, and a plain statement of what was **not** run on real hardware.

## Connect and security conventions
* Anything that crosses the network in Lyra Connect is validated and size-capped in `core/connect/protocol.ts`; secrets never go in a URL query (the pairing code and the overlay credential live in the URL **fragment**); commands are signed (HMAC) with a replay counter and re-checked against the device role on every message; a role may only be narrowed, never widened. Read `docs/connect-redesign.md` section 4 before touching pairing.
* A new off-device request must be added to `PRIVACY.md` in the same PR.
