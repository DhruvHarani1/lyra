package dev.lyra.android.tv

import android.annotation.SuppressLint
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import dev.lyra.android.MediaListenerService
import dev.lyra.android.MediaMonitor
import dev.lyra.android.SecretStore
import org.json.JSONArray
import org.json.JSONObject

enum class TvMode { LOCAL, PAIRED }

/** What the TV remembers: where the music comes from, and (in the secret store) the token of the paired computer. */
object TvPrefs {
    private const val FILE = "lyra_tv"
    private const val SECRET = "tv-connect"
    private fun p(ctx: Context) = ctx.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    fun mode(ctx: Context): TvMode = if (p(ctx).getString("mode", "local") == "paired") TvMode.PAIRED else TvMode.LOCAL
    fun setMode(ctx: Context, m: TvMode) = p(ctx).edit().putString("mode", if (m == TvMode.PAIRED) "paired" else "local").apply()

    /** The device id + token the computer gave this TV, encrypted with a Keystore key like the other secrets. */
    fun credentials(ctx: Context): Credentials? = runCatching { Credentials.fromJson(SecretStore.load(ctx.applicationContext, SECRET)) }.getOrNull()
    fun saveCredentials(ctx: Context, c: Credentials) = runCatching { SecretStore.save(ctx.applicationContext, SECRET, c.toJson()) }.isSuccess
    fun clearCredentials(ctx: Context) = SecretStore.clear(ctx.applicationContext, SECRET)

    /** The name people know this TV by (Settings > About), shown on the computer's Devices panel. */
    fun deviceName(ctx: Context): String =
        runCatching { Settings.Global.getString(ctx.contentResolver, "device_name") }.getOrNull()?.takeIf { it.isNotBlank() } ?: Build.MODEL
}

/**
 * The source the TV page and the screen saver use: the TV's own media session ([LocalSource]) or a paired Lyra app
 * ([PairedSource]), chosen by [TvPrefs]. Switching is instant; listeners (the page push, the screen saver) are told.
 * In paired mode this also looks for Lyra hosts on the network ([HostDiscovery]) and reconnects to the stored one.
 */
object TvSource : PlaybackSource {
    private val paired = PairedSource(TvTransports.create())
    private val listeners = mutableListOf<() -> Unit>()
    private val forward = { listeners.toList().forEach { it() } }
    private var wired = false
    private var discovery: HostDiscovery? = null
    @SuppressLint("StaticFieldLeak") // always the application context
    private var appCtx: Context? = null

    /** Call once from whatever starts first (activity or screen saver). Idempotent. */
    fun init(ctx: Context) {
        val app = ctx.applicationContext
        appCtx = app
        if (!wired) {
            wired = true
            LocalSource.addListener(forward)
            paired.addListener(forward)
            paired.credentialsSink = { c -> TvPrefs.saveCredentials(app, c); forward() }
            // a computer that forgot this TV (or a revoked device) makes the stored token useless: drop it
            paired.rejectionSink = { code -> if (code == "bad-proof" || code == "unknown-device") TvPrefs.clearCredentials(app) }
        }
        apply(app)
    }

    private fun apply(ctx: Context) {
        if (TvPrefs.mode(ctx) != TvMode.PAIRED) {
            paired.stop()
            discovery?.stop()
            return
        }
        val d = discovery ?: HostDiscovery(ctx) { forward() }.also { discovery = it }
        d.start()
        val creds = TvPrefs.credentials(ctx)
        if (creds != null && !paired.isStarted && !paired.rejected) paired.start(requestFor(ctx, creds))
    }

    private fun requestFor(ctx: Context, creds: Credentials) = ConnectRequest(
        deviceName = TvPrefs.deviceName(ctx),
        // asked before every attempt: the newest stored address, or the host found again by name when its IP changed
        address = {
            val c = TvPrefs.credentials(ctx) ?: creds
            discovery?.hosts()?.firstOrNull { c.instance.isNotEmpty() && it.name == c.instance } ?: HostAddress(c.host, c.port, c.instance)
        },
        credentials = creds,
        pairCode = null
    )

    private fun active(): PlaybackSource {
        val c = appCtx
        return if (c != null && TvPrefs.mode(c) == TvMode.PAIRED) paired else LocalSource
    }

    fun setMode(ctx: Context, m: TvMode) {
        TvPrefs.setMode(ctx, m)
        apply(ctx.applicationContext)
        if (m == TvMode.LOCAL) LocalSource.refresh(ctx)
        forward()
    }

