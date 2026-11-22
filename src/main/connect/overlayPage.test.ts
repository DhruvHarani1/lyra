import { describe, expect, it } from 'vitest'
import { buildManifest } from './pwa'
import { OVERLAY_CORE_JS, OVERLAY_HTML } from './overlayPage'

// the overlay's runtime logic is plain JS in a string (the page has no build step); run it here to test it
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const core = new Function(
  OVERLAY_CORE_JS + '; return { LOOKS, LOOK_NAMES, lookFor, cleanColor, cleanFont, parseOptions, resolveLook, estimate, activeIndex, windowRange, wordProgress, positionAt, emptyFeed, emptyClock, clockAdd, clockOffset, pingDelay, backoff, applyHost, parseCreds }'
)() as {
  LOOKS: Record<string, string>
  LOOK_NAMES: string[]
  lookFor: (v: unknown) => string
  parseOptions: (s: string, hash?: string) => any
  parseCreds: (hash: string) => { id: string; token: string } | null
  resolveLook: (o: unknown, appVibe: string | null) => string
  estimate: (ls: { timeMs: number; text: string }[], dur: number) => any[]
  activeIndex: (lines: unknown[], p: number) => number
  windowRange: (idx: number, count: number, total: number) => number[]
  wordProgress: (w: unknown, p: number) => number
  positionAt: (feed: unknown, now: number, nudge: number) => number
  emptyFeed: () => any
  emptyClock: () => any
  clockAdd: (clock: unknown, c0: number, s1: number, s2: number, c3: number) => boolean
  clockOffset: (clock: unknown) => number
  pingDelay: (n: number) => number
  backoff: (attempt: number, rand: number) => number
  applyHost: (feed: any, m: unknown) => boolean
}

describe('vibe -> look mapping', () => {
  it('covers every vibe id with a known look', () => {
    const ids = ['none', 'sticker', 'chat', 'crt', 'neon', 'chrome', 'dream', 'paper', 'journal', 'arcade', 'noir', 'sunset', 'blocks', 'stadium', 'cassette', 'trailer', 'sketch', 'glitch', 'comic', 'stencil', 'film', 'filmstrip', 'lock', 'wallet', 'route', 'editor', 'metro', 'web', 'lens', 'picto', 'wall', 'flap']
    for (const id of ids) expect(core.LOOK_NAMES).toContain(core.lookFor(id))
    expect(Object.keys(core.LOOKS).sort()).toEqual([...ids].sort())
  })
  it('falls back to classic for unknown ids, ignoring case', () => {
    expect(core.lookFor('nope')).toBe('classic')
    expect(core.lookFor('')).toBe('classic')
    expect(core.lookFor('NEON')).toBe('neon')
    expect(core.lookFor('constructor')).toBe('classic')
  })
})

describe('parseOptions', () => {
  it('has sane defaults', () => {
    const o = core.parseOptions('')
    expect(o).toMatchObject({ vibe: 'app', lines: 3, mode: 'stack', size: 64, scale: 1, bg: '', pos: 'bottom', align: 'center', shadow: true, words: true, meta: false })
  })
  it('reads chroma colours with or without #, rejects junk', () => {
    expect(core.parseOptions('?chroma=00ff00').bg).toBe('#00ff00')
    expect(core.parseOptions('?bg=%23F0F').bg).toBe('#f0f')
    expect(core.parseOptions('?bg=magenta').bg).toBe('magenta')
    expect(core.parseOptions('?bg=transparent').bg).toBe('')
    expect(core.parseOptions('?bg=red;}body{display:none').bg).toBe('')
    expect(core.parseOptions('?bg=url(x)').bg).toBe('')
  })
  it('clamps numbers and switches to single mode for one line', () => {
    expect(core.parseOptions('?size=9999').size).toBe(400)
    expect(core.parseOptions('?size=-3').size).toBe(12)
    expect(core.parseOptions('?size=abc').size).toBe(64)
    expect(core.parseOptions('?lines=1').mode).toBe('single')
    expect(core.parseOptions('?lines=99').lines).toBe(9)
    expect(core.parseOptions('?lines=1&mode=stack').mode).toBe('stack')
  })
  it('cleans fonts and booleans', () => {
    expect(core.parseOptions('?font=' + encodeURIComponent('Segoe UI; background:url(x)')).font).toBe('Segoe UI backgroundurlx')
    expect(core.parseOptions('?shadow=0').shadow).toBe(false)
    expect(core.parseOptions('?words=off').words).toBe(false)
    expect(core.parseOptions('?meta=1').meta).toBe(true)
  })
  it('reads options from the fragment too, after the credentials, without leaking d/t into them', () => {
    const o = core.parseOptions('?size=80', '#d=aabbccdd&t=' + 'f'.repeat(64) + '&lines=1&size=999&vibe=neon')
    expect(o).toMatchObject({ size: 80, lines: 1, mode: 'single', vibe: 'neon' }) // the query wins over the fragment
    expect(o).not.toHaveProperty('k')
    expect(JSON.stringify(o)).not.toContain('ffffffff')
  })
  it('parses only a well-formed credential from the fragment', () => {
    const t = 'ab'.repeat(32)
    expect(core.parseCreds('#d=0123456789abcdef&t=' + t)).toEqual({ id: '0123456789abcdef', token: t })
    expect(core.parseCreds('#t=' + t)).toBeNull()
    expect(core.parseCreds('#d=zz&t=' + t)).toBeNull()
    expect(core.parseCreds('#d=0123456789abcdef&t=short')).toBeNull()
    expect(core.parseCreds('')).toBeNull()
  })
  it('resolves the look: look= beats vibe= beats the app vibe', () => {
    expect(core.resolveLook(core.parseOptions('?look=glitch&vibe=neon'), 'crt')).toBe('glitch')
    expect(core.resolveLook(core.parseOptions('?vibe=neon'), 'crt')).toBe('neon')
    expect(core.resolveLook(core.parseOptions(''), 'crt')).toBe('terminal')
    expect(core.resolveLook(core.parseOptions(''), null)).toBe('classic')
    expect(core.resolveLook(core.parseOptions('?look=bogus'), 'noir')).toBe('subtitle')
  })
})

