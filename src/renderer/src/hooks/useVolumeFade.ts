import { useEffect } from 'react'
import { getPosition, usePlayer } from '@/store/player'
import { useSettings } from '@/store/settings'
import { FADE_IN_MS, FADE_OUT_MS, canFade, fadeInLevel, fadeOutLevel } from '@/lib/volumeFade'

const KEY = 'lyra.volumeFadeBase'
type Phase = 'idle' | 'out' | 'in'

function remember(base: number | null): void {
  try {
    if (base === null) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify({ base, at: Date.now() }))
  } catch {
    /* storage can be blocked; the fade still works */
  }
}

/**
 * Fades the volume out in the last moments of a song and back in at the start of the next (setting "Fade volume between songs").
 * Safety: it only runs while playing, when the player lets Lyra set the volume and the song is long enough; it gives the user's
 * volume back when playback pauses, when the song is sought backwards, when the next song does not start in time, on quit, and
 * on the next start if Lyra was closed mid-fade; and it stands down at once when the user moves the volume themselves.
 */
export function useVolumeFade(): void {
  const enabled = useSettings((s) => s.settings.volumeFade)
  useEffect(() => {
    if (!enabled) return
    let phase: Phase = 'idle'
    let base = 0
    let trackId: string | undefined
    let lastSent: number | null = null
    let sentAt = 0
    let startedAt = 0
    let failed = false

    const send = (percent: number): void => {
      const p = Math.min(100, Math.max(0, Math.round(percent)))
      if (lastSent !== null && Math.abs(p - lastSent) < 2 && p !== base) return
      lastSent = p
      sentAt = Date.now()
      void window.lyra.player.command({ type: 'volume', percent: p }).then(
        (r) => {
          if (!r.ok) failed = true
        },
        () => {
          failed = true
        }
      )
    }
    const restore = (): void => {
      if (phase !== 'idle') send(base)
      phase = 'idle'
      lastSent = null
      remember(null)
    }

    // closed mid-fade last time: give the volume back
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        const { base: b, at } = JSON.parse(raw) as { base: number; at: number }
        remember(null)
        const cur = usePlayer.getState().snapshot?.device?.volumePercent
        if (Date.now() - at < 120000 && typeof b === 'number' && typeof cur === 'number' && cur < b) {
          void window.lyra.player.command({ type: 'volume', percent: Math.min(100, Math.max(0, Math.round(b))) })
        }
      }
    } catch {
      /* ignore */
    }

    const tick = (): void => {
      if (failed) return
      const snap = usePlayer.getState().snapshot
      const dev = snap?.device
      if (!snap?.track) return
      const ok = canFade({ enabled: true, isPlaying: snap.isPlaying, supportsVolume: !!dev?.supportsVolume, volume: dev?.volumePercent ?? null, durationMs: snap.track.durationMs, isAd: snap.isAdOrUnknown })
      if (phase === 'idle') {
        if (!ok) return
        const rem = snap.track.durationMs - getPosition()
        if (rem > 0 && rem <= FADE_OUT_MS) {
          base = dev!.volumePercent as number
          trackId = snap.track.id
          startedAt = Date.now()
          phase = 'out'
          remember(base)
        }
        return
      }
      // the user moved the volume themselves: stand down, do not fight them
      const cur = dev?.volumePercent
      if (lastSent !== null && typeof cur === 'number' && Date.now() - sentAt > 1400 && Math.abs(cur - lastSent) > 10) {
        phase = 'idle'
        lastSent = null
        remember(null)
        return
      }
      if (!snap.isPlaying) return restore()
      if (phase === 'out') {
        if (snap.track.id !== trackId) {
          phase = 'in'
          startedAt = Date.now()
          send(fadeInLevel(0, base))
          return
        }
        const rem = snap.track.durationMs - getPosition()
        if (rem > FADE_OUT_MS + 1500 || Date.now() - startedAt > FADE_OUT_MS + 6000) return restore() // sought back, or the song did not change
        send(fadeOutLevel(rem, base))
        return
      }
      // phase 'in'
      const el = Date.now() - startedAt
      if (el >= FADE_IN_MS) {
        send(base)
        phase = 'idle'
        lastSent = null
        remember(null)
      } else send(fadeInLevel(el, base))
    }

    const timer = window.setInterval(tick, 140)
    const onHide = (): void => restore()
    window.addEventListener('beforeunload', onHide)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('beforeunload', onHide)
      restore()
    }
  }, [enabled])
}
