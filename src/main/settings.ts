import { EventEmitter } from 'node:events'
import { ACCEL_PATTERN, GLOBAL_SHORTCUTS } from '@shared/shortcuts'
import { ALL_VIBES } from '@shared/vibes'
import { DEFAULT_SETTINGS, type Settings } from '@shared/types'
import { JsonStore } from './jsonStore'

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo))

/** Validate/normalise a settings object so corrupt files can't break the UI. */
function sanitize(s: Settings): Settings {
  const d = DEFAULT_SETTINGS
  const pos = s.position
  // Settings that were removed from the page (or renamed in an older Lyra) must never break loading: only keys that
  // still exist are kept, everything else in an old settings.json is dropped on the next save.
  const known = Object.fromEntries(Object.entries(s && typeof s === 'object' ? s : {}).filter(([k]) => k in d)) as Settings
  s = known
  return {
    ...d,
    ...s,
    // the page no longer offers these (each vibe designs its own type, size, spacing, motion and edge glow)
    lyricFont: d.lyricFont,
    lyricFontSize: d.lyricFontSize,
    lineSpacing: d.lineSpacing,
    lyricAnimation: d.lyricAnimation,
    rimLight: true,
    theme: (['adaptive', 'dark', 'light'] as const).includes(s.theme) ? s.theme : d.theme,
    reducedMotion: (['system', 'on', 'off'] as const).includes(s.reducedMotion) ? s.reducedMotion : d.reducedMotion,
    source: s.source === 'api' ? 'api' : 'local',
    opacity: clamp(s.opacity, 0.4, 1),
    lyricStyle: (['classic', 'zoom', 'kinetic', 'constellation', 'sticker', 'chat', 'type', 'diary', 'subtitle', 'chatlog', 'lowerthird', 'sign', 'liquid', 'pixel', 'bloom', 'title', 'ink', 'glitch', 'bubble', 'spray', 'intertitle', 'log', 'note', 'jot', 'scrawl', 'label', 'lockscreen', 'wallet', 'route', 'editor', 'metro', 'weave', 'picto', 'wall', 'flap'] as const).includes(s.lyricStyle) ? s.lyricStyle : d.lyricStyle,
    vibe: (ALL_VIBES as readonly string[]).includes(s.vibe) ? s.vibe : d.vibe,
    vibeMode: (['fixed', 'cycle', 'smart'] as const).includes(s.vibeMode) ? s.vibeMode : d.vibeMode,
    songVibes: Object.fromEntries(Object.entries(s.songVibes && typeof s.songVibes === 'object' ? s.songVibes : {}).filter(([, v]) => (ALL_VIBES as readonly string[]).includes(v as string)).slice(-300)),
    vibePool: Array.isArray(s.vibePool) ? s.vibePool.filter((v) => (ALL_VIBES as readonly string[]).includes(v)) : d.vibePool,
    performance: (['auto', 'smooth', 'light'] as const).includes(s.performance) ? s.performance : d.performance,
    lyricOffsetMs: clamp(s.lyricOffsetMs, -5000, 5000),
    compactWidth: clamp(s.compactWidth, 320, 520),
    shortcuts: Object.fromEntries(
      Object.entries(s.shortcuts && typeof s.shortcuts === 'object' ? s.shortcuts : {}).filter(
        ([id, accel]) => GLOBAL_SHORTCUTS.some((g) => g.id === id) && typeof accel === 'string' && ACCEL_PATTERN.test(accel)
      )
    ),
    onboarded: !!s.onboarded,
    backgroundStyle: (['auto', 'living', 'custom', 'youtube', 'still'] as const).includes(s.backgroundStyle) ? s.backgroundStyle : d.backgroundStyle,
    backgroundDim: clamp(s.backgroundDim, 0.2, 0.9),
    backgroundInMini: !!s.backgroundInMini,
    wordByWord: s.wordByWord !== false,
    keepScreenOn: !!s.keepScreenOn,
    keepRunning: !!s.keepRunning,
    ambientBrightness: clamp(s.ambientBrightness, 0.02, 0.6),
    ambientAutoBrightness: s.ambientAutoBrightness !== false,
    ambientStyle: s.ambientStyle === 'minimal' || s.ambientStyle === 'glow' || s.ambientStyle === 'video' ? s.ambientStyle : 'video',
    autoDim: s.autoDim !== false,
    startGate: s.startGate === true,
    customBackground:
      s.customBackground && /^[a-f0-9]{16}\.(mp4|webm|gif|png|jpe?g|webp|apng)$/i.test(s.customBackground.file ?? '')
        ? { file: s.customBackground.file, name: String(s.customBackground.name ?? '').slice(0, 120), kind: s.customBackground.kind === 'video' ? 'video' : 'image' }
        : null,
    miniSize:
      s.miniSize && Number.isFinite(s.miniSize.width) && Number.isFinite(s.miniSize.height)
        ? { width: Math.round(clamp(s.miniSize.width, 360, 700)), height: Math.round(clamp(s.miniSize.height, 480, 1200)) }
        : null,
    defaultMode: (['minimal', 'compact', 'mini'] as const).includes(s.defaultMode as 'mini') ? s.defaultMode : d.defaultMode,
    position:
      pos && Number.isFinite(pos.x) && Number.isFinite(pos.y) ? { x: Math.round(pos.x), y: Math.round(pos.y) } : null,
    spotifyClientId: typeof s.spotifyClientId === 'string' ? s.spotifyClientId.trim() : ''
  }
}

class SettingsService extends EventEmitter {
  private store: JsonStore<Settings> | null = null

  private ensure(): JsonStore<Settings> {
    if (!this.store) {
      this.store = new JsonStore<Settings>('settings.json', DEFAULT_SETTINGS)
      this.store.set(sanitize(this.store.get()))
    }
    return this.store
  }

  get(): Settings {
    return this.ensure().get()
  }

  update(patch: Partial<Settings>): Settings {
    const next = sanitize({ ...this.get(), ...patch })
    this.ensure().set(next)
    this.emit('change', next, patch)
    return next
  }

  /** Back to factory defaults. The welcome card isn't shown again. */
  reset(): Settings {
    const next = sanitize({ ...DEFAULT_SETTINGS, onboarded: true })
    this.ensure().set(next)
    this.emit('change', next, {})
    return next
  }

  flush(): void {
    this.store?.flush()
  }
}

export const settings = new SettingsService()