    /** Pairs with the host at [address] using the code the person read from its Devices panel. Returns a message when it cannot start. */
    fun pair(ctx: Context, codeText: String, address: HostAddress): String? {
        val code = PairingCode.normalize(codeText) ?: return "The code has 8 letters and digits, like ABCD-EFGH."
        val app = ctx.applicationContext
        val named = discovery?.hosts()?.firstOrNull { it.host == address.host && it.port == address.port } ?: address
        paired.stop()
        TvPrefs.clearCredentials(app) // a new pairing replaces the old one
        paired.start(ConnectRequest(TvPrefs.deviceName(app), { named }, null, code))
        forward()
        return null
    }

    /** Forget the paired computer: the TV stops following it and its token is deleted (remove the TV in Lyra's Devices panel too). */
    fun forget(ctx: Context) {
        paired.stop()
        TvPrefs.clearCredentials(ctx.applicationContext)
        forward()
    }

    val isPaired: Boolean get() = paired.connected
    val link: LinkState get() = paired.link
    val problem: String? get() = paired.problem
    val role: String get() = paired.role
    fun hosts(): List<HostAddress> = discovery?.hosts() ?: emptyList()

    /** The computer's lyrics for a song (page LyricsResult JSON), or null. */
    fun lyricsJson(trackId: String): String? = if (paired.connected) paired.lyricsJson(trackId) else null

    override fun snapshotJson(ctx: Context) = active().snapshotJson(ctx)
    override fun statusJson(ctx: Context) = active().statusJson(ctx)
    override fun queueJson() = active().queueJson()
    override fun command(json: String) = active().command(json)
    override fun addListener(l: () -> Unit) { listeners.add(l) }
    override fun removeListener(l: () -> Unit) { listeners.remove(l) }
    override fun refresh(ctx: Context) = active().refresh(ctx)
    override fun hasAccess(ctx: Context) = active().hasAccess(ctx)
    override fun now() = active().now()
}

/** The page's `tvState` / `tvSetMode` / `tvPair` / ... calls (see src/android-web/tv.ts). Added to Rpc.kt as one `when` branch. */
object TvRpc {
    val METHODS = setOf("tvState", "tvSetMode", "tvOpenAccess", "tvPair", "tvForget", "tvLyrics")

    /** Whether this TV has a screen where the user can allow notification access (many Android TV builds hide it). */
    fun canOpenAccessSettings(ctx: Context): Boolean =
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).resolveActivity(ctx.packageManager) != null

    fun state(ctx: Context): JSONObject {
        val listener = ComponentName(ctx, MediaListenerService::class.java).flattenToString()
        val creds = TvPrefs.credentials(ctx)
        val hosts = JSONArray().also { a -> TvSource.hosts().forEach { a.put(JSONObject().put("name", it.name).put("host", it.host).put("port", it.port)) } }
        return JSONObject()
            .put("mode", if (TvPrefs.mode(ctx) == TvMode.PAIRED) "paired" else "local")
            .put("hasAccess", MediaMonitor.hasAccess(ctx))
            .put("canOpenAccessSettings", canOpenAccessSettings(ctx))
            .put("paired", TvSource.isPaired)
            .put("link", TvSource.link.name.lowercase())
            .put("saved", creds != null)
            .put("hostName", creds?.hostName ?: "")
            .put("role", TvSource.role)
            .put("error", if (TvSource.isPaired) JSONObject.NULL else TvSource.problem ?: JSONObject.NULL)
            .put("hosts", hosts)
            .put("defaultPort", PairingCode.DEFAULT_PORT)
            .put("deviceName", TvPrefs.deviceName(ctx))
            .put("adb", "adb shell cmd notification allow_listener $listener")
    }

    fun call(ctx: Context, method: String, args: JSONArray): Any? = when (method) {
        "tvState" -> state(ctx)
        "tvSetMode" -> {
            TvSource.setMode(ctx, if (args.optString(0) == "paired") TvMode.PAIRED else TvMode.LOCAL)
            true
        }
        // tvPair(code, host, port): the code the computer shows, and where it is (a discovered host or a typed address)
        "tvPair" -> {
            val addr = PairingCode.parseAddress(args.optString(1) + ":" + args.optInt(2, PairingCode.DEFAULT_PORT))
            val problem = if (addr == null) "That address does not look right. Try something like 192.168.1.20." else TvSource.pair(ctx, args.optString(0), addr)
            JSONObject().put("ok", problem == null).put("message", problem ?: JSONObject.NULL)
        }
        "tvForget" -> {
            TvSource.forget(ctx)
            true
        }
        // the computer's lyrics for the song with this id (a LyricsResult), or null: the page then asks its own services
        // (false = not following a computer, null = the computer has not sent them yet, {"fallback":true} = it has none)
        "tvLyrics" -> if (!TvSource.isPaired) false else TvSource.lyricsJson(args.optString(0))?.let { JSONObject(it) }
        "tvOpenAccess" -> runCatching {
            ctx.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            true
        }.getOrDefault(false)
        else -> false
    }
}
