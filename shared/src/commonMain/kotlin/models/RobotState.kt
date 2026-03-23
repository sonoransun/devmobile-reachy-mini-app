package com.reachy.shared.models

import kotlinx.serialization.Serializable

/**
 * Complete robot state information.
 */
@Serializable
data class RobotState(
    val status: RobotStatus,
    val connection: RobotConnection,
    val pose: RobotPose? = null,
    val sensors: RobotSensors? = null,
    val battery: BatteryInfo? = null,
    val capabilities: List<String> = emptyList(),
    val lastUpdated: String // ISO 8601 format
)

/**
 * Robot operational status.
 */
@Serializable
data class RobotStatus(
    val state: RobotOperationalState,
    val isActive: Boolean,
    val busyReason: String? = null,
    val isCommandRunning: Boolean = false,
    val currentCommand: String? = null,
    val errorMessage: String? = null,
    val uptime: Long? = null // seconds
)

/**
 * Robot operational states.
 */
@Serializable
enum class RobotOperationalState(val value: String) {
    READY("ready"),
    BUSY("busy"),
    ERROR("error"),
    MAINTENANCE("maintenance"),
    STARTING("starting"),
    STOPPING("stopping"),
    UNKNOWN("unknown")
}

/**
 * Robot connection information.
 */
@Serializable
data class RobotConnection(
    val mode: ConnectionMode,
    val host: String? = null,
    val port: Int? = null,
    val latency: Int? = null, // ms
    val quality: ConnectionQualityLevel,
    val isConnected: Boolean,
    val lastSeen: String? = null // ISO 8601 format
)

/**
 * Connection modes for robot communication.
 */
@Serializable
enum class ConnectionMode(val value: String) {
    USB("usb"),
    WIFI("wifi"),
    SIMULATION("simulation"),
    UNKNOWN("unknown")
}

/**
 * Connection quality levels.
 */
@Serializable
enum class ConnectionQualityLevel(val value: String) {
    EXCELLENT("excellent"),
    GOOD("good"),
    FAIR("fair"),
    POOR("poor"),
    UNKNOWN("unknown")
}

/**
 * Robot pose information (6-DOF head + body).
 */
@Serializable
data class RobotPose(
    val headPose: HeadPose,
    val bodyYaw: Float, // degrees
    val antennasPosition: AntennasPosition
)

/**
 * 6-DOF head pose using Stewart platform.
 */
@Serializable
data class HeadPose(
    val x: Float, // mm
    val y: Float, // mm
    val z: Float, // mm
    val roll: Float,  // degrees
    val pitch: Float, // degrees
    val yaw: Float    // degrees
)

/**
 * Antenna positions.
 */
@Serializable
data class AntennasPosition(
    val left: Float,  // degrees
    val right: Float  // degrees
)

/**
 * Robot sensor readings.
 */
@Serializable
data class RobotSensors(
    val temperature: Float? = null, // Celsius
    val accelerometer: Vector3D? = null,
    val gyroscope: Vector3D? = null,
    val magnetometer: Vector3D? = null,
    val proximity: Float? = null,
    val ambientLight: Float? = null
)

/**
 * 3D vector representation.
 */
@Serializable
data class Vector3D(
    val x: Float,
    val y: Float,
    val z: Float
)

/**
 * Battery information.
 */
@Serializable
data class BatteryInfo(
    val level: Int, // 0-100 percentage
    val isCharging: Boolean,
    val voltage: Float? = null,
    val current: Float? = null,
    val temperature: Float? = null,
    val estimatedTimeRemaining: Int? = null // minutes
)

/**
 * Robot movement command.
 */
@Serializable
data class RobotCommand(
    val type: CommandType,
    val target: RobotPose? = null,
    val parameters: Map<String, String> = emptyMap(),
    val duration: Int? = null, // milliseconds
    val priority: CommandPriority = CommandPriority.NORMAL
)

/**
 * Types of robot commands.
 */
@Serializable
enum class CommandType(val value: String) {
    MOVE_TO_POSE("move_to_pose"),
    MOVE_HEAD("move_head"),
    MOVE_BODY("move_body"),
    NOD("nod"),
    SHAKE("shake"),
    LOOK_AROUND("look_around"),
    EXPRESSION("expression"),
    CHOREOGRAPHY("choreography"),
    STOP("stop"),
    RESET_POSE("reset_pose")
}

/**
 * Command execution priority.
 */
@Serializable
enum class CommandPriority(val value: String) {
    LOW("low"),
    NORMAL("normal"),
    HIGH("high"),
    EMERGENCY("emergency")
}