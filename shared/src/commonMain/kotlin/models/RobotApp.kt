package com.reachy.shared.models

import kotlinx.serialization.Serializable

/**
 * Represents a robot application that can be installed and managed.
 * Unified model based on iOS and Android implementations and mobile-api specification.
 */
@Serializable
data class RobotApp(
    val id: String,
    val name: String,
    val description: String,
    val version: String,
    val isInstalled: Boolean = false,
    val isRunning: Boolean = false,
    val installationStatus: AppInstallationStatus = AppInstallationStatus.NOT_INSTALLED,
    val iconUrl: String? = null,
    val category: String? = null,
    val author: String? = null,
    val size: Long? = null, // bytes
    val lastUpdated: String? = null,
    val requirements: AppRequirements? = null
)

/**
 * Installation status of a robot application.
 */
@Serializable
enum class AppInstallationStatus(val value: String) {
    NOT_INSTALLED("not_installed"),
    DOWNLOADING("downloading"),
    INSTALLING("installing"),
    INSTALLED("installed"),
    UPDATING("updating"),
    FAILED("failed"),
    UNINSTALLING("uninstalling")
}

/**
 * Application runtime status.
 */
@Serializable
enum class AppRuntimeStatus(val value: String) {
    STOPPED("stopped"),
    STARTING("starting"),
    RUNNING("running"),
    STOPPING("stopping"),
    ERROR("error")
}

/**
 * System requirements for a robot application.
 */
@Serializable
data class AppRequirements(
    val minRobotVersion: String? = null,
    val requiredCapabilities: List<String> = emptyList(),
    val memoryRequirement: Long? = null, // bytes
    val storageRequirement: Long? = null // bytes
)

/**
 * Application installation/operation job tracking.
 */
@Serializable
data class AppJob(
    val id: String,
    val appId: String,
    val operation: AppOperation,
    val status: JobStatus,
    val progress: Float = 0.0f, // 0.0 to 1.0
    val startTime: String,
    val endTime: String? = null,
    val errorMessage: String? = null
)

/**
 * Types of operations that can be performed on applications.
 */
@Serializable
enum class AppOperation(val value: String) {
    INSTALL("install"),
    UNINSTALL("uninstall"),
    UPDATE("update"),
    START("start"),
    STOP("stop")
}

/**
 * Job execution status.
 */
@Serializable
enum class JobStatus(val value: String) {
    PENDING("pending"),
    RUNNING("running"),
    COMPLETED("completed"),
    FAILED("failed"),
    CANCELLED("cancelled")
}