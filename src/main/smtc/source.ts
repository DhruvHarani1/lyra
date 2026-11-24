import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { app } from 'electron'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import type { CommandResult, PlaybackSnapshot, PlayerCommand, QueueItem, RecentItem, Track } from '@shared/types'
import { createLogger } from '../logger'
import { PlaybackSource } from '../source'
import { favorites } from '../favorites'
import { releaseYear } from '../meta/musicbrainz'
import { settings } from '../settings'
import { smtcScript } from './script'

const log = createLogger('smtc')

interface Msg {
  ready?: boolean
  error?: string
  found?: boolean
  app?: string
  title?: string
  artist?: string
  album?: string
  durationMs?: number
  positionMs?: number
  playing?: boolean
  thumb?: string
  volume?: number
  commandResult?: { id: number; ok: boolean; error?: string }
}

const UNSUPPORTED = (what: string): CommandResult => ({
  ok: false,
  reason: 'unsupported',
  error: `${what} isn’t exposed by Windows media controls. Use your media player or system volume.`
})

/**
 * Reads the Spotify desktop app through Windows media controls (SMTC). No account, API key or
 * Premium needed. Volume is the system master volume; likes are Lyra-local favourites; release year
 * comes from MusicBrainz. No queue, shuffle or repeat.
 */
export class SmtcSource extends PlaybackSource {
  readonly kind = 'smtc' as const
  private proc: ChildProcessWithoutNullStreams | null = null
  private stopped = true
  private restartTimer: NodeJS.Timeout | null = null
  private lastEmitted: PlaybackSnapshot | null = null
  private thumbs = new Map<string, string>()
  private years = new Map<string, number | null>()
  private yearRequested = new Set<string>()
  private failures = 0
  private lastErr = ''
  private commandResponses = false
  private nextCommandId = 0
  private pendingCommands = new Map<number, { resolve: (result: CommandResult) => void; timeout: NodeJS.Timeout }>()

  private statusMessage(): string {
    return settings.get().followAnyPlayer
      ? 'Current Windows media player · Windows media controls'
      : 'Spotify desktop app · Windows media controls'
  }

  start(): void {
    if (process.platform !== 'win32') {
      this.setStatus({ state: 'offline', message: 'Windows media controls are only available on Windows.' })
      return
    }
    this.stopped = false
    this.setStatus({ state: 'local', message: this.statusMessage() })
    this.spawn()
  }

  /** Re-spawn the bridge (used when the system-volume option changes). */
  restart(): void {
    this.stop()
    this.start()
  }

  stop(): void {
    this.stopped = true
    if (this.restartTimer) clearTimeout(this.restartTimer)
    this.restartTimer = null
    for (const [id, pending] of this.pendingCommands) {
      clearTimeout(pending.timeout)
      pending.resolve({ ok: false, reason: 'offline', error: 'Windows media bridge stopped before confirming the command.' })
      this.pendingCommands.delete(id)
    }
    this.proc?.kill()
    this.proc = null
  }

