package dev.lyra.android.tv

import org.json.JSONArray
import org.json.JSONObject

/*
 * The pure parts of the Lyra Connect client (docs/connect-protocol.md): clock offset, ping and reconnect timing, the
 * mapping of page commands to signed command bodies, and the mirror of what the host sent mapped onto the shapes the
 * shared page already understands (PlaybackSnapshot, LyricsResult). Everything here is plain Kotlin + org.json so it is
 * unit tested on the JVM; the socket and the threads live in ConnectClient.kt. Mirrors src/core/connect/clockSync.ts.
 */

const val PROTOCOL_VERSION = 1

/** One NTP-style exchange: client sent at c0, host received at s1 and answered at s2, client got it at c3. */
data class OffsetSample(val offset: Double, val rtt: Double, val at: Long)

fun offsetSample(c0: Long, s1: Long, s2: Long, c3: Long): OffsetSample? {
    val rtt = (c3 - c0 - (s2 - s1)).toDouble()
    if (rtt < 0 || rtt > 10_000) return null // a clock jumped, or the answer was ancient
    return OffsetSample(((s1 - c0) + (s2 - c3)) / 2.0, rtt, c3)
}

/** Host clock minus this device's clock, from the lowest-round-trip recent sample (queues only ever add delay). */
class ClockOffset(private val window: Int = 8, private val maxAgeMs: Long = 120_000) {
    private val samples = ArrayList<OffsetSample>()

    @Synchronized fun add(s: OffsetSample?) {
        if (s == null) return
        samples.add(s)
        if (samples.size > window) samples.removeAt(0)
    }

    private fun fresh(now: Long): List<OffsetSample> {
        val f = samples.filter { now - it.at <= maxAgeMs }
        return if (f.isNotEmpty()) f else samples
    }

    @Synchronized fun offset(now: Long = System.currentTimeMillis()): Long {
        val f = fresh(now)
        return if (f.isEmpty()) 0 else Math.round(f.minByOrNull { it.rtt }!!.offset)
    }

    @Synchronized fun rtt(now: Long = System.currentTimeMillis()): Double = fresh(now).minOfOrNull { it.rtt } ?: Double.POSITIVE_INFINITY
    @get:Synchronized val ready: Boolean get() = samples.isNotEmpty()
    @Synchronized fun reset() = samples.clear()
}

/** Ping cadence: 6 quick pings after connecting, then 6 a second apart, then every 10 s. */
fun pingDelayMs(sentSoFar: Int): Long = when {
    sentSoFar < 6 -> 150
    sentSoFar < 12 -> 1000
    else -> 10_000
}

/** Reconnect backoff 0.5 s, 1 s, 2 s ... capped at 15 s, +/- 25 % jitter; `rand` in [0, 1). */
fun backoffMs(attempt: Int, rand: Double = Math.random()): Long {
    val base = minOf(15_000.0, 500.0 * Math.pow(2.0, maxOf(0, attempt).toDouble()))
    return Math.round(base * (0.75 + rand * 0.5))
}

/**
 * The page speaks {"type":"toggle"} / {"type":"seek","positionMs":n} (the shape the media-session mirror takes); Connect
 * commands are {"c":"toggle"} / {"c":"seek","ms":n}. Null for a command Connect does not have.
 */
fun commandBody(pageCommand: String): String? {
    val o = try { JSONObject(pageCommand) } catch (_: Exception) { return null }
    return when (o.optString("type")) {
        "play" -> """{"c":"play"}"""
        "pause" -> """{"c":"pause"}"""
        "toggle" -> """{"c":"toggle"}"""
        "next" -> """{"c":"next"}"""
        "previous" -> """{"c":"prev"}"""
        "seek" -> if (o.has("positionMs")) JSONObject().put("c", "seek").put("ms", maxOf(0L, o.optLong("positionMs"))).toString() else null
        else -> null
    }
}

/** What [HostState.lyricsJson] answers when the computer has no lyrics for the song: the page then asks its own services. */
const val FALLBACK = """{"fallback":true}"""

/** What the host last told us, kept so the page can be given a fresh PlaybackSnapshot whenever the clock moves. */
class HostState {
    var role: String = "viewer"; private set
    var hostName: String = ""; private set
    private var now: JSONObject? = null
    private var play: JSONObject? = null
    private var view: JSONObject? = null
    private var lyrics: JSONObject? = null
    private var art: JSONObject? = null

