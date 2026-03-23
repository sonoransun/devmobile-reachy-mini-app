const fs = require('fs').promises;
const path = require('path');
const BaseVpnService = require('./baseVpnService');
const logger = require('../../utils/logger');
const { ApiError } = require('../../utils/errors');

/**
 * Wireguard Service - Manages Wireguard VPN connections
 */
class WireguardService extends BaseVpnService {
  constructor(vpnManager) {
    super(vpnManager);
    this.serviceName = 'wireguard';
    this.interfacePrefix = 'reachy-wg';
  }

  /**
   * Connect to Wireguard VPN
   */
  async connect(profile, options = {}) {
    const connectionId = this.generateConnectionId();
    const timeout = options.timeout || 30;

    // Check if wg tools are available
    if (!(await this.isCommandAvailable('wg')) || !(await this.isCommandAvailable('wg-quick'))) {
      throw new ApiError(500, 'WIREGUARD_NOT_AVAILABLE',
        'Wireguard tools are not installed or not available in PATH');
    }

    // Generate interface name
    const interfaceName = `${this.interfacePrefix}-${connectionId.substring(0, 8)}`;

    // Prepare configuration file
    const configPath = await this.prepareConfigFile(profile, interfaceName);

    try {
      await this.writeLog(profile.id, 'info', `Starting Wireguard connection: ${profile.name} on ${interfaceName}`);

      // Use wg-quick to bring up the interface
      await this.execCommand('wg-quick', ['up', configPath], {
        timeout: timeout * 1000,
      });

      await this.writeLog(profile.id, 'info', `Wireguard interface ${interfaceName} is up`);

      const connection = {
        id: connectionId,
        profileId: profile.id,
        interface: interfaceName,
        configPath,
        status: 'connected',
        connectedAt: new Date().toISOString(),
        estimatedTime: 5, // Wireguard connects quickly
        type: 'wireguard',
      };

      this.activeConnections.set(connectionId, connection);

      return connection;
    } catch (error) {
      await this.writeLog(profile.id, 'error', `Wireguard connection failed: ${error.message}`);

      // Cleanup config file
      await this.cleanupFiles(configPath);

      throw new ApiError(500, 'WIREGUARD_CONNECTION_FAILED',
        `Failed to start Wireguard: ${error.message}`);
    }
  }

  /**
   * Disconnect from Wireguard VPN
   */
  async disconnect(connection) {
    if (!connection || connection.type !== 'wireguard') {
      throw new ApiError(400, 'INVALID_CONNECTION', 'Invalid Wireguard connection');
    }

    const { id, interface: interfaceName, configPath } = connection;

    try {
      await this.writeLog(connection.profileId, 'info', `Disconnecting Wireguard interface: ${interfaceName}`);

      // Use wg-quick to bring down the interface
      try {
        await this.execCommand('wg-quick', ['down', configPath], {
          timeout: 15000,
        });
      } catch (error) {
        // If wg-quick fails, try manual cleanup
        await this.manualCleanup(interfaceName);
      }

      // Cleanup configuration file
      await this.cleanupFiles(configPath);

      await this.writeLog(connection.profileId, 'info', 'Wireguard disconnected successfully');

      this.activeConnections.delete(id);

    } catch (error) {
      logger.error('Wireguard disconnection error:', error);
      throw new ApiError(500, 'WIREGUARD_DISCONNECT_FAILED',
        `Failed to disconnect Wireguard: ${error.message}`);
    }
  }

