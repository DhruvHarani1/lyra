import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// One place for the version: version.properties (the release workflow checks that the tag matches it, and
// F-Droid reads it too). Bump both numbers for every release; versionCode must always go up.
val versionProps = Properties().apply { file("version.properties").inputStream().use { load(it) } }
val lyraVersion: String = versionProps.getProperty("versionName")
val lyraVersionCode: Int = versionProps.getProperty("versionCode").toInt()

// Release signing: the workflow provides the key through environment variables. Without them (a contributor's
// own build) the release build falls back to the debug key so `assembleRelease` still works.
val keystorePath: String? = System.getenv("LYRA_KEYSTORE")

android {
    namespace = "dev.lyra.android"
    compileSdk = 36

    // keeps the APK free of the encrypted dependency blob that open-source app stores flag
    dependenciesInfo {
        includeInApk = false
        includeInBundle = false
    }

    defaultConfig {
        applicationId = "dev.lyra.android"
        minSdk = 26
        targetSdk = 36
        versionCode = lyraVersionCode
        versionName = lyraVersion
        // F-Droid builds pass -PlyraNoUpdater (see fdroid/dev.lyra.android.yml): the in-app updater is compiled out
        buildConfigField("boolean", "IN_APP_UPDATER", if (project.hasProperty("lyraNoUpdater")) "false" else "true")
    }

    buildFeatures {
        buildConfig = true
    }

    signingConfigs {
        if (keystorePath != null) {
            create("release") {
                storeFile = file(keystorePath)
                storePassword = System.getenv("LYRA_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("LYRA_KEY_ALIAS")
                keyPassword = System.getenv("LYRA_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        // a debug build installs next to the real app (own settings, own signature) instead of failing to update it
        debug {
            applicationIdSuffix = ".debug"
        }
        release {
            // R8 (code shrinking + resource shrinking) is OFF in shipped builds on purpose, see docs/android-release.md:
            // the app builds and unit-tests fine with it (-PlyraMinify), but no minified build has been run on a device,
            // and a WebView app with widgets, receivers and a screen saver fails in ways only a device shows. The keep
            // rules are ready in proguard-rules.pro; turn it on by default only after a minified build was exercised on a phone.
            val minify = project.hasProperty("lyraMinify")
            isMinifyEnabled = minify
            isShrinkResources = minify
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = if (keystorePath != null) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.activity:activity-ktx:1.9.3")

    implementation("androidx.work:work-runtime:2.10.0")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303") // the android.jar stubs of org.json do nothing in unit tests
}
