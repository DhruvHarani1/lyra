# Device connection: what existed, what changed, why

Protocol spec for client authors: `docs/connect-protocol.md`.

## 1. What existed before (mapped from the code)

> Historical. This section and the "Gaps" paragraph below describe the app BEFORE Lyra Connect (the old LAN server, Jam
> and Rooms). They are not the current state: the Connect host (`src/main/connect/`) replaced them. Current behaviour is in
> sections 2 to 5.

Three overlapping features, all "show Lyra on another screen":

1. **TV and party mode** (the removed src/main/lan/server.ts and viewerHtml.ts; settings `lanViewer`, `lanPort`, `lanToken`).
   A Node `http` server bound to `0.0.0.0` (every interface, including VPN / virtual adapters), default port 47813.
   Authentication: one static 12-hex-character secret (`?k=`) stored in settings, passed in the URL query of every
   request. Transport: plain http, Server-Sent Events (`/events`, a state message every 4 s plus on change),
   `/lyrics` and `/art` fetched with the same key in the URL. Viewer page: read-only synced lyrics. One shared key for
   all devices: nobody could be removed except by rotating the key for everyone (there was no UI to rotate it). No
   pairing, no device list, no roles, no remote control, no clock-offset (the page used the host `now` stamp and
   assumed zero skew). The link with the key was shown as text and QR in Settings.
2. **Jam nearby / Stream sound** (the removed renderer store nearby.ts, `/rtc/offer` on the same server, setting `lanAudio`).
   The viewer could request WebRTC audio of the PC's whole system sound (loopback capture of everything the PC plays)
   which also needed a display-capture permission handler in `src/main/index.ts`.
3. **Rooms / Jam** (`store/room.ts`, `store/jam.ts`, `website/room.html`). Host a room or join one by code through the
   public PeerJS cloud broker (`0.peerjs.com`) over the internet: browser-to-browser WebRTC, state (song, position,
   lyrics) pushed by the host, a basic ping for skew, guests can see the host's network address. Joiners in the app
   match their own Spotify to the host.

Gaps of that old design relative to the goal (all addressed by Connect): open-ish LAN server on all interfaces, secret in URLs and shared by all, no revocation, no
discovery, no per-device identity, nothing shared except lyrics (no video id, vibe or user choices), no remote
control, no real clock sync, no reconnect logic in the page, polling-style state every 4 s.

## 2. Decisions

| Old | New | Why |
| --- | --- | --- |
| TV mode server on `0.0.0.0`, `?k=` shared key | Lyra Connect host, bound to ONE private LAN address, per-device tokens | Open server and shared URL secret were the main exposure. |
| `?k=` in every URL, `/lyrics` `/art` HTTP endpoints | One WebSocket, nothing but the static viewer page is served unauthenticated; code in URL fragment | No secrets in URLs, referrers or logs; no data endpoint to scrape. |
| SSE one-way | WebSocket, versioned JSON, heartbeat, reconnect with backoff | Two-way (control), lower overhead, battery friendly (only changes are sent). |
| Static key | One-time 8-char code (2 min, single use, 5 tries) then a per-device token proven by HMAC challenge | Revocable, short-lived pairing; token never re-sent. |
| No device list | Devices panel: list, online state, Viewer/Controller role, one-click Disconnect | Visibility and control. |
| (nothing) | Party mode: shared viewer-only code, guests expire when party ends | Group screens without handing out control. |
| Wall-clock `now` | NTP-style ping, lowest-rtt filter | Tight sync. |
| OBS overlay on the old `?k=` server (`/overlay`, fed by `/events`, `/lyrics`, `/art`) | `/overlay` on the Connect host; a narrow, revocable `overlay` role; the page is fed by the Connect WebSocket (section 7) | An OBS browser source cannot scan a QR code, but it must not get the old shared secret back either. |
| Viewer PWA bits on the old page (manifest with the key in `start_url`, full screen, wake lock, TV layout) | Same bits on the Connect viewer page, with a static manifest that holds no secret | Installable and TV friendly without weakening pairing. |
| Lyrics only | now-playing, shared song clock, lyrics, video id, vibe, per-song choices and lyric offset, cover art | "Share everything" with local playback instead of streaming. |
| **Removed**: WebRTC system-audio streaming (Jam nearby, `lanAudio`, `/rtc/offer`, `nearby.ts`) | each device plays its own video locally | Streaming everything the PC plays is a privacy-heavy, laggy feature that duplicates "play the same song yourself", and it required a standing capture permission. The capture handler now only serves the recording studio. |
| **Removed**: Settings "Nearby screens (TV mode)" section | "Devices" section (`DevicesPanel.tsx`) | One place, one concept. |
| **Kept untouched**: Rooms / Jam over PeerJS | | It is a different job (internet, friends elsewhere) and owned by contributors; it stays. Its confusing overlap with Devices (both say "room"/"guests") is documented as a follow-up: merge it onto this protocol with a relay. |

