// One vibe, every state, every main device, as one contact sheet (for design review).
//   node scripts/ui-test/vibe-sheet.mjs --vibe=neon [--out=dir]
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const vibe = args.vibe ?? 'neon'
const out = args.out ?? join(process.cwd(), 'ui-test-out', 'sheets')
mkdirSync(out, { recursive: true })
const PORT = Number(process.env.UI_PORT ?? 5197)
const BASE = `http://localhost:${PORT}`
const up = () => fetch(BASE).then((r) => r.ok).catch(() => false)
let server
if (!(await up())) {
  server = spawn('npx', ['vite', '-c', 'scripts/harness/vite.config.ts', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true })
  for (let i = 0; i < 80 && !(await up()); i++) await new Promise((r) => setTimeout(r, 500))
}
const DEVICES = [
  { id: 'win-full', w: 1280, h: 720, q: 'mode=full' },
  { id: 'win-mini', w: 420, h: 700, q: 'mode=mini' },
  { id: 'phone', w: 390, h: 844, q: 'android=1&mode=mini' },
  { id: 'tablet', w: 1100, h: 700, q: 'android=1&mode=mini' }
]
const STATES = [
  { id: 'video+synced', q: 'video=night' },
  { id: 'video+plain', q: 'video=night&ly=plain' },
  { id: 'video+nolyrics', q: 'video=night&ly=none' },
  { id: 'synced', q: '' },
  { id: 'plain', q: 'ly=plain' },
  { id: 'nolyrics', q: 'ly=none' }
]
const b = await chromium.launch()
const ctx = await b.newContext({ deviceScaleFactor: 1 })
const s = encodeURIComponent(JSON.stringify({ vibe, performance: 'smooth' }))
for (const d of DEVICES) {
  const tiles = []
  for (const st of STATES) {
    const p = await ctx.newPage()
    await p.setViewportSize({ width: d.w, height: d.h })
    await p.goto(`${BASE}/?paused=1&t=43500&${d.q}&${st.q}&s=${s}`)
    await p.evaluate(() => document.fonts.ready)
    await p.waitForTimeout(2400)
    tiles.push({ id: st.id, buf: await p.screenshot() })
    await p.close()
  }
  const page = await ctx.newPage()
  const cols = 3, tw = Math.round(d.w * 0.5), th = Math.round(d.h * 0.5)
  await page.setViewportSize({ width: cols * tw, height: 2 * (th + 18) })
  await page.setContent(`<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(${cols},${tw}px);font:11px system-ui;color:#fff">${tiles.map((t) => `<div><div style="height:18px;padding:2px 6px">${vibe} / ${d.id} / ${t.id}</div><img width="${tw}" height="${th}" src="data:image/png;base64,${t.buf.toString('base64')}"></div>`).join('')}</body>`)
  await page.screenshot({ path: join(out, `${vibe}-${d.id}.png`) })
  await page.close()
}
await b.close()
try { if (server) process.kill(process.platform === 'win32' ? server.pid : -server.pid) } catch {}
console.log(`sheets in ${out}`)
