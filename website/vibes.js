/* Gallery page: filterable grid of every look, hover previews, and a spotlight dialog with palette, states and a phone shot. */
const VIBES = window.LYRA_VIBES || []
document.querySelectorAll('[data-looks]').forEach((el) => { el.textContent = VIBES.length })
const $ = (s, r = document) => r.querySelector(s)
const img = (name) => `assets/shots/${name}.webp`
// full-screen shots come in two widths
const fullSrcset = (id) => `${img(`${id}-full-800`)} 800w, ${img(`${id}-full`)} 1600w`
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const KIND_LABEL = { night: 'Night glow', handmade: 'Hand-made', motion: 'Motion graphics', retro: 'Retro & games', screen: 'Film & screen', ui: 'Phone & app UI', light: 'Light' }
const STAGE_LABEL = {
  classic: 'Classic', kinetic: 'Kinetic', constellation: 'Constellation', log: 'Log', sticker: 'Stickers', chat: 'Chat bubbles', note: 'Handwriting', jot: 'Ink + highlighter',
  scrawl: 'Marker', pixel: 'Pixel', subtitle: 'Subtitles', bloom: 'Bloom', chatlog: 'Chat log', lowerthird: 'Lower third', label: 'Label strips', title: 'Title cards',
  ink: 'Ink', glitch: 'Glitch', bubble: 'Speech bubbles', spray: 'Spray paint', intertitle: 'Intertitles', sign: 'Neon sign', liquid: 'Liquid metal',
  lockscreen: 'Notifications', wallet: 'Payments', route: 'Map pins', editor: 'Code', metro: 'Transit line', weave: 'Web', picto: 'Icons', wall: '3D wall', flap: 'Split-flap'
}
const matches = (v, f, q) => (f === 'all' || v.kinds.includes(f)) && (!q || `${v.name} ${v.tag} ${STAGE_LABEL[v.stage] || v.stage}`.toLowerCase().includes(q))

/* ---------- marquee of names ---------- */
const mq = $('#marquee')
if (mq) { const row = VIBES.map((v) => `<span style="--c:${v.acc}">${esc(v.name)}</span>`).join(''); mq.innerHTML = row + row }

/* ---------- grid ---------- */
const grid = $('#vg'), status = $('#status'), empty = $('#empty'), qEl = $('#q')
let filter = 'all', query = ''
const chips = [...document.querySelectorAll('#filters button')]
chips.forEach((b) => { const n = VIBES.filter((v) => matches(v, b.dataset.f, '')).length; b.querySelector('i').textContent = n })

const card = (v, i) => `<article class="pgx__card" data-id="${v.id}" style="--vc:${v.acc};--c2:${v.c2};--i:${i}">
  <div class="pgx__shot"><img loading="lazy" decoding="async" width="800" height="450" src="${img(v.id + '-full-800')}" alt="${esc(v.name)} look, full screen with video and synced lyrics" />
    <img class="pgx__phone" loading="lazy" decoding="async" width="780" height="1688" src="${img(v.id + '-phone')}" alt="" aria-hidden="true" /></div>
  <div class="pgx__meta"><span class="pgx__n">${String(VIBES.indexOf(v) + 1).padStart(2, '0')}</span><b><a class="pgx__open" href="#${v.id}" aria-label="${esc(v.name)}: ${esc(v.tag)}">${esc(v.name)}</a></b><small>${esc(v.tag)}</small>
    <span class="pgx__pal" aria-hidden="true"><i style="background:${v.acc}"></i><i style="background:${v.c2}"></i><i style="background:${v.c3}"></i></span></div>
</article>`

const draw = () => {
  const list = VIBES.filter((v) => matches(v, filter, query))
  grid.innerHTML = list.map(card).join('')
  empty.hidden = list.length > 0
  status.textContent = list.length === VIBES.length ? `Showing all ${VIBES.length} looks` : `Showing ${list.length} of ${VIBES.length} looks`
}
draw()

