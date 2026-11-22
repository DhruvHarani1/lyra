/* Lyra website: hero, looks wall + showcase, state story, rails, release links. Uses REPO and reduce from demo.js. */
const BASE_VIBES = window.LYRA_VIBES || []
// looks added after the first site build (they only have a full-screen screenshot): merged in so every look is on the page
const EXTRA = [
  { id: 'filmstrip', name: 'Film Strip', tag: 'The film advances frame by frame', layout: 'scene', stage: 'intertitle', acc: '#e0b36a', light: false },
  { id: 'lock', name: 'Lock Screen', tag: 'Each line arrives as a notification', layout: 'scene', stage: 'lockscreen', acc: '#b58cff', light: false },
  { id: 'wallet', name: 'Wallet', tag: 'Every line is a payment', layout: 'scene', stage: 'wallet', acc: '#35e08a', light: false },
  { id: 'route', name: 'Route', tag: 'The lyrics are a route on a map', layout: 'scene', stage: 'route', acc: '#4aa3ff', light: false },
  { id: 'editor', name: 'Editor', tag: 'The song as code', layout: 'scene', stage: 'editor', acc: '#3b9cff', light: false },
  { id: 'metro', name: 'Metro', tag: 'A line map, one stop per word', layout: 'scene', stage: 'metro', acc: '#ff3b6b', light: false },
  { id: 'web', name: 'Web', tag: 'Words hang in a spider web', layout: 'scene', stage: 'weave', acc: '#9aa8ff', light: false },
  { id: 'lens', name: 'Lens', tag: 'A glass lens magnifies the line', layout: 'scene', stage: 'label', acc: '#5ff0c4', light: false },
  { id: 'picto', name: 'Picto', tag: 'Words turn into pictograms', layout: 'scene', stage: 'picto', acc: '#ff7a59', light: false },
  { id: 'wall', name: 'Drift Wall', tag: 'Words land on a wall that drifts in 3D', layout: 'scene', stage: 'wall', acc: '#ffa23b', light: false },
  { id: 'flap', name: 'Split-flap', tag: 'An airport board flips each word', layout: 'scene', stage: 'flap', acc: '#ffd23b', light: false },
  { id: 'journal', name: 'Journal', tag: 'A ruled page, a taped polaroid, marker highlights', layout: 'scene', stage: 'jot', acc: '#e0556d', light: true },
  { id: 'doodle', name: 'Doodle', tag: 'Fat marker, bright shapes, scribbles that draw themselves', layout: 'scene', stage: 'scrawl', acc: '#ff5f7e', light: true },
]
const VIBES = [...BASE_VIBES, ...EXTRA.filter((x) => !BASE_VIBES.some((b) => b.id === x.id))]
// looks that only have a full-screen screenshot (no phone / mini / no-video shots); the Diary was redesigned, so its old extra shots are retired
const FULL_ONLY = new Set(['paper', ...EXTRA.map((x) => x.id)])
const HAS_CARD = new Set(BASE_VIBES.map((v) => v.id))
const shot = (name) => `assets/shots/${name}.jpg`
const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]
const rootStyle = document.documentElement.style
const setAccent = (v) => rootStyle.setProperty('--acc', v.acc)
const vibeById = (id) => VIBES.find((v) => v.id === id) || VIBES[0]
const fine = matchMedia('(pointer: fine)').matches
document.documentElement.classList.add('js')
// when a screenshot is missing the layout must not collapse
document.addEventListener('error', (e) => { if (e.target.tagName === 'IMG') e.target.style.visibility = 'hidden' }, true)
// swap an <img> only once the new picture is ready, so there is never a blank flash
const swapImg = (el, src, alt) => {
  if (!el) return
  const im = new Image()
  im.onload = () => { el.src = src; if (alt !== undefined) el.alt = alt; el.style.visibility = ''; el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap') }
  im.src = src
}

/* ---------- scroll progress, nav state, mobile menu ---------- */
{
  const prog = $('#prog')
  const links = $$('.nv nav a[href^="#"]')
  const secs = $$('main > section[id]')
  let ticking = false
  const onScroll = () => {
    ticking = false
    const h = document.documentElement
    prog.style.transform = `scaleX(${Math.min(1, scrollY / Math.max(1, h.scrollHeight - innerHeight))})`
    h.style.setProperty('--sy', Math.min(1, scrollY / innerHeight).toFixed(3))
    let cur = null
    secs.forEach((el) => { if (el.getBoundingClientRect().top < innerHeight * 0.4) cur = el.id })
    links.forEach((a) => (a.getAttribute('href') === `#${cur}` ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')))
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll) } }, { passive: true })
  onScroll()
  const burger = $('#burger'), mnav = $('#mnav')
  const close = () => { mnav.hidden = true; burger.setAttribute('aria-expanded', 'false'); document.body.classList.remove('menu') }
  burger.addEventListener('click', () => { const open = mnav.hidden; mnav.hidden = !open; burger.setAttribute('aria-expanded', String(open)); document.body.classList.toggle('menu', open) })
  mnav.addEventListener('click', (e) => { if (e.target.closest('a')) close() })
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close() })
  addEventListener('resize', () => { if (innerWidth > 980) close() })
}

