# Lyra Connect protocol, version 1

For anyone building a client (Android TV, Android Auto, phone app, another PC). The reference implementation is
`src/core/connect/` (pure logic, shared by host, web viewer and tests) and `src/main/connect/` (the host). The web
viewer in `src/main/connect/viewerHtml.ts` is a complete working client (pairing, reconnect, clock sync, lyric rendering and controls; read it as the reference
implementation, it is no longer tiny).

## 1. Transport and discovery

- One WebSocket, `ws://<host-ip>:<port>/ws`, text frames only, JSON. Plain `ws` (no TLS, see Security).
- Default port 47813; if taken the host picks another, so always use the discovered / displayed port.
- The host listens only on one private IPv4 address of its Wi-Fi / Ethernet card and refuses non-LAN peers.
- Discovery: mDNS / DNS-SD service type `_lyra-connect._tcp`, TXT `v=1`, `name=<PC name>`. Android: `NsdManager`.
  Discovery only says where Lyra is; it grants nothing. Browsers cannot browse mDNS, so the QR code carries the address.
- Pairing link (QR): `http://<ip>:<port>/#p=<CODE>`. The code is in the fragment, which is never sent to a server.
  Opening `http://<ip>:<port>/` serves the web viewer. Native clients skip the page and open the WebSocket directly.

## 2. Envelope and limits

Every message: `{"v":1,"t":"<type>", ...fields}`. A message with another `v` gets `err version` and a close.
Client messages max 4 KB, host messages max 768 KB. Unknown fields are ignored; unknown types are an error.

## 3. Handshake

A device is either unpaired (has a one-time code) or paired (has `deviceId` + `token`).

```
First time:   C: pair {code, name, cn}
              S: paired {deviceId, token, role, sn}      store deviceId + token (the only time the token is sent)
              S: ready ...
Next times:   C: hello {deviceId, name, cn}
              S: challenge {sn}
              C: auth {proof}
              S: ready ...
```

- `cn`, `sn`: random nonces, 16 to 32 bytes hex (client / server).
- `proof = HMAC-SHA256(token, "lyra1|auth|" + cn + "|" + sn)` as lowercase hex. The token is never sent again.
- `sessionKey = HMAC-SHA256(token, "lyra1|sess|" + cn + "|" + sn)`; used to sign commands.
- Code: 8 characters of Crockford base32 (`0-9 A-Z` without I L O U), case-insensitive, shown as `ABCD-EFGH`. Valid 2
  minutes, single use, destroyed after 5 wrong guesses, 10 wrong guesses a minute across all codes is a lock-out.
- Party code: reusable (up to 4 hours), always gives role `viewer`; its guests disappear when the party ends.
- Pre-auth: 10 s to finish, 30 messages max, then dropped. `ping` works at any stage.
- `ready {role, name, host, vibes[], party}` is followed by the state snapshot (section 4) and a `devices` list.
- A second connection by the same device replaces the first (`bye`).
- Errors: `err {code, msg}`; codes `version bad-message bad-code expired unknown-device bad-proof forbidden rate full replay`.
  An unknown device and a wrong proof both answer `bad-proof` so devices cannot be probed. On `bad-proof` a
  client should forget its credentials and ask the user to pair again.

## 4. Host to client messages (state)

| `t` | fields | meaning |
| --- | --- | --- |
| `now` | `now: {id,key,title,artists[],album?,durationMs} or null`, `choices?: {video?:{videoId}, lyrics?:{provider,id}, offsetMs?}` | the song and the user's per-song picks (`src/core/userChoices.ts`). `key` is the stable song identity (`songKey`). |
| `play` | `play: {playing, positionMs, at, volume?}` | the shared song clock anchor: "at host time `at` the song was at `positionMs`". |
| `view` | `view: {vibe, mode?, video:{id\|null}, offsetMs?}` | the vibe in effect (`data-vibe`), YouTube id of the background video or null, and the lyric shift in effect (global + per song). |
| `lyrics` | `id, status, synced, lines:[{t,x}]` | lyrics for song `id`. `t` in ms when `synced`, else 0. Can be re-sent (plain lyrics get one re-check for synced ones). |
| `art` | `id, src` | `https://` URL or `data:image/(png|jpeg|webp);base64,` (max 300 KB), or null. |
| `devices` | `devices:[{id,name,role,online}]` | controllers only. |
| `pong`, `err`, `bye` | | see sections 5 and 3. |

The host sends only what changed: an idle host sends nothing. `play` is re-sent on play / pause / seek (position
off the anchor by more than 400 ms), on volume change, and every 10 s as a refresh.

### The song clock on a client

