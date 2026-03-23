package com.reachy.shared.models

import kotlinx.serialization.Serializable

/**
 * Represents a VPN profile configuration that can be used across platforms.
 * Unified model based on iOS and Android implementations and mobile-api specification.
 */
@Serializable
data class VPNProfile(
    val id: String,
    val name: String,
    val type: VPNType,
    val status: VPNConnectionStatus,
    val provider: String? = null, // For commercial VPNs like NordVPN, ExpressVPN
    val autoConnect: Boolean = false,
    val configuration: VPNConfiguration? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null
)

/**
 * VPN connection types supported by the mobile-api backend.
 */
@Serializable
enum class VPNType(val value: String) {
    OPENVPN("openvpn"),
    WIREGUARD("wireguard"),
    IPSEC("ipsec"),
    COMMERCIAL("commercial")
}

/**
 * Current connection status of a VPN profile.
 */
@Serializable
enum class VPNConnectionStatus(val value: String) {
    CONNECTED("connected"),
    DISCONNECTED("disconnected"),
    CONNECTING("connecting"),
    DISCONNECTING("disconnecting"),
    ERROR("error")
}

/**
 * VPN configuration parameters (credentials excluded for security).
 * Actual credentials are stored securely on the server side.
 */
@Serializable
data class VPNConfiguration(
    val serverAddress: String? = null,
    val port: Int? = null,
    val protocol: String? = null, // TCP/UDP for OpenVPN
    val country: String? = null, // For commercial VPNs
    val city: String? = null,    // For commercial VPNs
    val description: String? = null
)

/**
 * VPN service capabilities and status information.
 */
@Serializable
data class VPNStatus(
    val isConnected: Boolean,
    val activeProfile: VPNProfile? = null,
    val connectionQuality: ConnectionQuality? = null,
    val capabilities: List<VPNType> = emptyList()
)

/**
 * Connection quality metrics for VPN connections.
 */
@Serializable
data class ConnectionQuality(
    val latency: Int? = null,    // ms
    val bandwidth: Double? = null, // Mbps
    val stability: String? = null  // excellent, good, fair, poor
)