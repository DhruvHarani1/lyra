# Research: free, legal, high-quality video sources for Lyra

Date: 2026-11-22. Scope: research only, no app code changed. No API keys appear in this file.

Legend: **[V]** verified against an official page fetched in this session. **[S]** from a secondary source (search summary, third-party repo or blog). **[U]** unverified (background knowledge, check before relying on it).

## 1. What Lyra has today

- `src/core/background/youtube.ts`: user-supplied Data API key (stored via `platform().secret`), one `search.list` per song, then `videos.list` for duration/definition/embeddable. Cache keyed by artist|title: 90 days for hits, 14 days for misses, 6 h quota cooldown, picker list cached so it costs no extra quota.
- `src/core/background/rank.ts`: pure scorer. Needs embeddable, title similarity, artist hit, "official" title/own channel/VEVO, length within 30 s, rejects "- Topic" channels, Shorts, lyric/audio/live variants (burned-in text), prefers HD.
- `src/core/background/itunes.ts`: iTunes Search API, 30 s preview clips from `*.itunes.apple.com` only (loops, never synced).
- `src/core/background/resolver.ts`: Auto order = your file for this song, your file for all songs, Apple clip (YouTube instead if the clip is only 640p and a key exists), YouTube (key needed), animated cover art.
- `docs/video-sources.md`: sync/seek/caption behaviour of each player. YouTube embeds use `cc_load_policy=0`, `iv_load_policy=3`, captions module unloaded.

Main weakness: the best source (official video) needs the user to create a Google Cloud key; without it Lyra falls back to a 30 s loop.

## 2. Ranked table

Rank = value for Lyra (quality x legality x cost x reliability).

| # | Source | Gives | Auth / limits | License / ToS for an open-source app | Quality | Reliability | Fit in Lyra |
|---|---|---|---|---|---|---|---|
| 1 | **YouTube IFrame embed + Data API `videos.list`** (already used) | Official MV, full length, syncable | Embed: no key. `videos.list`: 1 unit [S] | Embed is the sanctioned route. Must not overlay/obscure the player, no audio-only/background play, 200x200 minimum, Referer required (error 153 otherwise) [V] | Up to 4K, 16:9; official MVs rarely have burned-in text | High; some videos non-embeddable (101/150) | Primary video source (keep) |
| 2 | **MusicBrainz url-rels (+ ListenBrainz metadata)** for the video id | Human-curated YouTube id per recording | No key. 1 req/s per IP, User-Agent with contact required, 503 over limit [V] | Core data is CC0, fine to cache | id only | Coverage patchy: YouTube links often missing on recordings [S] | Zero-quota id lookup, tried before search |
| 3 | **YouTube Data API `search.list`** (fallback id lookup) | Search by artist+title | Default 100 `search.list` calls/day in their own bucket; 10,000 units/day for all other methods [V] | Key must be the user's own, never shipped. Search results must not be modified/replaced [V] | as #1 | High | Fallback when MB has no link; keep cache TTLs |
| 4 | **Apple Music animated artwork (editorialVideo)** | 8-35 s square/tall loop, HLS, source up to 3840 px [S] | No official public endpoint; community tools reuse the anonymous web-player JWT [S] | Unofficial, ToS grey. Do not ship the token scraping | Excellent, no captions, subset of albums only | Medium-low | Optional, user opt-in at most; treat as risk |
| 5 | **Apple iTunes preview clips** (already used) | 30 s clip, some music-video previews | No key. About 20 req/min soft limit [U] | Public Search API, previews are intended | 640p-1080p | High | Free fallback, loops, never synced |
| 6 | **Pexels API (videos)** | Generic mood loops by keyword, HD/4K MP4 | Free key. 200 req/h, 20,000/month, 429 over limit; limit increases paused [S] | Free incl. commercial; API guidelines require a visible link back to Pexels; no bulk download/redistribution [S] | HD 16:9, no captions | High | Mood backdrop; needs per-user key |
| 7 | **Pixabay API (videos)** | Loops, MP4 in several sizes | Free key. 100 req/60 s, cache responses 24 h, show Pixabay as source [S] | Pixabay Content License; video may be embedded directly, storing on own server recommended [S] | Up to 4K, 16:9 | High | Same role as Pexels; good for caching |
| 8 | **Coverr API** | Curated loops | Demo 50 calls/h [S] | API use requires visible Coverr attribution [S] | HD | Medium | Skip for now |
| 9 | **NASA Image and Video Library** (`images-api.nasa.gov`) | Space footage, mostly public domain | No key for search [U] | Mostly not copyrighted in the US; no implied endorsement, logos restricted, third-party items flagged [S] | Mixed, few loops | High | "Space" theme only |
| 10 | **Wikimedia Commons** (`gsrsearch=... filetype:video`) | CC/PD clips with `extmetadata` license | No key; send a User-Agent [S] | Per-file license, credit needed, filter out ShareAlike [S] | WebM, often low-res | High | Niche |
| 11 | **Internet Archive** (advancedsearch, Prelinger etc.) | PD footage | No key, polite use [U] | Per-item license, high variance [U] | Low-mixed | Medium | Skip |
| 12 | **Vimeo** | Few official MVs; oEmbed and Player SDK | oEmbed keyless; API needs OAuth [U] | Embed only if uploader allows | Good | High | Manual "paste a link" only |
| 13 | **Dailymotion** | Some official MVs; Player SDK | API v2 exists [V]; details [U] | Embed only | Good | Medium (regional) | Optional pasted-link embed |
| 14 | **Piped / Invidious** | Search + stream URLs, no key | Instance dependent | Violates YouTube ToS; YouTube legal demanded Invidious shut down in 2023 [S]. Public Invidious instances fell to about 3 and Piped about 15 by Mar 2026 (single source) [S] | Whatever YouTube serves | Low | Do not ship; maybe user-run self-host |
| 15 | **Odesli / song.link API** | Cross-platform links incl. YouTube id | 10 req/min without key, 60 with key; public API being sunset/allow-listed, new keys reportedly stopped [S]. A competitor claims YouTube/Apple missing in some responses (treat with caution) [S] | Heavy use restricted [U] | id only | Declining | Do not depend on it |
| 16 | **Wikidata P1651 (YouTube video id)** | Id for notable songs | Free API/SPARQL, send UA [S] | CC0 | id only | Famous songs only | Cheap extra lookup, low priority |
| 17 | **Generative / shader backgrounds** (WebGL/Canvas) | Infinite, offline, no caption risk, can react to the song clock | None | Our own code | Resolution independent | Perfect | Mandatory last-resort fallback and offline default |

