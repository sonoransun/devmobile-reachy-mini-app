package com.reachy.shared.network

import com.reachy.shared.models.*
import com.reachy.shared.platform.SecureStorage
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.plugins.*
import io.ktor.client.plugins.auth.*
import io.ktor.client.plugins.auth.providers.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.plugins.logging.*
import io.ktor.client.plugins.websocket.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.Json
import co.touchlab.kermit.Logger

/**
 * Main API client for communicating with the Reachy mobile-api backend.
 * Provides centralized HTTP configuration, authentication, and request handling.
 */
class ApiClient(
    private val secureStorage: SecureStorage,
    private val deviceId: String,
    private val platform: DevicePlatform
) {
    private val logger = Logger.withTag("ApiClient")
    private val tokenMutex = Mutex()

    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private var baseUrl: String = ""
    private var currentTokens: TokenPair? = null

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = false
    }

    private val httpClient = HttpClient {
        install(ContentNegotiation) {
            json(json)
        }

        install(Logging) {
            logger = object : io.ktor.client.plugins.logging.Logger {
                override fun log(message: String) {
                    this@ApiClient.logger.d { "HTTP: $message" }
                }
            }
            level = LogLevel.INFO
        }

        install(Auth) {
            bearer {
                loadTokens {
                    currentTokens?.let { tokens ->
                        BearerTokens(
                            accessToken = tokens.accessToken,
                            refreshToken = tokens.refreshToken
                        )
                    }
                }

                refreshTokens {
                    tokenMutex.withLock {
                        try {
                            val refreshToken = currentTokens?.refreshToken
                                ?: throw AuthenticationException("No refresh token available")

                            val response = httpClient.post("$baseUrl/api/v1/auth/refresh") {
                                contentType(ContentType.Application.Json)
                                setBody(RefreshTokenRequest(refreshToken))
                            }

                            if (response.status.isSuccess()) {
                                val authResponse: AuthResponse = response.body()
                                val newTokens = TokenPair(
                                    accessToken = authResponse.accessToken,
                                    refreshToken = authResponse.refreshToken,
                                    expiresAt = System.currentTimeMillis() + (authResponse.expiresIn * 1000)
                                )

                                saveTokens(newTokens)
                                BearerTokens(
                                    accessToken = newTokens.accessToken,
                                    refreshToken = newTokens.refreshToken
                                )
                            } else {
                                // Refresh failed, clear tokens and require re-authentication
                                clearTokens()
                                _connectionState.value = ConnectionState.AUTHENTICATION_FAILED
                                throw AuthenticationException("Token refresh failed")
                            }
                        } catch (e: Exception) {
                            logger.e(e) { "Token refresh failed" }
                            clearTokens()
                            _connectionState.value = ConnectionState.AUTHENTICATION_FAILED
                            throw e
                        }
                    }
                }
            }
        }

        install(DefaultRequest) {
            header("X-Device-ID", deviceId)
            header("X-Platform", platform.value)
            header("X-App-Version", "1.0.0") // TODO: Get from build config
            header("Content-Type", ContentType.Application.Json.toString())
        }

        install(HttpTimeout) {
            requestTimeoutMillis = 30000 // 30 seconds
            connectTimeoutMillis = 15000 // 15 seconds
            socketTimeoutMillis = 30000  // 30 seconds
        }

        install(WebSockets) {
            contentConverter = KotlinxWebsocketSerializationConverter(json)
        }

        // Global response handling
        install(ResponseObserver) {
            onResponse { response ->
                when {
                    response.status.isSuccess() -> {
                        if (_connectionState.value != ConnectionState.CONNECTED) {
                            _connectionState.value = ConnectionState.CONNECTED
                        }
                    }
                    response.status == HttpStatusCode.Unauthorized -> {
                        _connectionState.value = ConnectionState.AUTHENTICATION_FAILED
                    }
                    response.status == HttpStatusCode.ServiceUnavailable -> {
                        _connectionState.value = ConnectionState.SERVER_ERROR
                    }
                    !response.status.isSuccess() -> {
                        logger.w { "API request failed: ${response.status} ${response.status.description}" }
                    }
                }
            }
        }
    }

    /**
     * Initialize the API client with a base URL.
     */
    suspend fun initialize(baseUrl: String): Result<Unit> {
        return try {
            this.baseUrl = baseUrl.trimEnd('/')
            loadStoredTokens()
            _connectionState.value = ConnectionState.CONNECTING

            // Test connection with a health check
            val response = httpClient.get("$baseUrl/health")
            if (response.status.isSuccess()) {
                _connectionState.value = if (currentTokens != null) {
                    ConnectionState.CONNECTED
                } else {
                    ConnectionState.AUTHENTICATION_REQUIRED
                }
                Result.Success(Unit)
            } else {
                _connectionState.value = ConnectionState.CONNECTION_FAILED
                Result.Error(ApiError("CONNECTION_FAILED", "Unable to connect to server"))
            }
        } catch (e: Exception) {
            logger.e(e) { "Failed to initialize API client" }
            _connectionState.value = ConnectionState.CONNECTION_FAILED
            Result.Error(ApiError("INITIALIZATION_FAILED", e.message ?: "Unknown error"))
        }
    }

    /**
     * Perform authenticated login with device credentials.
     */
    suspend fun login(deviceName: String): Result<AuthResponse> {
        return try {
            _connectionState.value = ConnectionState.AUTHENTICATING

            val response = httpClient.post("$baseUrl/api/v1/auth/login") {
                setBody(
                    AuthRequest(
                        deviceId = deviceId,
                        deviceName = deviceName,
                        platform = platform
                    )
                )
            }

            if (response.status.isSuccess()) {
                val authResponse: AuthResponse = response.body()
                val tokens = TokenPair(
                    accessToken = authResponse.accessToken,
                    refreshToken = authResponse.refreshToken,
                    expiresAt = System.currentTimeMillis() + (authResponse.expiresIn * 1000)
                )

                saveTokens(tokens)
                _connectionState.value = ConnectionState.CONNECTED

                Result.Success(authResponse)
            } else {
                _connectionState.value = ConnectionState.AUTHENTICATION_FAILED
                val errorBody = response.bodyAsText()
                Result.Error(ApiError("AUTHENTICATION_FAILED", errorBody))
            }
        } catch (e: Exception) {
            logger.e(e) { "Login failed" }
            _connectionState.value = ConnectionState.AUTHENTICATION_FAILED
            Result.Error(ApiError("LOGIN_ERROR", e.message ?: "Login failed"))
        }
    }

    /**
     * Logout and clear stored tokens.
     */
    suspend fun logout(): Result<Unit> {
        return try {
            if (currentTokens != null) {
                httpClient.post("$baseUrl/api/v1/auth/logout")
            }
            clearTokens()
            _connectionState.value = ConnectionState.DISCONNECTED
            Result.Success(Unit)
        } catch (e: Exception) {
            logger.e(e) { "Logout failed" }
            clearTokens()
            _connectionState.value = ConnectionState.DISCONNECTED
            Result.Error(ApiError("LOGOUT_ERROR", e.message ?: "Logout failed"))
        }
    }

    /**
     * Get the configured HTTP client for making API requests.
     */
    fun getHttpClient(): HttpClient = httpClient

    /**
     * Get the current base URL.
     */
    fun getBaseUrl(): String = baseUrl

    /**
     * Check if the client is currently authenticated.
     */
    fun isAuthenticated(): Boolean = currentTokens != null

    private suspend fun loadStoredTokens() {
        try {
            val accessToken = secureStorage.getString("access_token")
            val refreshToken = secureStorage.getString("refresh_token")
            val expiresAt = secureStorage.getLong("token_expires_at")

            if (accessToken != null && refreshToken != null) {
                currentTokens = TokenPair(accessToken, refreshToken, expiresAt ?: 0)
            }
        } catch (e: Exception) {
            logger.w(e) { "Failed to load stored tokens" }
        }
    }

    private suspend fun saveTokens(tokens: TokenPair) {
        try {
            currentTokens = tokens
            secureStorage.putString("access_token", tokens.accessToken)
            secureStorage.putString("refresh_token", tokens.refreshToken)
            secureStorage.putLong("token_expires_at", tokens.expiresAt)
        } catch (e: Exception) {
            logger.e(e) { "Failed to save tokens" }
        }
    }

    private suspend fun clearTokens() {
        try {
            currentTokens = null
            secureStorage.remove("access_token")
            secureStorage.remove("refresh_token")
            secureStorage.remove("token_expires_at")
        } catch (e: Exception) {
            logger.e(e) { "Failed to clear tokens" }
        }
    }
}

/**
 * JWT token pair for authentication.
 */
private data class TokenPair(
    val accessToken: String,
    val refreshToken: String,
    val expiresAt: Long
)

/**
 * Connection states for the API client.
 */
enum class ConnectionState {
    DISCONNECTED,
    CONNECTING,
    AUTHENTICATION_REQUIRED,
    AUTHENTICATING,
    CONNECTED,
    CONNECTION_FAILED,
    AUTHENTICATION_FAILED,
    SERVER_ERROR
}

/**
 * Exception thrown when authentication fails.
 */
class AuthenticationException(message: String, cause: Throwable? = null) : Exception(message, cause)