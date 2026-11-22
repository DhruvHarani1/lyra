import { createSocket, type Socket } from 'node:dgram'
import { SERVICE_TYPE } from '@core/connect/protocol'
import { isLocalPeer } from './net'


/**
 * Announces "_lyra-connect._tcp" on the local network (mDNS / Bonjour / Android NSD) so apps can find the PC without
 * typing an address. Advertise-only: it answers queries and announces itself, and never browses. No dependency;
 * the packet code is small and pure (see buildResponse / parseQuestions, both unit tested).
 *
 * Discovery only tells a device WHERE Lyra is. It grants nothing: connecting still needs a pairing code or a token.
 */
const MDNS_ADDR = '224.0.0.251'
const MDNS_PORT = 5353
const T_A = 1
const T_PTR = 12
const T_TXT = 16
const T_SRV = 33
const T_ANY = 255

export interface ServiceInfo {
  instance: string
  host: string
  ip: string
  port: number
  txt: Record<string, string>
}

function nameBytes(name: string): Buffer {
  const parts: Buffer[] = []
  for (const label of name.split('.').filter(Boolean)) {
    const b = Buffer.from(label, 'utf8').subarray(0, 63)
    parts.push(Buffer.from([b.length]), b)
  }
  parts.push(Buffer.from([0]))
  return Buffer.concat(parts)
}

function record(name: string, type: number, ttl: number, data: Buffer, flush = false): Buffer {
  const head = Buffer.alloc(10)
  head.writeUInt16BE(type, 0)
  head.writeUInt16BE(flush ? 0x8001 : 1, 2) // class IN (+ cache-flush)
  head.writeUInt32BE(ttl, 4)
  head.writeUInt16BE(data.length, 8)
  return Buffer.concat([nameBytes(name), head, data])
}

/** The full answer set for one service. ttl 0 = goodbye. */
export function buildResponse(s: ServiceInfo, ttl = 120): Buffer {
  const svc = `${SERVICE_TYPE}.local`
  const inst = `${s.instance}.${svc}`
  const hostName = `${s.host}.local`
  const srv = Buffer.alloc(6)
  srv.writeUInt16BE(0, 0)
  srv.writeUInt16BE(0, 2)
  srv.writeUInt16BE(s.port, 4)
  const txt = Buffer.concat(
    Object.entries(s.txt).map(([k, v]) => {
      const kv = Buffer.from(`${k}=${v}`, 'utf8').subarray(0, 255)
      return Buffer.concat([Buffer.from([kv.length]), kv])
    })
  )
  const ip = Buffer.from(s.ip.split('.').map((n) => Number(n) & 255))
  const answers = [
    record(svc, T_PTR, ttl, nameBytes(inst)),
    record(inst, T_SRV, ttl, Buffer.concat([srv, nameBytes(hostName)]), true),
    record(inst, T_TXT, ttl, txt.length ? txt : Buffer.from([0]), true),
    record(hostName, T_A, ttl, ip, true)
  ]
  const head = Buffer.alloc(12)
  head.writeUInt16BE(0x8400, 2) // response, authoritative
  head.writeUInt16BE(answers.length, 6)
  return Buffer.concat([head, ...answers])
}

/** Names asked about in a query packet (lowercased). Tolerant: a malformed packet gives []. */
export function parseQuestions(msg: Buffer): Array<{ name: string; type: number }> {
  try {
    if (msg.length < 12 || msg.readUInt16BE(2) & 0x8000) return [] // too short, or a response
    const qd = msg.readUInt16BE(4)
    let off = 12
    const out: Array<{ name: string; type: number }> = []
    for (let i = 0; i < qd; i++) {
      const labels: string[] = []
      for (let guard = 0; guard < 32; guard++) {
        const len = msg[off++]
        if (len === undefined) return out
        if (len === 0) break
        if (len & 0xc0) return out // compression in a question: not worth handling
        labels.push(msg.toString('utf8', off, off + len))
        off += len
      }
      const type = msg.readUInt16BE(off)
      off += 4
      out.push({ name: labels.join('.').toLowerCase(), type })
    }
    return out
  } catch {
    return []
  }
}

export const asksForUs = (qs: Array<{ name: string; type: number }>, s: ServiceInfo): boolean => {
  const svc = `${SERVICE_TYPE}.local`
  const inst = `${s.instance}.${svc}`.toLowerCase()
  return qs.some((q) => (q.name === svc && (q.type === T_PTR || q.type === T_ANY)) || (q.name === inst && [T_SRV, T_TXT, T_ANY].includes(q.type)) || (q.name === `${s.host}.local`.toLowerCase() && (q.type === T_A || q.type === T_ANY)))
}

export class MdnsAdvertiser {
  constructor(private readonly warn: (...a: unknown[]) => void = () => undefined) {}

  private sock: Socket | null = null
  private info: ServiceInfo | null = null
  private timer: NodeJS.Timeout | null = null

  start(info: ServiceInfo): void {
    this.stop()
    this.info = info
    const sock = createSocket({ type: 'udp4', reuseAddr: true })
    this.sock = sock
    sock.on('error', (e) => {
      this.warn('mDNS unavailable', e.message)
      this.stop()
    })
    sock.on('message', (msg, rinfo) => {
      // the socket is bound to 0.0.0.0 (so multicast arrives on every platform); drop queries from outside the LAN
      if (!isLocalPeer(rinfo.address)) return
      if (this.info && asksForUs(parseQuestions(msg), this.info)) this.send(buildResponse(this.info))
    })
    sock.bind(MDNS_PORT, () => {
      try {
        sock.addMembership(MDNS_ADDR, info.ip) // only the LAN interface we serve on
        sock.setMulticastInterface(info.ip)
        sock.setMulticastTTL(255)
        sock.setMulticastLoopback(false)
      } catch (e) {
        this.warn('mDNS membership failed', (e as Error).message)
        return
      }
      this.send(buildResponse(info))
      // re-announce now and then; browsers that missed the first one catch the next
      this.timer = setInterval(() => this.info && this.send(buildResponse(this.info)), 60_000)
    })
  }

  private send(buf: Buffer): void {
    this.sock?.send(buf, MDNS_PORT, MDNS_ADDR, () => undefined)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    if (this.sock && this.info) {
      try {
        this.sock.send(buildResponse(this.info, 0), MDNS_PORT, MDNS_ADDR, () => undefined) // goodbye
      } catch {
        /* socket already closed */
      }
    }
    const s = this.sock
    this.sock = null
    this.info = null
    if (s) setTimeout(() => s.close(), 100)
  }
}
