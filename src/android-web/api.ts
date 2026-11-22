import { thumbCrop, type DecodedImage } from '@core/background/bars'
import { createBackgroundResolver, type SongBg } from '@core/background/resolver'
import { youtube } from '@core/background/youtube'
import { failedVideos } from '@core/background/failedVideos'
import { clearAllCaches } from '@core/cache/persistentCache'
import { lyricsService } from '@core/lyrics/service'
import { trackKey } from '@core/songKey'
import { keyForId } from '@core/trackIndex'
import { userChoices } from '@core/userChoices'
import type { LyraApi, Unsubscribe } from '@shared/ipc'
import { DEFAULT_SETTINGS, type ConnectionStatus, type LyricsResult, type ModeEvent, type PlaybackSnapshot, type QueueItem, type SavedMoment, type Settings, type ViewMode } from '@shared/types'
import { installAndroidPlatform, LocalStore, preloadSecrets, setAppVersion } from './platform'
import { nativeFetch, rpc } from './rpc'

/**
 * Android's implementation of `window.lyra`: the same surface the Windows preload exposes, so the React UI runs
 * unchanged. Lyrics and backgrounds use the shared core; playback and the OS come from the app through `rpc`.
 */

installAndroidPlatform()
void rpc<string>('version').then(setAppVersion).catch(() => undefined)
/** resolves once secrets are loaded; the UI starts after this */
export const ready: Promise<void> = preloadSecrets(['youtube-key'])

function emitter<T>(): { on(cb: (v: T) => void): Unsubscribe; emit(v: T): void } {
  const set = new Set<(v: T) => void>()
  return {
    on(cb) {
      set.add(cb)
      return () => set.delete(cb)
    },
    emit(v) {
      set.forEach((cb) => cb(v))
    }
  }
}

// ---------------- settings
const settingsStore = new LocalStore<Settings>('settings', {
  ...DEFAULT_SETTINGS,
  // phone defaults: no desktop welcome card, the expanded player is the home screen, and the video belongs in it
  onboarded: true,
  defaultMode: 'mini',
  backgroundInMini: true,
  keepScreenOn: true // music is playing: the phone should not fall asleep on the lyrics
})
// once, for people who installed before this became the default (they can switch it off again in Settings)
try {
  if (!localStorage.getItem('lyra.keepOnV1')) {
    localStorage.setItem('lyra.keepOnV1', '1')
    settingsStore.set({ ...settingsStore.get(), keepScreenOn: true })
  }
} catch {
  /* storage unavailable: keep what is saved */
}
// once: ambient mode shows the dimmed music video by default now; phones that still have the old default (Glow) get it too
try {
  if (!localStorage.getItem('lyra.ambientVideoV1')) {
    localStorage.setItem('lyra.ambientVideoV1', '1')
    const cur = settingsStore.get()
    if (cur.ambientStyle === 'glow') settingsStore.set({ ...cur, ambientStyle: 'video' })
  }
} catch {
  /* storage unavailable: keep what is saved */
}
const settingsChanged = emitter<Settings>()

function sanitize(s: Settings): Settings {
  const clamp = (n: unknown, lo: number, hi: number, d: number): number => (typeof n === 'number' && isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d)
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    // 0.06 was the old default (too dark to see a video); in auto mode this value is the maximum
    ambientBrightness: s.ambientBrightness === 0.06 || s.ambientBrightness === 0.3 ? 0.2 : clamp(s.ambientBrightness, 0.04, 0.6, 0.2),
    backgroundInMini: true, // the phone's only player always shows the video
    backgroundDim: clamp(s.backgroundDim, 0.2, 0.9, 0.5),
    lyricFontSize: clamp(s.lyricFontSize, 24, 72, 40),
    lineSpacing: clamp(s.lineSpacing, 1, 2, 1.35),
    lyricOffsetMs: clamp(s.lyricOffsetMs, -3000, 3000, 0),
    onboarded: true
  }
}

// ---------------- phone switches (screen stays on while playing / background service)
let lastScreenOn: boolean | null = null
let lastRunning: boolean | null = null
function syncPhone(): void {
  if (overlayMode) return // the floating widget never touches the screen / service switches
  const s = settingsStore.get()
  const screenOn = !!s.keepScreenOn && !!snapshot?.isPlaying
  if (screenOn !== lastScreenOn) {
    lastScreenOn = screenOn
    void rpc('keepScreenOn', screenOn).catch(() => undefined)
  }
  if (!!s.keepRunning !== lastRunning) {
    lastRunning = !!s.keepRunning
    void rpc('keepRunning', lastRunning).catch(() => undefined)
  }
}

