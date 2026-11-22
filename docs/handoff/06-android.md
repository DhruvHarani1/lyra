# 6. Android

Folder `android/` (Kotlin, Gradle, minSdk 26 / Android 8+, targetSdk 36), package `dev.lyra.android`. UI = the shared React bundle in a WebView (`npm run build:android-ui` writes to `android/app/src/main/assets/`).

## Pieces
* **MediaMonitor** (Kotlin): reads the active media session via Notification Access (`NotificationListenerService`); gives track, position, play state; `queueJson()` returns up to 3 queued items when the player publishes a `MediaController` queue (Spotify does not). Control commands go through `transportControls`.
* **Rpc.kt** / `src/android-web/rpc.ts` + `api.ts`: bridge between WebView JS and Kotlin; `api.ts` implements `window.lyra` (lyrics via `fetch` in the WebView, settings, `syncPhone`, `widgetVibe`, record, ambient...). `platform.ts` marks `data-platform='android'`.
* **LyricsNotifier**: media-style notification with the current line; calls `LyraWidgetUpdater.refreshSoon()` when lyrics change.
* **Home-screen widget** `LyraWidget.kt` (+ `res/layout/lyra_widget_{compact,medium,large}.xml`, `xml/lyra_widget_info.xml`): RemoteViews only (limited view types), responsive size map on API 31+, cover-colour gradient, live lyric ticker following the next line, previous/play/next. It follows the **vibe in effect**: web layer watches `<html data-vibe>` and sends `widgetVibe`; `WidgetPalettes.of(vibe)` maps all looks to palettes (gradient, text, accent), persisted in SharedPreferences so it survives reboots. Doc: `docs/android-widget.md` (eight widgets with their own looks as of 0.9). **Compiled in CI; the owner tests on a phone, not verified on launchers in general (#76).**
* **Ambient mode** (`AmbientActivity`, `ambient.tsx`): dim drifting lyrics clock on the charger; keeps screen on only while music plays (`FLAG_KEEP_SCREEN_ON`, released 3 min after pause), light-sensor brightness.
* **Recording** (`RecordService`, `ScreenRecorder`, `RecordActivity`): lyric-video screen recording with playback capture or microphone fallback (many known issues, see issues #19, #28, #30, #33).
* Quick Settings tile, app shortcut, floating lyrics overlay.
* **Lock-screen card and always-on lyrics screen** (`LyricsNotifier`, `AmbientActivity`, `AodLyricsView`, `AodLogic`, `LyraDream` screen saver): `docs/android-ambient.md`. Android has no API to draw on the system always-on display, so this is Lyra's own screen plus the media-session card.
* **Car mode** (`android/.../car/`, `CarMode.tsx`, `docs/android-car.md`): opened by hand for a passenger, never automatic; session metadata carries no lyric text when the phone is in a car dock. Lyra deliberately declares no Android Auto media app.
* **Android TV** (`android/.../tv/`: `TvActivity`, `TvDream`, `TvKeys`, `PairedSource`, `ConnectTransport`, `PairingCode`; `src/android-web/tv.ts`; `docs/android-tv.md`): one APK, big lyrics, D-pad control. **Never run on a TV or emulator; TV pairing with a PC is being redesigned by another agent.**
* **In-app updater** (`android/.../update/`, Settings row `AndroidUpdateRow.tsx`): only for GitHub-installed builds (`UpdateManager.disabledReason` says why it is off, e.g. store builds). Checks the GitHub release list at most every 12 h (Wi-Fi by default), resumable download, SHA-256 against the release's checksum, same signing certificate as the installed app, then `PackageInstaller`. Unit tests: `UpdateLogicTest.kt`. Distribution notes (not mine to edit here): `docs/DISTRIBUTION.md`, `docs/FDROID.md`.
* Kotlin unit tests live under `android/app/src/test` (`AodLogicTest`, `CarLogicTest`, `PcmProcessorTest`, `TvLogicTest`, `UpdateLogicTest`).

## Phone UI rules
Lyrics-first layout; a bottom dock (`.mini__card.phone__dock`); portrait, landscape and small phones; tablet/unfolded foldable uses a two-pane layout (`useWideScreen`, `.wide__dock`). Settings opens as a bottom sheet. The phone's YouTube video pauses with the music but is hidden while paused (see engine doc).

## Build/versions
`android/app/version.properties` (`versionName`, `versionCode`; raise both every release). CI workflow `android.yml` builds a signed APK when keystore secrets exist (`ANDROID_KEYSTORE_BASE64` etc.), else unsigned/debug-style per Gradle config. The release is named `android-v<versionName>` and is **not** marked latest (the desktop updater reads the Windows release as latest).

## Testing reality
There is no Android SDK or device in the cloud session. The browser harness (`?android=1`) emulates the phone layout; Kotlin is only compile-verified by CI. The owner tests APKs on a real phone (Samsung Galaxy A54, Android 16 / One UI 8 was the reference device).