$('#filters').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return
  filter = b.dataset.f
  chips.forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', x === b) })
  const go = () => draw()
  document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches ? document.startViewTransition(go) : go()
})
qEl.addEventListener('input', () => { query = qEl.value.trim().toLowerCase(); draw() })

/* pointer glow + tilt on each card */
if (fine) grid.addEventListener('pointermove', (e) => {
  const c = e.target.closest('.pgx__card'); if (!c || e.pointerType === 'touch') return
  const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
  c.style.setProperty('--mx', `${x * 100}%`); c.style.setProperty('--my', `${y * 100}%`)
  c.style.setProperty('--rx', `${(0.5 - y) * 5}deg`); c.style.setProperty('--ry', `${(x - 0.5) * 6}deg`)
})
if (fine) grid.addEventListener('pointerout', (e) => { const c = e.target.closest('.pgx__card'); if (c && !c.contains(e.relatedTarget)) { c.style.removeProperty('--rx'); c.style.removeProperty('--ry') } })

/* ---------- spotlight dialog ---------- */
const dlg = $('#dlg'), inn = $('#dlg-in')
let cur = -1, opener = null
const STATES = [['-full', 'Synced, with video'], ['-plain', 'Words without timing'], ['-nolyrics', 'No lyrics found'], ['-full-novideo', 'No video']]
const fig = (v, suffix, cap) => `<figure><img loading="lazy" decoding="async" width="1280" height="720" src="${img(v.id + suffix)}" alt="${esc(v.name)}: ${esc(cap)}" /><figcaption>${cap}</figcaption></figure>`
const swatch = (hex, label) => `<button class="pgx__sw" data-hex="${hex}" style="--sw:${hex}" title="Copy ${hex}"><i></i><span>${label}</span><code>${hex}</code></button>`

