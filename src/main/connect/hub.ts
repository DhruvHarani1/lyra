import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { Duplex } from 'node:stream'
import { EventEmitter } from 'node:events'
import {
  DEAD_AFTER_MS,
  DEFAULT_PORT,
  HEARTBEAT_MS,
  MAX_CLIENT_BYTES,
  encode,
  parseClient,
  parseCommand,
  type ChoicesInfo,
  type CommandBody,
  type DeviceSummary,
  type ErrorCode,
  type HostMsg,
  type LyricLine,
  type NowInfo,
  type PlayInfo,
  type Role,
  type ViewInfo
} from '@core/connect/protocol'
import { CommandGate, Pairing, formatCode, type Device } from '@core/connect/pairing'
import { SyncState } from '@core/connect/syncState'
import { messageForRole } from '@core/connect/roleView'
import { acceptUpgrade, type WsConn } from './ws'
import { hostAllowed, isLocalPeer, originAllowed } from './net'
import { buildManifest } from './pwa'

/**
 * The Lyra Connect host: one small HTTP + WebSocket server, bound ONLY to the PC's LAN address.
 *
 *  - GET /        the viewer page (static, contains no data and no secrets)
 *  - GET /overlay the OBS / stream overlay page (static too; it authenticates over the WS with an overlay-role link)
 *  - GET /manifest.webmanifest, /icon.png   the viewer's installable-app bits (static)
 *  - WS  /ws      the protocol (docs/connect-protocol.md). Nothing is served to a connection that has not paired.
 *
 * Off by default; nothing listens until the user turns Devices on. Everything else (what is shown, who may do what)
 * lives in core/connect and is unit tested; this class is the thin socket layer around it.
 */
export interface Advertiser {
  start(info: { instance: string; host: string; ip: string; port: number; txt: Record<string, string> }): void
  stop(): void
}

export interface HubDeps {
  pairing: Pairing
  viewerHtml: string
  /** the stream overlay page served at /overlay; when absent the route 404s */
  overlayHtml?: string
  /** the app icon for the installable viewer (PNG bytes and edge length), or null */
  icon?: () => { png: Buffer; size: number } | null
  lanIp: () => string | null
  /** preferred port; if taken the OS picks another */
  port?: number
  hostName: () => string
  vibes: string[]
  onCommand: (cmd: CommandBody, from: Device) => void
  advertiser?: Advertiser
  log?: { info: (...a: unknown[]) => void; warn: (...a: unknown[]) => void }
  now?: () => number
  randomHex: (bytes: number) => string
}

interface Session {
  conn: WsConn
  stage: 'new' | 'challenged' | 'ready'
  cn?: string
  sn?: string
  helloDeviceId?: string
  device?: Device
  gate?: CommandGate
  lastHeard: number
  messages: number
  cmdTokens: number
  cmdAt: number
}

export interface HubStatus {
  running: boolean
  ip: string | null
  port: number
  url: string | null
  party: boolean
}

export class ConnectHub extends EventEmitter {
  private server: Server | null = null
  private sessions = new Set<Session>()
  private sweepTimer: NodeJS.Timeout | null = null
  private port = 0
  private ip: string | null = null
  private party = false
  readonly state = new SyncState()

  constructor(private readonly d: HubDeps) {
    super()
  }

  private now(): number {
    return (this.d.now ?? Date.now)()
  }

  get running(): boolean {
    return !!this.server
  }

  status(): HubStatus {
    return { running: this.running, ip: this.ip, port: this.port, url: this.running && this.ip ? `http://${this.ip}:${this.port}/` : null, party: this.party }
  }

  // ---- lifecycle -----------------------------------------------------------------------------------------------