// ---------------- home-screen widget: wears the vibe in effect
// The page sets data-vibe on <html> whenever the vibe in effect changes (settings, cycling, smart pick); the native widget
// picks its palette from it. Watching the attribute keeps this file independent of the renderer's stores.
if (!new URLSearchParams(location.search).get('overlay')) {
  let lastVibe = ''
  const sendVibe = (): void => {
    const v = document.documentElement.dataset.vibe ?? 'none'
    if (v === lastVibe) return
    lastVibe = v
    void rpc('widgetVibe', v).catch(() => undefined)
  }
  new MutationObserver(sendVibe).observe(document.documentElement, { attributes: true, attributeFilter: ['data-vibe'] })
  window.addEventListener('load', sendVibe)
}

// ---------------- window / mode (the phone has one screen: expanded player or the full cinema layout)
/** the floating widget runs this same page with ?overlay=compact */
const overlayMode = new URLSearchParams(location.search).get('overlay')
const tvPage = new URLSearchParams(location.search).has('tv') // the TV shows the full-screen scene look, never the phone's player
let mode: ViewMode = overlayMode ? 'compact' : tvPage ? 'full' : 'mini'
const modeChanged = emitter<ModeEvent>()

// ---------------- playback (pushed by the app)
let snapshot: PlaybackSnapshot | null = null
let status: ConnectionStatus = { state: 'offline', message: 'Starting…' }
const playbackChanged = emitter<PlaybackSnapshot>()
const statusChanged = emitter<ConnectionStatus>()

function receive(snapJson: string, statusJson: string): void {
  try {
    const st = JSON.parse(statusJson) as ConnectionStatus
    if (JSON.stringify(st) !== JSON.stringify(status)) {
      status = st
      statusChanged.emit(st)
    }
    const snap = JSON.parse(snapJson) as PlaybackSnapshot | null
    snapshot = snap
    if (snap) playbackChanged.emit(snap)
    syncPhone()
  } catch (e) {
    console.warn('bad native push', e)
  }
}

// ---------------- artwork / moments / backgrounds
const artCache = new Map<string, string | null>()
async function artDataUrl(url: string): Promise<string | null> {
  if (url.startsWith('data:')) return url
  if (artCache.has(url)) return artCache.get(url) ?? null
  try {
    const res = await nativeFetch(url)
    if (!res.ok) throw new Error(String(res.status))
    const blob = await res.blob()
    const data = await new Promise<string>((ok, bad) => {
      const r = new FileReader()
      r.onload = () => ok(String(r.result))
      r.onerror = () => bad(r.error)
      r.readAsDataURL(blob)
    })
    artCache.set(url, data)
    return data
  } catch {
    artCache.set(url, null)
    return null
  }
}

const momentsStore = new LocalStore<{ items: SavedMoment[] }>('moments', { items: [] })
const songsStore = new LocalStore<{ songs: Record<string, SongBg> }>('backgrounds', { songs: {} })

const b64url = (s: string): string => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** Decode a thumbnail through a canvas so the shared core can look for black bars. */
async function decodeThumb(bytes: ArrayBuffer): Promise<DecodedImage | null> {
  const bmp = await createImageBitmap(new Blob([bytes]))
  const c = new OffscreenCanvas(160, 90)
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(bmp, 0, 0, 160, 90)
  const d = ctx.getImageData(0, 0, 160, 90)
  return { width: 160, height: 90, pixels: d.data, order: 'rgba' }
}

const resolveBackground = createBackgroundResolver({
  settings: () => settingsStore.get(),
  songs: () => songsStore.get().songs,
  mediaSpec: (m, scope) => ({ kind: 'media', url: `${location.origin}/bg/${m.file}`, media: m.kind, name: m.name, scope }),
  clipUrl: (url) => `${location.origin}/preview/${b64url(url)}`,
  crop: (videoId) => thumbCrop(videoId, decodeThumb)
})

const noop = (): void => undefined

/** Delete a picked file once nothing refers to it any more. */
function dropIfUnused(file: string): void {
  const used = settingsStore.get().customBackground?.file === file || Object.values(songsStore.get().songs).some((s) => s.media?.file === file)
  if (!used) void rpc('mediaDelete', file).catch(() => undefined)
}