describe('timing', () => {
  const ls = [
    { timeMs: 1000, text: 'Hello there world' },
    { timeMs: 5000, text: 'Second line' },
    { timeMs: 9000, text: '' }
  ]
  it('finds the active line', () => {
    const lines = core.estimate(ls, 20000)
    expect(core.activeIndex(lines, 0)).toBe(-1)
    expect(core.activeIndex(lines, 1000)).toBe(0)
    expect(core.activeIndex(lines, 4999)).toBe(0)
    expect(core.activeIndex(lines, 5000)).toBe(1)
    expect(core.activeIndex(lines, 99999)).toBe(2)
    expect(core.activeIndex([], 5)).toBe(-1)
  })
  it('spreads word timing inside the line window', () => {
    const lines = core.estimate(ls, 20000)
    const w = lines[0].words
    expect(w.map((x: { w: string }) => x.w)).toEqual(['Hello', 'there', 'world'])
    expect(w[0].from).toBe(1000)
    expect(w[2].to).toBeLessThanOrEqual(1000 + 7000 + 1)
    expect(w[1].from).toBeCloseTo(w[0].to, 5)
    expect(lines[2].words).toEqual([])
  })
  it('word progress is clamped', () => {
    const w = { w: 'a', from: 100, to: 200 }
    expect(core.wordProgress(w, 50)).toBe(0)
    expect(core.wordProgress(w, 150)).toBe(0.5)
    expect(core.wordProgress(w, 999)).toBe(1)
  })
  it('keeps a window of lines around the active one', () => {
    expect(core.windowRange(-1, 3, 10)).toEqual([0, 3])
    expect(core.windowRange(0, 3, 10)).toEqual([0, 3])
    expect(core.windowRange(4, 3, 10)).toEqual([3, 6])
    expect(core.windowRange(9, 3, 10)).toEqual([7, 10])
    expect(core.windowRange(4, 1, 10)).toEqual([4, 5])
    expect(core.windowRange(2, 5, 3)).toEqual([0, 3])
    expect(core.windowRange(0, 3, 0)).toEqual([0, 0])
  })
})