  /**
   * Get Wireguard connection status
   */
  async getStatus(connection) {
    if (!connection || connection.type !== 'wireguard') {
      return {
        status: 'disconnected',
        connected: false,
        connectedAt: null,
        duration: 0,
        publicIp: null,
        localIp: null,
        bytesReceived: 0,
        bytesSent: 0,
        latency: null,
      };
    }

    try {
      const { interface: interfaceName } = connection;

      // Check if interface exists
      if (!(await this.interfaceExists(interfaceName))) {
        return {
          status: 'disconnected',
          connected: false,
          connectedAt: null,
          duration: 0,
          publicIp: null,
          localIp: null,
          bytesReceived: 0,
          bytesSent: 0,
          latency: null,
        };
      }

      // Get interface statistics
      const stats = await this.getInterfaceStats(interfaceName);
      const interfaceInfo = await this.getNetworkInterface(interfaceName);

      const connected = stats.connected;
      const connectedAt = connection.connectedAt;

      return {
        status: connected ? 'connected' : 'connecting',
        connected,
        connectedAt,
        duration: connectedAt ?
          Math.floor((Date.now() - new Date(connectedAt).getTime()) / 1000) : 0,
        publicIp: connected ? await this.getPublicIp() : null,
        localIp: interfaceInfo?.[0]?.address || null,
        bytesReceived: stats.bytesReceived || 0,
        bytesSent: stats.bytesSent || 0,
        latency: connected ? await this.measureLatency() : null,
      };
    } catch (error) {
      logger.error('Failed to get Wireguard status:', error);
      return {
        status: 'error',
        connected: false,
        connectedAt: null,
        duration: 0,
        publicIp: null,
        localIp: null,
        bytesReceived: 0,
        bytesSent: 0,
        latency: null,
      };
    }
  }

