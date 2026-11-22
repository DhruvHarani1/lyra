import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Pairing } from '@core/connect/pairing'
import type { CommandBody } from '@core/connect/protocol'
import { ConnectHub } from '../main/connect/hub'

/**
 * The Android TV client against the REAL host: this test starts the shipped hub (src/main/connect/hub.ts) on loopback and
 * runs the Kotlin client (android/.../tv/HubInteropTest.kt, the same LanConnectTransport the TV app uses) in a JVM through
 * Gradle. It pairs with a one-time code, follows the song, sends signed commands, reconnects by proof, and must be refused
 * with a wrong token and a used code. Slow (a Gradle run) and needs the Android SDK, so it only runs on request:
 *   LYRA_KOTLIN_INTEROP=1 npx vitest run src/android-web/connectInterop.test.ts
 */
const run = process.env.LYRA_KOTLIN_INTEROP === '1'

const live: Array<{ stop(): void }> = []
afterEach(() => {
  for (const x of live.splice(0)) x.stop()
})

describe.skipIf(!run)('android TV client against the real Connect hub', () => {
  it('pairs, follows, commands and reconnects', async () => {
    const commands: CommandBody[] = []
    const pairing = new Pairing({ now: Date.now, randomHex: (n) => randomBytes(n).toString('hex'), randomBytes: (n) => new Uint8Array(randomBytes(n)) })
    const hub = new ConnectHub({
      pairing,
      viewerHtml: '<html></html>',
      overlayHtml: '<html></html>',
      icon: () => ({ png: Buffer.from([137, 80, 78, 71]), size: 64 }),
      lanIp: () => '127.0.0.1',
      port: 0,
      hostName: () => 'InteropPC',
      vibes: ['none', 'neon'],
      onCommand: (c) => commands.push(c),
      randomHex: (n) => randomBytes(n).toString('hex')
    })
    live.push(hub)
    expect(await hub.start()).toBe(true)

    const at = Date.now()
    hub.setNow({ id: 's1', key: 'k1', title: 'Interop Song', artists: ['Interop Artist'], durationMs: 200_000 })
    hub.setPlay({ playing: true, positionMs: 30_000, at })
    hub.setView({ vibe: 'neon', video: { id: null }, offsetMs: 250 })
    hub.setArt('s1', 'https://example.test/cover.jpg')
    hub.setLyrics('s1', 'synced', true, [
      { t: 1000, x: 'first line' },
      { t: 4000, x: 'second line' }
    ])
    const code = hub.newCode('controller').code

    const root = resolve(__dirname, '../../android')
    const win = process.platform === 'win32'
    const out: string[] = []
    const exit = await new Promise<number | null>((done) => {
      const gradle = ['cleanTestDebugUnitTest', 'testDebugUnitTest', '--tests', '*HubInteropTest*', '--console=plain']
      const child = spawn(win ? 'cmd.exe' : './gradlew', win ? ['/c', '.\\gradlew.bat', ...gradle] : gradle, {
        cwd: root,
        env: { ...process.env, LYRA_HUB_PORT: String(hub.status().port), LYRA_HUB_CODE: code, LYRA_HUB_AT: String(at) }
      })
      child.stdout.on('data', (d) => out.push(String(d)))
      child.stderr.on('data', (d) => out.push(String(d)))
      child.on('close', done)
    })
    expect(exit, out.join('').slice(-3000)).toBe(0)

    // the hub accepted exactly the signed commands the TV sent (the unknown "like" never left the TV)
    expect(commands).toEqual([{ c: 'toggle' }, { c: 'seek', ms: 15_000 }, { c: 'next' }])
    // and the TV is a paired controller device on the host
    expect(pairing.list().some((d) => d.name === 'Interop TV' && d.role === 'controller')).toBe(true)
  }, 600_000)
})
