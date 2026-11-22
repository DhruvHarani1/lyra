import { app, net, safeStorage } from 'electron'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { setPlatform, type BlobCache, type CorePlatform, type SecretStore } from '@core/platform'
import { JsonStore } from './jsonStore'
import { createLogger } from './logger'

/** Key → file cache in userData; keeps only the newest `max` entries. */
class FileBlobCache implements BlobCache {
  private readonly dir: string
  constructor(name: string, max: number) {
    this.dir = join(app.getPath('userData'), name)
    mkdirSync(this.dir, { recursive: true })
    try {
      readdirSync(this.dir)
        .map((f) => ({ f, t: statSync(join(this.dir, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t)
        .slice(max)
        .forEach(({ f }) => rmSync(join(this.dir, f), { force: true }))
    } catch {
      /* best effort */
    }
  }
  private file(key: string): string {
    return join(this.dir, createHash('sha1').update(key).digest('hex') + '.json')
  }
  read(key: string): string | null {
    try {
      const f = this.file(key)
      const v = readFileSync(f, 'utf8')
      const t = new Date()
      utimesSync(f, t, t) // a read counts as use, so frequently played songs survive the size cap (LRU)
      return v
    } catch {
      return null
    }
  }
  write(key: string, value: string): void {
    // atomic: a crash mid-write leaves the old file, never a half-written one
    const f = this.file(key)
    const tmp = `${f}.tmp`
    writeFileSync(tmp, value)
    renameSync(tmp, f)
  }
  clear(): void {
    try {
      for (const f of readdirSync(this.dir)) rmSync(join(this.dir, f), { force: true })
    } catch {
      /* best effort */
    }
  }
}

/** One secret, encrypted with the Windows credential store (DPAPI) via Electron's safeStorage. */
class SafeStorageSecret implements SecretStore {
  private readonly path: string
  constructor(name: string) {
    this.path = join(app.getPath('userData'), `${name}.bin`)
  }
  available(): boolean {
    return safeStorage.isEncryptionAvailable()
  }
  load(): string | null {
    try {
      return existsSync(this.path) && this.available() ? safeStorage.decryptString(readFileSync(this.path)) : null
    } catch {
      return null
    }
  }
  save(value: string): void {
    writeFileSync(this.path, safeStorage.encryptString(value))
  }
  clear(): void {
    rmSync(this.path, { force: true })
  }
}

/** Per-value encryption for stores that hold several secrets (Connect device tokens). */
export const safeStorageCipher = {
  available: (): boolean => safeStorage.isEncryptionAvailable(),
  encrypt: (plain: string): string => safeStorage.encryptString(plain).toString('base64'),
  decrypt: (b64: string): string => safeStorage.decryptString(Buffer.from(b64, 'base64'))
}

export function installElectronPlatform(): void {
  const platform: CorePlatform = {
    fetch: (url, init) => net.fetch(url, init),
    store: (name, defaults) => new JsonStore(name, defaults),
    blobCache: (name, max) => new FileBlobCache(name, max),
    secret: (name) => new SafeStorageSecret(name),
    log: (scope) => createLogger(scope),
    get appVersion() {
      return app.getVersion()
    }
  }
  setPlatform(platform)
}
