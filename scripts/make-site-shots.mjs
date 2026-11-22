// Renders the marketing screenshots for the website (website/assets/shots) from the browser harness.
//   node scripts/make-site-shots.mjs [--port=5411] [--only=neon,chrome]
// The harness server must already be running on the port (npx vite -c scripts/harness/vite.config.ts --port 5411).
import { chromium } from 'playwright'
import { readFileSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]))
const PORT = Number(args.port ?? 5411)
const BASE = `http://localhost:${PORT}`
const OUT = join(root, 'website/assets/shots')
mkdirSync(OUT, { recursive: true })

const src = readFileSync(join(root, 'src/shared/vibes.ts'), 'utf8')
const vibes = [...src.matchAll(/\{ id: '(\w+)', layout: '\w+', style: '\w+', name: '([^']+)', tag: '([^']+)'/g)].map((m) => ({ id: m[1], name: m[2], tag: m[3] }))
const LIGHT = new Set(['sticker', 'cassette', 'sketch', 'comic', 'chrome', 'journal', 'doodle'])
const only = args.only ? String(args.only).split(',') : null
const list = only ? vibes.filter((v) => only.includes(v.id)) : vibes
if (!vibes.length) throw new Error('no vibes parsed')

const settle = 6500
const jobs = []
const shot = (file, vibe, q, w, h, scale, quality) => jobs.push({ kind: 'page', file, vibe, q, w, h, scale, quality })
for (const v of list) {
  const s = v.id
  shot(`${s}-full.jpg`, s, 'mode=full&video=site', 1600, 900, 1, 82)
  shot(`${s}-full-novideo.jpg`, s, 'mode=full', 1600, 900, 1, 82)
  shot(`${s}-phone.jpg`, s, 'android=1&mode=mini', 390, 844, 2, 80)
  shot(`${s}-mini.jpg`, s, 'mode=mini', 420, 700, 2, 80)
  shot(`${s}-plain.jpg`, s, 'mode=full&video=site&ly=plain', 1280, 720, 1, 78)
  shot(`${s}-nolyrics.jpg`, s, 'mode=full&video=site&ly=none', 1280, 720, 1, 78)
  shot(`settings-${s}.jpg`, s, 'mode=full&panel=settings', 1280, 720, 1, 78)
  jobs.push({ kind: 'card', file: `card-${s}.jpg`, vibe: s })
}

const browser = await chromium.launch()
// one fresh browser context per job (the device scale factor belongs to the context)
const runOne = async (j) => {
  const ctx = await browser.newContext({ deviceScaleFactor: j.scale ?? 1, viewport: j.w ? { width: j.w, height: j.h } : { width: 600, height: 400 } })
  try {
    const p = await ctx.newPage()
    if (j.kind === 'page') {
      const s = encodeURIComponent(JSON.stringify({ vibe: j.vibe, performance: 'smooth' }))
      await p.goto(`${BASE}/?paused=1&t=43500&${j.q}&s=${s}`)
      await p.evaluate(() => document.fonts.ready)
      // wait until every clip has a decoded frame (a slow machine otherwise shows an empty video window)
      await p.evaluate(() => Promise.all([...document.querySelectorAll('video')].map((v) => (v.readyState >= 3 ? 1 : new Promise((r) => { v.addEventListener('canplay', r, { once: true }); setTimeout(r, 8000) })))))
      await p.waitForTimeout(settle)
      await p.screenshot({ path: join(OUT, j.file), type: 'jpeg', quality: j.quality })
    } else {
      await p.goto(`${BASE}/?mode=mini`)
      await p.waitForTimeout(1200)
      const url = await p.evaluate(async ({ id, path }) => {
        const m = await import(/* @vite-ignore */ path)
        const c = document.createElement('canvas')
        await m.drawCard(c, { lines: ['I keep running back to you', 'every single night'], title: 'Midnight Drive', artist: 'The Night Owls', artworkUrl: null, accent: '#ff6aa0', tint1: '#1a1a1a', tint2: '#101010', style: 'doodle', theme: m.cardTheme(id) })
        const t = document.createElement('canvas')
        t.width = 540
        t.height = 960
        t.getContext('2d').drawImage(c, 0, 0, 540, 960)
        return t.toDataURL('image/jpeg', 0.85)
      }, { id: j.vibe, path: `/@fs${join(root, 'src/renderer/src/lib/shareCard.ts')}` })
      writeFileSync(join(OUT, j.file), Buffer.from(url.split(',')[1], 'base64'))
    }
  } catch (e) {
    console.error('FAILED', j.file, String(e).slice(0, 200))
  } finally {
    await ctx.close().catch(() => undefined)
  }
}
let idx = 0
let finished = 0
const pool = async () => {
  for (;;) {
    const j = jobs[idx++]
    if (!j) return
    await runOne(j)
    finished++
    if (finished % 10 === 0) console.log(`${finished}/${jobs.length}`)
  }
}
await Promise.all([pool(), pool(), pool()])

// the contact sheet of all vibes (full screen, five columns)
if (!only) {
  const page = await (await browser.newContext({ viewport: { width: 2400, height: 1200 } })).newPage()
  const tw = 480
  const th = 270
  const cells = vibes
    .map((v) => `<figure style="margin:0;position:relative"><img width="${tw}" height="${th}" style="display:block;object-fit:cover" src="data:image/jpeg;base64,${readFileSync(join(OUT, `${v.id}-full.jpg`)).toString('base64')}"><figcaption style="position:absolute;left:8px;bottom:6px;font:700 13px system-ui;color:#fff;text-shadow:0 1px 3px #000">${v.name}</figcaption></figure>`)
    .join('')
  await page.setContent(`<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(5,${tw}px)">${cells}</body>`)
  await page.setViewportSize({ width: 2400, height: Math.ceil(vibes.length / 5) * th })
  await page.screenshot({ path: join(OUT, 'sheet-vibes.jpg'), type: 'jpeg', quality: 80 })
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ vibes: vibes.map((v) => ({ ...v, light: LIGHT.has(v.id) })) }, null, 2))
await browser.close()
const files = readdirSync(OUT)
const total = files.reduce((n, f) => n + statSync(join(OUT, f)).size, 0)
console.log(`${files.length} files, ${(total / 1048576).toFixed(1)} MB`)
