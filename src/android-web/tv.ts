/**
 * The TV side of the shared page (`?tv=1`, data-platform="tv"): a remote-control layer on top of the same renderer.
 * It adds no player of its own. It
 *  - turns D-pad / OK / media keys into player actions and focus moves (rules in tvNav.ts),
 *  - shows a tiny HUD (hints, seek / pause feedback) that lives outside React,
 *  - shows the one-time setup screen: pair with Lyra on a computer (type the 8-character code from its Devices panel with
 *    the remote; the computer is found by mDNS or its address is typed), or listen to this TV's own
 *    media session (needs notification access, which many TVs hide from Settings; the screen says how to grant it).
 * Styling is in styles/tv.css.
 */
import { cycleVibe } from '@/hooks/useVibe'
import { getPosition, usePlayer } from '@/store/player'
import { useUi } from '@/store/ui'
import { decide, nativeKey, pickNext, remoteKey, type Dir, type RemoteKey } from './tvNav'

/** a Lyra host found on the network (mDNS `_lyra-connect._tcp`) */
export interface TvComputer {
  name: string
  host: string
  port: number
}

export interface TvState {
  /** 'local': mirror a media session on this TV; 'paired': follow a Lyra app on a computer (Lyra Connect, docs/connect-protocol.md) */
  mode: 'local' | 'paired'
  hasAccess: boolean
  canOpenAccessSettings: boolean
  /** connected to the computer right now */
  paired: boolean
  /** state of the link to the computer */
  link: 'idle' | 'waiting' | 'connected' | 'lost'
  /** this TV holds a token for a computer (it may be offline at the moment) */
  saved: boolean
  /** name of that computer, "" before it was seen */
  hostName: string
  /** 'viewer' | 'controller': what the computer allows this TV to do */
  role: string
  /** why the link is down (wrong code, computer forgot this TV, ...), shown on the pairing screen */
  error: string | null
  /** computers found on the network */
  hosts: TvComputer[]
  defaultPort: number
  deviceName: string
  /** adb command that grants notification access when the TV has no Settings screen for it */
  adb: string
}

export interface TvHost {
  rpc<T = unknown>(method: string, ...args: unknown[]): Promise<T>
  /** leave the app (Back from the home screen) */
  exit(): void
  /** harness only: show the setup screen whatever the state */
  forceSetup?: boolean
}

