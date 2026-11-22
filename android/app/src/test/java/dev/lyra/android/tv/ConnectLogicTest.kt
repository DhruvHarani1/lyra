package dev.lyra.android.tv

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The pure parts of the Lyra Connect client. HMAC vectors were produced with node:crypto, which src/core/connect/hmac.ts is tested against. */
class ConnectLogicTest {
    private val token = "a".repeat(32) + "b".repeat(32)
    private val cn = "00112233445566778899aabbccddeeff"
    private val sn = "ffeeddccbbaa99887766554433221100"

    @Test fun hmacMatchesRfc4231() {
        assertEquals("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843", ConnectCrypto.hmacHex("Jefe", "what do ya want for nothing?"))
        assertEquals("b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7", ConnectCrypto.hmacHex("\u000b".repeat(20), "Hi There"))
    }

    @Test fun hmacOverUtf8MatchesTheDesktop() {
        assertEquals("947c9765f25f337470c4f23ca6b6143b0f4f13ffef4c478a44cd013ec59434ab", ConnectCrypto.hmacHex("kéy☃", "méssage ♪"))
    }

    @Test fun proofSessionKeyAndCommandMacMatchTheDesktop() {
        assertEquals("151f7434e8bb8a93e8f53b55ecd587ee5bfca1a4c77368368f2229c5f5b5518d", ConnectCrypto.proof(token, cn, sn))
        val key = ConnectCrypto.sessionKey(token, cn, sn)
        assertEquals("68adaec07ec14c184affc55aceb2f82563e0cabe545ce8076e2e45a7e66adbfa", key)
        assertEquals("4dd6428531b44629aed0724648a352ff2dcae5115c14fb2902f6bf9842d8f129", ConnectCrypto.signCommand(key, 7, """{"c":"seek","ms":42000}"""))
        assertEquals("lyra1|auth|$cn|$sn", ConnectCrypto.authInput("auth", cn, sn))
    }

    @Test fun nonceIsHexOfTheRightLength() {
        val n = ConnectCrypto.randomHex(16)
        assertEquals(32, n.length)
        assertTrue(n.all { it in "0123456789abcdef" })
    }

    @Test fun websocketAcceptKeyMatchesRfc6455() {
        assertEquals("s3pPLMBiTxaQ9kYGzzhZRbK+xOo=", WsClient.acceptKey("dGhlIHNhbXBsZSBub25jZQ=="))
    }

    // ---- clock ------------------------------------------------------------------------------------------------------

    @Test fun offsetSampleIsNtpStyle() {
        // host clock is 1000 ms ahead; 20 ms each way, host takes 2 ms: c0=0, s1=1020, s2=1022, c3=42
        val s = offsetSample(0, 1020, 1022, 42)!!
        assertEquals(1000.0, s.offset, 0.001)
        assertEquals(40.0, s.rtt, 0.001)
    }

    @Test fun absurdSamplesAreDropped() {
        assertNull(offsetSample(0, 0, 0, -5)) // negative rtt
        assertNull(offsetSample(0, 0, 0, 10_001)) // over 10 s
    }

    @Test fun smallestRoundTripWins() {
        val c = ClockOffset()
        assertEquals(0, c.offset(0))
        c.add(offsetSample(0, 520, 521, 400)) // rtt 399, offset ~ 120/2 -> poor
        c.add(offsetSample(1000, 2002, 2003, 1006)) // rtt 5, offset 1000
        c.add(offsetSample(2000, 3030, 3031, 2100)) // rtt 99
        assertEquals(1000, c.offset(2100))
        assertEquals(5.0, c.rtt(2100), 0.001)
    }