    /** Applies one host message; true when something the page shows may have changed. */
    @Synchronized fun apply(m: JSONObject): Boolean {
        when (m.optString("t")) {
            "ready" -> { role = m.optString("role", "viewer"); hostName = m.optString("name", ""); return true }
            "now" -> {
                val next = m.optJSONObject("now")
                if (next?.optString("id") != now?.optString("id")) { lyrics = null; art = null }
                now = next
            }
            "play" -> play = m.optJSONObject("play")
            "view" -> view = m.optJSONObject("view")
            "lyrics" -> lyrics = m
            "art" -> art = m
            else -> return false
        }
        return true
    }

    @Synchronized fun clear() { now = null; play = null; view = null; lyrics = null; art = null }
    @get:Synchronized val songId: String? get() = now?.optString("id")?.takeIf { it.isNotEmpty() }

    /** The host's clock anchor as a local one: where the song was, and WHEN on this device's clock. */
    @Synchronized private fun anchorLocal(offsetMs: Long, localNow: Long): Pair<Long, Long> {
        val p = play ?: return 0L to localNow
        val shift = view?.optLong("offsetMs", 0L) ?: 0L
        // lyricTime = position - view.offsetMs (protocol section 4): the lyric shift is applied to the position the page uses
        return maxOf(0L, p.optLong("positionMs") - shift) to (p.optLong("at") - offsetMs)
    }

    /** PlaybackSnapshot JSON for the shared page ("null" when nothing plays). `sampledAt` is on THIS device's clock. */
    @Synchronized fun snapshotJson(offsetMs: Long, localNow: Long): String {
        val n = now ?: return "null"
        val (pos, at) = anchorLocal(offsetMs, localNow)
        val artists = n.optJSONArray("artists") ?: JSONArray()
        val artSrc = art?.takeIf { it.optString("id") == n.optString("id") }?.let { if (it.isNull("src")) null else it.optString("src") }
        val track = JSONObject()
            .put("id", n.optString("id"))
            .put("uri", "lyra-connect:" + n.optString("id"))
            .put("title", n.optString("title"))
            .put("artists", artists)
            .put("album", n.optString("album", ""))
            .put("releaseYear", JSONObject.NULL)
            .put("durationMs", n.optLong("durationMs"))
            .put("artworkUrl", artSrc ?: JSONObject.NULL)
            .put("explicit", false)
            .put("webUrl", JSONObject.NULL)
        val playing = play?.optBoolean("playing", false) ?: false
        return JSONObject()
            .put("track", track)
            .put("isPlaying", playing)
            .put("positionMs", pos)
            .put("sampledAt", at)
            .put("device", JSONObject.NULL)
            .put("shuffle", false)
            .put("repeat", "off")
            .put("isAdOrUnknown", false)
            .toString()
    }

    /** The host's lyrics for this song as a LyricsResult for the page, [FALLBACK] when it has none, null when it has not sent them (yet). */
    @Synchronized fun lyricsJson(trackId: String): String? {
        val l = lyrics ?: return null
        if (l.optString("id") != trackId) return null
        val status = l.optString("status", "none")
        val raw = l.optJSONArray("lines") ?: JSONArray()
        val synced = l.optBoolean("synced", false) && status == "synced"
        val out = JSONObject().put("trackId", trackId).put("provider", "Lyra on " + hostName.ifEmpty { "your computer" })
        if (synced) {
            val lines = JSONArray()
            for (i in 0 until raw.length()) {
                val o = raw.optJSONObject(i) ?: continue
                lines.put(JSONObject().put("timeMs", o.optLong("t")).put("text", o.optString("x")))
            }
            out.put("status", "synced").put("lines", lines)
        } else if (status == "plain" || (status == "synced" && raw.length() > 0)) {
            val text = (0 until raw.length()).joinToString("\n") { raw.optJSONObject(it)?.optString("x") ?: "" }
            out.put("status", "plain").put("lines", JSONArray()).put("plain", text)
        } else if (status == "instrumental") {
            out.put("status", "instrumental").put("lines", JSONArray())
        } else {
            // none / error: the computer found nothing, so the page should try its own services at once
            return FALLBACK
        }
        return out.toString()
    }
}
