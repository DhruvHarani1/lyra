import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Device } from '@core/connect/pairing'
import { DeviceStore, type SecretCipher } from './deviceStore'

const dirs: string[] = []
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'lyra-dev-'))
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

const fake = (available = true): SecretCipher => ({
  available: () => available,
  encrypt: (s) => Buffer.from(`ENC:${[...s].reverse().join('')}`).toString('base64'),
  decrypt: (b) => {
    const t = Buffer.from(b, 'base64').toString()
    if (!t.startsWith('ENC:')) throw new Error('bad blob')
    return [...t.slice(4)].reverse().join('')
  }
})

const dev = (id: string, token: string): Device => ({ id, name: id, role: 'viewer', token, guest: false, createdAt: 1, lastSeen: 1 })

describe('DeviceStore', () => {
  it('writes tokens encrypted, never in the clear, and reads them back', () => {
    const path = join(tmp(), 'connect-devices.json')
    const s = new DeviceStore(path, fake())
    s.set({ devices: [dev('a', 'SECRETTOKEN1')] })
    s.flush()
    const text = readFileSync(path, 'utf8')
    expect(text).not.toContain('SECRETTOKEN1')
    expect(text).toContain('tokenEnc')
    expect(new DeviceStore(path, fake()).get().devices[0]!.token).toBe('SECRETTOKEN1')
    expect(readdirSync(join(path, '..'))).toEqual(['connect-devices.json']) // atomic: no tmp file left behind
  })

  it('migrates an existing plaintext file to encrypted on first load', () => {
    const path = join(tmp(), 'connect-devices.json')
    writeFileSync(path, JSON.stringify({ devices: [dev('a', 'OLDPLAINTOKEN')] }))
    const s = new DeviceStore(path, fake())
    expect(s.get().devices[0]!.token).toBe('OLDPLAINTOKEN')
    const text = readFileSync(path, 'utf8')
    expect(text).not.toContain('OLDPLAINTOKEN')
    expect(new DeviceStore(path, fake()).get().devices[0]!.token).toBe('OLDPLAINTOKEN')
  })

  it('falls back to plaintext where encryption is unavailable, and still reads it', () => {
    const path = join(tmp(), 'connect-devices.json')
    const s = new DeviceStore(path, fake(false))
    s.set({ devices: [dev('a', 'PLAINTOK')] })
    s.flush()
    expect(readFileSync(path, 'utf8')).toContain('PLAINTOK')
    expect(new DeviceStore(path, fake(false)).get().devices[0]!.token).toBe('PLAINTOK')
  })

  it('drops a device whose token cannot be decrypted instead of failing', () => {
    const path = join(tmp(), 'connect-devices.json')
    const a = new DeviceStore(path, fake())
    a.set({ devices: [dev('a', 'T1'), dev('b', 'T2')] })
    a.flush()
    expect(new DeviceStore(path, fake(false)).get().devices).toEqual([]) // encryption gone: cannot read, do not guess
    const broken = readFileSync(path, 'utf8').replace(/"tokenEnc": "[^"]+"/, '"tokenEnc": "AAAA"')
    writeFileSync(path, broken)
    expect(new DeviceStore(path, fake()).get().devices.map((d) => d.id)).toEqual(['b'])
  })

  it('survives a corrupt file', () => {
    const path = join(tmp(), 'connect-devices.json')
    writeFileSync(path, '{not json')
    expect(new DeviceStore(path, fake()).get().devices).toEqual([])
  })
})
