# Android release build notes

## R8 (code and resource shrinking): evaluated, left OFF

`android/app/build.gradle.kts` builds the `release` type with `isMinifyEnabled = false`. This was evaluated (Lyra 0.24.1 code base)
and left that way on purpose.

What was checked:
- The app has no reflection (`Class.forName`, `getIdentifier`), no `@JavascriptInterface` (the page talks to Kotlin through
  `addWebMessageListener("AndroidRpc")` and `Rpc.kt` dispatches on method-name strings), and no JSON library that needs keep
  rules (org.json is the platform's). Components named in the manifest are kept by AAPT2; AndroidX ships consumer rules.
- `./gradlew assembleRelease -PlyraMinify` (R8 + `shrinkResources`, rules in `android/app/proguard-rules.pro`) builds without
  warnings, and the unit tests pass. The release APK shrinks from about 2.5 MB to 0.5 MB without the web UI assets (a local
  build without `npm run build:android-ui`; the real APK is bigger, the shrink applies to code and resources, not `assets/`).

Why it stays off: no minified build was run on a device or emulator. The unit tests run against the unminified debug classes
and cannot show a crash in a RemoteViews widget, the dream service, the quick-settings tile, WorkManager start-up or the
WebView bridge. A broken shrink would only show in users' hands, so shipping it needs a device check first.

To turn it on later: install `./gradlew assembleRelease -PlyraMinify` (signs with the debug key unless the `LYRA_KEYSTORE*`
variables are set; never commit a keystore) on a phone and exercise: first run, lyrics, widgets (all eight), lock-screen lyrics,
ambient mode and screen saver, record page, the in-app updater check, and the Android TV page on a TV or emulator. If all work,
make `minify` default to true in `build.gradle.kts` and keep `mapping.txt` of each release to read crash reports.

## Signing

The release workflow signs with the key from the `ANDROID_KEYSTORE_*` secrets. Without them `assembleRelease` falls back to the
debug key, which is fine for a local build but must never be published (the updater would refuse every later update); the
workflow refuses to publish in that case (see `docs/DISTRIBUTION.md`).
