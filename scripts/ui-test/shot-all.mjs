// Regression net for CSS/TSX refactors: every look x 5 sizes x 3 states, frozen (paused clock, animations off, seeded Math.random).
//   npx vite build -c scripts/harness/vite.config.ts --outDir ../../ui-test-out/dist-base --emptyOutDir
//   node scripts/ui-test/shot-all.mjs --dist=ui-test-out/dist-base --out=ui-test-out/base [--vibe=neon,chrome] [--size=full1366,mini] [--only=neon__mini__plain,...] [--conc=4]
//   (without --dist it screenshots the dev server on UI_PORT instead)
// Then:  node scripts/ui-test/diff-shots.mjs ui-test-out/base ui-test-out/after
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const out = args.out ?? join(process.cwd(), 'ui-test-out', 'base')
mkdirSync(out, { recursive: true })
const PORT = Number(process.env.UI_PORT ?? 5197)
const BASE = `http://localhost:${PORT}`
const up = () => fetch(BASE).then((r) => r.ok).catch(() => false)
let server
let staticSrv
if (args.dist) {
  // serve a built harness (vite build -c scripts/harness/vite.config.ts --outDir <dist>): one bundle, far faster than the dev server
  const { createServer } = await import('node:http')
  const { readFile } = await import('node:fs/promises')
  const { extname, resolve: res } = await import('node:path')
  const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' }
  const rootDir = res(args.dist)
  staticSrv = createServer(async (rq, rs) => {
    try {
      let p = decodeURIComponent(new URL(rq.url, 'http://x').pathname)
      if (p === '/') p = '/index.html'
      const buf = await readFile(join(rootDir, p))
      rs.writeHead(200, { 'content-type': T[extname(p)] ?? 'application/octet-stream' }).end(buf)
    } catch { rs.writeHead(404).end() }
  }).listen(PORT)
} else if (!(await up())) {
  server = spawn('npx', ['vite', '-c', 'scripts/harness/vite.config.ts', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true, shell: true })
  for (let i = 0; i < 120 && !(await up()); i++) await new Promise((r) => setTimeout(r, 500))
}
const src = readFileSync(join(process.cwd(), 'src/shared/vibes.ts'), 'utf8')
let vibes = [...src.matchAll(/^\s*\{ id: '([a-z]+)', layout:/gm)].map((m) => m[1])
if (args.vibe) vibes = args.vibe.split(',')
const SIZES = [
  { id: 'full1366', w: 1366, h: 768, q: 'mode=full' },
  { id: 'full1024', w: 1024, h: 600, q: 'mode=full' },
  { id: 'mini', w: 420, h: 700, q: 'mode=mini' },
  { id: 'phone', w: 390, h: 844, q: 'android=1&mode=mini' },
  { id: 'tablet', w: 1280, h: 800, q: 'android=1&mode=mini' }
].filter((s) => !args.size || args.size.split(',').includes(s.id))
const STATES = [
  { id: 'video', q: 'video=night' },
  { id: 'plain', q: 'ly=plain' },
  { id: 'nolyrics', q: 'ly=none' }
]
const jobs = []
for (const v of vibes) for (const s of SIZES) for (const st of STATES) jobs.push({ v, s, st })
if (args.only) { const keep = new Set(args.only.split(",")); jobs.splice(0, jobs.length, ...jobs.filter((j) => keep.has(j.v + "__" + j.s.id + "__" + j.st.id))) } // re-shoot just the flagged ones
const b = await chromium.launch()
const ctx = await b.newContext({ deviceScaleFactor: 1, reducedMotion: 'no-preference' })
await ctx.addInitScript(() => {
  // `new Date()` is frozen (the Lock look draws the wall-clock time); Date.now() stays real
  const RealDate = Date
  globalThis.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(1767264120000) } }
  let a = 0x9e3779b9
  Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
})
let next = 0, done = 0
const worker = async () => {
  while (next < jobs.length) {
    const { v, s, st } = jobs[next++]
    const p = await ctx.newPage()
    try {
      await p.setViewportSize({ width: s.w, height: s.h })
      const setting = encodeURIComponent(JSON.stringify({ vibe: v, performance: 'smooth' }))
      await p.goto(`${BASE}/?paused=1&t=43500&${s.q}&${st.q}&s=${setting}`)
      await p.evaluate(() => document.fonts.ready)
      await p.waitForTimeout(1800)
      await p.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' })
      await p.waitForTimeout(350)
      await p.screenshot({ path: join(out, `${v}__${s.id}__${st.id}.png`) })
    } catch (e) { console.log('FAIL', v, s.id, st.id, String(e).slice(0, 120)) }
    await p.close()
    if (++done % 30 === 0) console.log(`${done}/${jobs.length}`)
  }
}
await Promise.all(Array.from({ length: Number(args.conc ?? 4) }, worker))
await b.close()
staticSrv?.close()
try { if (server) process.kill(process.platform === 'win32' ? server.pid : -server.pid) } catch {}
console.log(`${done} shots in ${out}`)