## 3. Key findings and caveats

1. **YouTube quota changed.** The official quota page [V] says the default is 100 `search.list` calls/day (own bucket), 100 `videos.insert`/day and 10,000 units/day for all other endpoints. Older guides (100 units per search out of a shared 10,000) are outdated. One user can search about 100 new songs per day; `videos.list` is 1 unit for up to 50 ids, so verification is nearly free. The existing "search once per song, cache 90 days" design is right.
2. **YouTube embed rules that matter to Lyra [V]**: no overlay or frame in front of any part of the player including controls; no hidden/background player; no audio extraction; minimum 200x200; a Referer/origin is required (error 153). Lyra draws lyrics over the video, which is the biggest ToS grey area (a documented exception exists only for consent and playback-control overlays [S]). Mitigation options: a lyric panel beside/below the iframe, or accept the risk knowingly. Needs an owner decision; I could not confirm how Google enforces this against open-source apps.
3. **Burned-in captions**: official MVs almost never have them; lyric videos, visualizers, karaoke and some regional-label uploads do. See section 5.
4. **Do not rely on Piped/Invidious/Odesli**: unreliable, ToS-hostile or being withdrawn.
5. **Apple animated artwork** looks best but only through an unofficial token scrape [S]; optional and removable. Chromium needs hls.js for the HLS playlists [S].
6. **Stock sites** (Pexels/Pixabay) are legal, caption-free HD loops but not song-specific, and need a key and visible credit. Keys cannot be shipped in an open-source repo, so each user adds one (a proxy holding a key invites abuse and cost).
7. **MusicBrainz** returns url-rels only via direct lookup (`/ws/2/recording/{mbid}?inc=url-rels`), not via search [S]. Recording-level YouTube links use the "free streaming" relationship [V]. Coverage is incomplete [S], so it is a free first try, not the only path.
8. Unverified: iTunes rate limit, Vimeo/Dailymotion/Internet Archive terms, NASA API limits, exact ListenBrainz lookup endpoint behaviour. Check before implementing.

## 4. Recommended Auto order

1. User's own file (song, then global).
2. Cached id for the song, validated.
3. **Video id lookup chain (cheap to expensive)**: cache, then MusicBrainz url-rels (ISRC if known, else recording search by artist+title+length), then Wikidata P1651 (optional), then YouTube `search.list` if the user has a key.
4. Verify candidates with one `videos.list` (embeddable, duration, definition), rank with the existing `rank.ts`; auto-play only `acceptable` ones.
5. Apple animated artwork (if the user enabled it) or iTunes preview clip.
6. Stock loop by mood keyword (Pexels/Pixabay, user key) if enabled.
7. Generative shader background (always available, offline).

