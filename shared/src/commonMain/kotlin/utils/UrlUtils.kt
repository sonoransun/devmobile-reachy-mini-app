package com.reachy.shared.utils

/**
 * Utility functions for URL validation and manipulation.
 */
object UrlUtils {

    /**
     * Validate if a URL is properly formatted for HTTP/HTTPS connections.
     */
    fun isValidUrl(url: String): Boolean {
        val trimmedUrl = url.trim()

        if (trimmedUrl.isBlank()) {
            return false
        }

        // Check basic URL format
        if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
            return false
        }

        // Basic regex for URL validation
        val urlRegex = Regex(
            "^https?://(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?::[0-9]{1,5})?(?:/[^\\s]*)?$"
        )

        return urlRegex.matches(trimmedUrl)
    }

    /**
     * Validate if a URL could be a VPN endpoint.
     * VPN endpoints might include special domains or IP addresses.
     */
    fun isValidVpnEndpoint(url: String): Boolean {
        if (!isValidUrl(url)) {
            return false
        }

        // Extract host from URL
        val host = extractHost(url) ?: return false

        // Check if it's an IP address
        if (isValidIpAddress(host)) {
            return true
        }

        // Check for common VPN domain patterns
        val vpnDomainPatterns = listOf(
            "vpn\\.",          // vpn.example.com
            "\\.vpn\\.",       // subdomain.vpn.example.com
            "secure\\.",       // secure.example.com
            "gateway\\.",      // gateway.example.com
            "tunnel\\.",       // tunnel.example.com
            "proxy\\.",        // proxy.example.com
        )

        return vpnDomainPatterns.any { pattern ->
            Regex(pattern).find(host.lowercase()) != null
        }
    }

    /**
     * Extract hostname from URL.
     */
    fun extractHost(url: String): String? {
        return try {
            val urlWithoutProtocol = url.removePrefix("https://").removePrefix("http://")
            val hostWithPort = urlWithoutProtocol.split("/")[0]
            val host = hostWithPort.split(":")[0]
            if (host.isNotBlank()) host else null
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Extract port from URL, returns default port if not specified.
     */
    fun extractPort(url: String): Int? {
        return try {
            val urlWithoutProtocol = url.removePrefix("https://").removePrefix("http://")
            val hostWithPort = urlWithoutProtocol.split("/")[0]
            val parts = hostWithPort.split(":")

            if (parts.size > 1) {
                parts[1].toIntOrNull()
            } else {
                // Return default ports
                if (url.startsWith("https://")) 443 else 80
            }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Check if a string is a valid IPv4 address.
     */
    fun isValidIpAddress(host: String): Boolean {
        val ipRegex = Regex("^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$")
        return ipRegex.matches(host)
    }

    /**
     * Check if URL is using HTTPS protocol.
     */
    fun isHttps(url: String): Boolean {
        return url.trimStart().startsWith("https://")
    }

    /**
     * Normalize URL by removing trailing slashes and ensuring proper format.
     */
    fun normalizeUrl(url: String): String {
        var normalized = url.trim()

        // Remove trailing slash
        if (normalized.endsWith("/") && normalized != "http://" && normalized != "https://") {
            normalized = normalized.removeSuffix("/")
        }

        return normalized
    }

    /**
     * Check if URL appears to be a local network address.
     */
    fun isLocalNetworkUrl(url: String): Boolean {
        val host = extractHost(url) ?: return false

        // Check for localhost
        if (host.equals("localhost", ignoreCase = true) || host == "127.0.0.1") {
            return true
        }

        // Check for private IP ranges
        return isPrivateIpAddress(host)
    }

    /**
     * Check if an IP address is in private ranges (RFC 1918).
     */
    private fun isPrivateIpAddress(ip: String): Boolean {
        if (!isValidIpAddress(ip)) {
            return false
        }

        val parts = ip.split(".").map { it.toInt() }

        return when (parts[0]) {
            10 -> true // 10.0.0.0/8
            172 -> parts[1] in 16..31 // 172.16.0.0/12
            192 -> parts[1] == 168 // 192.168.0.0/16
            else -> false
        }
    }

    /**
     * Build API base URL from user input.
     * Handles common input variations and ensures proper format.
     */
    fun buildApiUrl(userInput: String): String? {
        var input = userInput.trim()

        if (input.isBlank()) {
            return null
        }

        // Add protocol if missing
        if (!input.startsWith("http://") && !input.startsWith("https://")) {
            // Default to HTTPS for security
            input = "https://$input"
        }

        // Validate the resulting URL
        if (!isValidUrl(input)) {
            return null
        }

        return normalizeUrl(input)
    }

    /**
     * Get display name for URL (hide sensitive information if needed).
     */
    fun getDisplayUrl(url: String, hideSensitiveInfo: Boolean = false): String {
        if (!hideSensitiveInfo) {
            return url
        }

        val host = extractHost(url) ?: return url
        val port = extractPort(url)
        val protocol = if (isHttps(url)) "https" else "http"

        return if (port != null && port != 80 && port != 443) {
            "$protocol://$host:$port"
        } else {
            "$protocol://$host"
        }
    }
}