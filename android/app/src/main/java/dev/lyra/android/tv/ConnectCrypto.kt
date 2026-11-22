package dev.lyra.android.tv

import java.security.SecureRandom
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * The cryptography of Lyra Connect (docs/connect-protocol.md, section 3 and 6), identical to src/core/connect/hmac.ts and
 * protocol.ts: HMAC-SHA-256 over UTF-8 strings, shown as lowercase hex. The token is never sent; both sides prove they hold
 * it with `proof`, and signed commands use a per-connection `sessionKey`. No Android classes here, so it runs in plain JUnit.
 */
object ConnectCrypto {
    fun hmacHex(key: String, message: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        // an empty key is not allowed by SecretKeySpec; the protocol never uses one, tokens are 64 hex characters
        mac.init(SecretKeySpec(key.toByteArray(Charsets.UTF_8), "HmacSHA256"))
        return hex(mac.doFinal(message.toByteArray(Charsets.UTF_8)))
    }

    fun authInput(kind: String, cn: String, sn: String) = "lyra1|$kind|$cn|$sn"

    /** What the client sends in `auth`. */
    fun proof(token: String, cn: String, sn: String) = hmacHex(token, authInput("auth", cn, sn))

    /** The key that signs commands for this one connection. */
    fun sessionKey(token: String, cn: String, sn: String) = hmacHex(token, authInput("sess", cn, sn))

    /** `mac` of a `cmd {n, b, mac}`: the signed bytes are exactly `n|b`, with `b` a JSON string. */
    fun signCommand(sessionKey: String, n: Long, body: String) = hmacHex(sessionKey, "$n|$body")

    fun randomHex(bytes: Int, random: SecureRandom = SecureRandom()): String {
        val b = ByteArray(bytes)
        random.nextBytes(b)
        return hex(b)
    }

    private fun hex(b: ByteArray): String {
        val sb = StringBuilder(b.size * 2)
        for (x in b) {
            val v = x.toInt() and 0xff
            sb.append(HEX[v ushr 4]).append(HEX[v and 15])
        }
        return sb.toString()
    }

    private val HEX = "0123456789abcdef".toCharArray()
}
