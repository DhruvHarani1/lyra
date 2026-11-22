// Automated UI checks: renders every vibe on every device size in a real browser (through the harness, with demo
// data) and fails when text is clipped or leaves the window, controls fall off-screen, lyrics collide with the card,
// the current lyric has poor contrast, touch targets are too small, or the page throws.
//
//   npm run test:ui           every vibe x every device
//   npm run test:ui:quick     a smaller matrix (used in CI)
//   node scripts/ui-test/run.mjs --vibe=neon --device=phone --shots     one corner, keep screenshots
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]))
const OUT = join(root, 'ui-test-out')
const PORT = Number(process.env.UI_PORT ?? process.env.LYRA_UI_PORT ?? 5199) // set UI_PORT when several runs happen at once
const BASE = `http://localhost:${PORT}`

// the vibe catalogue (id + default lyric style) is read from the source so the test never goes stale
const vibesSrc = readFileSync(join(root, 'src/shared/vibes.ts'), 'utf8')
const VIBES = [...vibesSrc.matchAll(/\{ id: '(\w+)', layout: '\w+', style: '(\w+)'/g)].map((m) => ({ id: m[1], style: m[2] }))
if (!VIBES.length) throw new Error('could not read the vibe list from src/shared/vibes.ts')

const DEVICES = [
  { id: 'phone', w: 390, h: 844, q: 'android=1&mode=mini', touch: true },
  { id: 'phone-small', w: 360, h: 640, q: 'android=1&mode=mini', touch: true },
  { id: 'phone-land', w: 844, h: 390, q: 'android=1&mode=mini', touch: true },
  { id: 'tablet', w: 800, h: 1280, q: 'android=1&mode=mini', touch: true },
  { id: 'tablet-land', w: 1280, h: 800, q: 'android=1&mode=mini', touch: true },
  { id: 'fold-open', w: 840, h: 920, q: 'android=1&mode=mini', touch: true },
  { id: 'win-minimal', w: 296, h: 64, q: 'mode=minimal', lyricsOptional: true },
  { id: 'win-compact', w: 380, h: 140, q: 'mode=compact', lyricsOptional: true },
  { id: 'win-mini', w: 420, h: 700, q: 'mode=mini' },
  { id: 'win-full-1080', w: 1920, h: 1080, q: 'mode=full' },
  { id: 'win-full-768', w: 1366, h: 768, q: 'mode=full' },
  { id: 'win-full-small', w: 1024, h: 600, q: 'mode=full' },
  { id: 'win-full-portrait', w: 720, h: 1100, q: 'mode=full' }
]
const QUICK = ['phone', 'tablet-land', 'win-mini', 'win-full-768', 'win-full-small']

let devices = DEVICES
if (args.quick) devices = DEVICES.filter((d) => QUICK.includes(d.id))
if (args.device) devices = DEVICES.filter((d) => String(args.device).split(',').some((x) => d.id === x || d.id.startsWith(x)))
const vibes = args.vibe ? VIBES.filter((v) => String(args.vibe).split(',').includes(v.id)) : VIBES
const withVideo = !!args.video

async function up() {
  try { return (await fetch(BASE)).ok } catch { return false }
}
let server
async function ensureServer() {
  if (await up()) return
  server = spawn('npx', ['vite', '-c', 'scripts/harness/vite.config.ts', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore', shell: process.platform === 'win32', detached: process.platform !== 'win32' })
  for (let i = 0; i < 80 && !(await up()); i++) await new Promise((r) => setTimeout(r, 500))
  if (!(await up())) throw new Error('the harness server did not start')
}

/** Everything we measure, run inside the page. Returns plain data; the Node side decides pass or fail. */
const MEASURE = () => {
  const vw = innerWidth, vh = innerHeight
  const R = (el) => el.getBoundingClientRect()
  const shown = (el) => {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') return false
    for (let n = el; n && n !== document.body; n = n.parentElement) if (parseFloat(getComputedStyle(n).opacity) < 0.05) return false
    const r = R(el)
    return r.width > 0 && r.height > 0
  }
  const box = (r) => ({ x: r.left, y: r.top, w: r.width, h: r.height })
  const label = (el) => (el.getAttribute('aria-label') || el.className?.toString?.().split(' ')[0] || el.tagName).slice(0, 40)

  // the lyric text actually on screen: the current line in a list, or the staged phrase
  const stageSel = ['.lyric.is-active .lyric__text', '.stage .kin__word.is-in', '.stage .zoom__word', '.stage .stk__word.is-in', '.stage .con__star.is-in span', '.stage .bub.is-live .bub__text span.is-in', '.stage .term__now', '.stage .diary__now', '.stage .sub__line span.is-in', '.stage .mc__row.is-live', '.stage .lt__bar p span.is-in', '.stage .sign__line > .sign__row .sign__word.is-in', '.stage .bloom__word.is-in', '.stage .termlog__word.is-in', '.stage .feed__word.is-in', '.stage .code__w.is-in']
  const textRects = []
  for (const sel of stageSel) for (const el of document.querySelectorAll(sel)) {
    if (!shown(el)) continue
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n; (n = w.nextNode()); ) {
      if (!n.textContent.trim()) continue
      const rg = document.createRange(); rg.selectNodeContents(n)
      for (const r of rg.getClientRects()) if (r.width > 1 && r.height > 1) textRects.push({ r, el })
    }
  }
  // contrast is judged on what is being sung right now (older / dimmed words are dim on purpose)
  const nowSel = ['.lyric.is-active .lyric__text', '.stage .kin__word.is-now', '.stage .zoom__word', '.stage .stk__word.is-now', '.stage .con__star.is-now span', '.stage .bub.is-live .bub__text', '.stage .term__now', '.stage .diary__now', '.stage .sub__line', '.stage .mc__row.is-live', '.stage .lt__bar p', '.stage .sign__line > .sign__row .sign__word.is-now', '.stage .bloom__word.is-now', '.stage .termlog__word.is-now', '.stage .feed__word.is-now', '.stage .code__w.is-now']
  const nowRects = []
  for (const sel of nowSel) for (const el of document.querySelectorAll(sel)) {
    if (!shown(el)) continue
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n; (n = w.nextNode()); ) {
      if (!n.textContent.trim()) continue
      const rg = document.createRange(); rg.selectNodeContents(n)
      for (const r of rg.getClientRects()) if (r.width > 1 && r.height > 1) nowRects.push(r)
    }
  }
  const union = textRects.reduce((u, { r }) => (u ? { l: Math.min(u.l, r.left), t: Math.min(u.t, r.top), r: Math.max(u.r, r.right), b: Math.max(u.b, r.bottom) } : { l: r.left, t: r.top, r: r.right, b: r.bottom }), null)

  // text cut off by an ancestor that clips (overflow hidden / clip-path / mask are intentional on the scroller, not on the active line)
  const clipped = []
  for (const { r, el } of textRects) {
    // history rows of a feed stage (lock, wallet...) fade out and slide under the stage edge on purpose; only the current row must be whole
    if (el.closest('.feed__row:not(.is-current)')) continue
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a)
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue
      const ar = R(a)
      const cut = Math.max(ar.left - r.left, r.right - ar.right, ar.top - r.top, r.bottom - ar.bottom)
      if (cut > 3) { clipped.push({ el: label(el), by: label(a), cut: Math.round(cut) }); break }
    }
  }
  const outside = textRects.filter(({ r }) => r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1).map(({ el }) => label(el))

  const controlSel = ['.playbtn', '.phone__dock', '.mini__card', '.full__side', '.progress', '.phone__bar', '.full__top', '.mini__head', '.widget', '.vstat__card']
  const controls = []
  for (const sel of controlSel) for (const el of document.querySelectorAll(sel)) if (shown(el)) controls.push({ sel, r: R(el) })
  const offscreen = controls.filter(({ r }) => r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1).map(({ sel }) => sel)

  const overlaps = []
  if (union) for (const c of controls) {
    if (c.sel === '.full__top' || c.sel === '.mini__head' || c.sel === '.phone__bar' || c.sel === '.widget') continue
    const ix = Math.min(union.r, c.r.right) - Math.max(union.l, c.r.left)
    const iy = Math.min(union.b, c.r.bottom) - Math.max(union.t, c.r.top)
    if (ix > 4 && iy > 4) overlaps.push({ with: c.sel, px: Math.round(Math.min(ix, iy)) })
  }

  // the active line must not touch its neighbours
  const lineClash = []
  const active = document.querySelector('.lyric.is-active .lyric__text')
  if (active && shown(active)) {
    const ar = R(active)
    for (const el of document.querySelectorAll('.lyric:not(.is-active) .lyric__text')) {
      if (!shown(el)) continue
      const r = R(el)
      const iy = Math.min(ar.bottom, r.bottom) - Math.max(ar.top, r.top)
      const ix = Math.min(ar.right, r.right) - Math.max(ar.left, r.left)
      if (iy > 2 && ix > 2) lineClash.push(Math.round(iy))
    }
  }

  // touch targets and tiny text
  const touch = document.documentElement.dataset.platform === 'android'
  const smallTargets = []
  if (touch) for (const el of document.querySelectorAll('.ibtn, .playbtn, .phone__act, .stabs button, .pill, .switch, .seg button')) {
    if (!shown(el)) continue
    const r = R(el)
    if (Math.min(r.width, r.height) < (el.classList.contains('switch') ? 30 : 36)) smallTargets.push({ el: label(el), w: Math.round(r.width), h: Math.round(r.height) })
  }
  const tinyText = []
  const w2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n; (n = w2.nextNode()); ) {
    const el = n.parentElement
    if (!n.textContent.trim() || !el || el.closest('[aria-hidden="true"], .vibefx, script, style, .lfb__poster, svg')) continue
    const fs = parseFloat(getComputedStyle(el).fontSize)
    if (fs < 10 && shown(el)) tinyText.push({ el: label(el), fs })
  }

  return {
    vw, vh,
    hscroll: document.documentElement.scrollWidth - vw,
    hasText: textRects.length,
    textBox: union ? { l: union.l, t: union.t, r: union.r, b: union.b } : null,
    nowRects: nowRects.slice(0, 60).map((r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom })),
    textRects: textRects.slice(0, 80).map(({ r }) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom })),
    clipped, outside: [...new Set(outside)], offscreen: [...new Set(offscreen)], overlaps, lineClash, smallTargets, tinyText
  }
}

