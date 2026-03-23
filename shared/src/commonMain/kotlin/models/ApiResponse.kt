package com.reachy.shared.models

import kotlinx.serialization.Serializable

/**
 * Generic API response wrapper for consistent response handling.
 */
@Serializable
data class ApiResponse<T>(
    val success: Boolean,
    val data: T? = null,
    val error: ApiError? = null,
    val timestamp: String? = null,
    val correlationId: String? = null
)

/**
 * API error information.
 */
@Serializable
data class ApiError(
    val code: String,
    val message: String,
    val details: String? = null,
    val field: String? = null, // For validation errors
    val type: ApiErrorType = ApiErrorType.UNKNOWN
)

/**
 * Types of API errors.
 */
@Serializable
enum class ApiErrorType(val value: String) {
    VALIDATION("validation"),
    AUTHENTICATION("authentication"),
    AUTHORIZATION("authorization"),
    NOT_FOUND("not_found"),
    CONFLICT("conflict"),
    RATE_LIMITED("rate_limited"),
    SERVER_ERROR("server_error"),
    NETWORK_ERROR("network_error"),
    TIMEOUT("timeout"),
    UNKNOWN("unknown")
}

/**
 * Paginated response wrapper.
 */
@Serializable
data class PaginatedResponse<T>(
    val data: List<T>,
    val pagination: PaginationInfo
)

/**
 * Pagination information.
 */
@Serializable
data class PaginationInfo(
    val page: Int,
    val pageSize: Int,
    val totalItems: Int,
    val totalPages: Int,
    val hasNext: Boolean,
    val hasPrevious: Boolean
)

/**
 * Result wrapper for success/error handling.
 */
sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val error: ApiError) : Result<Nothing>()

    inline fun <R> map(transform: (T) -> R): Result<R> = when (this) {
        is Success -> Success(transform(data))
        is Error -> this
    }

    inline fun onSuccess(action: (T) -> Unit): Result<T> {
        if (this is Success) action(data)
        return this
    }

    inline fun onError(action: (ApiError) -> Unit): Result<T> {
        if (this is Error) action(error)
        return this
    }
}

/**
 * Extension function to convert ApiResponse to Result.
 */
fun <T> ApiResponse<T>.toResult(): Result<T> {
    return if (success && data != null) {
        Result.Success(data)
    } else {
        Result.Error(error ?: ApiError("UNKNOWN", "Unknown error occurred"))
    }
}

/**
 * HTTP status codes for API responses.
 */
enum class HttpStatus(val code: Int) {
    OK(200),
    CREATED(201),
    ACCEPTED(202),
    NO_CONTENT(204),
    BAD_REQUEST(400),
    UNAUTHORIZED(401),
    FORBIDDEN(403),
    NOT_FOUND(404),
    CONFLICT(409),
    UNPROCESSABLE_ENTITY(422),
    TOO_MANY_REQUESTS(429),
    INTERNAL_SERVER_ERROR(500),
    BAD_GATEWAY(502),
    SERVICE_UNAVAILABLE(503),
    GATEWAY_TIMEOUT(504)
}