const meta = (sel, attr, val) => { const el = document.querySelector(sel); if (el) el.setAttribute(attr, val) }
const BASE_TITLE = document.title
const BASE = { desc: document.querySelector('meta[name=description]')?.content || '', ogTitle: document.querySelector('meta[property="og:title"]')?.content || '', ogDesc: document.querySelector('meta[property="og:description"]')?.content || '', url: document.querySelector('link[rel=canonical]')?.href || location.href }
// v = a look, or null to put the page back
const setMeta = (v) => {
  const title = v ? `${v.name} · a Lyra look` : BASE_TITLE
  const desc = v ? `${v.name}: ${v.tag}. See this Lyra look full screen, on a phone, and with no lyrics or no video.` : BASE.desc
  const url = v ? `${BASE.url}#${v.id}` : BASE.url
  document.title = title
  meta('meta[name=description]', 'content', desc)
  meta('meta[property="og:title"]', 'content', v ? title : BASE.ogTitle); meta('meta[name="twitter:title"]', 'content', v ? title : BASE.ogTitle)
  meta('meta[property="og:description"]', 'content', v ? desc : BASE.ogDesc); meta('meta[name="twitter:description"]', 'content', v ? desc : BASE.ogDesc)
  meta('meta[property="og:url"]', 'content', url)
}
const render = (i) => {
  const v = VIBES[i], prev = VIBES[(i + VIBES.length - 1) % VIBES.length], next = VIBES[(i + 1) % VIBES.length]
  cur = i
  dlg.style.setProperty('--vc', v.acc); dlg.style.setProperty('--c2', v.c2)
  document.documentElement.style.setProperty('--acc', v.acc)
  inn.innerHTML = `
  <div class="pgx__top">
    <button class="pgx__nav" data-go="-1" aria-label="Previous look: ${esc(prev.name)}"><span aria-hidden="true">←</span> ${esc(prev.name)}</button>
    <span class="mono">${String(i + 1).padStart(2, '0')} / ${VIBES.length}</span>
    <button class="pgx__nav" data-go="1" aria-label="Next look: ${esc(next.name)}">${esc(next.name)} <span aria-hidden="true">→</span></button>
    <button class="pgx__x" id="dlg-x" aria-label="Close">×</button>
  </div>
  <div class="pgx__hero2">
    <div class="pgx__title">
      <p class="mono">${v.kinds.map((k) => KIND_LABEL[k]).join(' · ')}</p>
      <h2 id="dlg-title">${esc(v.name)}</h2>
      <p class="lead">${esc(v.tag)}</p>
      <dl class="pgx__facts"><div><dt>Lyric style</dt><dd>${esc(STAGE_LABEL[v.stage] || v.stage)}</dd></div><div><dt>Layout</dt><dd>${v.layout === 'scene' ? 'Scene: its own screen' : 'Side card'}</dd></div></dl>
      <div class="pgx__pals">${swatch(v.acc, 'Accent')}${swatch(v.c2, 'Support')}${swatch(v.c3, 'Ground')}</div>
      <p class="pgx__copied mono" id="copied" aria-live="polite"></p>
      <div class="pgx__cta"><a class="btn btn--acc" href="./#download">Get Lyra</a><a class="btn btn--ghost" href="#${v.id}" data-copy-link>Copy link to this look</a></div>
    </div>
    <figure class="pgx__main-shot"><img src="${img(v.id + '-full')}" srcset="${fullSrcset(v.id)}" sizes="(max-width: 900px) 94vw, 640px" width="1600" height="900" alt="${esc(v.name)}, full screen with video and synced lyrics" /></figure>
  </div>
  <div class="pgx__states">
    <figure class="pgx__ph"><img loading="lazy" src="${img(v.id + '-phone')}" width="780" height="1688" alt="${esc(v.name)} on an Android phone" /><figcaption>On a phone</figcaption></figure>
    ${STATES.slice(1).map(([s, c]) => fig(v, s, c)).join('')}
  </div>`
  setMeta(v)
  $('#dlg-x').focus({ preventScroll: true })
  dlg.scrollTop = 0
}
const open = (i, from) => {
  opener = from || opener
  const go = () => { render(i); if (!dlg.open) dlg.showModal(); document.body.style.overflow = 'hidden'; history.replaceState(null, '', `#${VIBES[i].id}`) }
  document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches ? document.startViewTransition(go) : go()
}
const close = () => { if (dlg.open) dlg.close() }
dlg.addEventListener('close', () => { setMeta(null); document.body.style.overflow = ''; history.replaceState(null, '', location.pathname + location.search); if (opener && document.contains(opener)) opener.focus({ preventScroll: true }) })
dlg.addEventListener('click', (e) => {
  if (e.target === dlg) return close()
  if (e.target.closest('#dlg-x')) return close()
  const n = e.target.closest('[data-go]'); if (n) return open((cur + Number(n.dataset.go) + VIBES.length) % VIBES.length)
  const sw = e.target.closest('.pgx__sw')
  if (sw) { navigator.clipboard?.writeText(sw.dataset.hex).catch(() => {}); $('#copied').textContent = `Copied ${sw.dataset.hex}` }
  const cl = e.target.closest('[data-copy-link]')
  if (cl) { e.preventDefault(); navigator.clipboard?.writeText(location.href).catch(() => {}); $('#copied').textContent = 'Link copied' }
})
dlg.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') open((cur + 1) % VIBES.length)
  if (e.key === 'ArrowLeft') open((cur + VIBES.length - 1) % VIBES.length)
})
const idx = (el) => VIBES.findIndex((v) => v.id === el.dataset.id)
grid.addEventListener('click', (e) => { const c = e.target.closest('.pgx__card'); if (c) { e.preventDefault(); open(idx(c), c.querySelector('.pgx__open')) } })
document.addEventListener('error', (e) => { if (e.target.tagName === 'IMG') { const f = e.target.closest('.pgx__states figure'); (f || e.target).style.display = 'none' } }, true)
const fromHash = () => { const id = location.hash.slice(1), i = VIBES.findIndex((v) => v.id === id); if (i >= 0) open(i) }
fromHash(); addEventListener('hashchange', () => { if (!dlg.open) fromHash() })