/** Contrast of the lyric text against what is behind it, measured on the real pixels of a screenshot. */
const CONTRAST = async ({ png, rects }) => {
  const img = new Image(); img.src = png; await img.decode()
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0)
  const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const med = (a) => { a.sort((p, q) => p - q); return a[a.length >> 1] }
  const results = []
  const clampX = (v) => Math.max(0, Math.min(img.width - 1, Math.round(v)))
  const clampY = (v) => Math.max(0, Math.min(img.height - 1, Math.round(v)))
  for (const r of rects) {
    const x0 = clampX(r.l), y0 = clampY(r.t), x1 = clampX(r.r), y1 = clampY(r.b)
    const w = x1 - x0, h = y1 - y0
    if (w < 4 || h < 4) continue
    const pad = 6
    const ox = clampX(x0 - pad), oy = clampY(y0 - pad), ow = Math.min(img.width - ox, w + pad * 2), oh = Math.min(img.height - oy, h + pad * 2)
    const data = x.getImageData(ox, oy, ow, oh).data
    const inside = [], ring = []
    for (let j = 0; j < oh; j++) for (let i = 0; i < ow; i++) {
      const k = (j * ow + i) * 4
      const L = lum(data[k], data[k + 1], data[k + 2])
      const gx = ox + i, gy = oy + j
      ;(gx >= x0 && gx <= x1 && gy >= y0 && gy <= y1 ? inside : ring).push(L)
    }
    if (!ring.length || !inside.length) continue
    // ink vs what is right behind the letters, both measured INSIDE the text box (so a label / highlighter behind the
    // text counts as the background, and a glow outside the text does not distort it)
    inside.sort((p, q) => p - q)
    const at = (f) => inside[Math.min(inside.length - 1, Math.floor(inside.length * f))]
    const light = (at(0.92) + 0.05) / (at(0.3) + 0.05) // light ink on a darker ground
    const dark = (at(0.7) + 0.05) / (at(0.08) + 0.05) // dark ink on a lighter ground
    results.push(Math.max(light, dark))
  }
  return results.length ? results.reduce((a, b) => a + b, 0) / results.length : null
}

