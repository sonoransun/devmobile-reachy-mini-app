package com.reachy.shared.models

import kotlinx.serialization.Serializable

/**
 * Represents a system log entry.
 * Unified model based on iOS and Android implementations and mobile-api specification.
 */
@Serializable
data class LogEntry(
    val id: String,
    val timestamp: String, // ISO 8601 format
    val level: LogLevel,
    val component: String,
    val message: String,
    val threadId: String? = null,
    val userId: String? = null,
    val sessionId: String? = null,
    val metadata: LogMetadata? = null
)

/**
 * Log severity levels.
 */
@Serializable
enum class LogLevel(val value: String, val priority: Int) {
    TRACE("trace", 0),
    DEBUG("debug", 1),
    INFO("info", 2),
    WARN("warn", 3),
    ERROR("error", 4),
    FATAL("fatal", 5);

    companion object {
        fun fromString(value: String): LogLevel? {
            return values().find { it.value.equals(value, ignoreCase = true) }
        }
    }
}

/**
 * Additional metadata for log entries.
 */
@Serializable
data class LogMetadata(
    val stackTrace: String? = null,
    val requestId: String? = null,
    val deviceId: String? = null,
    val appVersion: String? = null,
    val osVersion: String? = null,
    val additionalData: Map<String, String> = emptyMap()
)

/**
 * Log query parameters for filtering and pagination.
 */
@Serializable
data class LogQuery(
    val level: LogLevel? = null,
    val component: String? = null,
    val search: String? = null,
    val startTime: String? = null, // ISO 8601 format
    val endTime: String? = null,   // ISO 8601 format
    val limit: Int = 50,
    val offset: Int = 0
)

/**
 * Paginated log response.
 */
@Serializable
data class LogResponse(
    val entries: List<LogEntry>,
    val totalCount: Int,
    val hasMore: Boolean,
    val nextOffset: Int?
)