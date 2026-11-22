package dev.lyra.android.tv

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import java.net.Inet4Address

/**
 * Finds Lyra hosts on the local network: mDNS / DNS-SD service type `_lyra-connect._tcp` through [NsdManager]
 * (docs/connect-protocol.md section 1). Discovery only says where Lyra is, it grants nothing; when nothing is found (some
 * routers block multicast) the pairing screen lets the person type the address the host shows.
 */
class HostDiscovery(ctx: Context, private val onChange: () -> Unit) {
    private val nsd = ctx.applicationContext.getSystemService(Context.NSD_SERVICE) as? NsdManager
    private val found = LinkedHashMap<String, HostAddress>()
    private val pending = ArrayDeque<NsdServiceInfo>()
    private var resolving = false
    private var running = false

    private val discoveryListener = object : NsdManager.DiscoveryListener {
        override fun onDiscoveryStarted(serviceType: String) = Unit
        override fun onDiscoveryStopped(serviceType: String) = Unit
        override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) { synchronized(this@HostDiscovery) { running = false } }
        override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) = Unit
        override fun onServiceFound(info: NsdServiceInfo) {
            synchronized(this@HostDiscovery) { pending.addLast(info) }
            resolveNext()
        }
        override fun onServiceLost(info: NsdServiceInfo) {
            val gone = synchronized(this@HostDiscovery) { found.remove(info.serviceName) != null }
            if (gone) onChange()
        }
    }

    @Synchronized fun start() {
        if (running || nsd == null) return
        running = true
        try {
            nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discoveryListener)
        } catch (_: Exception) {
            running = false // discovery is a convenience; manual entry still works
        }
    }

    @Synchronized fun stop() {
        if (!running || nsd == null) return
        running = false
        try { nsd.stopServiceDiscovery(discoveryListener) } catch (_: Exception) { /* was not running */ }
        found.clear()
        pending.clear()
        resolving = false
    }

    @Synchronized fun hosts(): List<HostAddress> = found.values.toList()

    @Suppress("DEPRECATION") // resolveService is the one call that works on every API level we support (26+)
    private fun resolveNext() {
        val info = synchronized(this) {
            if (resolving || !running) return
            val next = pending.removeFirstOrNull() ?: return
            resolving = true
            next
        }
        val done = {
            synchronized(this) { resolving = false }
            resolveNext()
        }
        try {
            nsd?.resolveService(info, object : NsdManager.ResolveListener {
                override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) = done()
                override fun onServiceResolved(serviceInfo: NsdServiceInfo) {
                    val ip = serviceInfo.host
                    // the host listens on one private IPv4 address (protocol section 1)
                    val addr = (ip as? Inet4Address)?.hostAddress
                    if (addr != null && serviceInfo.port > 0) {
                        synchronized(this@HostDiscovery) { found[serviceInfo.serviceName] = HostAddress(addr, serviceInfo.port, serviceInfo.serviceName) }
                        onChange()
                    }
                    done()
                }
            })
        } catch (_: Exception) {
            done()
        }
    }

    companion object {
        const val SERVICE_TYPE = "_lyra-connect._tcp"
    }
}
