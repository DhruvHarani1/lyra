import { createHash } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { EventEmitter } from 'node:events'

/**
 * A minimal WebSocket server side (RFC 6455): text frames, ping/pong, close, fragmentation, mandatory client masking,
 * a hard payload cap. Written here (about 150 lines) instead of adding the `ws` package: the app needs exactly this
 * and nothing else, and it keeps the shipped dependency list unchanged.
 */
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

export const acceptKey = (key: string): string => createHash('sha1').update(key + GUID).digest('base64')

export interface Frame {
  opcode: number
  payload: Buffer
}

export class ProtocolError extends Error {}

/** Incremental parser for CLIENT frames (they must be masked). */
export class FrameParser {
  private buf: Buffer = Buffer.alloc(0)
  private msgOpcode = 0
  private parts: Buffer[] = []
  private partsLen = 0

  constructor(private readonly maxPayload: number) {}

  /** Feed bytes; returns complete messages / control frames. Throws ProtocolError on anything unacceptable. */
  push(chunk: Buffer): Frame[] {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk
    const out: Frame[] = []
    for (;;) {
      if (this.buf.length < 2) break
      const b0 = this.buf[0]!
      const b1 = this.buf[1]!
      const fin = (b0 & 0x80) !== 0
      if (b0 & 0x70) throw new ProtocolError('reserved bits')
      const opcode = b0 & 0x0f
      if (!(b1 & 0x80)) throw new ProtocolError('client frames must be masked')
      let len = b1 & 0x7f
      let off = 2
      if (len === 126) {
        if (this.buf.length < 4) break
        len = this.buf.readUInt16BE(2)
        off = 4
      } else if (len === 127) {
        if (this.buf.length < 10) break
        const hi = this.buf.readUInt32BE(2)
        if (hi !== 0) throw new ProtocolError('frame too large')
        len = this.buf.readUInt32BE(6)
        off = 10
      }
      if (len > this.maxPayload) throw new ProtocolError('frame too large')
      if (this.buf.length < off + 4 + len) break
      const mask = this.buf.subarray(off, off + 4)
      const data = Buffer.from(this.buf.subarray(off + 4, off + 4 + len))
      for (let i = 0; i < data.length; i++) data[i] = data[i]! ^ mask[i & 3]!
      this.buf = this.buf.subarray(off + 4 + len)
      if (opcode >= 8) {
        if (!fin || len > 125) throw new ProtocolError('bad control frame')
        out.push({ opcode, payload: data })
        continue
      }
      if (opcode === 0) {
        if (!this.msgOpcode) throw new ProtocolError('unexpected continuation')
      } else {
        if (this.msgOpcode) throw new ProtocolError('interleaved message')
        if (opcode !== 1) throw new ProtocolError('only text messages')
        this.msgOpcode = opcode
      }
      this.parts.push(data)
      this.partsLen += data.length
      if (this.partsLen > this.maxPayload) throw new ProtocolError('message too large')
      if (fin) {
        out.push({ opcode: this.msgOpcode, payload: Buffer.concat(this.parts) })
        this.msgOpcode = 0
        this.parts = []
        this.partsLen = 0
      }
    }
    return out
  }
}

/** Encode one unmasked server frame. */
export function encodeFrame(opcode: number, payload: Buffer): Buffer {
  const n = payload.length
  const head = n < 126 ? Buffer.from([0x80 | opcode, n]) : n < 65536 ? Buffer.from([0x80 | opcode, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x80 | opcode, 127, 0, 0, 0, 0]), Buffer.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255])])
  return Buffer.concat([head, payload])
}

export interface WsConn {
  on(event: 'message', cb: (text: string) => void): this
  on(event: 'close', cb: () => void): this
  send(text: string): void
  close(code?: number): void
  readonly remoteAddress: string
  readonly bufferedAmount: number
}

class Conn extends EventEmitter implements WsConn {
  private readonly parser: FrameParser
  private closed = false
  readonly remoteAddress: string

  constructor(private readonly socket: Duplex & { remoteAddress?: string; writableLength: number }, maxIncoming: number) {
    super()
    this.parser = new FrameParser(maxIncoming)
    this.remoteAddress = socket.remoteAddress ?? ''
    socket.on('data', (d: Buffer) => {
      try {
        for (const f of this.parser.push(d)) this.onFrame(f)
      } catch {
        this.close(1002)
      }
    })
    // http.Server sockets are half-open capable: a peer FIN fires 'end' but not 'close', so finish on both
    socket.on('end', () => this.finish())
    socket.on('close', () => this.finish())
    socket.on('error', () => this.finish())
  }

  get bufferedAmount(): number {
    return this.socket.writableLength
  }

  private onFrame(f: Frame): void {
    if (f.opcode === 1) this.emit('message', f.payload.toString('utf8'))
    else if (f.opcode === 9) this.socket.write(encodeFrame(10, f.payload))
    else if (f.opcode === 8) this.close(1000)
  }

  send(text: string): void {
    if (this.closed) return
    this.socket.write(encodeFrame(1, Buffer.from(text, 'utf8')))
  }

  close(code = 1000): void {
    if (this.closed) return
    this.closed = true
    const p = Buffer.alloc(2)
    p.writeUInt16BE(code)
    this.socket.end(encodeFrame(8, p))
    this.emit('close')
  }

  private finish(): void {
    if (this.closed) return
    this.closed = true
    this.socket.destroy()
    this.emit('close')
  }
}

/** Complete the upgrade handshake. Returns null (and answers 400) when the request is not a valid WebSocket upgrade. */
export function acceptUpgrade(req: IncomingMessage, socket: Duplex, maxIncoming: number): WsConn | null {
  const key = req.headers['sec-websocket-key']
  const ok = req.headers.upgrade?.toLowerCase() === 'websocket' && typeof key === 'string' && req.headers['sec-websocket-version'] === '13'
  if (!ok) {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')
    return null
  }
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acceptKey(key)}\r\n\r\n`)
  return new Conn(socket as Duplex & { remoteAddress?: string; writableLength: number }, maxIncoming)
}
