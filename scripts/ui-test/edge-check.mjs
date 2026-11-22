// Window-edge check: counts how often the song variables (--lp --li --lt --lv --ts) are written on <html> and whether the
// edge animations run, per look and per situation (playing, paused/calm, rim light off, low performance, TV).
// Needs the harness (started on UI_PORT like run.mjs does).
//   UI_PORT=6101 node scripts/ui-test/edge-check.mjs [--vibes=lens,route,blocks,doodle] [--shots=label]
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]))
const PORT = Number(process.env.UI_PORT ?? 5199)
const BASE = `http://localhost:${PORT}`
const vibes = String(args.vibes ?? 'lens,route,blocks,doodle').split(',')
const OUT = join(root, 'ui-test-out', 'edge')
mkdirSync(OUT, { recursive: true })

const up = async () => { try { return (await fetch(BASE)).ok } catch { return false } }
let server
if (!(await up())) {
  server = spawn('npx', ['vite', '-c', 'scripts/harness/vite.config.ts', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore', shell: process.platform === 'win32' })
  for (let i = 0; i < 80 && !(await up()); i++) await new Promise((r) => setTimeout(r, 500))
}

const SCENARIOS = [
  { id: 'playing', q: '', s: {} },
  { id: 'paused(calm)', q: '&paused=1', s: {} },
  { id: 'rim-off', q: '', s: {}, after: true },
  { id: 'perf-low', q: '', s: { performance: 'light' } },
  { id: 'motion-off', q: '', s: { reducedMotion: 'on' } },
  { id: 'tv', q: '&tv=1', s: {} }
]

const browser = await chromium.launch()
const rows = []
for (const vibe of vibes) {
  for (const sc of SCENARIOS) {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
    await page.addInitScript(() => {
      window.__w = { n: 0, names: {} }
      const orig = CSSStyleDeclaration.prototype.setProperty
      CSSStyleDeclaration.prototype.setProperty = function (name, ...r) {
        if (this === document.documentElement.style && /^--(lp|li|lt|lv|ts)$/.test(name)) { window.__w.n++; window.__w.names[name] = (window.__w.names[name] || 0) + 1 }
        return orig.call(this, name, ...r)
      }
    })
    const s = encodeURIComponent(JSON.stringify({ vibe, performance: 'smooth', ...sc.s }))
    await page.goto(`${BASE}/?mode=full&t=43500${sc.q}&s=${s}`)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(1500)
    if (sc.after) await page.evaluate(() => { document.documentElement.dataset.rim = 'off' }) // the product locks rimLight on (store/settings.ts lockLook), so flip the attribute the CSS reads
    await page.evaluate(() => { window.__w.n = 0; window.__w.names = {} })
    const a = await page.screenshot()
    const v0 = await page.evaluate(() => ['--lp', '--li', '--lt', '--lv', '--ts'].map((k) => document.documentElement.style.getPropertyValue(k)))
    await page.waitForTimeout(3000)
    const b = await page.screenshot()
    const info = await page.evaluate(() => {
      const edge = document.querySelector('.edge')
      const anims = document.getAnimations().filter((x) => x.effect && x.effect.target && x.effect.target.closest && x.effect.target.closest('.edge'))
      return {
        w: window.__w,
        vars: ['--lp', '--li', '--lt', '--lv', '--ts'].map((k) => document.documentElement.style.getPropertyValue(k)),
        display: edge ? getComputedStyle(edge).display : 'none',
        running: anims.filter((x) => x.playState === 'running').length,
        paused: anims.filter((x) => x.playState === 'paused').length,
        calm: document.documentElement.hasAttribute('data-calm'), rim: document.documentElement.dataset.rim
      }
    })
    const moved = !a.equals(b)
    writeFileSync(join(OUT, `${args.shots ?? 'run'}__${vibe}__${sc.id.replace(/\W+/g, '')}.png`), b)
    rows.push({ vibe, scenario: sc.id, writes3s: info.w.n, byVar: JSON.stringify(info.w.names), edge: info.display, animRunning: info.running, animPaused: info.paused, calm: info.calm, rim: info.rim, framesDiffer: moved, varsBefore: v0.join('|'), varsAfter: info.vars.join('|') })
    await page.context().close()
  }
}
await browser.close()
if (server) server.kill()
console.table(rows)
