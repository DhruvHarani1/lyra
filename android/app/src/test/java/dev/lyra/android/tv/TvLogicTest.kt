package dev.lyra.android.tv

import android.view.KeyEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TvLogicTest {
    @Test fun codeAlphabetIsCrockfordBase32() {
        assertEquals(32, PairingCode.ALPHABET.length)
        assertEquals(8, PairingCode.LENGTH)
        assertTrue("I, L, O, U are not in the alphabet", PairingCode.ALPHABET.none { it in "ILOU" })
    }

    @Test fun codeIsShownInTwoGroups() {
        assertEquals("ABCD-EFGH", PairingCode.format("ABCDEFGH"))
        assertEquals("ABC", PairingCode.format("ABC")) // typed so far: no dash yet
        assertEquals("ABCD-E", PairingCode.format("ABCDE"))
    }

    @Test fun typedCodesAreForgiving() {
        assertEquals("ABCDEFGH", PairingCode.normalize("abcd-efgh"))
        assertEquals("ABCDEFGH", PairingCode.normalize(" ABCD EFGH "))
        assertEquals("0123456T", PairingCode.normalize("oi23 456t")) // O -> 0, I -> 1
        assertEquals("11234567", PairingCode.normalize("l1234567")) // L -> 1
        assertNull(PairingCode.normalize("ABCDEFG")) // too short
        assertNull(PairingCode.normalize("ABCDEFGHJ")) // too long
        assertNull(PairingCode.normalize("ABCDEFGU")) // U is not in the alphabet
        assertNull(PairingCode.normalize("ABCD#EFG"))
    }

    @Test fun partialEntryKeepsOnlyCodeCharactersAndStopsAtEight() {
        assertEquals("AB0C", PairingCode.partial("aB oC"))
        assertEquals("ABCDEFGH", PairingCode.partial("ABCDEFGHJKM"))
    }

    @Test fun hostLinkAndTypedAddressesParse() {
        val link = PairingCode.parseLink("http://192.168.1.5:47813/#p=abcd-efgh")!!
        assertEquals(HostAddress("192.168.1.5", 47813), link.first)
        assertEquals("ABCDEFGH", link.second)
        assertNull(PairingCode.parseLink("http://192.168.1.5:47813/")!!.second)
        assertNull(PairingCode.parseLink("lyra://pair?c=K7M2QX")) // the old placeholder scheme is gone
        assertEquals(HostAddress("192.168.1.5", 47813), PairingCode.parseAddress("192.168.1.5"))
        assertEquals(HostAddress("10.0.0.7", 50000), PairingCode.parseAddress(" 10.0.0.7:50000 "))
        assertEquals(HostAddress("my-pc.local", 47813), PairingCode.parseAddress("my-pc.local"))
        assertNull(PairingCode.parseAddress("192.168.1.5:99999"))
        assertNull(PairingCode.parseAddress("192.168 .1.5"))
        assertNull(PairingCode.parseAddress(""))
    }

    @Test fun mediaKeysAreForwardedToThePage() {
        assertEquals("playpause", TvKeys.nameFor(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE))
        assertEquals("next", TvKeys.nameFor(KeyEvent.KEYCODE_MEDIA_NEXT))
        assertEquals("prev", TvKeys.nameFor(KeyEvent.KEYCODE_MEDIA_PREVIOUS))
        assertEquals("ffwd", TvKeys.nameFor(KeyEvent.KEYCODE_MEDIA_FAST_FORWARD))
        assertEquals("rew", TvKeys.nameFor(KeyEvent.KEYCODE_MEDIA_REWIND))
        assertEquals("pause", TvKeys.nameFor(KeyEvent.KEYCODE_MEDIA_STOP))
        assertEquals("menu", TvKeys.nameFor(KeyEvent.KEYCODE_MENU))
    }

    @Test fun dpadAndBackAreNotIntercepted() {
        for (k in listOf(KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_DPAD_DOWN, KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_DPAD_RIGHT, KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_BACK)) {
            assertNull("key $k must reach the page / back handler", TvKeys.nameFor(k))
        }
    }

    @Test fun realTransportIsCreated() {
        assertNotNull(TvTransports.create())
        assertEquals("viewer", TvTransports.create().role)
    }
}