/** Ask the phone for a small text file (a browser file picker inside the WebView) and read it. Null when cancelled. */
function pickTextFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.lrc,.srt,.txt,text/plain'
    input.onchange = () => {
      const f = input.files?.[0]
      if (!f || f.size > 1_000_000) return resolve(null)
      void f.text().then(resolve, () => resolve(null))
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}

/** One quiet retry when the free lyrics service hiccups (the app and the floating widget can ask at the same moment). */
async function withRetry<T extends { status: string }>(first: () => Promise<T>, again: () => Promise<T>): Promise<T> {
  const r = await first()
  if (r.status !== 'error') return r
  await new Promise((ok) => setTimeout(ok, 3000))
  return again()
}

/**
 * The TV follows a Lyra app on a computer (Lyra Connect): that computer already found the lyrics for this song (and honours
 * the person's own pick for it), so use those, in time with its song clock. The host sends them a moment after the song
 * changes, so wait a little; if it has none, or nothing arrives, the page asks its own services as before.
 */
async function hostLyrics(trackId: string): Promise<LyricsResult | null> {
  if (document.documentElement.dataset.platform !== 'tv') return null
  for (let i = 0; i < 8; i++) {
    let r: (LyricsResult & { fallback?: boolean }) | false | null
    try {
      r = await rpc<(LyricsResult & { fallback?: boolean }) | false | null>('tvLyrics', trackId)
    } catch {
      return null
    }
    if (r === false || (r && r.fallback)) return null // not following a computer, or the computer has none
    if (r) return r
    await new Promise((ok) => setTimeout(ok, 400))
  }
  return null
}

