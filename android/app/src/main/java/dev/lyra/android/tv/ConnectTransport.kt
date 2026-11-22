package dev.lyra.android.tv

import org.json.JSONObject

/** How far the link to the Lyra host has got. LOST means it dropped and is being retried (or was refused). */
enum class LinkState { IDLE, WAITING, CONNECTED, LOST }

/** What a paired TV keeps: its device id and token (from the host's `paired` message) and where the host was last seen. */
data class Credentials(
    val deviceId: String,
    val token: String,
    val role: String,
    val hostName: String,
    val host: String,
    val port: Int,
    /** the mDNS instance name, so the host can be found again when its IP address changes ("" when typed in by hand) */
    val instance: String
) {
    fun toJson(): String = JSONObject().put("deviceId", deviceId).put("token", token).put("role", role).put("hostName", hostName)
        .put("host", host).put("port", port).put("instance", instance).toString()

    companion object {
        fun fromJson(s: String?): Credentials? = try {
            val o = JSONObject(s ?: return null)
            val c = Credentials(o.getString("deviceId"), o.getString("token"), o.optString("role", "viewer"), o.optString("hostName"), o.getString("host"), o.getInt("port"), o.optString("instance"))
            if (c.deviceId.isEmpty() || c.token.isEmpty()) null else c
        } catch (_: Exception) {
            null
        }
    }
}

/**
 * One connection job. Give [credentials] to reconnect as an already paired device, or a [pairCode] (typed by the person
 * from the host's Devices panel) to pair first. [address] is asked again before every (re)connect so a host that moved
 * to a new IP address is found again.
 */
class ConnectRequest(
    val deviceName: String,
    val address: () -> HostAddress,
    val credentials: Credentials?,
    val pairCode: String?
)

/**
 * The wire between this TV and the Lyra host (docs/connect-protocol.md). [LanConnectTransport] is the real one; the
 * interface exists so [PairedSource] can be tested with a fake. All callbacks may come from any thread.
 */
interface ConnectTransport {
    interface Listener {
        fun onState(state: LinkState, detail: String?)
        /** PlaybackSnapshot JSON for the page ("null" when nothing plays); `sampledAt` is already on this device's clock */
        fun onSnapshot(json: String)
        /** Pairing worked (or the role / name changed): store these, they are the only copy of the token */
        fun onPaired(credentials: Credentials)
        /** The host refused for good (wrong or expired code, forgotten device, host full): the link stops, the person must act. */
        fun onRejected(code: String, message: String)
    }

    fun connect(request: ConnectRequest, listener: Listener)
    fun stop()
    /** A page command ({"type":"toggle"}, ...) as a signed `cmd`. False when not connected, not a controller, or unknown. */
    fun send(commandJson: String): Boolean
    /** The host's lyrics for this song, shaped as the page's LyricsResult, or null when it has none (yet). */
    fun lyricsJson(trackId: String): String?
    /** `viewer` or `controller` (the host can change it at any time) */
    val role: String
}

object TvTransports {
    /** The one place that decides which transport the TV uses. */
    fun create(): ConnectTransport = LanConnectTransport()
}