describe('feed from Connect messages', () => {
  const now = (id: string, extra = {}) => ({ t: 'now', now: { id, key: 'k', title: 'T', artists: ['A', 'B'], durationMs: 1000, ...extra } })
  it('extrapolates the position with the host clock offset while playing', () => {
    const feed = core.emptyFeed()
    core.applyHost(feed, now('a'))
    core.applyHost(feed, { t: 'play', play: { playing: true, positionMs: 2000, at: 10_000 } })
    feed.positionClock.skewMs = 9500 // host = local + 9500
    expect(core.positionAt(feed, 1500, 0)).toBe(2000 + (1500 + 9500 - 10_000))
    expect(core.positionAt(feed, 1500, -5000)).toBe(0)
    core.applyHost(feed, { t: 'play', play: { playing: false, positionMs: 2000, at: 10_000 } })
    expect(core.positionAt(feed, 5000, 100)).toBe(2100)
  })
  it('estimates the clock offset NTP style and trusts the lowest round trip', () => {
    const clock = core.emptyClock()
    expect(core.clockOffset(clock)).toBe(0)
    // true offset +500: c0=1000 -> host rx at 1500+d, answer, client rx at 1000+2d+... ; a slow sample is skewed
    expect(core.clockAdd(clock, 1000, 1510, 1511, 1021)).toBe(true) // rtt 20, offset 500
    expect(core.clockAdd(clock, 2000, 2700, 2701, 2400)).toBe(true) // rtt 399, offset 500.5 + noise
    expect(core.clockOffset(clock)).toBeCloseTo(500, 0)
    expect(core.clockAdd(clock, 5000, 5000, 5000, 4000)).toBe(false) // negative rtt rejected
    expect(core.clockAdd(clock, 0, 0, 0, 20_000)).toBe(false) // over 10 s rejected
    for (let i = 0; i < 20; i++) core.clockAdd(clock, 0, 0, 0, 5)
    expect(clock.samples.length).toBe(8)
  })
  it('follows the cadence and backoff of the protocol', () => {
    expect([core.pingDelay(0), core.pingDelay(6), core.pingDelay(12)]).toEqual([150, 1000, 10000])
    expect(core.backoff(0, 0.5)).toBe(500)
    expect(core.backoff(20, 0.5)).toBe(15000)
  })
  it('reports song changes, joins artists, and clears lyrics on a new song or silence', () => {
    const feed = core.emptyFeed()
    expect(core.applyHost(feed, now('a'))).toBe(true)
    expect(core.applyHost(feed, now('a'))).toBe(false)
    expect(feed.nowPlaying.artists).toBe('A, B')
    expect(feed.nowPlaying.artUrl).toBeNull()
    core.applyHost(feed, { t: 'view', view: { vibe: 'neon', video: { id: null }, offsetMs: 120 } })
    expect(feed.vibe).toBe('neon')
    expect(feed.lyricOffsetMs).toBe(120)
    core.applyHost(feed, { t: 'lyrics', id: 'a', status: 'synced', synced: true, lines: [{ t: 1, x: 'x' }] })
    expect(feed.lyrics).toEqual({ status: 'synced', lines: [{ timeMs: 1, text: 'x' }] })
    expect(core.applyHost(feed, now('b'))).toBe(true)
    expect(feed.lyrics).toEqual({ status: 'loading', lines: [] })
    expect(core.applyHost(feed, { t: 'now', now: null })).toBe(true)
    expect(feed.nowPlaying).toBeNull()
  })
  it('ignores lyrics and art for a song that is no longer playing, and plain lyrics', () => {
    const feed = core.emptyFeed()
    core.applyHost(feed, now('b'))
    core.applyHost(feed, { t: 'lyrics', id: 'a', status: 'synced', synced: true, lines: [{ t: 1, x: 'late' }] })
    core.applyHost(feed, { t: 'art', id: 'a', src: 'https://x/a.jpg' })
    expect(feed.lyrics.status).toBe('loading')
    expect(feed.nowPlaying.artUrl).toBeNull()
    core.applyHost(feed, { t: 'art', id: 'b', src: 'https://x/b.jpg' })
    expect(feed.nowPlaying.artUrl).toBe('https://x/b.jpg')
    core.applyHost(feed, { t: 'lyrics', id: 'b', status: 'plain', synced: false, lines: [{ t: 0, x: 'plain' }] })
    expect(feed.lyrics).toEqual({ status: 'none', lines: [] })
  })
})

describe('pages', () => {
  it('the overlay is transparent by default, loads nothing external, and talks only over the Connect socket', () => {
    expect(OVERLAY_HTML).toContain('background: transparent')
    expect(OVERLAY_HTML).not.toMatch(/https?:\/\//)
    expect(OVERLAY_HTML).toContain("'ws://' + location.host + '/ws'")
    expect(OVERLAY_HTML).toContain("t: 'hello'")
    expect(OVERLAY_HTML).toContain('lyraHmac')
    expect(OVERLAY_HTML).not.toContain('/events')
    expect(OVERLAY_HTML).not.toContain('EventSource')
    expect(OVERLAY_HTML).not.toContain('fetch(')
  })
  it('never sends the token and never sends commands', () => {
    expect(OVERLAY_HTML).not.toContain("t: 'cmd'")
    expect(OVERLAY_HTML).not.toContain("t: 'pair'")
    // the credential is only ever fed into the HMAC, never into a message field
    expect(OVERLAY_HTML).not.toMatch(/token:\s*cred\.token/)
  })
  it('the manifest is static, holds no secret, and is installable', () => {
    const m = buildManifest({ iconSize: 512 }) as { start_url: string; scope: string; display: string; icons: { sizes: string; src: string }[] }
    expect(m.start_url).toBe('/')
    expect(m.scope).toBe('/')
    expect(m.display).toBe('standalone')
    expect(m.icons[0]).toMatchObject({ sizes: '512x512', src: '/icon.png' })
    expect(buildManifest({ iconSize: 0 }).icons).toEqual([])
    expect(JSON.stringify(m)).not.toMatch(/\?k=|token/)
  })
})
