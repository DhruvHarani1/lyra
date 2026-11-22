# Privacy

Lyra runs entirely on your PC. There are no accounts, no analytics and no telemetry.

**What stays local:** your settings, favorites, saved lyric moments, per-song lyric choices and offsets,
and caches (lyrics, artwork, release years). They live in `%APPDATA%\Lyra`. Uninstalling Lyra does not
delete that folder; remove it by hand if you want everything gone.

**What leaves your PC (only while a song plays):**
| Service | Sent | Why |
|---|---|---|
| [LRCLIB](https://lrclib.net) | song title, artist, album, duration | find synchronized lyrics |
| [PublicDomainOnly](https://github.com/kennethyork/PubDomainOnly) on raw.githubusercontent.com | nothing about your music: Lyra downloads the public lyrics file (about 0.8 MB) once per session, only when LRCLIB has no lyrics for a song, and matches it on your device | old public-domain songs as a last resort |
| [MusicBrainz](https://musicbrainz.org) | song title, artist, duration | look up the release year |
| [Apple iTunes Search](https://performance-partners.apple.com/search-api) | song title, artist | find a free 30-second music-video preview for the cinematic background (on by default; turn off by choosing "Living" or "Still" as the background style) |
| Google YouTube Data API + [youtube-nocookie.com](https://www.youtube-nocookie.com) | song title, artist (the karaoke screen also adds the word "karaoke" to the search); then the video player loads from YouTube | **only if you paste your own YouTube API key** in Settings → Background: find and play the official music video, muted, behind the lyrics, or a karaoke version |
| YouTube thumbnail host (`i.ytimg.com`) | the video id of the video that is about to play | **only with a YouTube key**: fetch one small preview picture to see whether the video has black bars, so Lyra can trim them |
| GitHub Releases (`api.github.com`, `github.com`) | nothing about you or your music (a normal web request, so GitHub sees your IP address) | the Windows app checks for a new version (electron-updater), and the Android app, if it was installed from GitHub, checks for one (see Android below) |
| Spotify image CDN | the artwork URL Spotify already gave Lyra | download cover art (only when using the optional Spotify API source) |

Lyra reads what the Spotify desktop app is playing through Windows media controls. It never sees your
Spotify password or account. If you enable the optional Spotify API source, tokens are encrypted with
Windows DPAPI and stored locally.

Backgrounds you choose (GIF, image, MP4, WebM) are **copied** into `%APPDATA%\Lyra\backgrounds` and never uploaded.
A YouTube API key, if you add one, is encrypted with Windows DPAPI, kept only in the main process and never shown
to the interface; remove it any time in Settings → Background.

**On Android** the same rules apply, plus: Lyra asks for *Notification access* only so Android will let it see which song is playing (title, artist, album, position, cover). It does not read or store your notifications. Your settings, saved lines, and any background video/GIF you pick live in the app's private storage; a YouTube API key is encrypted with the Android Keystore. The optional floating widget and "keep running" service only show lyrics and keep the app alive; they send nothing anywhere. *Record lyric video* asks Android for screen-recording consent and for the sound permission, which it uses only while you record, to capture the music app's playback and, if the phone does not allow that, to hear the music through the microphone; the video is saved to your Movies/Lyra folder and goes nowhere unless you share it yourself.

Requests go straight from your PC to those services; Lyra has no server of its own.

**Where a song title goes, in short:** to LRCLIB (and, as a last resort, only a downloaded file is read), to MusicBrainz, to Apple's iTunes search, and, only if you added a YouTube key, to Google. Everything is looked up once per song and then cached on your device (see below), so a song you played before sends nothing the second time until its cache entry expires.

## Local caches (and the Clear cache button)

Lyra remembers answers so repeat plays are instant and cost no quota. All of it is stored in your Lyra folder (`%APPDATA%\Lyra` on Windows, the app's private storage on Android), never uploaded: found lyrics (30 days), "no lyrics" answers (12 hours), plain-only answers (24 hours), the YouTube choice per song (hit 90 days, miss 14 days), the karaoke search results (30 days, 3 days when empty), the Apple clip lookup (30 days, 7 days when empty), release years, and songs whose video failed. **Settings → Clear cache** forgets the lookup caches (lyrics, video and clip searches). It does not delete what you chose yourself: pinned lyric matches, imported lyrics, per-song choices (the video you picked, the lyrics match, a timing nudge), favorites, saved moments, your backgrounds and your settings. Those stay until you remove the Lyra folder by hand.

## Optional network features (off by default)

- **Lyra Connect** (Settings → Connect → Devices) shows Lyra on your other screens over your **local network**. It is **off until you turn it on**, listens only on one private LAN address of the PC (not on every interface) and sends nothing to the internet. What it is, and what it is not:
  - **Not encrypted.** It uses plain `http` and `ws`. Anyone on the same Wi-Fi who is sniffing traffic can read what is playing (song, lyrics, cover, look) and, if they capture the moment a device is being paired, the pairing token, which would let them act as that device. Pair on a network you trust. The one-time pairing code is single use and lasts 2 minutes, and the token itself is never re-sent afterwards (devices prove they have it with a challenge-response), but it does travel once at pairing. TLS is planned, not built.
  - **Per-device tokens**, stored in `connect-devices.json` in your Lyra folder on this PC, and on the paired device. Disconnect a device in the panel and its token is forgotten and its connection dropped at once. At most 12 devices.
  - **Roles:** a viewer only watches; a controller can also play, pause, skip, seek, set volume and change the look (every command is signed and replay-protected); an overlay link is view-only.
  - **Party mode** is one shared viewer-only code for a group. Guests are removed when the party ends (or after 4 hours).
  - **It announces itself on the local network** with mDNS/DNS-SD as `_lyra-connect._tcp` (so apps can find the PC) while Connect is on. It answers queries for that service name only.
  - **The OBS overlay link is a secret in a URL.** It looks like `http://<pc>:47813/overlay#d=...&t=...`. The secret sits in the part after `#`, which browsers do not send to the server, but the link itself is the password: anyone who copies it (it is saved in OBS's scene file, and in a browser's history if you open it there) can watch what you play until you remove the link in the Devices panel. It is view-only and the page never shows your per-song choices.
  - What a connected device receives: the song, position, synced lyrics, cover, the look, and the video id and your per-song choices for viewers and controllers (overlays get none of the last two). Audio is never sent.
  - Details and limits: `docs/connect-redesign.md`, `docs/connect-protocol.md`. Not verified here: the Android TV client talking to a PC, and a real two-device test on a physical network.
- **Listen together** (Rooms) is a separate **internet** feature: friends' browsers or apps connect to yours directly with WebRTC. The public PeerJS broker (`0.peerjs.com`) only introduces the two sides, and a public STUN server helps them find each other, so both can see the other's network address. The host sends, to each guest: the song title, artists, duration, whether it is playing, the position (with a timestamp), the synced lyrics (time and text of every line) and the cover (a link, or a small image embedded in the message). A guest sends only a hello and clock pings; when you join a room from the Lyra app (Jam), Lyra matches your own player to the host's play/pause and position. No audio, no files, no account. Stop the room and nothing more is shared. The room code is the only thing that protects a room: anyone who has it can listen in.
- **Export lyric video** records the song as it plays. On Windows a small helper (`lyra-audio.exe`) listens to the Spotify app's own sound only, so other programs and notifications stay out; if that is not possible, the whole PC sound is recorded instead. Nothing is uploaded: the video is saved to the file you choose.

## Android: the in-app updater

If you installed the APK from GitHub (not from Google Play, F-Droid or IzzyOnDroid, where the store updates it), Lyra can check for a new version: it reads the public list of releases from `api.github.com`, at most every 12 hours and on Wi-Fi by default, and downloads the APK from `github.com`. Before installing it checks the file's **SHA-256** against the release's checksum and that it is **signed with the same certificate** as the installed app, then hands it to Android's installer, which asks you to confirm. Nothing about you or your music is sent. Store builds do not run it.

## What never leaves your device

Your settings, favorites, saved moments, per-song choices, pinned and imported lyrics, your own background files, the caches above, the Connect device list and tokens, notification contents (Lyra never reads them), your YouTube key (encrypted, never shown to the interface) and any Spotify tokens. There is no analytics, crash reporting or advertising SDK. Not verified here: the network traffic of the YouTube player iframe itself, which is Google's code and may set its own cookies.