  private spawn(): void {
    const { systemVolume: withVolume, followAnyPlayer } = settings.get()
    // The committed native helper may predate --any-player. Use the PowerShell bridge until it is rebuilt.
    const helper = followAnyPlayer ? null : this.helperPath()
    let proc: ChildProcessWithoutNullStreams
    if (helper) {
      // Preferred: tiny event-driven native helper (resources/lyra-media.exe), ~0% CPU while idle.
      proc = spawn(helper, withVolume ? ['--volume'] : [], { windowsHide: true })
    } else {
      log.warn(followAnyPlayer ? 'Follow other players uses the PowerShell bridge' : 'lyra-media.exe missing; falling back to the PowerShell bridge')
      const dir = join(app.getPath('userData'), 'bridge')
      mkdirSync(dir, { recursive: true })
      const file = join(dir, 'smtc.ps1')
      writeFileSync(file, '﻿' + smtcScript(withVolume, followAnyPlayer), 'utf8')
      proc = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file], {
        windowsHide: true
      })
    }
    this.proc = proc
    this.commandResponses = !helper
    createInterface({ input: proc.stdout }).on('line', (l) => this.onLine(l))
    proc.stderr.on('data', (d: Buffer) => {
      this.lastErr = d.toString().trim().slice(0, 400)
      log.warn('powershell:', this.lastErr)
    })
    proc.on('error', (e) => this.onExit(`could not start the media helper: ${e.message}`, proc))
    proc.on('exit', (code) => this.onExit(`bridge exited (${code})`, proc))
  }

  private helperPath(): string | null {
    const candidates = [join(process.resourcesPath ?? '', 'lyra-media.exe'), join(app.getAppPath(), 'resources', 'lyra-media.exe')]
    return candidates.find((p) => existsSync(p)) ?? null
  }

  private onExit(why: string, from?: ChildProcessWithoutNullStreams): void {
    // a restart replaces this.proc; the old process's late exit must not tear down the new one
    if (from && from !== this.proc) return
    this.proc = null
    for (const [id, pending] of this.pendingCommands) {
      clearTimeout(pending.timeout)
      pending.resolve({ ok: false, reason: 'offline', error: 'Windows media bridge stopped before confirming the command.' })
      this.pendingCommands.delete(id)
    }
    if (this.stopped) return
    this.failures++
    log.warn(why)
    this.setStatus({ state: 'offline', message: `Lost the connection to Windows media controls (${why}${this.lastErr ? `: ${this.lastErr}` : ''}). Retrying…`, retryInSec: 3 })
    this.restartTimer = setTimeout(() => !this.stopped && this.spawn(), Math.min(15_000, 3000 * this.failures))
  }

  private onLine(raw: string): void {
    let m: Msg
    try {
      m = JSON.parse(raw.replace(/^﻿/, '')) as Msg
    } catch {
      return
    }
    if (m.commandResult) {
      const pending = this.pendingCommands.get(m.commandResult.id)
      if (pending) {
        clearTimeout(pending.timeout)
        this.pendingCommands.delete(m.commandResult.id)
        pending.resolve(
          m.commandResult.ok
            ? { ok: true }
            : { ok: false, reason: 'unsupported', error: m.commandResult.error ?? 'The Windows media player rejected this command.' }
        )
      }
      return
    }
    if (m.ready) {
      this.failures = 0
      this.setStatus({ state: 'local', message: this.statusMessage() })
      return
    }
    if (m.error) {
      log.warn('bridge error', m.error)
      return
    }
    if (this.status.state !== 'local') this.setStatus({ state: 'local', message: this.statusMessage() })

    const now = Date.now()
    let snap: PlaybackSnapshot
    const base = {
      sampledAt: now,
      device: {
        id: null,
        name: settings.get().followAnyPlayer ? 'Windows media player' : 'Spotify · Windows',
        type: 'Computer',
        volumePercent: m.volume ?? null,
        supportsVolume: m.volume !== undefined
      },
      shuffle: false,
      repeat: 'off' as const
    }
    if (!m.found) {
      snap = { ...base, track: null, isPlaying: false, positionMs: 0, isAdOrUnknown: false }
    } else if (
      !m.title ||
      (/spotify/i.test(m.app ?? '') && (m.title === 'Advertisement' || m.title === 'Spotify' || m.artist === 'Spotify'))
    ) {
      snap = { ...base, track: null, isPlaying: !!m.playing, positionMs: 0, isAdOrUnknown: true }
    } else {
      const dur = m.durationMs ?? 0
      const id = 'smtc:' + createHash('sha1').update(`${m.title}|${m.artist}|${m.album}|${Math.round(dur / 1000)}`).digest('hex').slice(0, 16)
      if (m.thumb) {
        this.thumbs.set(id, m.thumb)
        if (this.thumbs.size > 20) this.thumbs.delete(this.thumbs.keys().next().value as string)
      }
      const track: Track = {
        id,
        uri: id,
        title: m.title,
        artists: m.artist ? [m.artist] : [],
        album: m.album ?? '',
        releaseYear: this.years.get(id) ?? null,
        durationMs: dur,
        artworkUrl: this.thumbs.get(id) ?? null,
        explicit: false,
        webUrl: null
      }
      snap = { ...base, track, isPlaying: !!m.playing, positionMs: m.positionMs ?? 0, isAdOrUnknown: false }
      if (!this.yearRequested.has(id) && track.artists[0]) {
        this.yearRequested.add(id)
        void releaseYear(track.title, track.artists[0], dur).then((y) => {
          if (y === null) return
          this.years.set(id, y)
          const cur = this.snapshot
          if (cur?.track?.id === id) {
            const next = { ...cur, track: { ...cur.track, releaseYear: y } }
            this.snapshot = next
            this.lastEmitted = next
            this.emit('snapshot', next)
          }
        })
      }
    }
    this.snapshot = snap
    if (this.shouldEmit(snap)) {
      this.lastEmitted = snap
      this.emit('snapshot', snap)
    }
  }

  private shouldEmit(n: PlaybackSnapshot): boolean {
    const o = this.lastEmitted
    if (!o) return true
    if (o.track?.id !== n.track?.id || o.isPlaying !== n.isPlaying || o.isAdOrUnknown !== n.isAdOrUnknown) return true
    if (o.track?.artworkUrl !== n.track?.artworkUrl || o.track?.releaseYear !== n.track?.releaseYear) return true // artwork arrives a tick after the track
    if (o.device?.volumePercent !== n.device?.volumePercent) return true
    const predicted = o.positionMs + (o.isPlaying ? n.sampledAt - o.sampledAt : 0)
    // re-anchor the renderer's clock as soon as it is off by a noticeable amount (a loose threshold left lyrics/video up to 1.5 s out)
    return Math.abs(predicted - n.positionMs) > 400
  }

  private sendCommand(command: string, values: Record<string, number> = {}): Promise<CommandResult> {
    const proc = this.proc
    if (!proc) return Promise.resolve({ ok: false, reason: 'offline', error: 'Windows media bridge isn’t running.' })

    if (!this.commandResponses) {
      try {
        proc.stdin.write(`${command}\n`)
        return Promise.resolve({ ok: true })
      } catch (error) {
        return Promise.resolve({ ok: false, reason: 'offline', error: error instanceof Error ? error.message : String(error) })
      }
    }

    const id = ++this.nextCommandId
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(id)
        resolve({ ok: false, reason: 'unknown', error: 'The Windows media bridge did not confirm the command.' })
      }, 2500)
      this.pendingCommands.set(id, { resolve, timeout })
      try {
        proc.stdin.write(JSON.stringify({ id, command, ...values }) + '\n', (error) => {
          if (!error) return
          const pending = this.pendingCommands.get(id)
          if (!pending) return
          clearTimeout(pending.timeout)
          this.pendingCommands.delete(id)
          resolve({ ok: false, reason: 'offline', error: error.message })
        })
      } catch (error) {
        clearTimeout(timeout)
        this.pendingCommands.delete(id)
        resolve({ ok: false, reason: 'offline', error: error instanceof Error ? error.message : String(error) })
      }
    })
  }

  async command(cmd: PlayerCommand): Promise<CommandResult> {
    if (!this.proc) return { ok: false, reason: 'offline', error: 'Windows media bridge isn’t running.' }
    if (!this.snapshot?.track && cmd.type !== 'toggle' && cmd.type !== 'play') {
      return { ok: false, reason: 'no-device', error: 'No supported media player is playing anything.' }
    }
    switch (cmd.type) {
      case 'play':
      case 'pause':
      case 'toggle':
        return this.sendCommand(cmd.type)
      case 'next':
        return this.sendCommand('next')
      case 'previous':
        return this.sendCommand('prev')
      case 'seek':
        return this.sendCommand('seek', { positionMs: Math.max(0, Math.round(cmd.positionMs)) })
      case 'volume':
        return this.sendCommand('volume', { percent: Math.min(100, Math.max(0, Math.round(cmd.percent))) })
      case 'shuffle':
        return UNSUPPORTED('Shuffle')
      case 'repeat':
        return UNSUPPORTED('Repeat')
    }
  }

  async isLiked(trackId: string): Promise<boolean | null> {
    return favorites.has(trackId)
  }
  async setLiked(trackId: string, liked: boolean): Promise<CommandResult> {
    const t = this.snapshot?.track
    favorites.set(trackId, liked, { title: t?.title ?? '', artist: t?.artists[0] ?? '' })
    return { ok: true }
  }
  async queue(): Promise<QueueItem[] | null> {
    return null
  }
  async recent(): Promise<RecentItem[] | null> {
    return null
  }
}