function verdict(d, m, contrast) {
  const f = []
  if (m.hscroll > 1) f.push(`page scrolls sideways by ${m.hscroll}px`)
  if (!d.lyricsOptional && m.hasText === 0) f.push('no lyric text on screen')
  if (m.clipped.length) f.push(`text clipped: ${m.clipped.slice(0, 2).map((c) => `${c.el} by ${c.by} (${c.cut}px)`).join('; ')}`)
  if (m.outside.length) f.push(`text outside the window: ${m.outside.slice(0, 2).join(', ')}`)
  if (m.offscreen.length) f.push(`controls outside the window: ${m.offscreen.join(', ')}`)
  if (m.overlaps.length) f.push(`lyrics overlap ${m.overlaps.map((o) => `${o.with} (${o.px}px)`).join(', ')}`)
  if (m.lineClash.length) f.push(`lyric lines collide (${m.lineClash[0]}px)`)
  if (m.smallTargets.length) f.push(`touch targets under 36px: ${m.smallTargets.slice(0, 3).map((t) => `${t.el} ${t.w}x${t.h}`).join(', ')}`)
  if (m.tinyText.length) f.push(`text under 10px: ${m.tinyText.slice(0, 2).map((t) => `${t.el} ${t.fs}px`).join(', ')}`)
  if (contrast !== null && contrast < 3) f.push(`lyric contrast ${contrast.toFixed(2)}:1 (needs 3:1)`)
  return f
}

