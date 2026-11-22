import { networkInterfaces, hostname } from 'node:os'
import { randomBytes } from 'node:crypto'
import type { PlaybackSnapshot, PlayerCommand, Settings, Track } from '@shared/types'
import { ALL_VIBES } from '@shared/vibes'
import { lyricsService } from '@core/lyrics/service'
import { trackKey } from '@core/songKey'
import { userChoices } from '@core/userChoices'
import type { CommandBody, ViewInfo } from '@core/connect/protocol'
import { Pairing } from '@core/connect/pairing'
import { createLogger } from '../logger'
import { DeviceStore } from './deviceStore'
import { safeStorageCipher } from '../platform'
import { app } from 'electron'
import { join } from 'node:path'
import { settings } from '../settings'
import { ConnectHub } from './hub'
import { MdnsAdvertiser } from './mdns'
import { pickLanAddress } from './net'
import { VIEWER_HTML } from './viewerHtml'
import { OVERLAY_HTML } from './overlayPage'
import { appIcon } from '../tray'

const log = createLogger('connect')

/**
 * Glue between the Connect hub and the rest of the app: what is playing (main process), its lyrics, the user's
 * per-song choices, the vibe / video the renderer reports, and the commands paired controllers may send.
 */
class ConnectService {
  private store: DeviceStore | null = null
  private hubInstance: ConnectHub | null = null
  private lastSong = ''
  private lyricsTimer: NodeJS.Timeout | null = null
  /** executes a player command (set by ipc.ts, which owns the active source) */
  runCommand: (cmd: PlayerCommand) => Promise<unknown> = async () => undefined

  private get hub(): ConnectHub {
    if (this.hubInstance) return this.hubInstance
    this.store = new DeviceStore(join(app.getPath('userData'), 'connect-devices.json'), safeStorageCipher, (...a) => log.warn(...a))
    const pairing = new Pairing(
      { now: Date.now, randomHex: (n) => randomBytes(n).toString('hex'), randomBytes: (n) => new Uint8Array(randomBytes(n)) },
      this.store.get().devices,
      (devices) => this.store!.set({ devices })
    )
    this.hubInstance = new ConnectHub({
      pairing,
      viewerHtml: VIEWER_HTML,
      overlayHtml: OVERLAY_HTML,
      icon: () => {
        const img = appIcon()
        return img.isEmpty() ? null : { png: img.toPNG(), size: img.getSize().width || 512 }
      },
      lanIp: () => pickLanAddress(networkInterfaces())?.ip ?? null,
      hostName: () => hostname().slice(0, 30),
      vibes: [...ALL_VIBES],
      onCommand: (c) => this.onCommand(c),
      advertiser: new MdnsAdvertiser((...a) => log.warn(...a)),
      log,
      randomHex: (n) => randomBytes(n).toString('hex')
    })
    return this.hubInstance
  }

  get api(): ConnectHub {
    return this.hub
  }

  get running(): boolean {
    return !!this.hubInstance?.running
  }

  async start(): Promise<boolean> {
    return this.hub.start()
  }

  stop(): void {
    this.hubInstance?.stop()
    if (this.lyricsTimer) clearTimeout(this.lyricsTimer)
    this.store?.flush()
  }

  private onCommand(c: CommandBody): void {
    const run = (cmd: PlayerCommand): void => void this.runCommand(cmd).catch(() => undefined)
    switch (c.c) {
      case 'play':
      case 'pause':
      case 'toggle':
      case 'next':
        return run({ type: c.c })
      case 'prev':
        return run({ type: 'previous' })
      case 'seek':
        return run({ type: 'seek', positionMs: c.ms })
      case 'volume':
        return run({ type: 'volume', percent: c.pct })
      case 'vibe':
        // a remote pick behaves like picking in the app: that vibe, fixed
        if (ALL_VIBES.includes(c.id as Settings['vibe'])) settings.update({ vibe: c.id as Settings['vibe'], vibeMode: 'fixed' })
    }
  }

  /** Called for every playback snapshot from the active source. Cheap when nothing is connected. */
  onSnapshot(s: PlaybackSnapshot): void {
    if (!this.hubInstance?.running) return
    const hub = this.hubInstance
    const t = s.track
    if (!t) {
      hub.setNow(null)
    } else {
      const choice = userChoices().getChoice(trackKey(t))
      hub.setNow(
        { id: t.id, key: trackKey(t), title: t.title, artists: t.artists, album: t.album, durationMs: t.durationMs },
        choice ? { ...(choice.video ? { video: choice.video } : {}), ...(choice.lyrics ? { lyrics: choice.lyrics } : {}), ...(choice.offsetMs ? { offsetMs: choice.offsetMs } : {}) } : {}
      )
      if (t.id !== this.lastSong) {
        this.lastSong = t.id
        hub.setArt(t.id, t.artworkUrl)
        this.sendLyrics(t, 0)
      }
    }
    hub.setPlay({ playing: s.isPlaying && !s.isAdOrUnknown, positionMs: Math.round(s.positionMs), at: s.sampledAt, ...(s.device?.volumePercent != null ? { volume: s.device.volumePercent } : {}) })
  }

  private sendLyrics(t: Track, attempt: number): void {
    const hub = this.hubInstance
    if (!hub) return
    void lyricsService
      .get(t)
      .then((r) => {
        const synced = r.status === 'synced'
        const lines = r.lines.map((l) => ({ t: synced ? l.timeMs : 0, x: l.text }))
        hub.setLyrics(t.id, r.status, synced, lines)
        // plain lyrics are a stop-gap: look again once for synced ones
        if (!synced && attempt === 0) {
          if (this.lyricsTimer) clearTimeout(this.lyricsTimer)
          this.lyricsTimer = setTimeout(() => this.lastSong === t.id && this.sendLyrics(t, 1), 30_000)
        }
      })
      .catch(() => hub.setLyrics(t.id, 'error', false, []))
  }

  /** The renderer owns the effective vibe, the resolved video and the lyric offset; it reports them here. */
  setView(v: { vibe: string; mode?: ViewInfo['mode']; videoId: string | null; offsetMs?: number }): void {
    if (!this.hubInstance?.running) return
    if (!/^[a-z]{1,24}$/.test(v.vibe)) return
    const id = v.videoId && /^[A-Za-z0-9_-]{11}$/.test(v.videoId) ? v.videoId : null
    this.hubInstance.setView({ vibe: v.vibe, mode: v.mode, video: { id }, ...(typeof v.offsetMs === 'number' ? { offsetMs: Math.round(v.offsetMs) } : {}) })
  }
}

export const connectService = new ConnectService()