Settings: `lanViewer`, `lanAudio`, `lanPort`, `lanToken` are replaced by `connectEnabled` (off by default). Old
stored values are simply ignored (and harmless). Paired devices live in `userData/connect-devices.json`.

## 3. Architecture

- `src/core/connect/` (pure, tested): `protocol` (messages, validation), `hmac` (one HMAC-SHA-256 source used by host,
  tests and the browser page), `clockSync` (offset estimation, follow position, seek decision, ping cadence,
  backoff), `pairing` (codes, devices, proofs, command gate, party), `syncState` (what changed, snapshot).
- `src/main/connect/`: `ws` (small RFC 6455 server, no new dependency), `hub` (HTTP + WebSocket, state machine),
  `mdns` (advertise `_lyra-connect._tcp`), `net` (LAN address choice, peer and origin checks), `viewerHtml` (viewer
  client), `overlayPage` (OBS overlay page and its unit-tested runtime), `pwa` (static web-app manifest), `service` (glue: playback snapshots, lyrics, user choices, commands, device store).
- Renderer: `store/connect.ts` (status + publisher of vibe, video id, lyric offset to the host process),
  `components/DevicesPanel.tsx` (the Devices UI), one `videoId` field added to `bgState` and set from `Backdrop`.
- Song, position, lyrics and art come from the main process (it owns playback); the vibe in effect, the resolved
  video and the per-song offset are renderer knowledge, so the renderer reports them over `connect:view`.

## 3b. The overlay role (OBS / stream overlay)

`overlay` is a third role next to `viewer` and `controller`: the narrowest one, for an OBS browser source.

- **Why a role, not a code.** OBS cannot do QR pairing and a pairing code lives 2 minutes and works once, while an OBS
  source keeps its URL for months. So the host (Devices panel, "Add an overlay link") creates the device directly with
  `Pairing.addOverlay`: no code, no redeem step. Codes can never mint this role (`createCode` coerces it to viewer) and
  no other device can be switched to it; an overlay can never be switched up (`setRole` refuses both).
- **Where the credential lives: the URL fragment**, `http://<pc>:47813/overlay#d=<device id>&t=<token>`. A fragment is
  never sent to the server, never in a `Referer`, not in the host's or a router's logs, and not in OBS's request list.
  The alternative (a one-time exchange: a short code in the fragment redeemed for a token the page then keeps in
  `localStorage`) was rejected because OBS's browser profile can be cleared ("Refresh cache", a moved scene collection) and
  then the source would silently die and need a new code; a link that is self-contained survives that. The cost is that
  the link itself is the secret, so it is treated like a password: shown in the panel with the note "anyone with this
  link on your network can see what you play", copyable on demand (the list never carries tokens), and **revoked from
  the panel** ("Remove link"), which forgets the token and drops a live source's socket at once.
