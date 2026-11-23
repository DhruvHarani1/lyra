/**
 * Volume fade between songs: ease the volume down over the last moments of a song and back up over the first moments of the next.
 * These are the pure parts (the levels and the guards); the hook that sends the commands is hooks/useVolumeFade.ts.
 */
export const FADE_OUT_MS = 1700
export const FADE_IN_MS = 1500
/** The volume never drops below this share of the user's volume (a dip, not silence). */
export const FADE_FLOOR = 0.15

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))
const ease = (t: number): number => t * t * (3 - 2 * t) // smoothstep: gentle at both ends

export function fadeFloor(base: number): number {
  return Math.round(base * FADE_FLOOR)
}

/** Level while `remainingMs` of the song is left. At or above FADE_OUT_MS it is the full volume, at 0 it is the floor. */
export function fadeOutLevel(remainingMs: number, base: number): number {
  const t = ease(clamp01(1 - remainingMs / FADE_OUT_MS))
  return Math.round(base - (base - fadeFloor(base)) * t)
}

/** Level `elapsedMs` after the next song started: floor at 0, full volume at FADE_IN_MS. */
export function fadeInLevel(elapsedMs: number, base: number): number {
  const t = ease(clamp01(elapsedMs / FADE_IN_MS))
  return Math.round(fadeFloor(base) + (base - fadeFloor(base)) * t)
}

/** Only fade when it is safe and worth it. */
export function canFade(o: { enabled: boolean; isPlaying: boolean; supportsVolume: boolean; volume: number | null; durationMs: number | undefined; isAd: boolean | undefined }): boolean {
  return o.enabled && o.isPlaying && o.supportsVolume && !o.isAd && o.volume !== null && o.volume >= 10 && (o.durationMs ?? 0) >= 20000
}