export const androidApi: LyraApi &{ android: NonNullable<LyraApi['android']> } = {
  settings: {
    get: async () => sanitize(settingsStore.get()),
    set: async (patch) => {
      const next = sanitize({ ...settingsStore.get(), ...patch })
      settingsStore.set(next)
      settingsChanged.emit(next)
      syncPhone()
      return next
    },
    reset: async () => {
      const next = sanitize({ ...DEFAULT_SETTINGS, defaultMode: 'mini', backgroundInMini: true, keepScreenOn: true })
      settingsStore.set(next)
      settingsChanged.emit(next)
      return next
    },
    onChange: settingsChanged.on
  },
  window: {
    setMode: async (m) => {
      if (overlayMode) {
        // the floating widget can only be a widget; "expand" opens the app
        if (m !== 'compact' && m !== 'minimal') void rpc('openApp')
        return
      }
      // the phone only has two layouts: the expanded player ("mini") and the cinema layout ("full")
      const next: ViewMode = tvPage ? 'full' : 'mini' // the phone has one player: the video-first one
      if (next === mode) return
      mode = next
      modeChanged.emit({ mode })
    },
    getMode: async () => mode,
    onMode: modeChanged.on,
    onFade: () => noop,
    settle: noop,
    resizeStart: noop,
    resizeMove: noop,
    resizeEnd: noop,
    dragStart: noop,
    dragMove: noop,
    dragEnd: noop,
    hide: () => void rpc('minimize'),
    minimize: () => void rpc('minimize'),
    quit: () => void rpc('finish')
  },
  spotify: {
    connect: async () => status,
    disconnect: async () => undefined,
    startDemo: async () => undefined,
    useLocal: async () => undefined,
    getStatus: async () => {
      status = JSON.parse(await rpc<string>('status')) as ConnectionStatus
      return status
    },
    getSnapshot: async () => {
      snapshot = JSON.parse(await rpc<string>('snapshot')) as PlaybackSnapshot | null
      return snapshot
    },
    onStatus: statusChanged.on,
    onPlayback: playbackChanged.on
  },
  player: {
    command: async (cmd) => {
      const ok = await rpc<boolean>('command', JSON.stringify(cmd))
      return ok ? { ok: true } : { ok: false, reason: 'unsupported', error: 'Nothing is playing, or that app doesn’t allow this control.' }
    },
    isLiked: async () => null,
    setLiked: async () => ({ ok: false, reason: 'unsupported', error: 'Saving to Liked Songs isn’t available on Android yet.' }),
    queue: async () => {
      // the next songs the player itself publishes (many players publish none: then null and nothing is prefetched)
      try {
        const raw = await rpc<string>('queue')
        const list = raw ? (JSON.parse(raw) as QueueItem[] | null) : null
        return Array.isArray(list) && list.length ? list : null
      } catch {
        return null
      }
    },
    recent: async () => null,
    openInSpotify: async () => void (await rpc('openSpotify'))
  },
  lyrics: {
    get: async (t) => (await hostLyrics(t.id)) ?? withRetry(() => lyricsService.get(t), () => lyricsService.get(t, true)),
    refresh: (t) => lyricsService.get(t, true),
    candidates: (t) => lyricsService.candidates(t),
    choose: (t, provider, id) => lyricsService.choose(t, provider, id),
    clearPin: (t) => lyricsService.clearPin(t),
    importText: async (t, text) => lyricsService.importText(t, text, 'pasted'),
    importFile: async (t) => {
      const text = await pickTextFile()
      return text === null ? null : lyricsService.importText(t, text, 'file')
    },
    health: async () => lyricsService.health()
  },
  cache: { clear: async () => clearAllCaches() },
  art: { get: artDataUrl },
  moments: {
    list: async () => momentsStore.get().items,
    add: async (m) => {
      const items = momentsStore.get().items
      if (items.some((x) => x.trackId === m.trackId && x.text === m.text)) return items
      const next = [{ ...m, id: crypto.randomUUID(), savedAt: Date.now() }, ...items].slice(0, 500)
      momentsStore.set({ items: next })
      return next
    },
    remove: async (id) => {
      const next = momentsStore.get().items.filter((x) => x.id !== id)
      momentsStore.set({ items: next })
      return next
    }
  },
  background: {
    resolve: (t) => resolveBackground(t),
    pick: async (scope, trackId) => {
      if (scope === 'song' && !trackId) return { ok: false, error: 'No song selected.' }
      const r = await rpc<{ ok: boolean; file?: string; name?: string; kind?: 'video' | 'image'; error?: string }>('pickMedia')
      if (!r.ok || !r.file || !r.name || !r.kind) return { ok: false, error: r.error }
      const media = { file: r.file, name: r.name, kind: r.kind }
      if (scope === 'global') {
        const old = settingsStore.get().customBackground
        const next = sanitize({ ...settingsStore.get(), customBackground: media })
        settingsStore.set(next)
        settingsChanged.emit(next)
        if (old) dropIfUnused(old.file)
      } else {
        const songs = { ...songsStore.get().songs }
        const old = songs[trackId!]?.media
        songs[trackId!] = { ...songs[trackId!], media }
        songsStore.set({ songs })
        if (old) dropIfUnused(old.file)
      }
      return { ok: true }
    },
    clear: async (scope, trackId) => {
      if (scope === 'global') {
        const old = settingsStore.get().customBackground
        const next = sanitize({ ...settingsStore.get(), customBackground: null })
        settingsStore.set(next)
        settingsChanged.emit(next)
        if (old) dropIfUnused(old.file)
      } else if (trackId) {
        const songs = { ...songsStore.get().songs }
        const old = songs[trackId]?.media
        if (songs[trackId]) {
          const { media: _gone, ...rest } = songs[trackId]!
          void _gone
          if (rest.youtube) songs[trackId] = rest
          else delete songs[trackId]
          songsStore.set({ songs })
        }
        if (old) dropIfUnused(old.file)
      }
    },
    hasYoutubeKey: async () => youtube.hasKey(),
    setYoutubeKey: (k) => youtube.setKey(k),
    clearYoutubeKey: async () => youtube.clearKey(),
    youtubeCandidates: (t) => youtube.candidates(t),
    karaokeVideos: (t) => youtube.karaoke(t),
    youtubeFailed: async (songKey, videoId) => failedVideos().remember(songKey, videoId),
    youtubeChoose: async (trackId, videoId) => {
      const sk = keyForId(trackId)
      if (sk) {
        userChoices().setChoice(sk, { video: videoId ? { videoId } : null })
        failedVideos().forget(sk, videoId ?? undefined)
      }
      const songs = { ...songsStore.get().songs }
      if (videoId) songs[trackId] = { ...songs[trackId], youtube: { videoId, title: '', channel: '', durationSec: null } }
      else if (songs[trackId]) {
        const { youtube: _gone, ...rest } = songs[trackId]!
        void _gone
        if (rest.media) songs[trackId] = rest
        else delete songs[trackId]
      }
      songsStore.set({ songs })
    }
  },
  choices: {
    get: async (t) => userChoices().getChoice(trackKey(t)),
    setOffset: async (t, ms) => void userChoices().setChoice(trackKey(t), { offsetMs: ms }),
    clear: async (t, field) => {
      userChoices().clearChoice(trackKey(t), field)
      // "back to automatic" also drops the pins the pickers keep (same as the desktop app)
      if (!field || field === 'video') await androidApi.background.youtubeChoose(t.id, null)
      if (!field || field === 'lyrics') await lyricsService.clearPin(t)
    }
  },
  update: {
    get: async () => ({ state: 'disabled', reason: 'Download new versions from the GitHub releases page.' }),
    check: async () => undefined,
    install: async () => undefined,
    onState: () => noop
  },
  studio: { open: async () => null, write: async () => undefined, close: async () => undefined, discard: async () => undefined, end: async () => undefined, reveal: async () => undefined, setMic: async () => undefined, saveImage: async () => null, frameCaptureStart: async () => false, frameCaptureStop: async () => null, frameRead: async () => null, frameCaptureClear: async () => undefined, audioStart: async () => ({ ok: false, reason: 'Not available on Android' }), audioStop: async () => undefined, onAudio: () => () => undefined, stageStart: async () => ({ ok: false, reason: 'Not available on Android' }), stageSeek: async () => undefined, stageSync: async () => undefined, stageStop: async () => undefined, onFrame: () => () => undefined },
  connect: {
    status: async () => ({ enabled: false, running: false, noNetwork: false, url: null, party: false, devices: [], codes: [] }),
    setEnabled: async () => ({ enabled: false, running: false, noNetwork: false, url: null, party: false, devices: [], codes: [] }),
    newCode: async () => ({ enabled: false, running: false, noNetwork: false, url: null, party: false, devices: [], codes: [] }),
    party: async () => ({ enabled: false, running: false, noNetwork: false, url: null, party: false, devices: [], codes: [] }),
    revoke: async () => ({ enabled: false, running: false, noNetwork: false, url: null, party: false, devices: [], codes: [] }),
    setRole: async () => ({ enabled: false, running: false, noNetwork: false, url: null, party: false, devices: [], codes: [] }),
    publishView: () => undefined,
    addOverlay: async () => ({ enabled: false, running: false, noNetwork: false, url: null, party: false, devices: [], codes: [] }),
    overlayLink: async () => null,
    onChange: () => () => undefined
  },
  app: {
    info: async () => ({ version: await rpc<string>('version'), platform: 'android', envClientId: false }),
    diagnostics: async () => `Lyra for Android ${await rpc<string>('version')}\n${navigator.userAgent}\nstatus: ${JSON.stringify(status)}`,
    copy: async (text) => rpc<boolean>('copy', text),
    copyImage: async () => false,
    shareImage: async (dataUrl, name) => ((await rpc<boolean>('shareImage', dataUrl.slice(dataUrl.indexOf(',') + 1), name)) ? 'shared' : 'failed'),
    failedShortcuts: async () => [],
    onCommand: () => noop
  },
  android: {
    hasAccess: () => rpc<boolean>('hasAccess'),
    openAccessSettings: async () => void (await rpc('openAccessSettings')),
    openBatterySettings: async () => void (await rpc('openBatterySettings')),
    overlayState: () => rpc<{ enabled: boolean; canDraw: boolean }>('overlayState'),
    lyricsNotification: () => rpc<{ enabled: boolean; public: boolean }>('lyricsNotificationState'),
    setLyricsNotification: async (on, showOnLockScreen) => void (await rpc('lyricsNotification', on, showOnLockScreen)),
    openAmbient: async () => void (await rpc('openAmbient')),
    toggleAmbient: async () => void (await rpc('toggleAmbient')),
    audioRoute: () => rpc<{ headphones: boolean }>('audioRoute'),
    compatibilityReport: () => rpc<string>('compatibilityReport'),
    recordVideo: (fromStart) => rpc<{ ok: boolean; error?: string }>('recordVideo', fromStart),
    addAmbientTile: () => rpc<boolean>('addAmbientTile'),
    appUpdate: {
      status: () => rpc('updateStatus'),
      check: () => rpc('updateCheck'),
      download: () => rpc('updateDownload'),
      install: () => rpc('updateInstall'),
      setSettings: (s) => rpc('updateSettings', s)
    },
    setOverlay: (on) => rpc<{ ok: boolean; needsPermission?: boolean }>('overlaySet', on)
  }
}

window.lyra = androidApi
syncPhone()
window.__lyraNative = {
  push: receive,
  back: () => false // replaced by entry.ts once the UI stores exist
}