    @Test fun cadenceAndBackoffFollowTheProtocol() {
        assertEquals(150L, pingDelayMs(0)); assertEquals(150L, pingDelayMs(5))
        assertEquals(1000L, pingDelayMs(6)); assertEquals(1000L, pingDelayMs(11))
        assertEquals(10_000L, pingDelayMs(12))
        assertEquals(500L, backoffMs(0, 0.5)) // jitter 0.75 + 0.5 * 0.5 = 1.0
        assertEquals(1000L, backoffMs(1, 0.5))
        assertEquals(2000L, backoffMs(2, 0.5))
        assertEquals(15_000L, backoffMs(10, 0.5))
        assertEquals(375L, backoffMs(0, 0.0))
        assertEquals(18_750L, backoffMs(10, 1.0)) // cap 15 s, +25 %
    }

    // ---- commands ---------------------------------------------------------------------------------------------------

    @Test fun pageCommandsBecomeConnectCommands() {
        assertEquals("""{"c":"toggle"}""", commandBody("""{"type":"toggle"}"""))
        assertEquals("""{"c":"prev"}""", commandBody("""{"type":"previous"}"""))
        assertEquals("""{"c":"next"}""", commandBody("""{"type":"next"}"""))
        assertEquals("""{"c":"seek","ms":15000}""", commandBody("""{"type":"seek","positionMs":15000}"""))
        assertEquals("""{"c":"seek","ms":0}""", commandBody("""{"type":"seek","positionMs":-5}"""))
        assertNull(commandBody("""{"type":"like"}"""))
        assertNull(commandBody("not json"))
    }

    // ---- host messages -> page shapes ---------------------------------------------------------------------------------

    private fun host(vararg raw: String): HostState = HostState().also { h -> raw.forEach { h.apply(JSONObject(it)) } }

    private val ready = """{"v":1,"t":"ready","role":"controller","name":"Dev PC","host":1,"vibes":["none"],"party":false}"""
    private val now = """{"v":1,"t":"now","now":{"id":"s1","key":"k","title":"Song","artists":["Ann","Bob"],"album":"Alb","durationMs":200000}}"""

    @Test fun nothingPlayingIsNull() {
        assertEquals("null", HostState().snapshotJson(0, 1000))
        assertEquals("null", host(ready).snapshotJson(0, 1000))
    }

    @Test fun nowPlayAndArtMapToAPlaybackSnapshot() {
        val h = host(ready, now, """{"v":1,"t":"play","play":{"playing":true,"positionMs":30000,"at":5000000}}""", """{"v":1,"t":"art","id":"s1","src":"https://x.test/a.jpg"}""")
        assertEquals("controller", h.role)
        assertEquals("Dev PC", h.hostName)
        // the host clock is 250 ms ahead of ours: the anchor moves back by that much on our clock
        val s = JSONObject(h.snapshotJson(250, 5_000_300))
        assertTrue(s.getBoolean("isPlaying"))
        assertEquals(30000, s.getLong("positionMs"))
        assertEquals(5_000_000 - 250, s.getLong("sampledAt"))
        val t = s.getJSONObject("track")
        assertEquals("s1", t.getString("id"))
        assertEquals("Song", t.getString("title"))
        assertEquals("Ann", t.getJSONArray("artists").getString(0))
        assertEquals(200000, t.getLong("durationMs"))
        assertEquals("https://x.test/a.jpg", t.getString("artworkUrl"))
        assertTrue(s.isNull("device"))
    }

    @Test fun lyricShiftIsAppliedToThePosition() {
        val h = host(ready, now, """{"v":1,"t":"play","play":{"playing":false,"positionMs":10000,"at":1}}""", """{"v":1,"t":"view","view":{"vibe":"neon","video":{"id":null},"offsetMs":-400}}""")
        // lyricTime = position - offsetMs
        assertEquals(10400, JSONObject(h.snapshotJson(0, 99)).getLong("positionMs"))
        assertTrue(!JSONObject(h.snapshotJson(0, 99)).getBoolean("isPlaying"))
    }

