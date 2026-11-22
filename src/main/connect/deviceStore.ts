import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Device } from '@core/connect/pairing'

/** Encrypts a string for storage on this machine (Electron safeStorage / DPAPI in the app, a fake in tests). */
export interface SecretCipher {
  available(): boolean
  /** returns base64 */
  encrypt(plain: string): string
  decrypt(b64: string): string
}

interface StoredDevice extends Omit<Device, 'token'> {
  token?: string
  /** the device token, encrypted with the OS credential store (base64) */
  tokenEnc?: string
}

interface FileShape {
  v: 2
  devices: StoredDevice[]
}

/**
 * connect-devices.json: the paired devices. Each device's token is a bearer secret (it is what an overlay link carries and
 * what proves a controller), so it is written encrypted with the OS credential store when that exists, like the Spotify
 * tokens. Where encryption is unavailable the file falls back to plaintext tokens (the previous behaviour) so pairing still
 * works; the moment encryption is available an existing plaintext file is migrated (rewritten encrypted). A token that
 * cannot be decrypted (file copied from another account or machine) is dropped: that device must pair again.
 * Writes are atomic (tmp file + rename) and debounced.
 */
export class DeviceStore {
  private devices: Device[]
  private timer: NodeJS.Timeout | null = null

  constructor(
    readonly path: string,
    private readonly cipher: SecretCipher,
    private readonly warn: (...a: unknown[]) => void = () => undefined
  ) {
    const { devices, needsRewrite } = this.load()
    this.devices = devices
    if (needsRewrite) this.flush()
  }

  private load(): { devices: Device[]; needsRewrite: boolean } {
    let raw: unknown
    try {
      if (!existsSync(this.path)) return { devices: [], needsRewrite: false }
      raw = JSON.parse(readFileSync(this.path, 'utf8'))
    } catch (e) {
      this.warn('connect: could not read the device list', (e as Error).message)
      return { devices: [], needsRewrite: false }
    }
    const list = (raw as { devices?: unknown })?.devices
    if (!Array.isArray(list)) return { devices: [], needsRewrite: false }
    const out: Device[] = []
    let needsRewrite = false
    for (const item of list as StoredDevice[]) {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string') continue
      const { tokenEnc, token, ...rest } = item
      let plain: string | null = null
      if (typeof tokenEnc === 'string') {
        try {
          plain = this.cipher.available() ? this.cipher.decrypt(tokenEnc) : null
        } catch {
          plain = null
        }
        if (plain === null) this.warn('connect: dropped a device whose token could not be decrypted', item.id)
      } else if (typeof token === 'string') {
        plain = token
        if (this.cipher.available()) needsRewrite = true // migrate plaintext to encrypted
      }
      if (plain) out.push({ ...rest, token: plain })
      // an undecryptable device is dropped from memory only: the file is left alone (encryption may be only temporarily
      // unavailable) until the next real change rewrites it
    }
    return { devices: out, needsRewrite }
  }

  get(): { devices: Device[] } {
    return { devices: this.devices }
  }

  set(next: { devices: Device[] }): void {
    this.devices = next.devices
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), 250)
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    try {
      const enc = this.cipher.available()
      const file: FileShape = {
        v: 2,
        devices: this.devices.map(({ token, ...rest }) => (enc ? { ...rest, tokenEnc: this.cipher.encrypt(token) } : { ...rest, token }))
      }
      mkdirSync(dirname(this.path), { recursive: true })
      const tmp = `${this.path}.tmp`
      writeFileSync(tmp, JSON.stringify(file, null, 2))
      renameSync(tmp, this.path)
    } catch (e) {
      this.warn('connect: failed to write the device list', (e as Error).message)
    }
  }
}