/* ---------- headings: the words rise in one by one ---------- */
if (!reduce) {
  $$('.sx__head h2, .wallx__head h2').forEach((h) => {
    const label = h.textContent.replace(/\s+/g, ' ').trim()
    const walk = (node) => {
      ;[...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment()
          n.textContent.split(/(\s+)/).forEach((t) => {
            if (!t) return
            if (!t.trim()) { frag.append(' '); return }
            const o = document.createElement('span'); o.className = 'sw'; o.setAttribute('aria-hidden', 'true')
            const i = document.createElement('span'); i.textContent = t; o.append(i); frag.append(o)
          })
          n.replaceWith(frag)
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n)
      })
    }
    walk(h)
    h.setAttribute('aria-label', label)
    h.classList.add('hsplit')
    $$('.sw > span', h).forEach((s, i) => s.style.setProperty('--i', i))
  })
}

/* ---------- reveal ---------- */
{
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }), { threshold: 0.1 })
  $$('.reveal, h2.hsplit').forEach((el, i) => { if (!el.matches('h2')) el.style.transitionDelay = `${(i % 4) * 70}ms`; io.observe(el) })
}

/* ---------- cursor spotlight, magnetic buttons, glow that follows the pointer on cards ---------- */
if (!reduce && fine) {
  const spot = $('#spot')
  let raf = 0, x = 0, y = 0
  addEventListener('pointermove', (e) => {
    x = e.clientX; y = e.clientY
    spot.classList.add('on')
    if (!raf) raf = requestAnimationFrame(() => { spot.style.transform = `translate(${x}px, ${y}px)`; raf = 0 })
  }, { passive: true })
  $$('.btn--big, .btn--acc, .shuf').forEach((b) => {
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect()
      b.style.setProperty('--mx', `${((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1)}px`)
      b.style.setProperty('--my', `${((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1)}px`)
    })
    b.addEventListener('pointerleave', () => { b.style.setProperty('--mx', '0px'); b.style.setProperty('--my', '0px') })
  })
  $$('.bc, .vcard, .dl__card, .stats > div').forEach((c) => {
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect()
      c.style.setProperty('--px', `${e.clientX - r.left}px`); c.style.setProperty('--py', `${e.clientY - r.top}px`)
    })
  })
}