  /**
   * Test Wireguard connection
   */
  async testConnection(profile, options = {}) {
    const timeout = options.timeout || 30;

    try {
      // Validate configuration first
      await this.validateConfig(profile.config);

      const startTime = Date.now();

      // Create temporary connection for testing
      const tempConnection = await this.connect(profile, { timeout });

      // Wait a moment for interface to be fully established
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test connectivity
      const connected = await this.testConnectivity();
      const latency = connected ? await this.measureLatency() : null;
      const publicIp = connected ? await this.getPublicIp() : null;

      // Cleanup test connection
      await this.disconnect(tempConnection);

      const duration = Date.now() - startTime;

      return {
        success: connected,
        message: connected ? 'Wireguard test successful' : 'Wireguard connection test failed',
        latency,
        publicIp,
        duration,
        location: null, // TODO: Get location from IP
        details: {
          connectionTime: duration,
          interfaceUp: true,
          handshakeSuccessful: connected,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Wireguard test failed: ${error.message}`,
        latency: null,
        publicIp: null,
        duration: 0,
        location: null,
        details: {
          error: error.message,
        },
      };
    }
  }

  /**
   * Validate Wireguard configuration
   */
  async validateConfig(config) {
    const required = ['privateKey', 'endpoint', 'allowedIPs'];

    for (const field of required) {
      if (!config[field]) {
        throw new ApiError(400, 'INVALID_CONFIG',
          `Wireguard configuration missing required field: ${field}`);
      }
    }

    // Validate key format (base64)
    if (!this.isValidWireguardKey(config.privateKey)) {
      throw new ApiError(400, 'INVALID_CONFIG', 'Invalid Wireguard private key format');
    }

    if (config.publicKey && !this.isValidWireguardKey(config.publicKey)) {
      throw new ApiError(400, 'INVALID_CONFIG', 'Invalid Wireguard public key format');
    }

    // Validate endpoint format (host:port)
    if (!config.endpoint.match(/^.+:\d+$/)) {
      throw new ApiError(400, 'INVALID_CONFIG', 'Invalid endpoint format (expected host:port)');
    }

    return true;
  }

  /**
   * Parse Wireguard configuration
   */
  async parseConfig(content) {
    const config = {
      interface: {},
      peer: {},
    };

    const lines = content.split('\n');
    let currentSection = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        currentSection = trimmed.slice(1, -1).toLowerCase();
      } else if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, value] = trimmed.split('=', 2).map(s => s.trim());

        if (currentSection === 'interface') {
          config.interface[key] = value;
        } else if (currentSection === 'peer') {
          config.peer[key] = value;
        }
      }
    }

    // Convert to our config format
    return {
      privateKey: config.interface.PrivateKey,
      address: config.interface.Address,
      dns: config.interface.DNS,
      publicKey: config.peer.PublicKey,
      endpoint: config.peer.Endpoint,
      allowedIPs: config.peer.AllowedIPs,
      persistentKeepalive: config.peer.PersistentKeepalive,
    };
  }

  /**
   * Export Wireguard configuration
   */
  async exportConfig(profile, format = 'native') {
    if (format === 'json') {
      return {
        name: profile.name,
        type: profile.type,
        config: profile.config,
        provider: profile.provider,
        exported: true,
        exportedAt: new Date().toISOString(),
      };
    } else {
      // Return native .conf format
      const config = profile.config;

      let configContent = '[Interface]\n';
      configContent += `PrivateKey = ${config.privateKey}\n`;

      if (config.address) {
        configContent += `Address = ${config.address}\n`;
      }

      if (config.dns) {
        configContent += `DNS = ${config.dns}\n`;
      }

      configContent += '\n[Peer]\n';
      configContent += `PublicKey = ${config.publicKey}\n`;
      configContent += `Endpoint = ${config.endpoint}\n`;
      configContent += `AllowedIPs = ${config.allowedIPs}\n`;

      if (config.persistentKeepalive) {
        configContent += `PersistentKeepalive = ${config.persistentKeepalive}\n`;
      }

      return configContent;
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Prepare Wireguard configuration file
   */
  async prepareConfigFile(profile, interfaceName) {
    const configPath = path.join('/tmp', `wireguard-${interfaceName}.conf`);
    const config = profile.config;

    let configContent = '[Interface]\n';
    configContent += `PrivateKey = ${config.privateKey}\n`;

    // Add address if provided, otherwise generate one
    if (config.address) {
      configContent += `Address = ${config.address}\n`;
    } else {
      configContent += 'Address = 10.8.0.2/24\n'; // Default address
    }

    // Add DNS settings
    if (config.dns) {
      configContent += `DNS = ${config.dns}\n`;
    } else {
      configContent += 'DNS = 8.8.8.8, 1.1.1.1\n'; // Default DNS
    }

    configContent += '\n[Peer]\n';
    configContent += `PublicKey = ${config.publicKey}\n`;
    configContent += `Endpoint = ${config.endpoint}\n`;
    configContent += `AllowedIPs = ${config.allowedIPs}\n`;

    if (config.persistentKeepalive) {
      configContent += `PersistentKeepalive = ${config.persistentKeepalive}\n`;
    } else {
      configContent += 'PersistentKeepalive = 25\n'; // Default keepalive
    }

    await fs.writeFile(configPath, configContent, { mode: 0o600 });

    return configPath;
  }

  /**
   * Get interface statistics
   */
  async getInterfaceStats(interfaceName) {
    try {
      const result = await this.execCommand('wg', ['show', interfaceName, 'transfer'], {
        timeout: 5000,
      });

      const output = result.stdout.trim();
      if (output) {
        const lines = output.split('\n');
        for (const line of lines) {
          const parts = line.trim().split('\t');
          if (parts.length >= 3) {
            return {
              connected: true,
              bytesReceived: parseInt(parts[1]) || 0,
              bytesSent: parseInt(parts[2]) || 0,
            };
          }
        }
      }

      // Check if interface exists but no transfer stats yet
      const showResult = await this.execCommand('wg', ['show', interfaceName], {
        timeout: 5000,
      });

      return {
        connected: showResult.stdout.trim().length > 0,
        bytesReceived: 0,
        bytesSent: 0,
      };
    } catch (error) {
      return {
        connected: false,
        bytesReceived: 0,
        bytesSent: 0,
      };
    }
  }

  /**
   * Manual cleanup when wg-quick fails
   */
  async manualCleanup(interfaceName) {
    try {
      // Remove the interface
      await this.execCommand('ip', ['link', 'delete', interfaceName]);
    } catch (error) {
      logger.warn(`Failed to manually cleanup interface ${interfaceName}:`, error);
    }
  }

  /**
   * Check if Wireguard key is valid base64
   */
  isValidWireguardKey(key) {
    try {
      // Wireguard keys are 44 characters of base64 (32 bytes + padding)
      if (key.length !== 44) {
        return false;
      }

      // Check if it's valid base64
      const decoded = Buffer.from(key, 'base64');
      return decoded.length === 32;
    } catch (error) {
      return false;
    }
  }

  /**
   * Cleanup configuration files
   */
  async cleanupFiles(...filePaths) {
    for (const filePath of filePaths) {
      if (filePath) {
        try {
          await fs.unlink(filePath);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
  }
}

module.exports = WireguardService;