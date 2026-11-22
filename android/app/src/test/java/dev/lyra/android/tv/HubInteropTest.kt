package dev.lyra.android.tv

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Runs the real [LanConnectTransport] against the REAL desktop host (src/main/connect/hub.ts) on loopback.
 * It only runs when LYRA_HUB_PORT, LYRA_HUB_CODE and LYRA_HUB_AT are set, which `npm run test -- src/android-web/connectInterop`
 * does after starting the hub (set LYRA_KOTLIN_INTEROP=1; see docs/android-tv.md). A plain `./gradlew testDebugUnitTest`
 * skips it, because without a host there is nothing to talk to. The Node side checks which commands the hub accepted.
 */
class HubInteropTest {
    private val port = System.getenv("LYRA_HUB_PORT")?.toIntOrNull()
    private val code = System.getenv("LYRA_HUB_CODE")
    private val anchorAt = System.getenv("LYRA_HUB_AT")?.toLongOrNull()

    private class Probe : ConnectTransport.Listener {
        val states = CopyOnWriteArrayList<LinkState>()
        @Volatile var snapshot = "null"
        @Volatile var creds: Credentials? = null
        @Volatile var rejectedCode: String? = null
        override fun onState(state: LinkState, detail: String?) { states += state }
        override fun onSnapshot(json: String) { snapshot = json }
        override fun onPaired(credentials: Credentials) { creds = credentials }
        override fun onRejected(code: String, message: String) { rejectedCode = code }
        val connected get() = states.lastOrNull() == LinkState.CONNECTED
    }

    private fun waitFor(what: String, ms: Long = 10_000, cond: () -> Boolean) {
        val end = System.currentTimeMillis() + ms
        while (!cond()) {
            if (System.currentTimeMillis() > end) throw AssertionError("timed out waiting for $what")
            Thread.sleep(25)
        }
    }

    private fun request(creds: Credentials?, pairCode: String?) =
        ConnectRequest("Interop TV", { HostAddress("127.0.0.1", port!!) }, creds, pairCode)

    @Test fun pairsFollowsCommandsAndReconnectsAgainstTheRealHost() {
        assumeTrue("no hub given (LYRA_HUB_PORT / LYRA_HUB_CODE / LYRA_HUB_AT)", port != null && code != null && anchorAt != null)
        val t = LanConnectTransport()
        val p = Probe()

        // 1. pair with the one-time code
        t.connect(request(null, PairingCode.normalize(code!!)), p)
        waitFor("pairing and ready") { p.connected && p.snapshot != "null" }
        val creds = p.creds!!
        assertTrue(creds.deviceId.isNotEmpty())
        assertEquals(64, creds.token.length)
        assertEquals("controller", creds.role)
        assertEquals("InteropPC", creds.hostName)

        // 2. the song, mapped onto the page's PlaybackSnapshot, on THIS device's clock
        val s = JSONObject(p.snapshot)
        assertEquals("Interop Song", s.getJSONObject("track").getString("title"))
        assertEquals("Interop Artist", s.getJSONObject("track").getJSONArray("artists").getString(0))
        assertTrue(s.getBoolean("isPlaying"))
        assertEquals(30_000L - 250, s.getLong("positionMs")) // minus the host's lyric offset of 250 ms
        assertTrue("sampledAt follows the clock offset (loopback: about 0)", Math.abs(s.getLong("sampledAt") - anchorAt!!) < 150)
        waitFor("lyrics") { t.lyricsJson("s1") != null }
        assertEquals(2, JSONObject(t.lyricsJson("s1")!!).getJSONArray("lines").length())
        assertEquals("controller", t.role)

        // 3. signed commands (the node side checks the hub accepted them)
        assertTrue(t.send("""{"type":"toggle"}"""))
        assertTrue(t.send("""{"type":"seek","positionMs":15000}"""))
        assertFalse("not a Connect command", t.send("""{"type":"like"}"""))
        Thread.sleep(300)
        t.stop()

        // 4. reconnect as a paired device: hello -> challenge -> auth(proof), the token is never sent
        val again = Probe()
        t.connect(request(creds, null), again)
        waitFor("reconnect") { again.connected && again.snapshot != "null" }
        assertTrue(t.send("""{"type":"next"}"""))
        Thread.sleep(300)
        t.stop()

        // 5. a wrong token is refused for good (the TV must be paired again)
        val bad = Probe()
        t.connect(request(creds.copy(token = "0".repeat(64)), null), bad)
        waitFor("rejection") { bad.rejectedCode != null }
        assertEquals("bad-proof", bad.rejectedCode)
        t.stop()

        // 6. the code was single use
        val reuse = Probe()
        t.connect(request(null, PairingCode.normalize(code)), reuse)
        waitFor("rejection of the used code") { reuse.rejectedCode != null }
        assertNotNull(reuse.rejectedCode)
        t.stop()
    }
}
