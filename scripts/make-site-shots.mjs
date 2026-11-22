// Renders every marketing image for the website from the browser harness, optimises them to WebP,
// and regenerates website/vibes-data.js (taglines, layout, style and the light/dark flag come from here, nowhere else).
//
//   node scripts/make-site-shots.mjs --start-server            everything, starts (and stops) the harness itself
//   node scripts/make-site-shots.mjs --start-server --only=neon,chrome
//   node scripts/make-site-shots.mjs --port=6301               use a harness that is already running
//
// Needs sharp. It is deliberately not a dependency of the repo; install it anywhere and point SHARP_DIR at that folder:
//   mkdir %TEMP%\lyra-tools && cd %TEMP%\lyra-tools && npm i sharp && set SHARP_DIR=%CD%
// (when sharp is already resolvable from the repo, SHARP_DIR is not needed).
//
// Output (website/assets/shots), all WebP except og.jpg (link previews must be a jpg/png):
//   <id>-full.webp (1600) and <id>-full-800.webp, <id>-full-novideo, <id>-plain, <id>-nolyrics, <id>-phone, <id>-mini,
//   settings-<id>, card-<id>, tile-<id> (wall tiles, 640x360), og.jpg (1200x630 contact sheet)
import { chromium } from 'playwright'
import { spawn, execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { readFileSync, mkdirSync, writeFileSync, readdirSync, statSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]))
const PORT = Number(args.port ?? process.env.UI_PORT ?? 5197)
const BASE = `http://localhost:${PORT}`
const OUT = join(root, 'website/assets/shots')
const DATA = join(root, 'website/vibes-data.js')

// the no-JS fallbacks (a plain list of looks) live between markers in the pages and are written from vibes-data.js
function writeLists() {
  const ctx = { window: {} }
  vm.runInNewContext(readFileSync(DATA, 'utf8'), ctx)
  const vs = ctx.window.LYRA_VIBES
  const inject = (file, html) => {
    const f = join(root, 'website', file)
    const t = readFileSync(f, 'utf8')
    const re = /<!--looks:start-->[\s\S]*?<!--looks:end-->/
    if (!re.test(t)) throw new Error(`${file}: no <!--looks:start--> marker`)
    writeFileSync(f, t.replace(re, () => `<!--looks:start-->${html}<!--looks:end-->`))
  }
  const items = vs.map((v) => `<li><a href="assets/shots/${v.id}-full.webp">${v.name}</a>: ${v.tag}</li>`).join('')
  inject('index.html', `<ul class="nojs-list">${items}</ul>`)
  inject('vibes.html', `<ul class="nojs-list">${items}</ul>`)
  console.log(`no-JS lists written for ${vs.length} looks`)
}
if (args['lists-only']) { writeLists(); process.exit(0) }

let sharp
for (const base of [root, process.env.SHARP_DIR].filter(Boolean)) {
  try { sharp = createRequire(join(base, 'noop.js'))('sharp'); break } catch { /* try the next place */ }
}
if (!sharp) throw new Error('sharp not found: install it outside the repo and set SHARP_DIR (see the top of this file)')

