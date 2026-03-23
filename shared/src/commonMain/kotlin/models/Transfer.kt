package com.reachy.shared.models

import kotlinx.serialization.Serializable

/**
 * Represents a file transfer operation (upload/download/export).
 * Unified model based on iOS and Android implementations and mobile-api specification.
 */
@Serializable
data class Transfer(
    val id: String,
    val name: String,
    val type: TransferType,
    val status: TransferStatus,
    val progress: Float = 0.0f, // 0.0 to 1.0
    val startTime: String,
    val endTime: String? = null,
    val totalSize: Long? = null, // bytes
    val transferredSize: Long? = null, // bytes
    val transferRate: Double? = null, // bytes per second
    val estimatedTimeRemaining: Long? = null, // seconds
    val errorMessage: String? = null,
    val metadata: TransferMetadata? = null
)

/**
 * Types of transfer operations supported.
 */
@Serializable
enum class TransferType(val value: String) {
    UPLOAD("upload"),
    DOWNLOAD("download"),
    DIAGNOSTICS("diagnostics"),
    LOGS("logs"),
    SYSTEM_BACKUP("system_backup"),
    CONFIGURATION("configuration")
}

/**
 * Current status of a transfer operation.
 */
@Serializable
enum class TransferStatus(val value: String) {
    PENDING("pending"),
    IN_PROGRESS("in_progress"),
    COMPLETED("completed"),
    FAILED("failed"),
    CANCELLED("cancelled"),
    PAUSED("paused")
}

/**
 * Additional metadata for transfer operations.
 */
@Serializable
data class TransferMetadata(
    val filePath: String? = null,
    val mimeType: String? = null,
    val checksum: String? = null,
    val compressionType: String? = null,
    val description: String? = null,
    val tags: List<String> = emptyList()
)

/**
 * Diagnostic export configuration.
 */
@Serializable
data class DiagnosticExport(
    val id: String,
    val components: List<DiagnosticComponent>,
    val format: ExportFormat = ExportFormat.ZIP,
    val includeSystemLogs: Boolean = true,
    val includeApplicationLogs: Boolean = true,
    val includePerformanceMetrics: Boolean = false,
    val dateRange: DateRange? = null
)

/**
 * Available diagnostic components for export.
 */
@Serializable
enum class DiagnosticComponent(val value: String) {
    SYSTEM_INFO("system"),
    ROBOT_STATE("robot"),
    NETWORK_CONFIG("network"),
    APPLICATION_STATE("applications"),
    PERFORMANCE_METRICS("performance"),
    SYSTEM_LOGS("logs"),
    ERROR_LOGS("errors"),
    VPN_CONFIG("vpn")
}

/**
 * Export format options.
 */
@Serializable
enum class ExportFormat(val value: String) {
    ZIP("zip"),
    TAR_GZ("tar.gz"),
    JSON("json"),
    CSV("csv")
}

/**
 * Date range specification for filtered exports.
 */
@Serializable
data class DateRange(
    val startDate: String, // ISO 8601 format
    val endDate: String    // ISO 8601 format
)