/* ---------- hero: words light up one by one, then the looks rotate ---------- */
const HERO = VIBES.filter((v) => v.id !== 'none' && !FULL_ONLY.has(v.id))
{
  const words = $$('#hero-h1 .w')
  let i = 0
  const lightUp = () => {
    words.forEach((w, k) => w.classList.toggle('on', k <= i))
    i = (i + 1) % (words.length + 3)
    if (i === 0) words.forEach((w) => w.classList.remove('on'))
  }
  lightUp()
  if (reduce) words.forEach((w) => w.classList.add('on'))
  else setInterval(lightUp, 520)

  let cur = Math.max(0, HERO.findIndex((v) => v.id === 'neon'))
  const apply = (v) => {
    setAccent(v)
    swapImg($('#hx-full'), shot(`${v.id}-full`), `Lyra fullscreen in the ${v.name} look`)
    swapImg($('#hx-phone'), shot(`${v.id}-phone`)); swapImg($('#hx-mini'), shot(`${v.id}-mini`))
    const withCard = HERO.filter((x) => HAS_CARD.has(x.id))
    const a = withCard[(cur + 5) % withCard.length], b = withCard[(cur + 11) % withCard.length]
    swapImg($('#hx-card-a'), shot(`card-${a.id}`)); swapImg($('#hx-card-b'), shot(`card-${b.id}`))
    $('#hx-name').textContent = v.name
  }
  const next = () => { cur = (cur + 1) % HERO.length; apply(HERO[cur]) }
  let timer = 0
  const arm = () => { clearInterval(timer); if (!reduce) timer = setInterval(next, 4200) }
  $('#hx-next').addEventListener('click', () => { next(); arm() })
  // do not rotate while the hero is off screen
  new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? arm() : clearInterval(timer))), { threshold: 0.1 }).observe($('.hx'))
  // hero devices follow the pointer
  if (!reduce && fine) {
    const stage = $('#hx-stage')
    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5
      $('.tilt', stage).style.transform = `rotateY(${px * 8}deg) rotateX(${-py * 6}deg)`
      $('.dev--phone', stage).style.transform = `translate(${px * -26}px, ${py * -14}px)`
      $('.dev--mini', stage).style.transform = `translate(${px * 30}px, ${py * -18}px)`
      stage.style.setProperty('--gx', `${(px + 0.5) * 100}%`); stage.style.setProperty('--gy', `${(py + 0.5) * 100}%`)
    })
    stage.addEventListener('pointerleave', () => $$('.dev', stage).forEach((d) => (d.style.transform = '')))
  }
}

/* ---------- two tickers of look names, running in opposite directions ---------- */
{
  const half = Math.ceil(VIBES.length / 2)
  const fill = (el, list) => { const h = list.map((v) => `<span>${v.name}</span>`).join(''); el.innerHTML = h + h }
  fill($('#tick'), VIBES.slice(0, half)); fill($('#tick2'), VIBES.slice(half))
}

/* ---------- the wall: every look as a screenshot, three tilted rows drifting past ---------- */
{
  const stage = $('#wall-stage')
  const rows = [0, 1, 2].map((r) => VIBES.filter((_, i) => i % 3 === r))
  stage.innerHTML = rows.map((row, r) => {
    const tiles = row.map((v) => `<button type="button" class="wt" data-id="${v.id}" style="--glow:${v.acc}" aria-label="Open the ${v.name} look"><img loading="lazy" decoding="async" src="${shot(`wall-${v.id}`)}" alt="" width="640" height="360" /><span>${v.name}</span></button>`).join('')
    return `<div class="wallx__row${r === 1 ? ' is-rev' : ''}"><div class="wallx__track">${tiles}${tiles}</div></div>`
  }).join('')
  stage.addEventListener('click', (e) => {
    const b = e.target.closest('.wt'); if (!b) return
    window.lyraShow && window.lyraShow(b.dataset.id)
    $('.show').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  })
}

/* ---------- count-up ---------- */
{
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return
    io.unobserve(e.target)
    const to = Number(e.target.dataset.count)
    if (reduce) return
    const t0 = performance.now()
    const f = (t) => { const k = Math.min(1, (t - t0) / 1400); e.target.textContent = Math.round(to * (1 - Math.pow(1 - k, 4))); if (k < 1) requestAnimationFrame(f) }
    requestAnimationFrame(f)
  }), { threshold: 0.6 })
  $$('[data-count]').forEach((n) => { if (!reduce) n.textContent = '0'; io.observe(n) })
}