## 5. How to avoid burned-in captions

- Prefer the artist/VEVO channel and titles "Official Video / Official Music Video". Keep hard-penalizing (already in `rank.ts`) lyric, lyrics, visualizer, audio, karaoke, live, cover, reaction, sub/subtitulado/letra, sped up, slowed.
- Reject "- Topic" channels (still image) and Shorts (done).
- `contentDetails.caption` describes caption tracks, not burned-in text, so it is not a reliable signal. Category 10 (Music) is only a weak hint [U].
- Prefer MusicBrainz-linked ids: human-curated links are usually the official MV.
- Keep `cc_load_policy=0`, `iv_load_policy=3` and the unloaded captions module (done) for YouTube's own caption track.
- Optional pixel check for sources we can read (Apple HLS, stock, local files): sample a downscaled frame and test for a high-contrast text band in the lower third; on failure demote and try the next candidate. Impossible for cross-origin iframes.
- Keep the "pick another" list and add a per-song "never use this video" block list.

## 6. Cheap, robust video id for a song

1. Normalize artist+title (existing `trackCacheKey`); check the persistent cache first (hits 90 d, misses 14 d, keyed by song).
2. If the track has an ISRC, `GET /ws/2/recording?query=isrc:XXXX&fmt=json`, take the best MBID, then `GET /ws/2/recording/{mbid}?inc=url-rels&fmt=json` and extract `youtube.com/watch?v=` or `youtu.be/` relations. Queue to 1 req/s, send a User-Agent with app name and contact URL, cache by MBID for weeks.
3. Without ISRC, search recordings by artist+title and filter by length; check the ListenBrainz metadata lookup, which can expose `url_rels` [S].
4. If still nothing, YouTube `search.list` (if a key exists): one call per song, cache the list for the picker.
5. Confirm with `videos.list?part=status,contentDetails,snippet&id=a,b,c` (1 unit for up to 50 ids): embeddable, duration within 30 s of the song, then rank.
6. Cache negatives for 14 days; offer a "paste a YouTube link" box (parse the id, one `videos.list`), which costs nothing.

## 7. Integration plan

1. Add a new module, core/background/musicbrainz.ts (not written yet), (pure parsing plus a rate-limited fetch via `platform().fetch`), unit tests on recorded JSON fixtures, wired ahead of `search.list` behind a small `videoIdProvider` interface so more providers can plug in.
2. Key-optional playback: with a MusicBrainz hit and no key, play the embed directly and rely on the player's error events (101/150) to demote the id.
3. Add a `generative` background kind (shader) as the last fallback and offline default, driven by the song clock.
4. Optional stock provider (Pexels/Pixabay) with user keys in `platform().secret`, 24 h response cache, local cache of the chosen loop, visible credit.
5. Do not add Piped/Invidious/Odesli. Revisit Apple animated artwork only if the owner accepts the ToS risk.
6. Owner/legal decision: the YouTube overlay rule in finding 2.

## 8. Sources

- YouTube quota cost page: https://developers.google.com/youtube/v3/determine_quota_cost [V]
- IFrame API reference: https://developers.google.com/youtube/iframe_api_reference [V]
- YouTube developer policies, guide, required minimum functionality: https://developers.google.com/youtube/terms/developer-policies , https://developers.google.com/youtube/terms/developer-policies-guide [V/S]
- MusicBrainz rate limiting and relationship types: https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting , https://musicbrainz.org/relationships/recording-url [V/S]
- ListenBrainz metadata API: https://listenbrainz.readthedocs.io/en/latest/users/api/metadata.html [V]
- Wikidata P1651: https://www.wikidata.org/wiki/Property:P1651 [S]
- Odesli API docs: http://help.song.link/articles/3037922-api-documentation-v1-alpha-1 [S]
- Pexels API: https://www.pexels.com/api/documentation/ [S]
- Pixabay API: https://pixabay.com/api/docs/ [S]
- Coverr developers: https://coverr.co/developers [S]
- NASA media guidelines: https://www.nasa.gov/nasa-brand-center/images-and-media [S]
- Wikimedia reuse: https://commons.wikimedia.org/wiki/Commons:First_steps/Reuse [S]
- Apple motion artwork community tools: https://github.com/m8tec/apple-music-animated-artworks [S]
- Piped/Invidious status: https://selfhosting.sh/compare/invidious-vs-piped/ [S]
