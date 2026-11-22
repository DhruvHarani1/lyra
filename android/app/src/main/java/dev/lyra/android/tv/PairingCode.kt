package dev.lyra.android.tv

/** Where a Lyra host listens. [name] is the mDNS instance name when it was discovered, else "". */
data class HostAddress(val host: String, val port: Int, val name: String = "")

/**
 * The pairing code of Lyra Connect. The HOST makes it (Lyra on the computer: Devices panel), the TV only asks for it:
 * 8 characters of Crockford base32 (`0-9 A-Z` without I, L, O, U), shown as `ABCD-EFGH`, valid 2 minutes, single use
 * (src/core/connect/pairing.ts). Typing is forgiving: case, spaces, dashes and the look-alikes O, I, L.
 */
object PairingCode {
    const val ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
    const val LENGTH = 8
    const val DEFAULT_PORT = 47813

    /** One typed character as the code character it stands for, or null when it cannot be part of a code. */
    fun fold(c: Char): Char? {
        val u = c.uppercaseChar()
        val m = when (u) { 'O' -> '0'; 'I', 'L' -> '1'; else -> u }
        return if (m in ALPHABET) m else null
    }

    /** Typed text as the code characters so far (for showing progress while a person is still typing). Stops at 8. */
    fun partial(input: String): String = buildString { for (c in input) { if (length >= LENGTH) break; fold(c)?.let { append(it) } } }

    /** "abcd efgh", "ABCD-EFGH", "abcdefgh" -> "ABCDEFGH"; null when it is not a complete, valid code. */
    fun normalize(input: String): String? {
        val kept = input.filter { !it.isWhitespace() && it != '-' }
        if (kept.length != LENGTH) return null
        val out = StringBuilder()
        for (c in kept) out.append(fold(c) ?: return null)
        return out.toString()
    }

    /** "ABCDEFGH" -> "ABCD-EFGH" (shorter input is shown as typed so far, with the dash once it is past four) */
    fun format(code: String): String = if (code.length > 4) code.substring(0, 4) + "-" + code.substring(4) else code

    /**
     * What the host's QR code carries, `http://<ip>:<port>/#p=<CODE>` (protocol section 1). A TV has no camera, but the
     * same text may be typed or pasted; returns the address and the code, or null when it is not such a link.
     */
    fun parseLink(text: String): Pair<HostAddress, String?>? {
        val m = LINK.matchEntire(text.trim()) ?: return null
        val addr = address(m.groupValues[1], m.groupValues[2]) ?: return null
        val code = m.groupValues[3].takeIf { it.isNotEmpty() }?.let { normalize(it) }
        return addr to code
    }

    /** "192.168.1.5", "192.168.1.5:47813" or "pc-name.local:47813" -> address; null when it cannot be one. */
    fun parseAddress(text: String): HostAddress? {
        val m = ADDR.matchEntire(text.trim()) ?: return null
        return address(m.groupValues[1], m.groupValues[2])
    }

    private fun address(host: String, port: String): HostAddress? {
        val p = if (port.isEmpty()) DEFAULT_PORT else port.toIntOrNull() ?: return null
        if (p !in 1..65535 || host.isEmpty() || host.length > 253) return null
        return HostAddress(host, p)
    }

    private val ADDR = Regex("""([A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?)(?::(\d{1,5}))?""")
    private val LINK = Regex("""https?://([A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?)(?::(\d{1,5}))?/?(?:#p=([A-Za-z0-9-]*))?""")
}
