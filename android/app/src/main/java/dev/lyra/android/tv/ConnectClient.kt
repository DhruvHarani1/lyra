package dev.lyra.android.tv

import org.json.JSONObject
import java.security.SecureRandom
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

/**
 * The real Connect client: pair (or hello/auth), then follow the host. One worker thread per [connect] runs the whole
 * conversation linearly (the socket reader only feeds a queue), so there is no shared mutable protocol state.
 * Handshake, clock sync, signed commands and reconnect all follow docs/connect-protocol.md; no Android classes, so
 * the same code is exercised against the real desktop hub in the JVM interop test (see docs/android-tv.md).
 */
class LanConnectTransport(
    private val clock: () -> Long = System::currentTimeMillis,
    private val random: SecureRandom = SecureRandom()
) : ConnectTransport {
    @Volatile private var current: Worker? = null

    override val role: String get() = current?.state?.role ?: "viewer"

    @Synchronized override fun connect(request: ConnectRequest, listener: ConnectTransport.Listener) {
        stop()
        current = Worker(request, listener).also { it.start() }
    }

    @Synchronized override fun stop() {
        current?.halt()
        current = null
    }

    override fun send(commandJson: String): Boolean = current?.sendCommand(commandJson) ?: false
    override fun lyricsJson(trackId: String): String? = current?.state?.lyricsJson(trackId)

    private sealed class Event {
        object Open : Event()
        class Text(val text: String) : Event()
        class Closed(val why: String) : Event()
    }

    /** How one connection attempt ended. */
    private class Outcome(val rejected: Boolean, val reachedReady: Boolean, val credentials: Credentials?, val why: String)

    private enum class Phase { PAIR, HELLO, AUTH, READY }

    private inner class Worker(private val request: ConnectRequest, private val listener: ConnectTransport.Listener) : Thread("lyra-connect") {
        @Volatile private var stopped = false
        @Volatile private var ws: WsClient? = null
        val state = HostState()
        private val offset = ClockOffset()
        private val cmdN = AtomicLong()
        @Volatile private var sessionKey: String? = null
        @Volatile private var ready = false

        init { isDaemon = true }

        fun halt() {
            stopped = true
            ws?.close()
            interrupt()
        }

        fun sendCommand(pageCommand: String): Boolean {
            val key = sessionKey
            val w = ws
            if (!ready || key == null || w == null || state.role != "controller") return false
            val body = commandBody(pageCommand) ?: return false
            val n = cmdN.incrementAndGet() // strictly increasing per connection, starting at 1
            return w.send(JSONObject().put("v", PROTOCOL_VERSION).put("t", "cmd").put("n", n).put("b", body).put("mac", ConnectCrypto.signCommand(key, n, body)).toString())
        }

        override fun run() {
            var creds = request.credentials
            var code = request.pairCode
            var attempt = 0
            while (!stopped) {
                if (creds == null && code == null) { listener.onRejected("no-credentials", "This TV is not paired yet."); return }
                listener.onState(LinkState.WAITING, null)
                val out = session(creds, code)
                if (stopped) return
                ready = false
                state.clear()
                if (out.rejected) return // onRejected was already reported
                if (out.credentials != null) { creds = out.credentials; code = null }
                attempt = if (out.reachedReady) 0 else attempt + 1
                listener.onState(LinkState.LOST, out.why.ifEmpty { null })
                try { sleep(backoffMs(maxOf(0, attempt - 1), random.nextDouble())) } catch (_: InterruptedException) { return }
            }
        }

        private fun reject(code: String, msg: String): Outcome {
            listener.onRejected(code, msg)
            return Outcome(true, false, null, msg)
        }

        private fun session(startCreds: Credentials?, pairCode: String?): Outcome {
            var creds = startCreds
            val addr = request.address()
            val q = LinkedBlockingQueue<Event>()
            val w = WsClient(addr.host, addr.port)
            ws = w
            val reader = Thread({
                val why = w.open(object : WsClient.Handler {
                    override fun onOpen() { q.add(Event.Open) }
                    override fun onText(text: String) { q.add(Event.Text(text)) }
                })
                q.add(Event.Closed(why))
            }, "lyra-connect-reader").apply { isDaemon = true; start() }

            fun end(why: String, reached: Boolean) = Outcome(false, reached, creds, why)
            try {
                when (val first = q.poll(8, TimeUnit.SECONDS)) {
                    is Event.Open -> Unit
                    is Event.Closed -> return end(first.why.ifEmpty { "closed" }, false)
                    else -> return end("no answer from ${addr.host}", false)
                }
                val cn = ConnectCrypto.randomHex(16, random)
                val name = request.deviceName.trim().take(40).ifEmpty { "Android TV" }
                var phase: Phase
                if (creds != null) {
                    phase = Phase.HELLO
                    w.send(msg("hello") { put("deviceId", creds!!.deviceId); put("name", name); put("cn", cn) })
                } else {
                    phase = Phase.PAIR
                    w.send(msg("pair") { put("code", pairCode); put("name", name); put("cn", cn) })
                }
                val preAuthDeadline = clock() + 10_000
                var nextPing = Long.MAX_VALUE
                var pings = 0
                var lastOffset = 0L
                while (!stopped) {
                    val now = clock()
                    val waitMs = if (phase == Phase.READY) maxOf(1L, nextPing - now) else maxOf(1L, preAuthDeadline - now)
                    val ev = q.poll(waitMs, TimeUnit.MILLISECONDS)
                    if (ev == null) {
                        if (phase != Phase.READY) return end("the host did not answer in time", false)
                        w.send(msg("ping") { put("id", pings); put("c0", clock()) })
                        pings++
                        nextPing = clock() + pingDelayMs(pings)
                        continue
                    }
                    if (ev is Event.Closed) return end(ev.why.ifEmpty { "closed" }, phase == Phase.READY)
                    if (ev !is Event.Text) continue
                    val m = try { JSONObject(ev.text) } catch (_: Exception) { continue }
                    if (m.optInt("v", PROTOCOL_VERSION) != PROTOCOL_VERSION) return reject("version", "The Lyra app on the computer speaks another version. Update Lyra.")
                    when (m.optString("t")) {
                        "err" -> {
                            val code = m.optString("code")
                            val text = m.optString("msg")
                            // in a running session these only say "that command was not allowed / too fast"; nothing to do
                            if (phase == Phase.READY && (code == "forbidden" || code == "rate" || code == "replay")) continue
                            return when (code) {
                                "bad-proof", "unknown-device" -> reject(code, "This computer no longer knows this TV. Pair it again.")
                                "bad-code", "expired" -> reject(code, "That code is wrong or has expired. Codes last 2 minutes.")
                                "full" -> reject(code, "The computer has too many paired devices. Remove one in Lyra's Devices panel.")
                                "version" -> reject(code, "The Lyra app on the computer speaks another version. Update Lyra.")
                                "rate" -> if (creds != null) end("the host is busy, trying again", false) else reject(code, "Too many tries. Wait a minute and try again.")
                                else -> reject(code.ifEmpty { "error" }, text.ifEmpty { "The host refused the connection." })
                            }
                        }
                        "challenge" -> if (phase == Phase.HELLO) {
                            val c = creds!!
                            val sn = m.optString("sn")
                            sessionKey = ConnectCrypto.sessionKey(c.token, cn, sn)
                            w.send(msg("auth") { put("proof", ConnectCrypto.proof(c.token, cn, sn)) })
                            phase = Phase.AUTH
                        }
                        "paired" -> if (phase == Phase.PAIR) {
                            val token = m.optString("token")
                            val sn = m.optString("sn")
                            val c = Credentials(m.optString("deviceId"), token, m.optString("role", "viewer"), "", addr.host, addr.port, addr.name)
                            creds = c
                            sessionKey = ConnectCrypto.sessionKey(token, cn, sn)
                            listener.onPaired(c) // the token is sent only this once: store it now
                            phase = Phase.AUTH
                        }
                        "ready" -> if (phase == Phase.AUTH) {
                            phase = Phase.READY
                            state.apply(m)
                            val c = creds!!
                            val updated = c.copy(role = state.role, hostName = state.hostName, host = addr.host, port = addr.port)
                            if (updated != c) { creds = updated; listener.onPaired(updated) }
                            offset.reset()
                            cmdN.set(0)
                            ready = true
                            nextPing = clock()
                            listener.onState(LinkState.CONNECTED, null)
                            listener.onSnapshot(state.snapshotJson(offset.offset(), clock()))
                        }
                        "pong" -> if (phase == Phase.READY) {
                            val c3 = clock()
                            offset.add(offsetSample(m.optLong("c0"), m.optLong("s1"), m.optLong("s2"), c3))
                            val o = offset.offset(c3)
                            // the anchor on the page is on this device's clock, so a better offset moves it: say so when it matters
                            if (kotlin.math.abs(o - lastOffset) > 15) { lastOffset = o; listener.onSnapshot(state.snapshotJson(o, c3)) }
                        }
                        "bye" -> return end(m.optString("why").ifEmpty { "the host closed the connection" }, phase == Phase.READY)
                        else -> if (phase == Phase.READY && state.apply(m)) listener.onSnapshot(state.snapshotJson(offset.offset(), clock()))
                    }
                }
                return end("", false)
            } catch (_: InterruptedException) {
                return end("", false)
            } finally {
                w.close()
                reader.interrupt()
            }
        }

        private fun msg(type: String, fill: JSONObject.() -> Unit): String = JSONObject().put("v", PROTOCOL_VERSION).put("t", type).apply(fill).toString()
    }
}
