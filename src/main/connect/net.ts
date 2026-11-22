import type { NetworkInterfaceInfo } from 'node:os'

/** RFC 1918 private IPv4 ranges (the only addresses Lyra Connect serves on or accepts connections from). */
export function isPrivateIPv4(ip: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

/** Peers may be on the LAN, or on this very PC (a browser tab, a test). Remote-address strings can be IPv4-mapped. */
export function isLocalPeer(addr: string): boolean {
  const ip = addr.replace(/^::ffff:/, '')
  return isPrivateIPv4(ip) || ip === '127.0.0.1' || ip === '::1' || /^169\.254\./.test(ip)
}

export interface LanAddress {
  ip: string
  name: string
}

/**
 * The one address to serve on: a private IPv4 of a real network card. Wi-Fi / Ethernet beat virtual adapters
 * (VPN, VM, WSL, Docker), whose names we recognise. Returns null when the PC is not on a network.
 */
export function pickLanAddress(ifaces: NodeJS.Dict<NetworkInterfaceInfo[]>): LanAddress | null {
  const virtual = /vethernet|virtual|vmware|vbox|hyper-v|wsl|docker|tailscale|zerotier|hamachi|tun|tap|loopback|bluetooth/i
  const found: Array<LanAddress & { score: number }> = []
  for (const [name, list] of Object.entries(ifaces)) {
    for (const n of list ?? []) {
      if (n.family !== 'IPv4' || n.internal || !isPrivateIPv4(n.address)) continue
      let score = 0
      if (!virtual.test(name)) score += 10
      if (n.address.startsWith('192.168.')) score += 2
      found.push({ ip: n.address, name, score })
    }
  }
  found.sort((a, b) => b.score - a.score)
  return found[0] ? { ip: found[0].ip, name: found[0].name } : null
}

/** The page's own origin: browsers send `Origin: http://host:port` on a WebSocket and it has to be us. */
export function originAllowed(origin: string | undefined, hostHeader: string | undefined): boolean {
  if (!origin) return true // native apps send none; a web page always does
  if (!hostHeader) return false
  return origin === `http://${hostHeader}`
}

/**
 * DNS-rebinding guard: the Host header must name this server (the LAN IP, localhost or 127.0.0.1, with or without our
 * port). A rebinding page reaches us under its own hostname, which is never one of these. Missing Host is refused.
 */
export function hostAllowed(hostHeader: string | undefined, ip: string | null, port: number): boolean {
  if (!hostHeader) return false
  const h = hostHeader.toLowerCase()
  const names = ['localhost', '127.0.0.1']
  if (ip) names.push(ip.toLowerCase())
  return names.some((n) => h === n || h === `${n}:${port}`)
}