```
hostNow  = Date.now() + offset                      // offset from section 5
position = play.positionMs + (play.playing ? hostNow - play.at : 0)   // clamp to [0, durationMs]
lyricTime = position - view.offsetMs
```

Lyrics, progress bars and the background video are all derived from this one position (see `src/core/clock.ts`).

### Video / background

`view.video.id` is a YouTube video id. Each device plays it locally (muted, no controls), seeks it to `position`
once, and corrects only when more than about 0.6 s off, at most every 3 s (`followDecision` in `clockSync.ts`).
No pixels or audio are streamed. If the id is null, offline, or the embed fails, show the cover art (`art`).
Devices without internet simply show art. The video is a shared timeline only when its length matches the song,
which the host already decided before choosing the id.

### Vibe / theme

Set `data-vibe` to `view.vibe`. `vibes` in `ready` lists every id the host knows. A client may map unknown vibes to a default.

## 5. Clock offset (NTP style)

```
C: ping {id, c0}                       c0 = client time
S: pong {id, c0, s1, s2}               s1 = host receive time, s2 = host send time
client at c3:  offset = ((s1 - c0) + (s2 - c3)) / 2      // host clock minus client clock
               rtt    = (c3 - c0) - (s2 - s1)
```

Keep the last 8 samples and use the one with the smallest `rtt` (queueing only ever adds delay). Drop samples with
negative or over 10 s `rtt`. Cadence (`pingDelayMs`): 6 pings 150 ms apart after connecting, then 6 one second apart,
then every 10 s. The host drops a peer silent for 20 s. Typical Wi-Fi accuracy is a few ms (uncertainty = rtt / 2).

## 5b. Roles

`viewer` watches, `controller` also commands (section 6), `overlay` is a view-only role for an OBS browser source. An overlay
device is created by the host (Devices panel), never by a pairing code; its credential is carried in the URL fragment of
`/overlay` (`#d=<deviceId>&t=<token>`) and used for the normal `hello` / `auth` handshake (the token itself is never sent). The
host redacts for it: `now` without `choices`, `view` with `video.id` null, `ready.party` false, no `devices`. Every command from an overlay gets `err forbidden`.

## 6. Client to host: commands (role `controller` only)

`cmd {n, b, mac}`: `n` strictly increasing integer per connection (start at 1), `b` a JSON **string** (so the signed
bytes are exact), `mac = HMAC-SHA256(sessionKey, n + "|" + b)`.

Bodies: `{"c":"play"|"pause"|"toggle"|"next"|"prev"}`, `{"c":"seek","ms":n}`, `{"c":"volume","pct":0..100}`,
`{"c":"vibe","id":"neon"}` (sets that vibe, fixed). Commands are rate limited (burst 10, 5 per second). A viewer
sending one gets `err forbidden`. The role is re-checked on every command, so a downgrade takes effect at once.
The result of a command is visible as normal `play` / `now` / `view` messages; there is no separate ack.

## 7. Follow me and party

Follow me is the default: any paired device, viewer or controller, shows the host's experience in time, because it only
renders what the host sends against the shared clock. Party mode is a shared viewer-only pairing code for a group; all
screens receive the same messages, so everyone shows the same song together. A controller device can run the same
client and also drive the host.

## 8. Reconnect

On close, reconnect with exponential backoff: 0.5 s, 1 s, 2 s ... capped at 15 s, each with +/-25 % jitter
(`backoffMs`). Reconnecting uses the `hello` / `auth` path, and re-estimates the clock. Pause timers while the screen is
off or the page hidden if the platform allows; the snapshot sent on `ready` brings a client fully up to date.

## 9. Security summary

Per-device 256-bit tokens (the overlay link is the one deliberate secret in a URL: fragment only, revocable), challenge-response (token never re-sent), signed commands with replay protection, single-use
short-lived pairing codes in the URL fragment, LAN-only binding and peer check, strict page CSP and same-origin check,
revocation (drops the live socket immediately, overlay links included), no secrets in URLs or Referers.
Host-side details a client author may notice: the HTTP server and the WebSocket upgrade answer only when the `Host`
header is the host's LAN IP, `localhost` or `127.0.0.1` (with or without the port), so connect by IP (the QR does), not
through a DNS name; browsers' `Origin` must equal `http://<Host>`; the viewer page's CSP allows a socket to its own
`ws://host:port` only; mDNS queries from non-LAN source addresses are ignored; stored device tokens are encrypted at rest
on the host where the OS allows. Server messages are not individually authenticated (the stream is read-only state; only
commands are MACed), and `pair` is accepted only as the first step of a connection, so there is no weaker path to
downgrade to. NOT provided: confidentiality. Traffic is plain `ws`: someone on the same network can
read what is playing and, at pairing time, see the token. See `docs/connect-redesign.md` for the plan to add TLS.