// ---- the looks: exactly what the app ships (src/shared/vibes.ts) ----
const src = readFileSync(join(root, 'src/shared/vibes.ts'), 'utf8')
const vibes = [...src.matchAll(/\{ id: '(\w+)', layout: '(\w+)', style: '(\w+)', name: '([^']+)', tag: '([^']+)'/g)].map((m) => ({
  id: m[1], layout: m[2], stage: m[3], name: m[4],
  // the app source still carries a "(draft B)" note on Film Strip: not for the public site
  tag: m[5].replace(/\s*\(draft\s*\w*\)\s*$/i, '')
}))
if (!vibes.length) throw new Error('no vibes parsed')
const only = args.only ? String(args.only).split(',') : null
const list = only ? vibes.filter((v) => only.includes(v.id)) : vibes

// ---- server ----
const up = () => fetch(BASE).then((r) => r.ok).catch(() => false)
let server
if (args['start-server'] && !(await up())) {
  server = spawn('npx', ['vite', '-c', 'scripts/harness/vite.config.ts', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore', shell: true })
  for (let i = 0; i < 120 && !(await up()); i++) await new Promise((r) => setTimeout(r, 500))
}
if (!(await up())) throw new Error(`the harness is not running on ${BASE} (use --start-server, or: npx vite -c scripts/harness/vite.config.ts --port ${PORT})`)
const stopServer = () => {
  if (!server?.pid) return
  try { process.platform === 'win32' ? execFileSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }) : process.kill(server.pid) } catch { /* already gone */ }
}

mkdirSync(OUT, { recursive: true })
if (!only) for (const f of readdirSync(OUT)) rmSync(join(OUT, f))

// ---- jobs ----
const settle = 6500
const jobs = []
const shot = (name, vibe, q, w, h, scale, out) => jobs.push({ kind: 'page', name, vibe, q, w, h, scale, out })
for (const v of list) {
  const s = v.id
  shot(`${s}-full`, s, 'mode=full&video=site', 1600, 900, 1, [{ w: 1600, q: 80 }, { w: 800, q: 78, suffix: '-800' }, { w: 640, q: 72, prefix: 'tile-', noSuffix: true }])
  shot(`${s}-full-novideo`, s, 'mode=full', 1600, 900, 1, [{ w: 1600, q: 80 }])
  shot(`${s}-phone`, s, 'android=1&mode=mini', 390, 844, 2, [{ w: 780, q: 78 }])
  shot(`${s}-mini`, s, 'mode=mini', 420, 700, 2, [{ w: 840, q: 78 }])
  shot(`${s}-plain`, s, 'mode=full&video=site&ly=plain', 1280, 720, 1, [{ w: 1280, q: 76 }])
  shot(`${s}-nolyrics`, s, 'mode=full&video=site&ly=none', 1280, 720, 1, [{ w: 1280, q: 76 }])
  shot(`settings-${s}`, s, 'mode=full&panel=settings', 1280, 720, 1, [{ w: 1280, q: 76 }])
  jobs.push({ kind: 'card', name: `card-${s}`, vibe: s })
}

const browser = await chromium.launch()
const lum = {} // id -> mean luminance of the scene without video, decides the "light" flag
const save = async (buf, name, spec) => {
  let img = sharp(buf)
  const meta = await img.metadata()
  if (spec.w && spec.w < meta.width) img = img.resize({ width: spec.w, height: spec.prefix ? 360 : undefined, fit: 'cover' })
  const base = spec.prefix ? name.replace(/-full$/, '').replace(/^/, spec.prefix) : `${name}${spec.suffix ?? ''}`
  await img.webp({ quality: spec.q, effort: 5, smartSubsample: true }).toFile(join(OUT, `${base}.webp`))
}
const runOne = async (j) => {
  const ctx = await browser.newContext({ deviceScaleFactor: j.scale ?? 1, viewport: j.w ? { width: j.w, height: j.h } : { width: 600, height: 400 } })
  try {
    const p = await ctx.newPage()
    let buf
    if (j.kind === 'page') {
      const s = encodeURIComponent(JSON.stringify({ vibe: j.vibe, performance: 'smooth' }))
      await p.goto(`${BASE}/?paused=1&t=43500&${j.q}&s=${s}`)
      await p.evaluate(() => document.fonts.ready)
      // wait until every clip has a decoded frame (a slow machine otherwise shows an empty video window)
      await p.evaluate(() => Promise.all([...document.querySelectorAll('video')].map((v) => (v.readyState >= 3 ? 1 : new Promise((r) => { v.addEventListener('canplay', r, { once: true }); setTimeout(r, 8000) })))))
      await p.waitForTimeout(settle)
      buf = await p.screenshot({ type: 'png' })
      for (const spec of j.out) await save(buf, j.name, spec)
      if (j.name.endsWith('-full-novideo')) {
        const st = await sharp(buf).stats()
        const [r, g, b] = st.channels.map((c) => c.mean)
        lum[j.vibe] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
      }
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
        return t.toDataURL('image/png')
      }, { id: j.vibe, path: `/@fs/${join(root, 'src/renderer/src/lib/shareCard.ts').replace(/\\/g, '/')}` })
      await save(Buffer.from(url.split(',')[1], 'base64'), j.name, { q: 80 })
    }
  } catch (e) {
    console.error('FAILED', j.name, String(e).slice(0, 200))
    process.exitCode = 1
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

// ---- link preview image: the contact sheet cropped to 1200x630 (a jpg, because crawlers do not read WebP) ----
if (!only) {
  const page = await (await browser.newContext({ viewport: { width: 2400, height: 1200 } })).newPage()
  const tw = 480
  const th = 270
  const cells = []
  for (const v of vibes) {
    const b = await sharp(join(OUT, `${v.id}-full.webp`)).resize(tw, th).jpeg({ quality: 82 }).toBuffer()
    cells.push(`<figure style="margin:0;position:relative"><img width="${tw}" height="${th}" style="display:block;object-fit:cover" src="data:image/jpeg;base64,${b.toString('base64')}"><figcaption style="position:absolute;left:8px;bottom:6px;font:700 13px system-ui;color:#fff;text-shadow:0 1px 3px #000">${v.name}</figcaption></figure>`)
  }
  await page.setContent(`<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(5,${tw}px)">${cells.join('')}</body>`)
  await page.setViewportSize({ width: 2400, height: Math.ceil(vibes.length / 5) * th })
  const sheet = await page.screenshot({ type: 'png' })
  await sharp(sheet).resize(1200, 630, { fit: 'cover', position: 'north' }).jpeg({ quality: 84, mozjpeg: true }).toFile(join(OUT, 'og.jpg'))
}
await browser.close()
stopServer()

// ---- vibes-data.js: id/name/tag/layout/stage from the app, light/dark measured from the shots, colours and moods kept ----
const prev = {}
try {
  const ctx = { window: {} }
  vm.runInNewContext(readFileSync(DATA, 'utf8'), ctx)
  for (const v of ctx.window.LYRA_VIBES ?? []) prev[v.id] = v
} catch { /* first run */ }
const LIGHT_AT = 0.5
const out = vibes.map((v) => {
  const old = prev[v.id] ?? {}
  const light = v.id in lum ? lum[v.id] > LIGHT_AT : !!old.light
  const kinds = (old.kinds ?? []).filter((k) => k !== 'light')
  if (light) kinds.push('light')
  if (!old.acc) console.warn(`no colours for ${v.id}: add acc, c2, c3, kinds to website/vibes-data.js`)
  return { id: v.id, name: v.name, tag: v.tag, layout: v.layout, stage: v.stage, acc: old.acc ?? '#ffffff', c2: old.c2 ?? '#888888', c3: old.c3 ?? '#111111', kinds, light }
})
writeFileSync(DATA, `/* Generated by scripts/make-site-shots.mjs: id, name, tag, layout and stage from src/shared/vibes.ts, light measured from the shots; accent, support colours and moods are kept from the previous file. */\nwindow.LYRA_VIBES = ${JSON.stringify(out, null, 1)}\n`)

writeLists()
const stale = readFileSync(join(root, 'website/index.html'), 'utf8').match(/<title>[^<]*?(\d+) looks/)
if (stale && Number(stale[1]) !== out.length) console.warn(`NOTE: the static text of the pages says ${stale[1]} looks but there are ${out.length}: search the website for "${stale[1]}" (scripts/check-site.mjs lists them)`)

const files = readdirSync(OUT)
const total = files.reduce((n, f) => n + statSync(join(OUT, f)).size, 0)
console.log(`${files.length} files, ${(total / 1048576).toFixed(1)} MB; ${out.length} looks, ${out.filter((v) => v.light).length} light: ${out.filter((v) => v.light).map((v) => v.id).join(', ')}`)
if (!existsSync(join(OUT, 'og.jpg'))) console.log('(og.jpg is only rebuilt on a full run)')
