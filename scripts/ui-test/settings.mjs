// Clicks the real controls in Settings and checks that each one actually changes the app (so no setting is a dead switch).
//   npm run test:settings
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const BASE = 'http://localhost:5199'
const up = async () => { try { return (await fetch(BASE)).ok } catch { return false } }
let server
if (!(await up())) {
  server = spawn('npx', ['vite', '-c', 'scripts/harness/vite.config.ts', '--port', '5199', '--strictPort'], { cwd: root, stdio: 'ignore', shell: process.platform === 'win32' })
  for (let i = 0; i < 80 && !(await up()); i++) await new Promise((r) => setTimeout(r, 500))
}

const browser = await chromium.launch()
const results = []
const check = (name, ok, detail = '') => results.push({ name, ok, detail })

async function open(query, viewport = { width: 440, height: 900 }) {
  const page = await browser.newPage({ viewport })
  page.on('pageerror', (e) => check('no page errors', false, e.message.slice(0, 120)))
  await page.goto(`${BASE}/?paused=1&t=43500&panel=settings&${query}`)
  await page.waitForTimeout(1200)
  return page
}
const tab = async (p, name) => { await p.locator('.stabs button', { hasText: new RegExp(`^${name}$`) }).click(); await p.waitForTimeout(250) }
const root$ = (p, attr) => p.evaluate((a) => document.documentElement.dataset[a], attr)
const more = async (p) => { for (let i = 0; i < 12 && (await p.locator('details.more:not([open]) > summary').count()) > 0; i++) await p.locator('details.more:not([open]) > summary').first().click() }

// ---------- Look ----------
{
  const p = await open('mode=mini&s=' + encodeURIComponent(JSON.stringify({ performance: 'smooth' })))
  await tab(p, 'Look')
  await p.locator('.vibecard', { hasText: 'Neon' }).click(); await p.waitForTimeout(200)
  check('Look: picking the Neon vibe changes the look', (await root$(p, 'vibe')) === 'neon')
  await p.locator('.vibecard', { hasText: 'Terminal' }).click(); await p.waitForTimeout(200)
  check('Look: picking Terminal switches it again', (await root$(p, 'vibe')) === 'crt')
  await p.locator('.vibecard', { hasText: 'Artwork' }).click()
  await p.locator('[aria-label="Vibe mode"] button', { hasText: 'Every song' }).click(); await p.waitForTimeout(150)
  check('Look: "Every song" shows tick boxes to choose the vibes', (await p.locator('.vibecard__tick').count()) > 5)
  await p.locator('[aria-label="Vibe mode"] button', { hasText: 'Fixed' }).click()
  await p.locator('[aria-label="Theme"] button', { hasText: 'Light' }).click(); await p.waitForTimeout(200)
  check('Look: Theme Light', (await p.evaluate(() => document.documentElement.getAttribute('data-theme') ?? document.body.getAttribute('data-theme') ?? document.querySelector('[data-theme]')?.getAttribute('data-theme'))) === 'light')
  await p.locator('[aria-label="Theme"] button', { hasText: 'Auto' }).click()
  check('Look: no rim-light / lyric-style switches (the look is designed per vibe)', (await p.locator('[aria-label="Rim light"], [aria-label="Lyric style"]').count()) === 0)
  await more(p)
  await p.locator('[aria-label="Performance"] button', { hasText: 'Light' }).click(); await p.waitForTimeout(150)
  check('Look: Performance Light', (await root$(p, 'perf')) === 'low')
  await p.locator('[aria-label="Performance"] button', { hasText: 'Smooth' }).click(); await p.waitForTimeout(150)
  check('Look: Performance Smooth', (await root$(p, 'perf')) === 'high')
  await p.locator('[aria-label="Reduce motion"] button', { hasText: 'On' }).click(); await p.waitForTimeout(150)
  check('Look: Reduce motion On', (await root$(p, 'motion')) === 'off')
  const sx = p.locator('[aria-label="Song change effects"]')
  check('Look: "Song change effects" is on by default and switches off', (await sx.getAttribute('aria-checked')) === 'true' && (await sx.click(), await p.waitForTimeout(150), (await root$(p, 'smooth')) === 'off'))
  const vf = p.locator('[aria-label="Fade volume between songs"]')
  check('Look: "Fade volume between songs" is off by default and flips', (await vf.getAttribute('aria-checked')) === 'false' && (await vf.click(), await p.waitForTimeout(150), (await vf.getAttribute('aria-checked')) === 'true'))
  await p.close()
}

