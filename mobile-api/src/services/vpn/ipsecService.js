const fs = require('fs').promises;
const path = require('path');
const BaseVpnService = require('./baseVpnService');
const logger = require('../../utils/logger');
const { ApiError } = require('../../utils/errors');

/**
 * IPsec Service - Manages IPsec VPN connections using strongSwan
 */
class IpsecService extends BaseVpnService {
  constructor(vpnManager) {
    super(vpnManager);
    this.serviceName = 'ipsec';
    this.configDir = '/etc/strongswan';
  }

  /**
   * Connect to IPsec VPN
   */
  async connect(profile, options = {}) {
    const connectionId = this.generateConnectionId();
    const timeout = options.timeout || 60;

    // Check if strongSwan is available
    if (!(await this.isCommandAvailable('ipsec'))) {
      throw new ApiError(500, 'IPSEC_NOT_AVAILABLE',
        'strongSwan IPsec is not installed or not available in PATH');
    }

    // Prepare configuration files
    const connectionName = `reachy-${connectionId.substring(0, 8)}`;
    await this.prepareIpsecConfig(profile, connectionName);

    try {
      await this.writeLog(profile.id, 'info', `Starting IPsec connection: ${profile.name} (${connectionName})`);

      // Reload strongSwan configuration
      await this.execCommand('ipsec', ['reload'], {
        timeout: 15000,
      });

      // Start the connection
      await this.execCommand('ipsec', ['up', connectionName], {
        timeout: timeout * 1000,
      });

      await this.writeLog(profile.id, 'info', `IPsec connection ${connectionName} established`);

      const connection = {
        id: connectionId,
        profileId: profile.id,
        connectionName,
        status: 'connected',
        connectedAt: new Date().toISOString(),
        estimatedTime: 30,
        type: 'ipsec',
      };

      this.activeConnections.set(connectionId, connection);

      return connection;
    } catch (error) {
      await this.writeLog(profile.id, 'error', `IPsec connection failed: ${error.message}`);

      // Cleanup configuration
      await this.cleanupIpsecConfig(connectionName);

      throw new ApiError(500, 'IPSEC_CONNECTION_FAILED',
        `Failed to start IPsec: ${error.message}`);
    }
  }

  /**
   * Disconnect from IPsec VPN
   */
  async disconnect(connection) {
    if (!connection || connection.type !== 'ipsec') {
      throw new ApiError(400, 'INVALID_CONNECTION', 'Invalid IPsec connection');
    }

    const { id, connectionName } = connection;

    try {
      await this.writeLog(connection.profileId, 'info', `Disconnecting IPsec connection: ${connectionName}`);

      // Bring down the connection
      try {
        await this.execCommand('ipsec', ['down', connectionName], {
          timeout: 30000,
        });
      } catch (error) {
        // Log but don't fail on disconnect errors
        logger.warn(`Failed to gracefully disconnect IPsec ${connectionName}:`, error);
      }

      // Cleanup configuration
      await this.cleanupIpsecConfig(connectionName);

      // Reload to remove the connection definition
      try {
        await this.execCommand('ipsec', ['reload'], {
          timeout: 15000,
        });
      } catch (error) {
        logger.warn('Failed to reload IPsec after cleanup:', error);
      }

      await this.writeLog(connection.profileId, 'info', 'IPsec disconnected successfully');

      this.activeConnections.delete(id);

    } catch (error) {
      logger.error('IPsec disconnection error:', error);
      throw new ApiError(500, 'IPSEC_DISCONNECT_FAILED',
        `Failed to disconnect IPsec: ${error.message}`);
    }
  }