    @Test fun artForAnotherSongIsIgnoredAndANewSongDropsOldLyrics() {
        val h = host(ready, now, """{"v":1,"t":"art","id":"old","src":"https://x.test/old.jpg"}""",
            """{"v":1,"t":"lyrics","id":"s1","status":"synced","synced":true,"lines":[{"t":1000,"x":"hello"}]}""")
        assertTrue(JSONObject(h.snapshotJson(0, 0)).getJSONObject("track").isNull("artworkUrl"))
        assertNotNull(h.lyricsJson("s1"))
        h.apply(JSONObject("""{"v":1,"t":"now","now":{"id":"s2","key":"k2","title":"Next","artists":[],"durationMs":1000}}"""))
        assertNull(h.lyricsJson("s1"))
        assertEquals("s2", h.songId)
    }

    @Test fun syncedLyricsMapToTheLyricsResult() {
        val h = host(ready, now, """{"v":1,"t":"lyrics","id":"s1","status":"synced","synced":true,"lines":[{"t":1000,"x":"one"},{"t":2500,"x":"two"}]}""")
        val r = JSONObject(h.lyricsJson("s1")!!)
        assertEquals("synced", r.getString("status"))
        assertEquals("s1", r.getString("trackId"))
        assertEquals(2500, r.getJSONArray("lines").getJSONObject(1).getLong("timeMs"))
        assertEquals("two", r.getJSONArray("lines").getJSONObject(1).getString("text"))
        assertNull(h.lyricsJson("other-song"))
    }

    @Test fun plainLyricsBecomePlainText() {
        val h = host(ready, now, """{"v":1,"t":"lyrics","id":"s1","status":"plain","synced":false,"lines":[{"t":0,"x":"a"},{"t":0,"x":"b"}]}""")
        val r = JSONObject(h.lyricsJson("s1")!!)
        assertEquals("plain", r.getString("status"))
        assertEquals("a\nb", r.getString("plain"))
        assertEquals(0, r.getJSONArray("lines").length())
    }

    @Test fun missingLyricsFallBackToThePagesOwnServices() {
        val h = host(ready, now, """{"v":1,"t":"lyrics","id":"s1","status":"none","synced":false,"lines":[]}""")
        assertEquals(FALLBACK, h.lyricsJson("s1"))
        assertNull("not sent yet: the page waits a moment", host(ready, now).lyricsJson("s1"))
        val inst = host(ready, now, """{"v":1,"t":"lyrics","id":"s1","status":"instrumental","synced":false,"lines":[]}""")
        assertEquals("instrumental", JSONObject(inst.lyricsJson("s1")!!).getString("status"))
    }

    @Test fun unknownMessagesChangeNothing() {
        val h = HostState()
        assertTrue(!h.apply(JSONObject("""{"v":1,"t":"devices","devices":[]}""")))
        assertTrue(!h.apply(JSONObject("""{"v":1,"t":"pong","id":1,"c0":1,"s1":1,"s2":1}""")))
    }

    // ---- stored credentials -----------------------------------------------------------------------------------------

    @Test fun credentialsRoundTripAndRejectGarbage() {
        val c = Credentials("dev-1", token, "viewer", "Dev PC", "192.168.1.5", 47813, "Lyra on Dev PC")
        assertEquals(c, Credentials.fromJson(c.toJson()))
        assertNull(Credentials.fromJson(null))
        assertNull(Credentials.fromJson("{}"))
        assertNull(Credentials.fromJson("""{"deviceId":"","token":"","host":"h","port":1}"""))
    }

    @Test fun snapshotFollowsThisDevicesClockForTheScreenSaver() {
        val h = host(ready, now, """{"v":1,"t":"play","play":{"playing":true,"positionMs":1000,"at":10000}}""")
        // 2 s after the anchor (offset 0) the screen saver shows 3 s
        assertEquals(3000, PairedSource.nowFrom(h.snapshotJson(0, 12000), 12000)!!.positionMs)
        assertEquals("Song", PairedSource.nowFrom(h.snapshotJson(0, 12000), 12000)!!.title)
        assertNull(PairedSource.nowFrom("null", 0))
    }
}