- **The token still never crosses the network.** The page uses the normal `hello` / `challenge` / `auth` handshake, so only
  an HMAC proof is sent (unlike pairing, where the token is sent once to the new device). Sniffing the LAN does not reveal it.
- **Capabilities.** Enforced in two places: `messageForRole` (`core/connect/roleView.ts`) redacts what the host sends (the
  song, art, lyrics, `play` anchor, `pong` and the vibe; no per-song picks, no video id, no device list; controllers are
  not told overlay devices exist), and the existing per-command registry check refuses every command (`err forbidden`), even
  a correctly signed one. It counts toward the 12-device cap.
- **Its own CSP** (`/overlay` only): `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: https:;
  connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`. Tighter than the viewer's: no `ws:` wildcard,
  no frames, no manifest. The viewer's policy gained only `manifest-src 'self'` and `'self'` in `img-src` for its icon.
- **Feed.** The page fills a `LyraFeed` (`src/shared/lyraFeed.ts`): `now` to nowPlaying, `play` plus the ping/pong clock
  offset (best of the last 8, as in protocol section 5) to positionClock, `lyrics`, `art`, `view` (vibe, and the host's lyric
  offset, which the overlay applies so it matches the app). Options in the URL are unchanged (`vibe`/`look`, `lines`, `size`,
  `scale`, `font`, `chroma`/`bg`, `color`, `accent`, `align`, `pos`, `shadow`, `words`, `meta`, `art`, `progress`, `idle`,
  `nudge`, `debug`); they go in the query or after the credentials in the fragment.

## 4. Security model and honest limits

Provided: LAN-only bind and peer check; off by default; single-use short-lived code in the URL fragment;
per-device 256-bit token; challenge-response so the token is never re-sent; HMAC-signed commands with replay counter;
roles enforced on every command; rate limits and pre-auth limits; max 12 devices; revocation drops the socket at once;
same-origin check for browsers; strict CSP, `no-store`, `no-referrer` on the page; payload caps (4 KB in, 768 KB out);
no data served before pairing.

Hardening added later:
- **Host header allow-list** (DNS rebinding): HTTP and the WebSocket upgrade accept only the chosen LAN IP, `localhost` or
  `127.0.0.1`, with or without the port. Anything else gets 421 (HTTP) or 403 (upgrade), checked before the Origin rule.
- **CSP connect-src** of the viewer page is built per request: `'self' ws://<host:port>` of this server (Safari and older
  WebViews do not let `'self'` cover `ws:`), never the `ws:` wildcard. The overlay keeps `connect-src 'self'`.
- **Device tokens at rest** (`connect-devices.json`) are encrypted per device with the OS credential store (Electron
  `safeStorage`, like the Spotify tokens) and written atomically. Where encryption is unavailable the file falls back to
  plaintext tokens; an old plaintext file is migrated to encrypted on the first load once encryption is available. A token
  that cannot be decrypted is dropped (that device pairs again).