  /** Start listening on the LAN address. Resolves false when there is no network to serve on. */
  start(): Promise<boolean> {
    if (this.server) return Promise.resolve(true)
    const ip = this.d.lanIp()
    if (!ip) return Promise.resolve(false)
    return new Promise((resolve) => {
      const srv = createServer((req, res) => this.http(req, res))
      srv.on('upgrade', (req, socket) => this.upgrade(req, socket))
      let triedRandom = false
      srv.on('error', (e: NodeJS.ErrnoException) => {
        if (!triedRandom && e.code === 'EADDRINUSE') {
          triedRandom = true
          srv.listen(0, ip)
          return
        }
        this.d.log?.warn('connect: could not listen', e.message)
        this.server = null
        resolve(false)
      })
      srv.listen(this.d.port ?? DEFAULT_PORT, ip, () => {
        this.server = srv
        this.ip = ip
        this.port = (srv.address() as { port: number }).port
        this.sweepTimer = setInterval(() => this.sweep(), HEARTBEAT_MS)
        this.d.log?.info('connect: listening on', `${ip}:${this.port}`)
        this.d.advertiser?.start({ instance: `Lyra on ${this.d.hostName()}`.slice(0, 40), host: `lyra-${this.d.randomHex(3)}`, ip, port: this.port, txt: { v: '1', name: this.d.hostName() } })
        this.emit('change')
        resolve(true)
      })
    })
  }

  stop(): void {
    this.d.advertiser?.stop()
    if (this.sweepTimer) clearInterval(this.sweepTimer)
    this.sweepTimer = null
    for (const s of [...this.sessions]) this.drop(s, 'The host turned Devices off.')
    this.server?.close()
    this.server = null
    this.port = 0
    this.ip = null
    this.party = false
    this.d.pairing.cancelCodes()
    this.emit('change')
  }

  // ---- host-side API -------------------------------------------------------------------------------------------

  newCode(role: Role): { code: string; display: string; expiresAt: number; url: string | null } {
    const c = this.d.pairing.createCode({ role })
    this.emit('change')
    return { code: c.code, display: formatCode(c.code), expiresAt: c.expiresAt, url: this.pairUrl(c.code) }
  }

  /** QR / link: the code rides in the URL FRAGMENT, which a browser never sends to any server or puts in a Referer. */
  pairUrl(code: string): string | null {
    const u = this.status().url
    return u ? `${u}#p=${code}` : null
  }

  /**
   * An overlay link for an OBS browser source (which cannot do QR pairing): a view-only device the host creates directly.
   * The credential rides in the URL FRAGMENT (`#d=<id>&t=<token>`): a browser never sends it to any server or puts it in a
   * Referer, and the page proves the token with the normal HMAC handshake, so it never crosses the network. OBS keeps the
   * URL, so unlike a one-time pairing code the link keeps working; revoking the device is what kills it.
   */
  createOverlay(name?: string): { id: string; url: string | null } | null {
    const d = this.d.pairing.addOverlay(name)
    if (!d) return null
    this.emit('change')
    return { id: d.id, url: this.overlayUrl(d.id) }
  }

  /** The link for an existing overlay device (host side only; never sent to another device). */
  overlayUrl(id: string): string | null {
    const d = this.d.pairing.get(id)
    const u = this.status().url
    return d && d.role === 'overlay' && u ? `${u}overlay#d=${d.id}&t=${d.token}` : null
  }

  startParty(): { code: string; display: string; expiresAt: number; url: string | null } {
    this.party = true
    const c = this.d.pairing.createCode({ party: true })
    this.emit('change')
    return { code: c.code, display: formatCode(c.code), expiresAt: c.expiresAt, url: this.pairUrl(c.code) }
  }

  endParty(): void {
    this.party = false
    for (const id of this.d.pairing.endParty()) this.kick(id, 'The party is over.')
    this.emit('change')
  }

  revoke(id: string): void {
    this.d.pairing.revoke(id)
    this.kick(id, 'This device was removed.')
    this.emit('change')
  }

  setRole(id: string, role: Role): void {
    // refused (false) for an overlay link, or when asking for the overlay role: nothing changes, nobody is kicked
    if (!this.d.pairing.setRole(id, role)) return
    // a role is fixed for a session: reconnect so the device re-learns it (and a downgrade can't linger)
    this.kick(id, 'Role changed. Reconnecting.')
    this.emit('change')
  }

