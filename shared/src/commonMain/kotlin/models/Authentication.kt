package com.reachy.shared.models

import kotlinx.serialization.Serializable

/**
 * Authentication request for device login.
 */
@Serializable
data class AuthRequest(
    val deviceId: String,
    val deviceName: String,
    val platform: DevicePlatform,
    val biometricEnabled: Boolean = false,
    val deviceInfo: DeviceInfo? = null
)

/**
 * Authentication response containing JWT tokens.
 */
@Serializable
data class AuthResponse(
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Long, // seconds
    val tokenType: String = "Bearer",
    val deviceId: String,
    val permissions: List<String> = emptyList()
)

/**
 * Token refresh request.
 */
@Serializable
data class RefreshTokenRequest(
    val refreshToken: String
)

/**
 * Device registration request.
 */
@Serializable
data class DeviceRegistrationRequest(
    val deviceId: String,
    val deviceName: String,
    val platform: DevicePlatform,
    val deviceInfo: DeviceInfo? = null
)

/**
 * Device registration response.
 */
@Serializable
data class DeviceRegistrationResponse(
    val deviceId: String,
    val registered: Boolean,
    val message: String? = null
)

/**
 * Current authentication status.
 */
@Serializable
data class AuthStatus(
    val authenticated: Boolean,
    val deviceId: String? = null,
    val deviceName: String? = null,
    val platform: DevicePlatform? = null,
    val permissions: List<String> = emptyList(),
    val expiresAt: String? = null // ISO 8601 format
)

/**
 * Supported device platforms.
 */
@Serializable
enum class DevicePlatform(val value: String) {
    MOBILE_IOS("mobile-ios"),
    MOBILE_ANDROID("mobile-android"),
    PWA("pwa"),
    DESKTOP("desktop"),
    UNKNOWN("unknown")
}

/**
 * Device information for registration and identification.
 */
@Serializable
data class DeviceInfo(
    val osVersion: String? = null,
    val appVersion: String? = null,
    val model: String? = null,
    val manufacturer: String? = null,
    val screenSize: String? = null,
    val timezone: String? = null,
    val locale: String? = null
)

/**
 * User session information.
 */
@Serializable
data class UserSession(
    val sessionId: String,
    val deviceId: String,
    val platform: DevicePlatform,
    val startTime: String, // ISO 8601 format
    val lastActivity: String, // ISO 8601 format
    val expiresAt: String,   // ISO 8601 format
    val permissions: List<String> = emptyList()
)

/**
 * Permission levels for API access.
 */
@Serializable
enum class Permission(val value: String) {
    ADMIN("admin"),
    ROBOT_CONTROL("robot.control"),
    ROBOT_READ("robot.read"),
    VPN_MANAGE("vpn.manage"),
    VPN_READ("vpn.read"),
    SYSTEM_READ("system.read"),
    SYSTEM_MANAGE("system.manage"),
    APPS_MANAGE("apps.manage"),
    APPS_READ("apps.read"),
    LOGS_READ("logs.read"),
    SETTINGS_MANAGE("settings.manage"),
    SETTINGS_READ("settings.read")
}

/**
 * JWT token information.
 */
@Serializable
data class TokenInfo(
    val token: String,
    val expiresAt: String, // ISO 8601 format
    val issuedAt: String,  // ISO 8601 format
    val scope: List<String> = emptyList()
)