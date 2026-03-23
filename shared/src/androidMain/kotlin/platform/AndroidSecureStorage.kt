package com.reachy.shared.platform

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import co.touchlab.kermit.Logger

/**
 * Android implementation of SecureStorage using EncryptedSharedPreferences
 * with Android Keystore for secure key management.
 */
class AndroidSecureStorage(private val context: Context) : SecureStorage {
    private val logger = Logger.withTag("AndroidSecureStorage")

    companion object {
        private const val PREFS_NAME = "reachy_secure_storage"
    }

    private val encryptedSharedPreferences by lazy {
        try {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            EncryptedSharedPreferences.create(
                context,
                PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            logger.e(e) { "Failed to create EncryptedSharedPreferences" }
            throw SecureStorageException("Failed to initialize secure storage", e)
        }
    }

    override suspend fun putString(key: String, value: String) {
        withContext(Dispatchers.IO) {
            try {
                encryptedSharedPreferences.edit()
                    .putString(key, value)
                    .apply()
            } catch (e: Exception) {
                logger.e(e) { "Failed to store string for key: $key" }
                throw SecureStorageException("Failed to store string", e)
            }
        }
    }

    override suspend fun getString(key: String): String? {
        return withContext(Dispatchers.IO) {
            try {
                encryptedSharedPreferences.getString(key, null)
            } catch (e: Exception) {
                logger.e(e) { "Failed to retrieve string for key: $key" }
                throw SecureStorageException("Failed to retrieve string", e)
            }
        }
    }

    override suspend fun putLong(key: String, value: Long) {
        withContext(Dispatchers.IO) {
            try {
                encryptedSharedPreferences.edit()
                    .putLong(key, value)
                    .apply()
            } catch (e: Exception) {
                logger.e(e) { "Failed to store long for key: $key" }
                throw SecureStorageException("Failed to store long", e)
            }
        }
    }

    override suspend fun getLong(key: String): Long? {
        return withContext(Dispatchers.IO) {
            try {
                if (encryptedSharedPreferences.contains(key)) {
                    encryptedSharedPreferences.getLong(key, 0L)
                } else {
                    null
                }
            } catch (e: Exception) {
                logger.e(e) { "Failed to retrieve long for key: $key" }
                throw SecureStorageException("Failed to retrieve long", e)
            }
        }
    }

    override suspend fun putBoolean(key: String, value: Boolean) {
        withContext(Dispatchers.IO) {
            try {
                encryptedSharedPreferences.edit()
                    .putBoolean(key, value)
                    .apply()
            } catch (e: Exception) {
                logger.e(e) { "Failed to store boolean for key: $key" }
                throw SecureStorageException("Failed to store boolean", e)
            }
        }
    }

    override suspend fun getBoolean(key: String): Boolean? {
        return withContext(Dispatchers.IO) {
            try {
                if (encryptedSharedPreferences.contains(key)) {
                    encryptedSharedPreferences.getBoolean(key, false)
                } else {
                    null
                }
            } catch (e: Exception) {
                logger.e(e) { "Failed to retrieve boolean for key: $key" }
                throw SecureStorageException("Failed to retrieve boolean", e)
            }
        }
    }

    override suspend fun remove(key: String) {
        withContext(Dispatchers.IO) {
            try {
                encryptedSharedPreferences.edit()
                    .remove(key)
                    .apply()
            } catch (e: Exception) {
                logger.e(e) { "Failed to remove key: $key" }
                throw SecureStorageException("Failed to remove key", e)
            }
        }
    }

    override suspend fun clear() {
        withContext(Dispatchers.IO) {
            try {
                encryptedSharedPreferences.edit()
                    .clear()
                    .apply()
            } catch (e: Exception) {
                logger.e(e) { "Failed to clear secure storage" }
                throw SecureStorageException("Failed to clear storage", e)
            }
        }
    }

    override suspend fun contains(key: String): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                encryptedSharedPreferences.contains(key)
            } catch (e: Exception) {
                logger.e(e) { "Failed to check if key exists: $key" }
                throw SecureStorageException("Failed to check key existence", e)
            }
        }
    }
}