  /**
   * Get IPsec connection status
   */
  async getStatus(connection) {
    if (!connection || connection.type !== 'ipsec') {
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
      const { connectionName } = connection;

      // Check connection status
      const statusResult = await this.execCommand('ipsec', ['status', connectionName], {
        timeout: 10000,
      });

      const isConnected = this.parseIpsecStatus(statusResult.stdout);

      // Get traffic statistics if connected
      let bytesReceived = 0;
      let bytesSent = 0;

      if (isConnected) {
        try {
          const statsResult = await this.execCommand('ipsec', ['statusall'], {
            timeout: 10000,
          });
          const stats = this.parseIpsecStats(statsResult.stdout, connectionName);
          bytesReceived = stats.bytesReceived;
          bytesSent = stats.bytesSent;
        } catch (error) {
          logger.warn('Failed to get IPsec statistics:', error);
        }
      }

      const connectedAt = connection.connectedAt;

      return {
        status: isConnected ? 'connected' : 'disconnected',
        connected: isConnected,
        connectedAt,
        duration: connectedAt && isConnected ?
          Math.floor((Date.now() - new Date(connectedAt).getTime()) / 1000) : 0,
        publicIp: isConnected ? await this.getPublicIp() : null,
        localIp: isConnected ? await this.getIpsecLocalIp(connectionName) : null,
        bytesReceived,
        bytesSent,
        latency: isConnected ? await this.measureLatency() : null,
      };
    } catch (error) {
      logger.error('Failed to get IPsec status:', error);
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
   * Test IPsec connection
   */
  async testConnection(profile, options = {}) {
    const timeout = options.timeout || 60;

    try {
      // Validate configuration first
      await this.validateConfig(profile.config);

      const startTime = Date.now();

      // Create temporary connection for testing
      const tempConnection = await this.connect(profile, { timeout });

      // Wait for connection to establish
      let connected = false;
      let attempts = 0;
      const maxAttempts = timeout;

      while (attempts < maxAttempts && !connected) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const status = await this.getStatus(tempConnection);
        connected = status.connected;
        attempts++;
      }

      // Measure final metrics
      const latency = await this.measureLatency();
      const publicIp = await this.getPublicIp();

      // Cleanup test connection
      await this.disconnect(tempConnection);

      const duration = Date.now() - startTime;

      return {
        success: connected,
        message: connected ? 'IPsec test successful' : 'IPsec connection test failed',
        latency,
        publicIp,
        duration,
        location: null, // TODO: Get location from IP
        details: {
          connectionTime: duration,
          attempts,
          authenticated: connected,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `IPsec test failed: ${error.message}`,
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
   * Validate IPsec configuration
   */
  async validateConfig(config) {
    const required = ['gateway', 'authMethod'];

    for (const field of required) {
      if (!config[field]) {
        throw new ApiError(400, 'INVALID_CONFIG',
          `IPsec configuration missing required field: ${field}`);
      }
    }

    // Validate authentication method
    const validAuthMethods = ['psk', 'cert', 'xauth'];
    if (!validAuthMethods.includes(config.authMethod)) {
      throw new ApiError(400, 'INVALID_CONFIG',
        `Invalid authentication method: ${config.authMethod}. Must be one of: ${validAuthMethods.join(', ')}`);
    }

    // Validate PSK if using pre-shared key
    if (config.authMethod === 'psk' && !config.preSharedKey) {
      throw new ApiError(400, 'INVALID_CONFIG',
        'Pre-shared key is required when using PSK authentication');
    }

    // Validate credentials for XAUTH
    if (config.authMethod === 'xauth' && (!config.username || !config.password)) {
      throw new ApiError(400, 'INVALID_CONFIG',
        'Username and password are required for XAUTH authentication');
    }

    return true;
  }

  /**
   * Parse IPsec configuration - Not commonly used for IPsec
   */
  async parseConfig(content) {
    throw new ApiError(400, 'PARSE_NOT_SUPPORTED',
      'IPsec configuration parsing from file content is not supported. Use structured config instead.');
  }

  /**
   * Export IPsec configuration
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
      // Return strongSwan config format
      const config = profile.config;

      let configContent = `conn ${profile.name}\n`;
      configContent += `  left=%defaultroute\n`;
      configContent += `  right=${config.gateway}\n`;
      configContent += `  ike=${config.ike || 'aes256-sha256-modp2048'}\n`;
      configContent += `  esp=${config.esp || 'aes256-sha256'}\n`;
      configContent += `  keyexchange=${config.keyexchange || 'ikev2'}\n`;
      configContent += `  auto=add\n`;

      if (config.authMethod === 'psk') {
        configContent += `  authby=secret\n`;
      } else if (config.authMethod === 'cert') {
        configContent += `  authby=rsasig\n`;
      }

      return configContent;
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Prepare IPsec configuration files
   */
  async prepareIpsecConfig(profile, connectionName) {
    const config = profile.config;

    // Prepare ipsec.conf entry
    const ipsecConfPath = path.join('/tmp', `ipsec-${connectionName}.conf`);
    let ipsecConf = `conn ${connectionName}\n`;
    ipsecConf += `  left=%defaultroute\n`;
    ipsecConf += `  right=${config.gateway}\n`;
    ipsecConf += `  ike=${config.ike || 'aes256-sha256-modp2048'}\n`;
    ipsecConf += `  esp=${config.esp || 'aes256-sha256'}\n`;
    ipsecConf += `  keyexchange=${config.keyexchange || 'ikev2'}\n`;
    ipsecConf += `  auto=add\n`;

    if (config.authMethod === 'psk') {
      ipsecConf += `  authby=secret\n`;
    } else if (config.authMethod === 'cert') {
      ipsecConf += `  authby=rsasig\n`;
      ipsecConf += `  leftcert=${config.clientCert || 'client.crt'}\n`;
    }

    if (config.subnet) {
      ipsecConf += `  rightsubnet=${config.subnet}\n`;
    }

    await fs.writeFile(ipsecConfPath, ipsecConf);

    // Add to main ipsec.conf
    const mainConfPath = `${this.configDir}/ipsec.conf`;
    await fs.appendFile(mainConfPath, `\ninclude ${ipsecConfPath}\n`);

    // Prepare secrets if using PSK
    if (config.authMethod === 'psk' && config.preSharedKey) {
      const secretsPath = `${this.configDir}/ipsec.secrets`;
      const secretEntry = `%any ${config.gateway} : PSK "${config.preSharedKey}"\n`;
      await fs.appendFile(secretsPath, secretEntry);
    }

    // Store paths for cleanup
    this.configPaths = this.configPaths || new Map();
    this.configPaths.set(connectionName, {
      confPath: ipsecConfPath,
      secretsBackup: config.authMethod === 'psk',
    });
  }

  /**
   * Cleanup IPsec configuration
   */
  async cleanupIpsecConfig(connectionName) {
    try {
      const paths = this.configPaths?.get(connectionName);
      if (paths) {
        // Remove config file
        if (paths.confPath) {
          await fs.unlink(paths.confPath).catch(() => {});
        }

        // TODO: Remove secrets entry (would need to parse and rewrite the file)

        this.configPaths.delete(connectionName);
      }

      // Remove include from main config
      const mainConfPath = `${this.configDir}/ipsec.conf`;
      try {
        let content = await fs.readFile(mainConfPath, 'utf-8');
        const lines = content.split('\n').filter(line =>
          !line.includes(`ipsec-${connectionName}.conf`)
        );
        await fs.writeFile(mainConfPath, lines.join('\n'));
      } catch (error) {
        logger.warn('Failed to cleanup main ipsec.conf:', error);
      }
    } catch (error) {
      logger.warn('Failed to cleanup IPsec config:', error);
    }
  }

  /**
   * Parse IPsec status output
   */
  parseIpsecStatus(statusOutput) {
    // Look for ESTABLISHED connections
    return statusOutput.includes('ESTABLISHED') && statusOutput.includes('INSTALLED');
  }

  /**
   * Parse IPsec statistics
   */
  parseIpsecStats(statusOutput, connectionName) {
    let bytesReceived = 0;
    let bytesSent = 0;

    try {
      // Parse strongSwan status output for traffic statistics
      const lines = statusOutput.split('\n');
      let inConnectionSection = false;

      for (const line of lines) {
        if (line.includes(connectionName)) {
          inConnectionSection = true;
        } else if (inConnectionSection && line.trim() === '') {
          break;
        } else if (inConnectionSection) {
          // Look for traffic statistics patterns
          const trafficMatch = line.match(/(\d+)\s+bytes_i.*?(\d+)\s+bytes_o/);
          if (trafficMatch) {
            bytesReceived = parseInt(trafficMatch[1]) || 0;
            bytesSent = parseInt(trafficMatch[2]) || 0;
            break;
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to parse IPsec statistics:', error);
    }

    return { bytesReceived, bytesSent };
  }

  /**
   * Get local IP for IPsec connection
   */
  async getIpsecLocalIp(connectionName) {
    try {
      // Get route information to determine local IP
      const routeResult = await this.execCommand('ip', ['route', 'show'], {
        timeout: 5000,
      });

      // Parse route output to find IPsec-related routes
      // This is a simplified approach
      const lines = routeResult.stdout.split('\n');
      for (const line of lines) {
        if (line.includes('dev') && line.includes('src')) {
          const srcMatch = line.match(/src\s+([0-9.]+)/);
          if (srcMatch) {
            return srcMatch[1];
          }
        }
      }

      return null;
    } catch (error) {
      logger.warn('Failed to get IPsec local IP:', error);
      return null;
    }
  }
}

module.exports = IpsecService;