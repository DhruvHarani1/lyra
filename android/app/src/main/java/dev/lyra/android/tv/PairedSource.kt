package dev.lyra.android.tv

import android.content.Context
import android.os.Handler
import android.os.Looper
import dev.lyra.android.MediaMonitor
import org.json.JSONObject

/**
 * Follows a Lyra app on a computer through [ConnectTransport]. It keeps the newest PlaybackSnapshot the transport mapped
 * from the host's now / play / view / art messages and answers the page's questions from it; the host's lyrics are handed
 * to the page through [lyricsJson]. Commands go back as signed Connect commands, and only when the host gave this TV the
 * controller role. The snapshot's `sampledAt` is already on this device's clock, so the page's own extrapolation follows
 * the computer's song clock.
 */
class PairedSource(private val transport: ConnectTransport) : PlaybackSource {
    private val main = Handler(Looper.getMainLooper())
    private val listeners = mutableListOf<() -> Unit>()

    @Volatile var link: LinkState = LinkState.IDLE
        private set
    /** why the link is not up (shown on the pairing screen): a refusal, or the last network trouble */
    @Volatile var problem: String? = null
        private set
    /** the host refused for good: nothing is retried until the person pairs again */
    @Volatile var rejected: Boolean = false
        private set
    private var latest: String = "null"
    private var started = false

    /** Called (any thread) with the credentials to store, and when the host forgot this TV. Set by [TvSource]. */
    var credentialsSink: (Credentials) -> Unit = {}
    var rejectionSink: (code: String) -> Unit = {}

    val connected: Boolean get() = link == LinkState.CONNECTED
    val role: String get() = transport.role

    private val onTransport = object : ConnectTransport.Listener {
        override fun onState(state: LinkState, detail: String?) {
            main.post {
                link = state
                problem = if (state == LinkState.CONNECTED) null else detail
                if (state != LinkState.CONNECTED) latest = "null"
                notifyListeners()
            }
        }

        override fun onSnapshot(json: String) {
            main.post {
                latest = json
                notifyListeners()
            }
        }

        override fun onPaired(credentials: Credentials) = credentialsSink.invoke(credentials)

        override fun onRejected(code: String, message: String) {
            rejectionSink.invoke(code)
            main.post {
                rejected = true
                link = LinkState.LOST
                problem = message
                latest = "null"
                started = false
                notifyListeners()
            }
        }
    }

    fun start(request: ConnectRequest) {
        started = true
        rejected = false
        problem = null
        link = LinkState.WAITING
        transport.connect(request, onTransport)
    }

    fun stop() {
        val was = started
        started = false
        transport.stop()
        link = LinkState.IDLE
        latest = "null"
        if (was) notifyListeners()
    }

    val isStarted: Boolean get() = started

    private fun notifyListeners() = listeners.toList().forEach { it() }

    override fun snapshotJson(ctx: Context): String = latest

    override fun statusJson(ctx: Context): String =
        if (connected) JSONObject().put("state", "connected").toString()
        else JSONObject().put("state", "needs-setup").put("message", problem ?: "Pair this TV with Lyra on your computer.").toString()

    override fun queueJson(): String = "null"
    override fun command(json: String): Boolean = connected && transport.send(json)
    /** The computer's lyrics for this song (page LyricsResult JSON), or null when it has none. */
    fun lyricsJson(trackId: String): String? = transport.lyricsJson(trackId)
    override fun addListener(l: () -> Unit) { main.post { listeners.add(l) } }
    override fun removeListener(l: () -> Unit) { main.post { listeners.remove(l) } }
    override fun refresh(ctx: Context) = notifyListeners()
    override fun hasAccess(ctx: Context) = true

    override fun now(): MediaMonitor.Now? = nowFrom(latest, System.currentTimeMillis())

    companion object {
        /** The screen saver's cheap "now playing" from a snapshot; the position moves on with this device's clock. */
        fun nowFrom(snapshot: String, localNow: Long): MediaMonitor.Now? {
            val o = try { JSONObject(snapshot) } catch (_: Exception) { return null }
            val t = o.optJSONObject("track") ?: return null
            val playing = o.optBoolean("isPlaying")
            var pos = o.optLong("positionMs")
            if (playing) pos += maxOf(0L, localNow - o.optLong("sampledAt"))
            val artists = t.optJSONArray("artists")
            val artist = if (artists != null && artists.length() > 0) artists.optString(0) else ""
            val dur = t.optLong("durationMs")
            return MediaMonitor.Now(
                id = t.optString("id"),
                title = t.optString("title"),
                artist = artist,
                positionMs = (if (dur > 0) minOf(pos, dur) else pos).coerceAtLeast(0),
                playing = playing,
                art = null,
                isAd = o.optBoolean("isAdOrUnknown"),
                durationMs = dur
            )
        }
    }
}