declare global {
  interface Window {
    /** the activity calls this for keys the WebView never sees as DOM events (media keys, Menu) */
    __lyraTv?: { key(name: string): void }
  }
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

/** true while the player chrome is on screen (it fades away after a few idle seconds) */
const controlsShown = (): boolean => !document.querySelector('.full.is-idle')
const wake = (): void => void window.dispatchEvent(new Event('mousemove')) // the renderer's idle timer listens for this

const visible = (e: HTMLElement): boolean => {
  const r = e.getBoundingClientRect()
  if (r.width < 4 || r.height < 4) return false
  const cs = getComputedStyle(e)
  return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.pointerEvents !== 'none'
}

interface Focusable {
  node: HTMLElement
  x: number
  y: number
  w: number
  h: number
}

function focusables(root: ParentNode): Focusable[] {
  const out: Focusable[] = []
  root.querySelectorAll<HTMLElement>('button:not([disabled]), [role="slider"], [data-tvfocus]').forEach((node) => {
    if (!visible(node)) return
    const r = node.getBoundingClientRect()
    out.push({ node, x: r.left, y: r.top, w: r.width, h: r.height })
  })
  return out
}

function moveFocus(root: ParentNode, dir: Dir): boolean {
  const all = focusables(root)
  const cur = document.activeElement as HTMLElement | null
  const from = all.find((f) => f.node === cur) ?? null
  if (!from) {
    const play = all.find((f) => /play|pause/i.test(f.node.getAttribute('aria-label') ?? '')) ?? pickNext(all, null, dir)
    play?.node.focus()
    return !!play
  }
  const next = pickNext(all, from, dir)
  next?.node.focus()
  return !!next
}

// ---------------------------------------------------------------- HUD (hints + feedback)

function makeHud(): { say(text: string): void } {
  const hud = el('div', 'tvhud')
  const say = el('div', 'tvhud__say')
  say.setAttribute('role', 'status')
  const hints = el('div', 'tvhud__hints')
  for (const [k, t] of [['◀ ▶', 'Seek 10 s'], ['▲ ▼', 'Change look'], ['OK', 'Play / pause'], ['☰', 'Set up']] as const) {
    const h = el('span', 'tvhud__hint')
    h.append(el('b', undefined, k), document.createTextNode(` ${t}`))
    hints.append(h)
  }
  hud.append(say, hints)
  document.body.append(hud)
  // the key hints are for the first moments only; after that they would sit on top of the lyrics
  hud.classList.add('is-hints')
  setTimeout(() => hud.classList.remove('is-hints'), 10_000)
  let timer: ReturnType<typeof setTimeout> | undefined
  return {
    say(text) {
      say.textContent = text
      say.classList.add('is-on')
      clearTimeout(timer)
      timer = setTimeout(() => say.classList.remove('is-on'), 1400)
    }
  }
}

// ---------------------------------------------------------------- setup screen

interface Setup {
  open(): void
  close(): void
  isOpen(): boolean
  /** a key while the screen is open; returns true when handled */
  key(k: RemoteKey): boolean
}

function makeSetup(host: TvHost, onClosed: () => void): Setup {
  let root: HTMLElement | null = null
  let state: TvState | null = null
  let poll: ReturnType<typeof setInterval> | undefined
  let renderedFor = ''
  // the pairing form lives here, not in the DOM, so a redraw (the screen refreshes when the link changes) never loses it
  let entry = '' // code characters typed so far (0-9 A-Z without I L O U)
  let addr = '' // typed address of the computer ("192.168.1.20" or "192.168.1.20:47813")
  let manual = false // type the address even though computers were found
  let picked = '' // "host:port" of the chosen found computer
  let repair = false // pair with another computer although one is already paired
  let notice = '' // a local message ("the code has 8 characters")

  const KEYS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford base32: what the host's codes are made of (docs/connect-protocol.md)
  const ADDRESS_KEYS = '0123456789.:'
  const hostKey = (h: TvComputer): string => `${h.host}:${h.port}`

  const sig = (s: TvState): string => JSON.stringify([s.mode, s.hasAccess, s.paired, s.link, s.saved, s.hostName, s.role, s.error, s.hosts.map(hostKey), s.canOpenAccessSettings])

  const button = (label: string, run: () => void, primary = false): HTMLButtonElement => {
    const b = el('button', `tvsetup__btn${primary ? ' is-primary' : ''}`, label)
    b.type = 'button'
    b.dataset.tvfocus = '1'
    b.addEventListener('click', run)
    return b
  }

  // a TV that holds a token is set up even while its computer is off: it reconnects by itself
  const needsSetup = (s: TvState): boolean => (s.mode === 'local' && !s.hasAccess) || (s.mode === 'paired' && !s.saved)

  async function choose(mode: TvState['mode']): Promise<void> {
    repair = false
    await host.rpc('tvSetMode', mode)
    await refresh(true)
  }

  /** One remote-friendly key: big, centred, a plain focusable button. */
  const key = (label: string, run: () => void, height = 76): HTMLButtonElement => {
    const b = button(label, run)
    b.style.cssText = `text-align:center;padding:0;min-height:calc(${height} * var(--u))`
    return b
  }

  function keypad(chars: string, cols: number, press: (c: string) => void, backspace: () => void, deleteLabel: string, height = 76): HTMLElement {
    const pad = el('div', 'tvsetup__keys')
    pad.style.cssText = `display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:calc(10 * var(--u));width:100%`
    for (const c of chars) pad.append(key(c, () => press(c), height))
    pad.append(key(deleteLabel, backspace, height))
    return pad
  }

  const redraw = (): void => void (state && render(state))

  /** where to connect: the picked / only found computer, or the typed address */
  function target(s: TvState): { host: string; port: number } | null {
    if (!manual && s.hosts.length) {
      const h = s.hosts.find((x) => hostKey(x) === picked) ?? s.hosts[0]!
      return { host: h.host, port: h.port }
    }
    const m = /^([A-Za-z0-9][A-Za-z0-9.-]*)(?::(\d{1,5}))?$/.exec(addr.trim())
    return m ? { host: m[1]!, port: m[2] ? Number(m[2]) : s.defaultPort } : null
  }

  async function connect(s: TvState): Promise<void> {
    const t = target(s)
    if (entry.length !== 8) notice = 'The code has 8 characters, like ABCD-EFGH.'
    else if (!t) notice = 'Choose your computer, or type the address Lyra shows in Devices.'
    else {
      notice = ''
      const r = await host.rpc<{ ok: boolean; message: string | null }>('tvPair', entry, t.host, t.port).catch(() => ({ ok: false, message: 'Could not start pairing.' }))
      if (r.ok) {
        entry = ''
        repair = false
      } else notice = r.message ?? 'Could not start pairing.'
    }
    await refresh(true)
  }

  /** Paired already: say with whom, and offer to pair with another computer or forget this one. */
  function linkedView(s: TvState): HTMLElement {
    const text = el('div', 'tvsetup__how')
    text.append(
      el('p', 'tvsetup__step', `Paired with “${s.hostName || 'your computer'}”.`),
      el('p', 'tvsetup__status', s.paired ? 'Connected. Start a song in Lyra on the computer.' : (s.error ?? 'Looking for the computer on your network…'))
    )
    if (s.paired) {
      text.append(el('p', 'tvsetup__step', s.role === 'controller' ? 'The remote can play, pause and skip on the computer.' : 'This TV only shows the lyrics. To control the computer with this remote, make it a controller in Lyra, Devices.'))
    }
    text.append(
      button('Pair with another computer', () => {
        repair = true
        redraw()
      }),
      button('Forget this computer', () => void host.rpc('tvForget').then(() => refresh(true)))
    )
    return text
  }

  /** Not paired: ask for the code the computer shows (Lyra, Devices, Add a device), typed with the remote. */
  function formView(s: TvState): HTMLElement {
    const text = el('div', 'tvsetup__how')
    text.style.cssText = 'width:100%;gap:calc(10 * var(--u))'
    text.append(el('p', 'tvsetup__step', 'On your computer open Lyra, then Devices, and add a device. Type the code it shows with the remote:'))

    const typing = manual || s.hosts.length === 0
    const where = el('div')
    where.style.cssText = 'display:flex;flex-wrap:wrap;gap:calc(12 * var(--u));align-items:center'
    if (typing) {
      const shown = el('p', 'tvsetup__step', addr ? `Computer: ${addr}` : 'Computer: type its address (Lyra, Devices shows it)')
      shown.style.margin = '0'
      where.append(shown)
    } else {
      for (const h of s.hosts) {
        const b = button(`${h.name || h.host} (${h.host})`, () => {
          picked = hostKey(h)
          redraw()
        })
        b.classList.toggle('is-current', (picked || hostKey(s.hosts[0]!)) === hostKey(h))
        b.style.minHeight = 'calc(64 * var(--u))'
        b.style.padding = 'calc(12 * var(--u)) calc(24 * var(--u))'
        where.append(b)
      }
    }
    text.append(where)

    const code = el('p', 'tvsetup__code', Array.from({ length: 8 }, (_, i) => entry[i] ?? '_').join('').replace(/^(.{4})/, '$1-'))
    text.append(code)

    if (typing && addr.length < 40) {
      // address entry first when there is nothing to pick: digits, dot, colon
      text.append(keypad(ADDRESS_KEYS, 13, (c) => { addr += c; redraw() }, () => { addr = addr.slice(0, -1); redraw() }, '⌫', 52))
    }
    text.append(keypad(KEYS, 11, (c) => { if (entry.length < 8) entry += c; redraw() }, () => { entry = entry.slice(0, -1); redraw() }, 'Delete', typing ? 56 : 76))

    const row = el('div')
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:calc(12 * var(--u));align-items:center'
    row.append(button('Connect', () => void connect(s), true))
    if (s.hosts.length) {
      row.append(button(typing ? 'Use a computer found on the network' : 'Type an address instead', () => { manual = !typing; redraw() }))
    }
    if (repair) row.append(button('Cancel', () => { repair = false; redraw() }))
    for (const b of row.querySelectorAll('button')) b.style.minHeight = 'calc(72 * var(--u))'
    text.append(row)

    const status = notice || s.error || (s.link === 'waiting' ? 'Connecting…' : s.hosts.length ? '' : 'Looking for Lyra on your network…')
    if (status) text.append(el('p', 'tvsetup__status', status))
    return text
  }

  async function refresh(force = false): Promise<void> {
    const s = await host.rpc<TvState>('tvState').catch(() => null)
    if (!s || !root) return
    state = s
    if (!force && sig(s) === renderedFor) return
    renderedFor = sig(s)
    await render(s)
  }

  async function render(s: TvState): Promise<void> {
    if (!root) return
    const focusedLabel = (document.activeElement as HTMLElement | null)?.textContent ?? ''
    root.replaceChildren()
    const head = el('header', 'tvsetup__head')
    head.append(el('h1', undefined, 'Lyrics on your TV'), el('p', undefined, `This is “${s.deviceName}”. Choose where the music comes from.`))

    const choices = el('div', 'tvsetup__choices')
    const pair = button('Pair with Lyra on my computer', () => void choose('paired'), s.mode === 'paired')
    pair.classList.toggle('is-current', s.mode === 'paired')
    const local = button('Use the music playing on this TV', () => void choose('local'), s.mode === 'local')
    local.classList.toggle('is-current', s.mode === 'local')
    choices.append(pair, local)

    const detail = el('section', 'tvsetup__detail')
    if (s.mode === 'paired') {
      detail.append(s.saved && !repair ? linkedView(s) : formView(s))
      if (!(s.saved && !repair)) {
        detail.style.alignItems = 'stretch'
        detail.style.padding = '2vh 2vw'
      }
    } else if (!s.hasAccess) {
      const text = el('div', 'tvsetup__how')
      text.append(
        el('p', 'tvsetup__step', 'Lyra reads the song from the music app on this TV (for example Spotify). Android asks you to allow it first: notification access for Lyra. Lyra never reads your notifications.')
      )
      if (s.canOpenAccessSettings) {
        text.append(button('Open the notification access screen', () => void host.rpc('tvOpenAccess'), true))
      } else {
        text.append(
          el('p', 'tvsetup__step', 'This TV has no Settings screen for that. Allow it once from a computer on the same network:'),
          el('p', 'tvsetup__cmd', s.adb)
        )
      }
      text.append(button('I allowed it, check again', () => void host.rpc('refresh').then(() => refresh(true))), el('p', 'tvsetup__status', 'Waiting for access…'))
      detail.append(text)
    } else {
      const text = el('div', 'tvsetup__how')
      text.append(el('p', 'tvsetup__step', 'Lyra can see what this TV plays. Start a song in your music app and the lyrics appear here.'), el('p', 'tvsetup__status', 'Ready.'))
      detail.append(text)
    }

    const foot = el('footer', 'tvsetup__foot')
    foot.append(button(needsSetup(s) ? 'Exit' : 'Done', () => (needsSetup(s) ? host.exit() : close())))
    root.append(head, choices, detail, foot)
    // keep the highlight where it was after a redraw, otherwise start on the current choice
    const all = focusables(root)
    const again = all.find((f) => f.node.textContent === focusedLabel) ?? all.find((f) => f.node.classList.contains('is-current')) ?? all[0]
    again?.node.focus()
  }

  function open(): void {
    if (root) return
    root = el('div', 'tvsetup')
    root.setAttribute('role', 'dialog')
    root.setAttribute('aria-label', 'Set up Lyra on this TV')
    document.body.append(root)
    document.documentElement.dataset.tvSetup = '1'
    renderedFor = ''
    void refresh(true)
    poll = setInterval(() => void refresh(), 2000)
  }

  function close(): void {
    if (!root) return
    clearInterval(poll)
    root.remove()
    root = null
    delete document.documentElement.dataset.tvSetup
    onClosed()
  }

  return {
    open,
    close,
    isOpen: () => !!root,
    key(k) {
      if (!root) return false
      if (k === 'back') {
        if (state && needsSetup(state)) host.exit()
        else close()
        return true
      }
      if (k === 'up' || k === 'down' || k === 'left' || k === 'right') {
        moveFocus(root, k)
        return true
      }
      return k !== 'select' // Enter clicks the focused button by itself
    }
  }
}

// ---------------------------------------------------------------- start

export function startTv(host: TvHost): void {
  const hud = makeHud()
  const setup = makeSetup(host, () => (document.activeElement as HTMLElement | null)?.blur())

  // first start: a TV is watched from a sofa, so the look changes with every song and the screen stays on
  try {
    if (!localStorage.getItem('lyra.tvDefaultsV1')) {
      localStorage.setItem('lyra.tvDefaultsV1', '1')
      void window.lyra.settings.set({ vibeMode: 'cycle', vibe: 'neon', keepScreenOn: true, backgroundInMini: true })
    }
  } catch {
    /* storage unavailable: the shared defaults are fine */
  }

  const player = (): ReturnType<typeof usePlayer.getState> => usePlayer.getState()

  const run = (k: RemoteKey, e?: KeyboardEvent): void => {
    if (setup.isOpen()) {
      if (setup.key(k)) {
        e?.preventDefault()
        e?.stopImmediatePropagation()
      }
      return
    }
    const shown = controlsShown()
    let action = decide(k, shown)
    const onControl = !!document.activeElement?.closest('.full button, .full [role="slider"]')
    if (action.type === 'pass' && k === 'select' && !onControl) action = { type: 'toggle' }
    if (action.type === 'move' && !onControl) {
      // first D-pad press with the chrome up: land on play / pause instead of jumping somewhere unexpected
      const full = document.querySelector('.full')
      if (full) moveFocus(full, action.dir)
      e?.preventDefault()
      e?.stopImmediatePropagation()
      return
    }
    if (action.type === 'pass') return
    e?.preventDefault()
    e?.stopImmediatePropagation()
    switch (action.type) {
      case 'toggle': {
        const was = player().snapshot?.isPlaying
        player().toggle()
        hud.say(was ? 'Paused' : 'Playing')
        wake()
        break
      }
      case 'play':
        void player().command({ type: 'play' })
        break
      case 'pause':
        void player().command({ type: 'pause' })
        break
      case 'seek':
        player().seek(Math.max(0, getPosition() + action.ms))
        hud.say(`${action.ms > 0 ? '+' : '−'}${Math.abs(action.ms) / 1000} s`)
        break
      case 'track':
        void player().command({ type: action.dir > 0 ? 'next' : 'previous' })
        hud.say(action.dir > 0 ? 'Next song' : 'Previous song')
        break
      case 'look':
        cycleVibe(action.dir) // announces itself with the app's own toast
        break
      case 'move': {
        const full = document.querySelector('.full')
        if (full) moveFocus(full, action.dir)
        break
      }
      case 'setup':
        setup.open()
        break
    }
  }

  window.addEventListener(
    'keydown',
    (e) => {
      const k = remoteKey(e)
      if (!k || e.repeat && k === 'select') return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      run(k, e)
    },
    true
  )
  window.__lyraTv = {
    key: (name) => {
      const k = nativeKey(name)
      if (k) run(k)
    }
  }

  // Back: the activity asks the page first. Close what is open, otherwise let the app leave.
  window.__lyraNative ??= { push: () => undefined, back: () => false }
  window.__lyraNative.back = () => {
    if (setup.isOpen()) return setup.key('back')
    const ui = useUi.getState()
    if (ui.panel !== 'none') {
      ui.setPanel('none')
      return true
    }
    return false
  }

  void (async () => {
    const s = await host.rpc<TvState>('tvState').catch(() => null)
    if (host.forceSetup || (s && ((s.mode === 'local' && !s.hasAccess) || (s.mode === 'paired' && !s.saved)))) setup.open()
  })()
}