async function main() {
  await ensureServer()
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(join(OUT, 'shots'), { recursive: true })
  const browser = await chromium.launch()
  const jobs = []
  if (args.states) {
    // the lyrics outcomes (words without timing, no lyrics, offline) on the main devices, with and without a video
    const key = devices.filter((d) => ['phone', 'tablet-land', 'win-full-768', 'win-mini'].includes(d.id))
    for (const v of vibes) for (const d of key) for (const ly of ['plain', 'none', 'offline']) jobs.push({ v, d: { ...d, id: `${d.id}+${ly}`, q: `${d.q}&ly=${ly}`, lyricsOptional: true, state: ly } })
  } else for (const v of vibes) for (const d of devices) jobs.push({ v, d })
  const results = []
  let next = 0
  const worker = async () => {
    const ctx = await browser.newContext({ deviceScaleFactor: 1 })
    for (;;) {
      const i = next++
      if (i >= jobs.length) break
      const { v, d, extra, vibeId } = jobs[i]
      const page = await ctx.newPage()
      await page.setViewportSize({ width: d.w, height: d.h })
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)))
      const s = encodeURIComponent(JSON.stringify({ vibe: vibeId ?? v.id, lyricStyle: v.style, performance: 'smooth', ...(extra ?? {}) }))
      await page.goto(`${BASE}/?paused=1&t=43500&${d.q}${withVideo ? '&video=night' : ''}&s=${s}`)
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(2800)
      const m = await page.evaluate(MEASURE)
      const shot = await page.screenshot()
      let contrast = null
      const cr = m.nowRects.length ? m.nowRects : m.textRects
      if (cr.length) contrast = await page.evaluate(CONTRAST, { png: 'data:image/png;base64,' + shot.toString('base64'), rects: cr })
      const fails = verdict(d, m, contrast)
      if (d.state) {
        // no synced lyrics: the screen must still say something useful (the words, or why there are none), never an empty hole
        const said = await page.evaluate(() => document.body.innerText.trim().length)
        if (said < 12) fails.push(`empty screen in the "${d.state}" lyrics state`)
        if (d.state === 'plain' && !(await page.evaluate(() => !!document.querySelector('.plain__stanza')))) fails.push('plain lyrics are not shown')
      }
      if (errors.length) fails.unshift(`page error: ${errors[0]}`)
      const name = `${v.id}__${d.id}`
      if (fails.length || args.shots) writeFileSync(join(OUT, 'shots', `${fails.length ? 'FAIL_' : ''}${name}.png`), shot)
      results.push({ vibe: v.id, device: d.id, fails, contrast: contrast === null ? null : Number(contrast.toFixed(2)) })
      await page.close()
    }
    await ctx.close()
  }
  await Promise.all(Array.from({ length: Number(args.workers) || 4 }, worker))
  await browser.close()
  try { if (server) process.kill(process.platform === 'win32' ? server.pid : -server.pid) } catch {}

  results.sort((a, b) => (a.vibe + a.device).localeCompare(b.vibe + b.device))
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(results, null, 2))
  const bad = results.filter((r) => r.fails.length)
  console.log(`\nUI test: ${results.length} screens checked${` (${vibes.length} vibes x ${devices.length} devices)`}, ${bad.length} with problems\n`)
  for (const r of bad) console.log(`  ✗ ${r.vibe} @ ${r.device}\n      ${r.fails.join('\n      ')}`)
  if (!bad.length) console.log('  ✓ all screens pass')
  console.log(`\nreport + failing screenshots: ${OUT}`)
  process.exit(bad.length ? 1 : 0)
}
main().catch((e) => { console.error(e); try { if (server) process.kill(process.platform === 'win32' ? server.pid : -server.pid) } catch {}; process.exit(2) })