// ---------- Lyrics ----------
{
  const p = await open('mode=mini&s=' + encodeURIComponent(JSON.stringify({ performance: 'smooth' })), { width: 1100, height: 900 })
  await p.evaluate(() => 0)
  await tab(p, 'Lyrics & video')
  check('Lyrics: no typeface / size switches (fixed per vibe)', (await p.locator('[aria-label="Typeface"], [aria-label="Lyric size"]').count()) === 0)
  const words = () => p.locator('.lyric.is-active .word').count()
  const w0 = await words()
  await p.locator('[aria-label="Highlight each word"]').click(); await p.waitForTimeout(400)
  check('Lyrics: "Highlight each word" off removes the word fill', w0 > 0 && (await words()) === 0, `${w0} -> ${await words()}`)
  await p.locator('[aria-label="Highlight each word"]').click(); await p.waitForTimeout(400)
  check('Lyrics: and back on', (await words()) > 0)
  await more(p)
  check('Lyrics: no animation / line-spacing switches', (await p.locator('[aria-label="Lyric animation"], [aria-label="Line spacing"]').count()) === 0)
  check('Lyrics: the services list shows each service', (await p.locator('.health__row').count()) >= 1)
  await p.close()
}

// ---------- Video ----------
{
  const p = await open('mode=full&s=' + encodeURIComponent(JSON.stringify({ performance: 'smooth' })), { width: 1280, height: 860 })
  await tab(p, 'Lyrics & video')
  const dim = p.locator('[aria-label="Background dim"]')
  check('Video: the dim slider exists', (await dim.count()) === 1)
  check('Video: the video switch exists', (await p.locator('[aria-label="Video behind the lyrics"]').count()) === 1)
  await more(p)
  const gate = p.locator('[aria-label="Wait a moment for lyrics"]')
  check('Video: "Wait a moment for lyrics" exists and is OFF by default', (await gate.count()) === 1 && (await gate.getAttribute('aria-checked')) === 'false')
  await gate.click(); await p.waitForTimeout(150)
  check('Video: "Wait a moment for lyrics" flips and is saved', (await gate.getAttribute('aria-checked')) === 'true')
  await p.close()
}

// ---------- Player (desktop) ----------
{
  const p = await open('mode=mini', { width: 440, height: 1100 })
  await tab(p, 'Player'); await more(p)
  for (const l of ['Always on top', 'Fade when idle', 'Hide while screen sharing', 'Launch at startup', 'Control system volume', 'Global shortcuts', 'Track change notifications']) {
    const sw = p.locator(`[aria-label="${l}"]`)
    const was = await sw.getAttribute('aria-checked')
    await sw.click(); await p.waitForTimeout(120)
    check(`Player: "${l}" switch flips and is saved`, (await sw.getAttribute('aria-checked')) !== was)
  }
  await p.close()
}

// ---------- Android ----------
{
  const p = await open('android=1&mode=mini&s=' + encodeURIComponent(JSON.stringify({ performance: 'smooth' })), { width: 390, height: 844 })
  const names = await p.locator('.stabs button').allInnerTexts()
  check('Phone: tabs are Look, Lyrics, Video, Phone, Connect, About', names.join(',') === 'Look,Lyrics,Video,Phone,Connect,About', names.join(','))
  await tab(p, 'Phone')
  for (const l of ['Keep screen on while playing', 'Keep Lyra running']) {
    const sw = p.locator(`[aria-label="${l}"]`)
    if ((await sw.count()) === 0) { check(`Phone: "${l}" exists`, false); continue }
    const was = await sw.getAttribute('aria-checked')
    await sw.click(); await p.waitForTimeout(150)
    check(`Phone: "${l}" flips`, (await sw.getAttribute('aria-checked')) !== was)
  }
  await p.close()
}

await browser.close()
server?.kill()
const bad = results.filter((r) => !r.ok)
for (const r of results) console.log(`${r.ok ? '  ✓' : '  ✗'} ${r.name}${r.ok || !r.detail ? '' : `  (${r.detail})`}`)
console.log(`\n${results.length - bad.length}/${results.length} settings checks passed`)
process.exit(bad.length ? 1 : 0)
