// Browser harness: runs the real renderer with a mocked `window.lyra`, so UI can be screenshotted without Electron.
import { DEFAULT_SETTINGS, type PlaybackSnapshot, type Settings } from '@shared/types'
import { DEMO_TRACKS } from '@core/demo/data'
import { demoLyrics } from '@core/demo/lyrics'

const q = new URLSearchParams(location.search)
if (q.get('android')) document.documentElement.dataset.platform = 'android'
// ?car=1 opens Car mode; ?carnight=0 gives the daytime palette; ?dock=1 shows the "Car mode" offer instead
if (q.get('car')) document.documentElement.dataset.car = '1'
if (q.get('carnight')) document.documentElement.dataset.carNight = q.get('carnight') === '0' ? '0' : '1'
// ?tv=1: the Android TV page (10-foot UI, full-screen scene, remote control): data-platform="tv" + the TV controller below
const tv = !!q.get('tv')
if (tv) document.documentElement.dataset.platform = 'tv'
if (q.get('overlay')) document.documentElement.dataset.overlay = '1'
const idx = Number(q.get('track') ?? 0)
let track = DEMO_TRACKS[idx] ?? DEMO_TRACKS[0]!
const playbackListeners: Array<(s: PlaybackSnapshot) => void> = []
let settings: Settings = { ...DEFAULT_SETTINGS, onboarded: true, source: 'api', ...(JSON.parse(q.get('s') ?? '{}') as Partial<Settings>) }
let startedAt = Date.now() - Number(q.get('t') ?? 40000)
let playing = q.get('paused') !== '1'
let frozenAt = Number(q.get('t') ?? 40000)
const snap = (): PlaybackSnapshot => ({
  track: q.get('idle') === '1' ? null : track, isPlaying: playing, positionMs: playing ? Date.now() - startedAt : frozenAt, sampledAt: Date.now(),
  device: { name: 'Studio PC', type: 'Computer', volume: 70 } as never, shuffle: false, repeat: 'off', isAdOrUnknown: q.get('ad') === '1'
})
// ?lang=hi|pa plays original sample lyrics in Devanagari / Gurmukhi (for glyph clipping and Roman-line checks)
const SAMPLE: Record<string, string[]> = {
  // ?lang=rp: English lines with a repeated chorus, a quoted line and an exclamation (Journal pens, chorus brace)
  rp: ['Streetlights hum a quiet tune', 'Hold on, hold on tight!', '“Never again,” she said', 'Over rooftops, under the moon', 'Hold on, hold on tight!', 'I count the hours in the glass', 'Hold on, hold on tight!', 'Watching every moment pass'],
  hi: ['रात के सन्नाटे में तेरी याद आई', 'चाँदनी बिखरी है सारी राहों में', 'दिल ने फिर तुझको पुकारा है', 'धड़कनों में गूँजती है एक कहानी', 'तू जहाँ भी है मेरी दुआओं में है', 'ख़्वाबों की बारिश में भीगा सा मन', 'लौट आ कि अब भी इंतज़ार है', 'हर लम्हा तेरे नाम कर दिया', 'साँसों की डोर तुझसे बँधी है', 'आसमान तक फैली हैं आशाएँ', 'चाँद भी आज थका सा लगता है', 'बस एक बार मुड़कर देख ले'],
  pa: ['ਰਾਤ ਦੀ ਚੁੱਪ ਵਿੱਚ ਤੇਰੀ ਯਾਦ ਆਈ', 'ਚਾਂਦਨੀ ਖਿੱਲਰੀ ਹੈ ਸਾਰੀਆਂ ਰਾਹਾਂ ਵਿੱਚ', 'ਦਿਲ ਨੇ ਫਿਰ ਤੈਨੂੰ ਪੁਕਾਰਿਆ ਹੈ', 'ਧੜਕਣਾਂ ਵਿੱਚ ਗੂੰਜਦੀ ਹੈ ਇੱਕ ਕਹਾਣੀ', 'ਤੂੰ ਜਿੱਥੇ ਵੀ ਹੈਂ ਮੇਰੀਆਂ ਦੁਆਵਾਂ ਵਿੱਚ ਹੈਂ', 'ਖ਼ਾਬਾਂ ਦੀ ਬਾਰਿਸ਼ ਵਿੱਚ ਭਿੱਜਿਆ ਮਨ', 'ਮੁੜ ਆ ਕਿ ਹੁਣ ਵੀ ਇੰਤਜ਼ਾਰ ਹੈ', 'ਹਰ ਪਲ ਤੇਰੇ ਨਾਮ ਕਰ ਦਿੱਤਾ', 'ਸਾਹਾਂ ਦੀ ਡੋਰ ਤੇਰੇ ਨਾਲ ਬੱਝੀ ਹੈ', 'ਅਸਮਾਨ ਤੱਕ ਫੈਲੀਆਂ ਨੇ ਆਸਾਂ', 'ਚੰਨ ਵੀ ਅੱਜ ਥੱਕਿਆ ਜਿਹਾ ਲੱਗਦਾ ਹੈ', 'ਬੱਸ ਇੱਕ ਵਾਰ ਮੁੜ ਕੇ ਵੇਖ ਲੈ']
}
const sampleLyrics = (id: string, lang: string): unknown => ({
  trackId: id,
  status: 'synced',
  provider: 'demo',
  wordSynced: false,
  lines: SAMPLE[lang]!.map((text, i) => ({ timeMs: 7000 + i * 6000, text }))
})
const lyricsFor = (id: string): unknown => {
  const lang = q.get('lang')
  if (lang && SAMPLE[lang]) return sampleLyrics(id, lang)
  const ly = q.get('ly')
  if (ly === 'offline') return { trackId: id, status: 'error', provider: 'lrclib', lines: [], error: { kind: 'network', message: 'offline', retryable: true } }
  if (ly === 'resting') return { trackId: id, status: 'error', provider: 'lrclib', lines: [], error: { kind: 'rate-limit', message: 'resting', retryable: true, retryInSec: 24 } }
  if (ly === 'error') return { trackId: id, status: 'error', provider: 'lrclib', lines: [], error: { kind: 'server', message: 'boom', retryable: true } }
  if (ly === 'plain') return { trackId: id, status: 'plain', provider: 'lrclib', lines: [], plain: 'First verse goes here\nSecond line of the verse\nAnother line of words\n\nChorus starts right here\nSing it out loud tonight\nHold the final note' }
  if (ly === 'none') return { trackId: id, status: 'none', provider: 'lrclib', lines: [] }
  if (ly === 'stale') return { ...demoLyrics(id), stale: true }
  return demoLyrics(id)
}
// ?kv= simulates the karaoke search: found (default) | none | nokey; ?ksim=1 swaps YouTube for a fake 200 s video clock
if (q.get('ksim')) (window as any).__karaokeSim = true
const karaokeItems = (): { items: unknown[]; error?: string } => {
  const kv = q.get('kv') ?? 'found'
  if (kv === 'none') return { items: [] }
  if (kv === 'nokey') return { items: [], error: 'Add a YouTube API key in Settings → Background first.' }
  return {
    items: [
      { videoId: 'aaaaaaaaaaa', title: `${track.title} (Karaoke Version)`, channel: 'Sing King', durationSec: Math.round(track.durationMs / 1000) },
      { videoId: 'bbbbbbbbbbb', title: `${track.title} (Karaoke With Lead Vocals)`, channel: 'Karafun Karaoke', durationSec: Math.round(track.durationMs / 1000) + 2, guide: true },
      { videoId: 'ccccccccccc', title: `${track.title} (Instrumental)`, channel: 'Some Channel', durationSec: Math.round(track.durationMs / 1000) + 24 }
    ]
  }
}
const sub = () => () => {}
const noop = async () => undefined
const api: any = {
  settings: { get: async () => settings, set: async (p: Partial<Settings>) => (settings = { ...settings, ...p }), reset: async () => settings, onChange: sub },
  window: { setMode: noop, getMode: async () => (q.get('mode') ?? (tv ? 'full' : 'mini')), onMode: sub, onFade: sub, settle() {}, resizeStart() {}, resizeMove() {}, resizeEnd() {}, dragStart() {}, dragMove() {}, dragEnd() {}, hide() {}, minimize() {}, quit() {} },
  connect: { status: async () => ({ enabled: false, running: false, noNetwork: false, url: null, party: false, devices: [], codes: [] }), setEnabled: async () => ({ enabled: false, running: false, noNetwork: false, url: null, party: false, devices: [], codes: [] }), newCode: async () => ({ enabled: false, running: false, noNetwork: false, url: null, party: false, devices: [], codes: [] }), party: async () => ({ enabled: false, running: false, noNetwork: false, url: null, party: false, devices: [], codes: [] }), revoke: async () => ({ enabled: false, running: false, noNetwork: false, url: null, party: false, devices: [], codes: [] }), setRole: async () => ({ enabled: false, running: false, noNetwork: false, url: null, party: false, devices: [], codes: [] }), publishView: noop, onChange: sub },
  cache: { clear: async () => ({ cleared: 0 }) },
  choices: { get: async () => null, setOffset: async () => undefined, clear: async () => undefined },
  spotify: { connect: noop, disconnect: noop, startDemo: noop, useLocal: noop, getStatus: async () => ({ state: 'demo' }), getSnapshot: async () => snap(), onStatus: sub, onPlayback: (cb: (s: PlaybackSnapshot) => void) => { playbackListeners.push(cb); return () => {} } },
  player: { command: async () => ({ ok: true }), isLiked: async () => false, setLiked: async () => ({ ok: true }), queue: async () => DEMO_TRACKS.slice(1).map((t) => ({ id: t.id, title: t.title, artists: t.artists, artworkUrl: t.artworkUrl })), recent: async () => [], openInSpotify: noop },
  // ?ly= simulates the lyrics outcome: offline | resting | error | none | plain | stale
  lyrics: {
    get: async (t: { id: string }) => lyricsFor(t.id),
    refresh: async (t: { id: string }) => lyricsFor(t.id),
    importText: async (_t: unknown, text: string) => ({ trackId: track.id, status: 'plain', provider: 'you', lines: [], plain: text, imported: true, pinned: true }),
    importFile: async () => null,
    health: async () => [
      { id: 'lrclib', name: 'LRCLIB', state: q.get('ly') === 'resting' ? 'down' : q.get('ly') === 'offline' ? 'slow' : 'ok', lastError: '', retryInSec: q.get('ly') === 'resting' ? 24 : 0, lastOkAt: 0 },
      { id: 'public-domain', name: 'Public-domain library', state: 'ok', lastError: '', retryInSec: 0, lastOkAt: 0 }
    ], candidates: async () => ({ items: [] }), choose: async () => demoLyrics(track.id), clearPin: async () => demoLyrics(track.id) },
  art: { get: async (u: string) => u },
  moments: { list: async () => [], add: async () => [], remove: async () => [] },
  background: {
    // ?vs= simulates every video outcome: searching | nokey | none | error | live | preview
    resolve: () => {
      const vs = q.get('vs') ?? (q.get('video') ? 'live' : 'off')
      const base = { youtube: 'off', hasSongMedia: false, hasGlobalMedia: false }
      if (vs === 'searching') return new Promise(() => {})
      if (vs === 'live') return Promise.resolve({ ...base, spec: { kind: 'media', url: `/${q.get('video') ?? 'night'}.mp4`, media: 'video', name: 'Glass Hours (Official Video)', scope: 'song' } })
      if (vs === 'preview') return Promise.resolve({ ...base, spec: { kind: 'preview', url: '/day.mp4', title: 'Glass Hours preview', width: 1280 } })
      const youtube = vs === 'nokey' ? 'no-key' : vs === 'none' ? 'none' : vs === 'error' ? 'error' : 'off'
      return Promise.resolve({ ...base, youtube, youtubeMessage: 'HTTP 403', spec: { kind: 'living' } })
    },
    pick: async () => ({ ok: false }), clear: noop, hasYoutubeKey: async () => false, setYoutubeKey: async () => ({ ok: true }), clearYoutubeKey: noop, youtubeCandidates: async () => ({ items: [] }), karaokeVideos: async () => karaokeItems(), youtubeChoose: noop },
  update: { get: async () => ({ state: 'idle' }), check: noop, install: noop, onState: sub },
  studio: { setMic: noop }, lan: { info: async () => ({ running: false, urls: [], qr: null }), onOffer: sub, answer: noop },
  app: { info: async () => ({ version: '0.17.1', platform: 'win32', envClientId: false }), diagnostics: async () => '', copy: async () => true, copyImage: async () => true, shareImage: async () => 'saved', failedShortcuts: async () => [], onCommand: sub }
}
;(window as any).lyra = api
// window.__setPlaying(false|true) pauses / resumes the fake player live (used by the video sync test)
;(window as any).__setPlaying = (on: boolean) => {
  if (on === playing) return
  if (on) startedAt = Date.now() - frozenAt
  else frozenAt = Date.now() - startedAt
  playing = on
  playbackListeners.forEach((cb) => cb(snap()))
}
// window.__next() plays the next demo song (used to check the vibe conductor)
;(window as any).__next = () => {
  track = DEMO_TRACKS[(DEMO_TRACKS.indexOf(track) + 1) % DEMO_TRACKS.length]!
  playbackListeners.forEach((cb) => cb({ ...snap(), positionMs: 1000, sampledAt: Date.now() }))
}
await import('@/main')
if (tv) {
  // ?tvs= picks the setup screen the TV shows: ready (default, plays) | pair (QR + short code) | access (standalone, no notification access) | nolist (…and Settings has no such screen)
  const tvs = q.get('tvs') ?? 'ready'
  const mock = {
    mode: tvs === 'pair' ? 'paired' : 'local',
    hasAccess: tvs !== 'access' && tvs !== 'nolist',
    canOpenAccessSettings: tvs !== 'nolist',
    paired: false,
    code: 'K7M-2QX',
    link: 'lyra://pair?c=K7M2QX&n=Living%20Room%20TV',
    deviceName: 'Living Room TV',
    adb: 'adb shell cmd notification allow_listener dev.lyra.android/dev.lyra.android.MediaListenerService'
  }
  ;(window as any).__lyraNative = { push() {}, back: () => false }
  const { startTv } = await import('../../src/android-web/tv')
  startTv({ rpc: async (m: string) => (m === 'tvState' ? mock : true) as never, exit: () => console.log('tv exit'), forceSetup: tvs !== 'ready' })
}
const panel = q.get('panel')
if (panel) { const { useUi } = await import('@/store/ui'); useUi.getState().setPanel(panel as never) }
if (q.get('dock')) { const { useCar } = await import('@/store/car'); useCar.getState().setEnv({ dock: true }) }