/* ---------- the looks showcase ---------- */
{
  const list = $('#show-list'), canvas = $('#show-canvas'), img = $('#show-img')
  const S = { id: 'neon', dev: 'full', vid: 1 }
  const swatch = (v) => (FULL_ONLY.has(v.id) ? `background-image:url(${shot(`wall-${v.id}`)})` : `background-image:url(${shot(`${v.id}-phone`)})`)
  list.innerHTML = VIBES.map((v) => `<button type="button" class="vbtn" aria-pressed="false" data-id="${v.id}"><i style="--sw:${v.acc};${swatch(v)}"></i><span><b>${v.name}</b><small>${v.tag}</small></span></button>`).join('')
  const render = (scroll) => {
    const v = vibeById(S.id)
    const only = FULL_ONLY.has(v.id)
    if (only && S.dev !== 'full') { S.dev = 'full'; $$('#seg-dev button').forEach((x) => x.classList.toggle('is-on', x.dataset.dev === 'full')) }
    setAccent(v)
    const name = S.dev === 'full' ? `${v.id}-full${only || S.vid ? '' : '-novideo'}` : `${v.id}-${S.dev}`
    canvas.dataset.dev = S.dev
    swapImg(img, shot(name), `${v.name} look, ${S.dev === 'full' ? 'full screen' : S.dev}`)
    $('#show-name').textContent = v.name
    $('#show-tag').textContent = v.tag
    $('#show-tags').innerHTML = [`Layout: ${v.layout}`, `Lyric style: ${v.stage}`, v.light ? 'Light, inked' : 'Dark'].map((t) => `<span>${t}</span>`).join('')
    $$('.vbtn', list).forEach((b) => { const on = b.dataset.id === S.id; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)) })
    $('#seg-vid').style.display = S.dev === 'full' && !only ? '' : 'none'
    $('#seg-dev').style.display = only ? 'none' : ''
    if (scroll) { const b = $(`.vbtn[data-id="${S.id}"]`, list); if (b && list.scrollHeight > list.clientHeight + 4 && getComputedStyle(list).position === 'sticky') list.scrollTo({ top: b.offsetTop - list.clientHeight / 2 + b.offsetHeight / 2, behavior: 'smooth' }) }
  }
  window.lyraShow = (id) => { S.id = id; render(true) }
  list.addEventListener('click', (e) => { const b = e.target.closest('.vbtn'); if (b) { S.id = b.dataset.id; render(false) } })
  $('#seg-dev').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; S.dev = b.dataset.dev; $$('#seg-dev button').forEach((x) => x.classList.toggle('is-on', x === b)); render() })
  $('#seg-vid').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; S.vid = Number(b.dataset.vid); $$('#seg-vid button').forEach((x) => x.classList.toggle('is-on', x === b)); render() })
  $('#show-shuffle').addEventListener('click', () => { let n; do { n = VIBES[Math.floor(Math.random() * VIBES.length)].id } while (n === S.id); S.id = n; render(true) })
  addEventListener('keydown', (e) => {
    if (!['ArrowDown', 'ArrowUp'].includes(e.key) || e.target.closest('input, textarea, video, select')) return
    const r = canvas.getBoundingClientRect()
    if (r.bottom < 0 || r.top > innerHeight) return
    const i = VIBES.findIndex((v) => v.id === S.id)
    S.id = VIBES[(i + (e.key === 'ArrowDown' ? 1 : -1) + VIBES.length) % VIBES.length].id
    e.preventDefault(); render(true)
  })
  // the screenshot tilts a little towards the pointer
  if (!reduce && fine) {
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect()
      canvas.style.setProperty('--rx', `${(((e.clientY - r.top) / r.height - 0.5) * -3).toFixed(2)}deg`)
      canvas.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width - 0.5) * 4).toFixed(2)}deg`)
    })
    canvas.addEventListener('pointerleave', () => { canvas.style.setProperty('--rx', '0deg'); canvas.style.setProperty('--ry', '0deg') })
  }
  render()
}

/* ---------- the four states (sticky story) ---------- */
{
  const steps = $$('.story__step'), a = $('#story-img'), b = $('#story-img2'), count = $('#story-count'), dots = $$('.story__bar i')
  const vibe = 'sketch'
  let front = a, back = b
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return
    const k = steps.indexOf(e.target)
    steps.forEach((x) => x.classList.toggle('is-on', x === e.target))
    dots.forEach((d, j) => d.classList.toggle('is-on', j <= k))
    count.textContent = `0${k + 1} / 04`
    const src = shot(`${vibe}-${e.target.dataset.s}`)
    const im = new Image()
    im.onload = () => { back.src = src; back.style.visibility = ''; back.classList.add('is-front'); front.classList.remove('is-front'); [front, back] = [back, front] }
    im.src = src
    setAccent(vibeById(vibe))
  }), { rootMargin: '-45% 0px -45% 0px' })
  steps.forEach((s) => io.observe(s))
  a.classList.add('is-front')
}

/* ---------- rails ---------- */
{
  const cards = VIBES.filter((v) => HAS_CARD.has(v.id))
  const sets = VIBES.filter((v) => HAS_CARD.has(v.id) && v.id !== 'paper')
  const item = (kind, v) => `<figure class="rail__item" style="--glow:${v.acc}"><img loading="lazy" decoding="async" src="${shot(`${kind}-${v.id}`)}" alt="${kind === 'card' ? 'Share card' : 'Settings panel'}, ${v.name} look" /><figcaption>${v.name}</figcaption></figure>`
  $('#rail-cards').innerHTML = cards.map((v) => item('card', v)).join('')
  $('#rail-settings').innerHTML = sets.map((v) => item('settings', v)).join('')
  // drag to scroll with the mouse
  $$('.rail').forEach((r) => {
    let down = false, sx = 0, sl = 0
    r.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = true; sx = e.clientX; sl = r.scrollLeft; r.style.scrollSnapType = 'none' })
    addEventListener('pointerup', () => { if (down) { down = false; r.style.scrollSnapType = '' } })
    addEventListener('pointermove', (e) => { if (down) r.scrollLeft = sl - (e.clientX - sx) })
  })
}

/* ---------- downloads: newest Windows and Android releases from GitHub ---------- */
if (/android/i.test(navigator.userAgent)) {
  const w = $('#cta-win'), a = $('#cta-and')
  a.classList.add('btn--acc'); a.classList.remove('btn--ghost'); w.classList.remove('btn--acc'); w.classList.add('btn--ghost')
  a.parentElement.prepend(a)
}
;(async () => {
  try {
    const rs = await (await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`)).json()
    const pick = (re, ext) => {
      const r = rs.find((x) => !x.draft && re.test(x.tag_name) && x.assets.some((a) => a.name.endsWith(ext)))
      return r && { v: r.tag_name.replace(/^\D+/, ''), url: r.assets.find((a) => a.name.endsWith(ext)).browser_download_url, size: r.assets.find((a) => a.name.endsWith(ext)).size }
    }
    const win = pick(/^v\d/, '.exe'), and = pick(/^android-v/, '.apk')
    const mb = (n) => `${(n / 1048576).toFixed(0)} MB`
    if (win) {
      $('#dl-win').href = win.url; $('#cta-win').href = win.url
      $('#dl-win-v').textContent = `Version ${win.v} · ${mb(win.size)} · Windows 10 / 11`
      $('#v-win').textContent = `Windows ${win.v}`
    }
    if (and) {
      $('#dl-and').href = and.url; $('#cta-and').href = and.url
      $('#dl-and-v').textContent = `Version ${and.v} · ${mb(and.size)} · Android 8+`
      $('#v-and').textContent = `Android ${and.v}`
    }
  } catch { /* offline or rate limited: the buttons keep pointing at the releases page */ }
})()