  /** Devices for the UI. */
  devices(): Array<DeviceSummary & { guest: boolean; lastSeen: number }> {
    const online = new Set([...this.sessions].filter((s) => s.stage === 'ready' && s.device).map((s) => s.device!.id))
    return this.d.pairing.list().map((x) => ({ id: x.id, name: x.name, role: x.role, online: online.has(x.id), guest: x.guest, lastSeen: x.lastSeen }))
  }

  /** What other apps see: the live codes for the UI to show. */
  codes(): Array<{ code: string; display: string; expiresAt: number; party: boolean; url: string | null }> {
    return this.d.pairing.activeCodes().map((c) => ({ code: c.code, display: formatCode(c.code), expiresAt: c.expiresAt, party: c.party, url: this.pairUrl(c.code) }))
  }

  // ---- publishing what is playing ------------------------------------------------------------------------------

  setNow(now: NowInfo | null, choices?: ChoicesInfo): void {
    this.send(this.state.setNow(now, choices))
  }
  setPlay(p: PlayInfo): void {
    this.send(this.state.setPlay(p, this.now()))
  }
  setView(v: ViewInfo): void {
    this.send(this.state.setView(v))
  }
  setLyrics(id: string, status: string, synced: boolean, lines: LyricLine[]): void {
    this.send(this.state.setLyrics({ id, status, synced, lines }))
  }
  setArt(id: string, src: string | null): void {
    this.send(this.state.setArt(id, src))
  }

  private send(m: HostMsg | null): void {
    if (m && this.sessions.size) this.broadcast(m)
  }

  private broadcast(m: HostMsg): void {
    const text = encode(m)
    for (const s of this.sessions) {
      if (s.stage !== 'ready') continue
      const out = this.textFor(s, m, text)
      if (out === null) continue
      if (s.conn.bufferedAmount > 2_000_000) this.drop(s, 'Too slow to keep up.')
      else s.conn.send(out)
    }
  }

  /** The wire text of `m` for this session: as-is for viewers and controllers, redacted (or withheld) for an overlay. */
  private textFor(s: Session, m: HostMsg, text: string): string | null {
    const role = s.device?.role
    if (role !== 'overlay') return text
    const r = messageForRole('overlay', m)
    return r ? encode(r) : null
  }

  private broadcastDevices(): void {
    // overlay links are a host-side concern; other apps are not told they exist
    const devs = this.devices().filter((x) => x.role !== 'overlay').map(({ id, name, role, online }) => ({ id, name, role, online }))
    const text = encode({ t: 'devices', devices: devs })
    for (const s of this.sessions) if (s.stage === 'ready' && s.device?.role === 'controller') s.conn.send(text)
  }

  // ---- sockets -------------------------------------------------------------------------------------------------

