import { create } from 'zustand'
import type { CommandResult, ConnectionStatus, PlaybackSnapshot, PlayerCommand, QueueItem, RecentItem } from '@shared/types'
import { estimatePositionMs, type ClockAnchor } from '@core/clock'
import { useUi } from './ui'
import { runSongTransition } from '@/lib/songTransition'

interface PlayerStore {
  snapshot: PlaybackSnapshot | null
  status: ConnectionStatus | null
  liked: boolean | null
  queue: QueueItem[] | null
  recent: RecentItem[] | null
  init(): Promise<void>
  command(cmd: PlayerCommand): Promise<CommandResult>
  toggle(): void
  seek(ms: number): void
  setVolume(percent: number): void
  toggleLike(): Promise<void>
  refreshQueue(): Promise<void>
  refreshRecent(): Promise<void>
}

/** Current playback position, interpolated from the last snapshot. Cheap; safe to call every frame. */
const anchor: ClockAnchor = { positionMs: 0, sampledAt: 0, isPlaying: false }
export function getPosition(): number {
  const s = usePlayer.getState().snapshot
  if (!s) return 0
  // one reused anchor instead of a fresh spread object per call (this runs every frame in several places)
  anchor.positionMs = s.positionMs
  anchor.sampledAt = s.sampledAt
  anchor.isPlaying = s.isPlaying
  anchor.isAdOrUnknown = s.isAdOrUnknown
  anchor.durationMs = s.track?.durationMs
  return estimatePositionMs(anchor)
}

export const usePlayer = create<PlayerStore>((set, get) => ({
  snapshot: null,
  status: null,
  liked: null,
  queue: null,
  recent: null,

  async init() {
    const api = window.lyra
    api.spotify.onStatus((status) => set({ status }))
    api.spotify.onPlayback((snapshot) => {
      const prevId = get().snapshot?.track?.id
      const changed = snapshot.track?.id !== prevId
      if (changed && prevId && snapshot.track && snapshot.isPlaying) runSongTransition(() => set({ snapshot, liked: null, queue: null }))
      else set({ snapshot })
      if (changed) {
        set({ liked: null, queue: null })
        const id = snapshot.track?.id
        if (id) void api.player.isLiked(id).then((v) => get().snapshot?.track?.id === id && set({ liked: v }))
        if (useUi.getState().panel === 'queue') void get().refreshQueue()
      }
    })
    const [status, snapshot] = await Promise.all([api.spotify.getStatus(), api.spotify.getSnapshot()])
    set({ status, snapshot })
    const id = snapshot?.track?.id
    if (id) void api.player.isLiked(id).then((v) => get().snapshot?.track?.id === id && set({ liked: v }))
  },

  async command(cmd) {
    const res = await window.lyra.player.command(cmd)
    if (!res.ok) {
      useUi.getState().toast(res.error ?? 'Spotify rejected that action.', 'error')
      // Re-sync optimistic state with reality
      const snap = await window.lyra.spotify.getSnapshot()
      if (snap) set({ snapshot: snap })
    }
    return res
  },

  toggle() {
    const s = get().snapshot
    if (!s?.track) return
    set({ snapshot: { ...s, isPlaying: !s.isPlaying, positionMs: getPosition(), sampledAt: Date.now() } })
    void get().command({ type: 'toggle' })
  },

  seek(ms) {
    const s = get().snapshot
    if (!s?.track) return
    const positionMs = Math.max(0, Math.min(ms, s.track.durationMs - 50))
    set({ snapshot: { ...s, positionMs, sampledAt: Date.now() } })
    void get().command({ type: 'seek', positionMs })
  },

  setVolume(percent) {
    const s = get().snapshot
    if (!s?.device) return
    set({ snapshot: { ...s, device: { ...s.device, volumePercent: percent } } })
    void get().command({ type: 'volume', percent })
  },

  async toggleLike() {
    const id = get().snapshot?.track?.id
    const liked = get().liked
    if (!id || liked === null) return
    set({ liked: !liked })
    const res = await window.lyra.player.setLiked(id, !liked)
    if (!res.ok) {
      set({ liked })
      useUi.getState().toast(res.error ?? 'Couldn’t update your library.', 'error')
    }
  },

  async refreshQueue() {
    set({ queue: await window.lyra.player.queue() })
  },
  async refreshRecent() {
    set({ recent: await window.lyra.player.recent() })
  }
}))