/* ---------- reel: recordings of the real app ---------- */
{
  const v = $('#reel-video')
  const tabs = $$('#reel-tabs button')
  tabs.forEach((x) => x.setAttribute('aria-pressed', String(x.classList.contains('is-on'))))
  $('#reel-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button')
    if (!b) return
    const k = b.dataset.clip
    tabs.forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', String(x === b)) })
    $('#reel-box').classList.toggle('is-tall', k === 'widget')
    b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
    v.poster = `assets/poster-${k}.jpg`
    v.src = `assets/clip-${k}.mp4`
    v.play().catch(() => {})
  })
  new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause())), { threshold: 0.25 }).observe(v)
  const song = $('#song-video')
  new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting && !song.paused) song.pause() }), { threshold: 0.1 }).observe(song)
}

/* ---------- Vega: newest release links ---------- */
;(async () => {
  try {
    const rs = await (await fetch('https://api.github.com/repos/DhruvHarani1/vega/releases?per_page=10')).json()
    const r = rs.find((x) => !x.draft && x.assets.some((a) => a.name.endsWith('.exe')))
    if (!r) return
    const exe = r.assets.find((a) => a.name.endsWith('.exe')), apk = r.assets.find((a) => a.name.endsWith('.apk'))
    const mb = (n) => `${(n / 1048576).toFixed(0)} MB`
    const v = r.tag_name.replace(/^\D+/, '')
    $('#vega-win').href = exe.browser_download_url
    $('#vega-win').textContent = `Download for Windows · ${v}`
    if (apk) { $('#vega-and').href = apk.browser_download_url; $('#vega-and').textContent = `Download for Android · ${v}` }
    $('#vega-meta').textContent = `Version ${v} · Windows ${mb(exe.size)}${apk ? ` · Android ${mb(apk.size)}` : ''} · free and open source`
  } catch { /* keep the releases page links */ }
})()