  private http(req: IncomingMessage, res: import('node:http').ServerResponse): void {
    if (!req.socket.remoteAddress || !isLocalPeer(req.socket.remoteAddress)) {
      res.writeHead(403).end()
      return
    }
    // DNS rebinding: a page on an attacker's hostname that re-resolves to this IP still sends ITS hostname as Host
    if (!hostAllowed(req.headers.host, this.ip, this.port)) {
      res.writeHead(421, { 'Cache-Control': 'no-store' }).end()
      return
    }
    const path = (req.url ?? '/').split('?')[0]
    const common = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' }
    if (req.method === 'GET' && path === '/') {
      res.writeHead(200, {
        ...common,
        'Content-Type': 'text/html; charset=utf-8',
        // the page may talk only to this host; art is inline or https; the optional video is a YouTube embed;
        // the manifest and icon (installable app) come from this host only
        'Content-Security-Policy': `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data: https:; connect-src ${this.connectSrc(req.headers.host)}; manifest-src 'self'; frame-src https://www.youtube-nocookie.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
      })
      res.end(this.d.viewerHtml)
      return
    }
    if (req.method === 'GET' && path === '/overlay' && this.d.overlayHtml) {
      res.writeHead(200, {
        ...common,
        'Content-Type': 'text/html; charset=utf-8',
        // its own, tighter policy: this page only draws text and art. Same-origin socket only (no 'ws:' wildcard), no frames,
        // no manifest, no fonts or media; art arrives as an https: URL or an inline data: image over the socket
        'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: https:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
      })
      res.end(this.d.overlayHtml)
      return
    }
    if (req.method === 'GET' && path === '/manifest.webmanifest') {
      const icon = this.d.icon?.()
      res.writeHead(200, { ...common, 'Content-Type': 'application/manifest+json' })
      res.end(JSON.stringify(buildManifest({ iconSize: icon?.size ?? 0 })))
      return
    }
    if (req.method === 'GET' && path === '/icon.png') {
      const icon = this.d.icon?.()
      if (icon) {
        res.writeHead(200, { ...common, 'Cache-Control': 'max-age=86400', 'Content-Type': 'image/png' })
        res.end(icon.png)
        return
      }
    }
    res.writeHead(404, { 'Cache-Control': 'no-store' }).end()
  }

  /**
   * connect-src for the viewer: this server only. 'self' alone is enough in current browsers; Safari and older WebViews
   * do not let 'self' cover ws://, so the exact ws origin (host:port, already validated against the allow-list) is named.
   * Never the 'ws:' wildcard.
   */
  private connectSrc(hostHeader: string | undefined): string {
    return hostHeader && hostAllowed(hostHeader, this.ip, this.port) ? `'self' ws://${hostHeader.toLowerCase()}` : "'self'"
  }

  private upgrade(req: IncomingMessage, socket: Duplex): void {
    const addr = (socket as { remoteAddress?: string }).remoteAddress ?? ''
    if (!isLocalPeer(addr) || (req.url ?? '').split('?')[0] !== '/ws' || !hostAllowed(req.headers.host, this.ip, this.port) || !originAllowed(req.headers.origin, req.headers.host)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
      return
    }
    if (this.sessions.size >= 40) {
      socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n')
      return
    }
    const conn = acceptUpgrade(req, socket, MAX_CLIENT_BYTES)
    if (!conn) return
    const t = this.now()
    const s: Session = { conn, stage: 'new', lastHeard: t, messages: 0, cmdTokens: 10, cmdAt: t }
    this.sessions.add(s)
    // a connection that does not finish pairing / auth quickly is dropped
    const timer = setTimeout(() => s.stage !== 'ready' && this.drop(s), 10_000)
    conn.on('message', (text) => this.onMessage(s, text))
    conn.on('close', () => {
      clearTimeout(timer)
      this.drop(s) // a no-op when the host already dropped it; otherwise the peer left: update the devices list
    })
  }

  private fail(s: Session, code: ErrorCode, msg: string, close = true): void {
    s.conn.send(encode({ t: 'err', code, msg }))
    if (close) this.drop(s)
  }

  /**
   * The ONE place a session leaves the set (the socket's 'close' event finds it already gone and does nothing), so the
   * devices list / online flag is refreshed for every cause: kick, revoke, dead-peer sweep, replacement, timeout, peer close.
   * `quiet` is for a replaced session whose successor is about to announce itself anyway.
   */
  private drop(s: Session, why?: string, quiet = false): void {
    const had = this.sessions.delete(s)
    if (why) s.conn.send(encode({ t: 'bye', why }))
    s.conn.close()
    if (had && s.device && s.stage === 'ready' && !quiet) {
      this.emit('change')
      this.broadcastDevices()
    }
  }

  private kick(deviceId: string, why: string): void {
    for (const s of [...this.sessions]) if (s.device?.id === deviceId) this.drop(s, why)
  }

  private sweep(): void {
    const t = this.now()
    for (const s of [...this.sessions]) if (t - s.lastHeard > DEAD_AFTER_MS) this.drop(s)
    // expired party guests / codes
    this.d.pairing.list()
    for (const s of [...this.sessions]) if (s.device && !this.d.pairing.get(s.device.id)) this.drop(s, 'This device was removed.')
  }

  private onMessage(s: Session, text: string): void {
    const t = this.now()
    s.lastHeard = t
    if (s.stage !== 'ready' && ++s.messages > 30) return this.drop(s)
    const p = parseClient(text)
    if (!p.ok) return this.fail(s, p.code, p.why, p.code === 'version')
    const m = p.msg
    if (m.t === 'ping') {
      // answered in every stage so a client can measure the clock while it is still pairing
      s.conn.send(encode({ t: 'pong', id: m.id, c0: m.c0, s1: t, s2: this.now() }))
      return
    }
    if (m.t === 'bye') return this.drop(s)

    if (s.stage === 'new') {
      if (m.t === 'pair') {
        const r = this.d.pairing.redeem(m.code, m.name)
        if (!r.ok) return this.fail(s, r.code, r.msg)
        const sn = this.d.randomHex(16)
        s.conn.send(encode({ t: 'paired', deviceId: r.device.id, token: r.device.token, role: r.device.role, sn }))
        this.ready(s, r.device, Pairing.sessionKey(r.device.token, m.cn, sn))
      } else if (m.t === 'hello') {
        s.cn = m.cn
        s.sn = this.d.randomHex(16)
        s.helloDeviceId = m.deviceId
        s.stage = 'challenged'
        s.conn.send(encode({ t: 'challenge', sn: s.sn }))
      } else this.fail(s, 'forbidden', 'Pair first.')
      return
    }
    if (s.stage === 'challenged') {
      if (m.t !== 'auth' || !s.cn || !s.sn || !s.helloDeviceId) return this.fail(s, 'bad-message', 'Expected auth.')
      const dev = this.d.pairing.verifyProof(s.helloDeviceId, s.cn, s.sn, m.proof)
      // one answer for "no such device" and "wrong proof": no way to probe which devices exist
      if (!dev) return this.fail(s, 'bad-proof', 'Not recognised. Pair this device again.')
      this.ready(s, dev, Pairing.sessionKey(dev.token, s.cn, s.sn))
      return
    }
    // ready
    if (m.t === 'cmd') return this.onCommand(s, m)
    this.fail(s, 'bad-message', 'Unexpected message.', false)
  }

  private ready(s: Session, device: Device, sessionKey: string): void {
    // one live session per device: a re-connect replaces the old socket
    for (const o of [...this.sessions]) if (o !== s && o.device?.id === device.id) this.drop(o, 'Connected from somewhere else.', true)
    s.stage = 'ready'
    s.device = device
    s.gate = new CommandGate(sessionKey)
    this.d.pairing.touch(device.id)
    const send = (m: HostMsg): void => {
      const r = messageForRole(device.role, m)
      if (r) s.conn.send(encode(r))
    }
    send({ t: 'ready', role: device.role, name: this.d.hostName(), host: this.now(), vibes: this.d.vibes, party: this.party })
    for (const m of this.state.snapshot()) send(m)
    send({ t: 'devices', devices: this.devices().filter((x) => x.role !== 'overlay').map(({ id, name, role, online }) => ({ id, name, role, online })) })
    this.emit('change')
    this.broadcastDevices()
  }

  private onCommand(s: Session, m: { n: number; b: string; mac: string }): void {
    const dev = s.device
    if (!dev || !s.gate) return
    const t = this.now()
    // token bucket: 10 commands burst, 5 per second sustained
    s.cmdTokens = Math.min(10, s.cmdTokens + ((t - s.cmdAt) / 1000) * 5)
    s.cmdAt = t
    if (s.cmdTokens < 1) return this.fail(s, 'rate', 'Slow down.', false)
    s.cmdTokens -= 1
    const verdict = s.gate.check(m.n, m.b, m.mac)
    if (verdict !== 'ok') return this.fail(s, verdict, verdict === 'replay' ? 'Old command.' : 'Bad signature.', false)
    // the role is read from the registry each time: a downgrade takes effect on the next command
    const current = this.d.pairing.get(dev.id)
    if (!current || current.role !== 'controller') return this.fail(s, 'forbidden', 'This device can only watch.', false)
    const cmd = parseCommand(m.b)
    if (!cmd) return this.fail(s, 'bad-message', 'Unknown command.', false)
    this.d.onCommand(cmd, current)
  }
}