- **Devices list**: every way a session ends (kick, revoke, role change, dead-peer sweep, replacement by a reconnect, peer
  close, pre-auth timeout) goes through one `drop()`, which refreshes the devices list controllers see. A peer's TCP FIN
  is now treated as a close (Node's http sockets are half-open capable, so FIN alone never fired `close`).
- **mDNS** is bound to 0.0.0.0:5353 (needed to receive multicast on every OS) but joins the group on the LAN interface only,
  answers by multicast on that interface, and ignores any query whose source address is not private / link-local / loopback.
- **Pairing cannot be downgraded**: `pair` is accepted only as a connection's first step and a code is single use;
  there is no negotiation of weaker auth. (The pairing token itself still crosses the LAN in the clear, see below.)

NOT provided, plainly:
- **No encryption.** Plain `ws`/`http`: an attacker on the same Wi-Fi can read the now-playing stream, and can read the
  token if they sniff the moment of pairing (they could then act as that device). Pair on a network you trust. The
  code is single use and short, so a sniffed code alone is useless after pairing, but the token travels once.
  Planned fix: self-signed certificate per install with the fingerprint in the QR (`#p=CODE&fp=...`), native
  clients pin it; browsers would warn, which is why it is not done yet, and Node has no built-in cert generator.
- Server-to-client messages are not individually MACed (read-only data); commands are.
- mDNS answers queries for the service name only; no browsing.
- A hostile device that is already paired as controller can control playback until disconnected.
- An overlay link is a bearer secret in a URL (fragment). It ends up in OBS's saved scene files, and in a browser's history or
  bookmarks if opened there; anyone who copies it can watch what plays (read-only) until it is removed. Not encrypted either.
  Revoking the overlay device drops its live socket immediately (tested) and the link can never authenticate again.

## 5. Limits and what is verified

Unit tested (vitest): protocol parsing and limits, HMAC against node:crypto, clock-offset maths and follow decisions,
backoff, pairing (expiry, single use, brute force, rate limit, party, revoke, persistence, device cap), command gate,
sync-state diffing, WebSocket framing, mDNS packet building and parsing, LAN address and origin rules. The hub is
tested over real loopback sockets: pair, replay state, reconnect by proof, bad code / bad proof, forbidden commands,
signed commands and replays, revoke, party, ping, live broadcast, wrong origin, rebinding Host (HTTP and upgrade), the CSP
header, and the devices list after kick, revoke, sweep, replacement and peer disconnect; the encrypted device store is
tested with a fake cipher (encrypt, migrate, fallback, undecryptable, corrupt file). The overlay role has its own hub tests:
link shape, `/overlay` CSP, proof auth, redaction (no choices, no video id, no device list), view-only enforcement with a valid
signature, no upgrade or minting through codes, invisibility to controllers, revocation of a live and a stale link, device cap,
and a loopback test that drives the overlay's feed logic (clock offset included) from a live host.
The overlay and the viewer were also run in Chromium (Playwright, `scripts/ui-test/overlay-check.mjs`) against the real hub on
loopback: the looks (the overlay maps the app's 34 vibes onto 10 looks), transparency, chroma, options, the line advancing with the clock and freezing on pause, live vibe
change, wrong / missing / revoked credentials, no CSP violation, the viewer's manifest, icon, TV layout, idle hide, and that
pairing from the QR fragment and reconnecting by proof still work.
The viewer was loaded in a browser against a live hub: pairing from the QR fragment (fragment wiped), credential
stored, lyric highlight following the shared clock, controller controls and vibe accent shown.

NOT verified: the Electron app end to end (Devices panel and its overlay link, IPC, real mDNS on a network, real second device), OBS's own browser (CEF) loading the link (only Chromium via Playwright), the full-screen and wake-lock calls (they need a user gesture or HTTPS), the YouTube
embed sync on the viewer (needs internet), TV browsers, Android. The viewer's seek control and command signing in the
browser were not exercised against the host; the HMAC used for auth in the browser was (pairing and reconnect would
fail otherwise).

## 6. Android plan (minimal bridge, not implemented here)

`src/android-web/api.ts` gets a stub `connect` API (disabled). Android TV, Auto and other-device apps should be clients
of this protocol: discover with `NsdManager` for `_lyra-connect._tcp`, pair with a typed code or QR, store
`deviceId`/`token` in the Keystore-backed `EncryptedSharedPreferences`, implement sections 3, 5, 6 of the protocol
(OkHttp WebSocket + HMAC from `javax.crypto`). An Android phone running Lyra as the HOST would need the hub ported to
Kotlin (same messages); until then the phone app is a client, or hosts via the existing Rooms feature.
Known follow-ups: TLS pinning, a Lyra-to-Lyra "follow another PC" client inside the desktop app (today another PC
uses the web viewer), migrating Rooms onto this protocol.
