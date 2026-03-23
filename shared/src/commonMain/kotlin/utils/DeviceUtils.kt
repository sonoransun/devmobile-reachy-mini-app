package com.reachy.shared.utils

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlin.random.Random

/**
 * Utility class for device-related operations.
 */
object DeviceUtils {
    private val deviceIdMutex = Mutex()
    private var cachedDeviceId: String? = null

    /**
     * Generate or retrieve a unique device ID.
     * The device ID should be persistent across app sessions.
     */
    suspend fun getDeviceId(storage: com.reachy.shared.platform.SecureStorage): String {
        return deviceIdMutex.withLock {
            cachedDeviceId?.let { return it }

            val existingId = storage.getString("device_id")
            if (existingId != null) {
                cachedDeviceId = existingId
                return existingId
            }

            val newId = generateDeviceId()
            storage.putString("device_id", newId)
            cachedDeviceId = newId
            return newId
        }
    }

    /**
     * Generate a new unique device ID.
     * Format: platform-timestamp-random
     * Example: android-1709123456789-abc123def456
     */
    private fun generateDeviceId(): String {
        val timestamp = getCurrentTimestamp()
        val randomPart = generateRandomString(12)
        return "mobile-$timestamp-$randomPart"
    }

    /**
     * Get current timestamp in milliseconds.
     */
    private fun getCurrentTimestamp(): Long {
        return kotlinx.datetime.Clock.System.now().toEpochMilliseconds()
    }

    /**
     * Generate a random alphanumeric string of specified length.
     */
    private fun generateRandomString(length: Int): String {
        val chars = "abcdefghijklmnopqrstuvwxyz0123456789"
        return (1..length)
            .map { chars[Random.nextInt(chars.length)] }
            .joinToString("")
    }

    /**
     * Validate device ID format.
     * Device IDs should be alphanumeric with hyphens and underscores allowed.
     */
    fun isValidDeviceId(deviceId: String): Boolean {
        if (deviceId.isBlank() || deviceId.length < 10 || deviceId.length > 100) {
            return false
        }

        // Check if it contains only allowed characters
        val regex = Regex("^[a-zA-Z0-9\\-_]+$")
        return regex.matches(deviceId)
    }

    /**
     * Get a human-readable device name based on platform.
     */
    fun getDefaultDeviceName(platform: com.reachy.shared.models.DevicePlatform): String {
        return when (platform) {
            com.reachy.shared.models.DevicePlatform.MOBILE_ANDROID -> "Android Device"
            com.reachy.shared.models.DevicePlatform.MOBILE_IOS -> "iOS Device"
            com.reachy.shared.models.DevicePlatform.PWA -> "Web App"
            com.reachy.shared.models.DevicePlatform.DESKTOP -> "Desktop"
            com.reachy.shared.models.DevicePlatform.UNKNOWN -> "Unknown Device"
        }
    }

    /**
     * Clear cached device ID (useful for testing or when device ID needs to be regenerated).
     */
    suspend fun clearDeviceId(storage: com.reachy.shared.platform.SecureStorage) {
        deviceIdMutex.withLock {
            cachedDeviceId = null
            storage.remove("device_id")
        }
    }
}