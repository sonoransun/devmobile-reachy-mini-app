package com.reachy.shared.models

import kotlinx.serialization.Serializable

/**
 * Application settings and configuration.
 */
@Serializable
data class AppSettings(
    val general: GeneralSettings = GeneralSettings(),
    val robot: RobotSettings = RobotSettings(),
    val network: NetworkSettings = NetworkSettings(),
    val audio: AudioSettings = AudioSettings(),
    val video: VideoSettings = VideoSettings(),
    val notifications: NotificationSettings = NotificationSettings(),
    val developer: DeveloperSettings = DeveloperSettings()
)

/**
 * General application settings.
 */
@Serializable
data class GeneralSettings(
    val theme: AppTheme = AppTheme.SYSTEM,
    val language: String = "en",
    val autoConnect: Boolean = false,
    val rememberLastConnection: Boolean = true,
    val showWelcomeScreen: Boolean = true,
    val analyticsEnabled: Boolean = true,
    val crashReportingEnabled: Boolean = true
)

/**
 * Robot-specific settings.
 */
@Serializable
data class RobotSettings(
    val defaultMovementSpeed: MovementSpeed = MovementSpeed.NORMAL,
    val safetyLimits: SafetyLimits = SafetyLimits(),
    val autoReturnHome: Boolean = true,
    val emergencyStopEnabled: Boolean = true,
    val voiceControlEnabled: Boolean = false,
    val gestureControlEnabled: Boolean = false
)

/**
 * Network and connectivity settings.
 */
@Serializable
data class NetworkSettings(
    val connectionTimeout: Int = 30, // seconds
    val retryAttempts: Int = 3,
    val useCompression: Boolean = true,
    val preferIPv6: Boolean = false,
    val proxyEnabled: Boolean = false,
    val proxyHost: String? = null,
    val proxyPort: Int? = null
)

/**
 * Audio configuration settings.
 */
@Serializable
data class AudioSettings(
    val volume: Float = 0.8f, // 0.0 to 1.0
    val microphoneEnabled: Boolean = true,
    val microphoneGain: Float = 1.0f,
    val echoReduction: Boolean = true,
    val noiseReduction: Boolean = true,
    val audioCodec: AudioCodec = AudioCodec.AAC
)

/**
 * Video configuration settings.
 */
@Serializable
data class VideoSettings(
    val quality: VideoQuality = VideoQuality.HD_720P,
    val frameRate: Int = 30, // fps
    val brightness: Float = 0.5f, // 0.0 to 1.0
    val contrast: Float = 0.5f,   // 0.0 to 1.0
    val saturation: Float = 0.5f, // 0.0 to 1.0
    val autoExposure: Boolean = true,
    val nightMode: Boolean = false
)

/**
 * Notification preferences.
 */
@Serializable
data class NotificationSettings(
    val enabled: Boolean = true,
    val soundEnabled: Boolean = true,
    val vibrationEnabled: Boolean = true,
    val robotStatusUpdates: Boolean = true,
    val connectionAlerts: Boolean = true,
    val errorNotifications: Boolean = true,
    val maintenanceReminders: Boolean = true
)

/**
 * Developer and debugging settings.
 */
@Serializable
data class DeveloperSettings(
    val debugMode: Boolean = false,
    val verboseLogging: Boolean = false,
    val showPerformanceMetrics: Boolean = false,
    val enableApiLogging: Boolean = false,
    val mockDataEnabled: Boolean = false,
    val betaFeaturesEnabled: Boolean = false
)

/**
 * Safety limits for robot movements.
 */
@Serializable
data class SafetyLimits(
    val maxHeadSpeed: Float = 50.0f, // degrees per second
    val maxBodySpeed: Float = 30.0f, // degrees per second
    val workspaceRadius: Float = 200.0f, // mm
    val emergencyStopDistance: Float = 50.0f // mm
)

/**
 * Application theme options.
 */
@Serializable
enum class AppTheme(val value: String) {
    LIGHT("light"),
    DARK("dark"),
    SYSTEM("system")
}

/**
 * Robot movement speed presets.
 */
@Serializable
enum class MovementSpeed(val value: String, val multiplier: Float) {
    SLOW("slow", 0.5f),
    NORMAL("normal", 1.0f),
    FAST("fast", 1.5f),
    CUSTOM("custom", 1.0f)
}

/**
 * Video quality options.
 */
@Serializable
enum class VideoQuality(val value: String, val width: Int, val height: Int) {
    SD_480P("480p", 640, 480),
    HD_720P("720p", 1280, 720),
    FULL_HD_1080P("1080p", 1920, 1080),
    AUTO("auto", 0, 0)
}

/**
 * Audio codec options.
 */
@Serializable
enum class AudioCodec(val value: String) {
    AAC("aac"),
    MP3("mp3"),
    OPUS("opus"),
    PCM("pcm")
}

/**
 * Setting update request.
 */
@Serializable
data class SettingUpdate(
    val key: String,
    val value: String,
    val category: SettingCategory? = null
)

/**
 * Setting categories for organization.
 */
@Serializable
enum class SettingCategory(val value: String) {
    GENERAL("general"),
    ROBOT("robot"),
    NETWORK("network"),
    AUDIO("audio"),
    VIDEO("video"),
    NOTIFICATIONS("notifications"),
    DEVELOPER("developer")
}