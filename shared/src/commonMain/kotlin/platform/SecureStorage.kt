package com.reachy.shared.platform

/**
 * Platform-agnostic interface for secure storage of sensitive data.
 * Implementations should use platform-specific secure storage mechanisms:
 * - iOS: Keychain Services
 * - Android: EncryptedSharedPreferences with Android Keystore
 */
interface SecureStorage {
    /**
     * Store a string value securely.
     * @param key The key to store the value under
     * @param value The string value to store
     */
    suspend fun putString(key: String, value: String)

    /**
     * Retrieve a string value from secure storage.
     * @param key The key to retrieve the value for
     * @return The stored string value or null if not found
     */
    suspend fun getString(key: String): String?

    /**
     * Store a long value securely.
     * @param key The key to store the value under
     * @param value The long value to store
     */
    suspend fun putLong(key: String, value: Long)

    /**
     * Retrieve a long value from secure storage.
     * @param key The key to retrieve the value for
     * @return The stored long value or null if not found
     */
    suspend fun getLong(key: String): Long?

    /**
     * Store a boolean value securely.
     * @param key The key to store the value under
     * @param value The boolean value to store
     */
    suspend fun putBoolean(key: String, value: Boolean)

    /**
     * Retrieve a boolean value from secure storage.
     * @param key The key to retrieve the value for
     * @return The stored boolean value or null if not found
     */
    suspend fun getBoolean(key: String): Boolean?

    /**
     * Remove a value from secure storage.
     * @param key The key to remove
     */
    suspend fun remove(key: String)

    /**
     * Clear all values from secure storage.
     * Use with caution as this will remove all stored data.
     */
    suspend fun clear()

    /**
     * Check if a key exists in secure storage.
     * @param key The key to check
     * @return true if the key exists, false otherwise
     */
    suspend fun contains(key: String): Boolean
}

/**
 * Exception thrown when secure storage operations fail.
 */
class SecureStorageException(
    message: String,
    cause: Throwable? = null
) : Exception(message, cause)