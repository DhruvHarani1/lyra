# R8 rules for the release build. Only used with -PlyraMinify (see app/build.gradle.kts and docs/android-release.md).
#
# What the app does NOT do, so there is nothing to keep for it:
#  - no reflection and no Class.forName / getIdentifier anywhere in dev.lyra.android
#  - no @JavascriptInterface: the page talks to Kotlin through androidx.webkit addWebMessageListener("AndroidRpc"), and
#    Rpc.kt dispatches on method-name STRINGS in a `when`, so renaming Kotlin classes and methods cannot break it
#  - no kotlinx.serialization / Gson / Moshi: JSON is org.json from the platform
# What is kept automatically: every Activity, Service, Receiver, Provider, AppWidgetProvider, DreamService and TileService
# named in AndroidManifest.xml, and classes named in layout / xml resources (AAPT2 generates those rules); AndroidX
# libraries (work-runtime, webkit, activity, core) ship their own consumer rules.

# readable crash reports from users
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
