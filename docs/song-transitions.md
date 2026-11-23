# Song transitions

Added in Windows 0.26 / Android 0.12.

## Visual effect (`Song change effects`, on by default)
* `src/renderer/src/lib/songTransition.ts` runs the song swap inside `document.startViewTransition`. The browser keeps the old screen as a picture while the new state renders (`flushSync` in `store/player.ts`), then animates the pair.
* `styles/song-transition.css` has one pair of keyframes per effect, keyed on `html[data-xfx]`: `fade`, `dissolve`, `slide-left`, `slide-right`, `rise`, `zoom-in`, `zoom-out`, `iris`, `wipe`, `split`. 0.9 s, long ease-out. `pickEffect` never repeats the previous effect.
* It is skipped (the change is instant) when: the API is missing (older WebView), `data-motion='off'`, `data-perf='low'`, the setting is off (`data-smooth='off'`), the system asks for reduced motion and Reduce motion is not forced On, the window is hidden, or a transition is already running. It only runs when the song changes while playing, not on the first song.
* The look's own backdrop picture and lyrics that arrive later are not part of the transition (they load after the swap).

## Volume fade (`Fade volume between songs`, off by default)
* `lib/volumeFade.ts` (levels, guards, unit tests in `songTransition.test.ts`) and `hooks/useVolumeFade.ts` (the loop, 140 ms).
* In the last 1.7 s of a song the volume eases (smoothstep) down to 15 % of the user's volume; when the next song is seen it starts at that level and eases back up over 1.5 s. Commands go through `window.lyra.player.command({type:'volume'})`.
* Only when `device.supportsVolume`, the song is at least 20 s, it is not an ad and the volume is at least 10 %. It gives the volume back on pause, on a backwards seek, if the next song does not arrive within about 6 s, on unmount / quit, and on the next start if Lyra was closed mid-fade (`localStorage` `lyra.volumeFadeBase`, valid 2 minutes). It stands down when the user changes the volume by more than 10 % away from the last value it sent.
* **Not verified on real hardware**: the real Windows helper and Spotify device volume paths were never run in the cloud (the harness mocks the player). Spotify Web API volume calls are network calls; the loop sends at most one per 140 ms and skips changes under 2 %.
