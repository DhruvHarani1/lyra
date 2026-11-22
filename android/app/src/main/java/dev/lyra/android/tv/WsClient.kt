package dev.lyra.android.tv

import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.EOFException
import java.io.IOException
import java.io.InputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

/**
 * A small RFC 6455 WebSocket client over a plain java.net.Socket (the app has no OkHttp and Connect only needs text
 * frames on a LAN `ws://`). It does the upgrade handshake (and checks Sec-WebSocket-Accept), sends masked text frames,
 * answers ping, joins fragmented messages, and refuses binary data and oversized messages. No Android classes.
 *
 * [open] blocks the calling thread for the whole connection (handshake, then the read loop) and returns when it ends;
 * [send] and [close] may be called from any thread.
 */
class WsClient(
    private val host: String,
    private val port: Int,
    private val path: String = "/ws",
    private val maxMessageBytes: Int = 800 * 1024,
    private val connectTimeoutMs: Int = 5000,
    /** a silent peer is dropped after this long (the host pings every few seconds) */
    private val readTimeoutMs: Int = 30_000
) {
    interface Handler {
        fun onOpen()
        fun onText(text: String)
    }

    private var socket: Socket? = null
    private val writeLock = Any()
    private val random = SecureRandom()
    @Volatile private var closed = false

    /** Runs until the connection ends; returns why ("" for a normal close), never throws for network trouble. */
    fun open(handler: Handler): String {
        try {
            val s = Socket()
            socket = s
            s.tcpNoDelay = true
            s.connect(InetSocketAddress(host, port), connectTimeoutMs)
            s.soTimeout = readTimeoutMs
            val input = BufferedInputStream(s.getInputStream(), 16 * 1024)
            handshake(s, input)
            if (closed) return ""
            handler.onOpen()
            return readLoop(input, handler)
        } catch (e: Exception) {
            return if (closed) "" else (e.message ?: e.javaClass.simpleName)
        } finally {
            close()
        }
    }

    private fun handshake(s: Socket, input: InputStream) {
        val keyBytes = ByteArray(16).also { random.nextBytes(it) }
        val key = Base64.getEncoder().encodeToString(keyBytes)
        val req = "GET $path HTTP/1.1\r\nHost: $host:$port\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
            "Sec-WebSocket-Key: $key\r\nSec-WebSocket-Version: 13\r\n\r\n"
        synchronized(writeLock) { s.getOutputStream().apply { write(req.toByteArray(Charsets.US_ASCII)); flush() } }
        val head = readHeaders(input)
        val lines = head.split("\r\n")
        if (!lines[0].startsWith("HTTP/1.1 101")) throw IOException("not a Lyra Connect host (${lines[0].take(40)})")
        val accept = lines.drop(1).firstOrNull { it.startsWith("sec-websocket-accept:", ignoreCase = true) }?.substringAfter(':')?.trim()
        if (accept != acceptKey(key)) throw IOException("bad websocket handshake")
    }

    private fun readHeaders(input: InputStream): String {
        val sb = StringBuilder()
        while (sb.length < 8192) {
            val b = input.read()
            if (b < 0) throw EOFException("closed during handshake")
            sb.append(b.toChar())
            if (sb.endsWith("\r\n\r\n")) return sb.substring(0, sb.length - 4)
        }
        throw IOException("handshake too long")
    }

    private fun readLoop(input: InputStream, handler: Handler): String {
        val message = ByteArrayOutputStream()
        var inMessage = false
        while (!closed) {
            val b0 = input.read()
            if (b0 < 0) return "closed"
            val b1 = readByte(input)
            val fin = b0 and 0x80 != 0
            val opcode = b0 and 0x0f
            if (b0 and 0x70 != 0) return "protocol error"
            val masked = b1 and 0x80 != 0
            var len = (b1 and 0x7f).toLong()
            if (len == 126L) len = ((readByte(input) shl 8) or readByte(input)).toLong()
            else if (len == 127L) { len = 0; repeat(8) { len = (len shl 8) or readByte(input).toLong() } }
            if (len < 0 || len > maxMessageBytes) return "message too large"
            val mask = if (masked) ByteArray(4).also { readFully(input, it) } else null
            val payload = ByteArray(len.toInt())
            readFully(input, payload)
            if (mask != null) for (i in payload.indices) payload[i] = (payload[i].toInt() xor mask[i and 3].toInt()).toByte()
            when (opcode) {
                0, 1 -> {
                    if (opcode == 1) { if (inMessage) return "protocol error"; message.reset(); inMessage = true }
                    else if (!inMessage) return "protocol error"
                    message.write(payload)
                    if (message.size() > maxMessageBytes) return "message too large"
                    if (fin) {
                        inMessage = false
                        handler.onText(String(message.toByteArray(), Charsets.UTF_8))
                    }
                }
                8 -> { writeFrame(8, payload.copyOf(minOf(payload.size, 2))); return "" }
                9 -> writeFrame(10, payload)
                10 -> Unit
                else -> return "binary frames are not part of the protocol"
            }
        }
        return ""
    }

    private fun readByte(input: InputStream): Int = input.read().also { if (it < 0) throw EOFException() }

    private fun readFully(input: InputStream, into: ByteArray) {
        var off = 0
        while (off < into.size) {
            val n = input.read(into, off, into.size - off)
            if (n < 0) throw EOFException()
            off += n
        }
    }

    /** Sends one text message. False when the connection is not open. Client frames are always masked (RFC 6455). */
    fun send(text: String): Boolean = writeFrame(1, text.toByteArray(Charsets.UTF_8))

    private fun writeFrame(opcode: Int, payload: ByteArray): Boolean {
        val s = socket ?: return false
        if (closed) return false
        val out = ByteArrayOutputStream(payload.size + 14)
        out.write(0x80 or opcode)
        val n = payload.size
        when {
            n < 126 -> out.write(0x80 or n)
            n < 65536 -> { out.write(0x80 or 126); out.write(n ushr 8); out.write(n and 255) }
            else -> { out.write(0x80 or 127); repeat(4) { out.write(0) }; out.write(n ushr 24); out.write((n ushr 16) and 255); out.write((n ushr 8) and 255); out.write(n and 255) }
        }
        val mask = ByteArray(4).also { random.nextBytes(it) }
        out.write(mask)
        for (i in payload.indices) out.write(payload[i].toInt() xor mask[i and 3].toInt())
        return try {
            synchronized(writeLock) { s.getOutputStream().apply { write(out.toByteArray()); flush() } }
            true
        } catch (_: IOException) {
            false
        }
    }

    fun close() {
        closed = true
        try { socket?.close() } catch (_: IOException) { /* already gone */ }
    }

    companion object {
        private const val GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
        fun acceptKey(key: String): String = Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-1").digest((key + GUID).toByteArray(Charsets.US_ASCII)))
    }
}
