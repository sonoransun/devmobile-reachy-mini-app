package com.reachy.shared.models

import kotlinx.serialization.Serializable

/**
 * Represents a WiFi network detected by the system.
 */
@Serializable
data class WiFiNetwork(
    val id: String,
    val ssid: String,
    val bssid: String? = null,
    val signalStrength: Int, // dBm (negative values, closer to 0 = stronger)
    val frequency: Int? = null, // MHz
    val channel: Int? = null,
    val securityType: WiFiSecurityType,
    val isConnected: Boolean = false,
    val isSecured: Boolean = true,
    val capabilities: List<String> = emptyList()
)

/**
 * WiFi security types.
 */
@Serializable
enum class WiFiSecurityType(val value: String) {
    OPEN("open"),
    WEP("wep"),
    WPA("wpa"),
    WPA2("wpa2"),
    WPA3("wpa3"),
    WPA_ENTERPRISE("wpa_enterprise"),
    UNKNOWN("unknown")
}

/**
 * Current network connection information.
 */
@Serializable
data class NetworkInfo(
    val connectionType: ConnectionType,
    val isConnected: Boolean,
    val wifiInfo: WiFiConnectionInfo? = null,
    val ethernetInfo: EthernetConnectionInfo? = null,
    val vpnInfo: VPNConnectionInfo? = null,
    val ipAddress: String? = null,
    val gateway: String? = null,
    val dns: List<String> = emptyList(),
    val networkQuality: NetworkQuality? = null
)

/**
 * Types of network connections.
 */
@Serializable
enum class ConnectionType(val value: String) {
    WIFI("wifi"),
    ETHERNET("ethernet"),
    CELLULAR("cellular"),
    VPN("vpn"),
    NONE("none"),
    UNKNOWN("unknown")
}

/**
 * WiFi connection details.
 */
@Serializable
data class WiFiConnectionInfo(
    val ssid: String,
    val bssid: String? = null,
    val signalStrength: Int, // dBm
    val frequency: Int? = null,
    val linkSpeed: Int? = null, // Mbps
    val securityType: WiFiSecurityType,
    val ipAddress: String? = null
)

/**
 * Ethernet connection details.
 */
@Serializable
data class EthernetConnectionInfo(
    val interface: String,
    val linkSpeed: Int? = null, // Mbps
    val duplex: String? = null, // full, half
    val ipAddress: String? = null
)

/**
 * VPN connection details.
 */
@Serializable
data class VPNConnectionInfo(
    val profileName: String,
    val serverAddress: String,
    val protocol: String,
    val connectedAt: String? = null,
    val bytesReceived: Long? = null,
    val bytesSent: Long? = null
)

/**
 * Network quality metrics.
 */
@Serializable
data class NetworkQuality(
    val latency: Int? = null, // ms
    val bandwidth: NetworkBandwidth? = null,
    val packetLoss: Float? = null, // 0.0 to 1.0
    val quality: NetworkQualityLevel = NetworkQualityLevel.UNKNOWN
)

/**
 * Network bandwidth information.
 */
@Serializable
data class NetworkBandwidth(
    val download: Double? = null, // Mbps
    val upload: Double? = null    // Mbps
)

/**
 * Network quality levels.
 */
@Serializable
enum class NetworkQualityLevel(val value: String) {
    EXCELLENT("excellent"),
    GOOD("good"),
    FAIR("fair"),
    POOR("poor"),
    UNKNOWN("unknown")
}