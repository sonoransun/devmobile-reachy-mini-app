package com.reachy.shared.platform

import kotlinx.cinterop.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import platform.CoreFoundation.*
import platform.Foundation.*
import platform.Security.*
import co.touchlab.kermit.Logger

/**
 * iOS implementation of SecureStorage using Keychain Services.
 * This implementation stores data securely in the iOS Keychain.
 */
class IOSSecureStorage : SecureStorage {
    private val logger = Logger.withTag("IOSSecureStorage")

    companion object {
        private const val SERVICE_NAME = "com.reachy.shared"
    }

    override suspend fun putString(key: String, value: String) {
        withContext(Dispatchers.Default) {
            try {
                // First, try to update existing item
                val updateQuery = createUpdateQuery(key, value)
                val updateStatus = SecItemUpdate(createSearchQuery(key), updateQuery)

                if (updateStatus == errSecItemNotFound) {
                    // Item doesn't exist, create new one
                    val status = SecItemAdd(createAddQuery(key, value), null)
                    if (status != errSecSuccess) {
                        throw SecureStorageException("Failed to add item to keychain: $status")
                    }
                } else if (updateStatus != errSecSuccess) {
                    throw SecureStorageException("Failed to update item in keychain: $updateStatus")
                }
            } catch (e: Exception) {
                logger.e(e) { "Failed to store string for key: $key" }
                throw SecureStorageException("Failed to store string", e)
            }
        }
    }

    override suspend fun getString(key: String): String? {
        return withContext(Dispatchers.Default) {
            try {
                memScoped {
                    val result = alloc<CFTypeRefVar>()
                    val status = SecItemCopyMatching(createSearchQuery(key, returnData = true), result.ptr)

                    if (status == errSecItemNotFound) {
                        return@withContext null
                    }

                    if (status != errSecSuccess) {
                        throw SecureStorageException("Failed to retrieve item from keychain: $status")
                    }

                    val data = result.value as CFDataRef
                    val nsData = data as NSData
                    val string = NSString.create(nsData, NSUTF8StringEncoding)
                    string?.toString()
                }
            } catch (e: Exception) {
                logger.e(e) { "Failed to retrieve string for key: $key" }
                throw SecureStorageException("Failed to retrieve string", e)
            }
        }
    }

    override suspend fun putLong(key: String, value: Long) {
        putString(key, value.toString())
    }

    override suspend fun getLong(key: String): Long? {
        return getString(key)?.toLongOrNull()
    }

    override suspend fun putBoolean(key: String, value: Boolean) {
        putString(key, value.toString())
    }

    override suspend fun getBoolean(key: String): Boolean? {
        return getString(key)?.toBooleanStrictOrNull()
    }

    override suspend fun remove(key: String) {
        withContext(Dispatchers.Default) {
            try {
                val status = SecItemDelete(createSearchQuery(key))
                if (status != errSecSuccess && status != errSecItemNotFound) {
                    throw SecureStorageException("Failed to remove item from keychain: $status")
                }
            } catch (e: Exception) {
                logger.e(e) { "Failed to remove key: $key" }
                throw SecureStorageException("Failed to remove key", e)
            }
        }
    }

    override suspend fun clear() {
        withContext(Dispatchers.Default) {
            try {
                val query = CFDictionaryCreateMutable(null, 0, null, null)
                CFDictionarySetValue(query, kSecClass, kSecClassGenericPassword)
                CFDictionarySetValue(query, kSecAttrService, CFBridgingRetain(SERVICE_NAME.toNSString()))

                val status = SecItemDelete(query)
                if (status != errSecSuccess && status != errSecItemNotFound) {
                    throw SecureStorageException("Failed to clear keychain: $status")
                }
            } catch (e: Exception) {
                logger.e(e) { "Failed to clear secure storage" }
                throw SecureStorageException("Failed to clear storage", e)
            }
        }
    }

    override suspend fun contains(key: String): Boolean {
        return withContext(Dispatchers.Default) {
            try {
                val status = SecItemCopyMatching(createSearchQuery(key), null)
                status == errSecSuccess
            } catch (e: Exception) {
                logger.e(e) { "Failed to check if key exists: $key" }
                throw SecureStorageException("Failed to check key existence", e)
            }
        }
    }

    private fun createSearchQuery(key: String, returnData: Boolean = false): CFDictionaryRef {
        val query = CFDictionaryCreateMutable(null, 0, null, null)
        CFDictionarySetValue(query, kSecClass, kSecClassGenericPassword)
        CFDictionarySetValue(query, kSecAttrService, CFBridgingRetain(SERVICE_NAME.toNSString()))
        CFDictionarySetValue(query, kSecAttrAccount, CFBridgingRetain(key.toNSString()))

        if (returnData) {
            CFDictionarySetValue(query, kSecReturnData, kCFBooleanTrue)
            CFDictionarySetValue(query, kSecMatchLimit, kSecMatchLimitOne)
        }

        return query
    }

    private fun createAddQuery(key: String, value: String): CFDictionaryRef {
        val query = CFDictionaryCreateMutable(null, 0, null, null)
        CFDictionarySetValue(query, kSecClass, kSecClassGenericPassword)
        CFDictionarySetValue(query, kSecAttrService, CFBridgingRetain(SERVICE_NAME.toNSString()))
        CFDictionarySetValue(query, kSecAttrAccount, CFBridgingRetain(key.toNSString()))

        val valueData = value.toNSString().dataUsingEncoding(NSUTF8StringEncoding)
        CFDictionarySetValue(query, kSecValueData, CFBridgingRetain(valueData))

        // Set accessibility - data is available when device is unlocked
        CFDictionarySetValue(query, kSecAttrAccessible, kSecAttrAccessibleWhenUnlockedThisDeviceOnly)

        return query
    }

    private fun createUpdateQuery(key: String, value: String): CFDictionaryRef {
        val query = CFDictionaryCreateMutable(null, 0, null, null)
        val valueData = value.toNSString().dataUsingEncoding(NSUTF8StringEncoding)
        CFDictionarySetValue(query, kSecValueData, CFBridgingRetain(valueData))
        return query
    }

    private fun String.toNSString(): NSString = NSString.stringWithUTF8String(this)!!
}