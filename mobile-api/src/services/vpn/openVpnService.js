const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const BaseVpnService = require('./baseVpnService');
const logger = require('../../utils/logger');
const { ApiError } = require('../../utils/errors');

/**
 * OpenVPN Service - Manages OpenVPN connections
 */
class OpenVpnService extends BaseVpnService {
  constructor(vpnManager) {
    super(vpnManager);
    this.serviceName = 'openvpn';
  }

  /**
   * Connect to OpenVPN
   */
  async connect(profile, options = {}) {
    const connectionId = this.generateConnectionId();
    const timeout = options.timeout || 60;

    // Check if OpenVPN is available
    if (!(await this.isCommandAvailable('openvpn'))) {
      throw new ApiError(500, 'OPENVPN_NOT_AVAILABLE', 'OpenVPN is not installed or not available in PATH');
    }

    // Prepare configuration file
    const configPath = await this.prepareConfigFile(profile);
    const authPath = await this.prepareAuthFile(profile);

    const args = [
      '--config', configPath,
      '--daemon',
      '--writepid', `/tmp/openvpn-${connectionId}.pid`,
      '--log-append', this.getLogPath(profile.id),
      '--verb', '3', // Verbose logging
      '--connect-retry-max', '3',
      '--connect-timeout', timeout.toString(),
    ];

    // Add authentication file if present
    if (authPath) {
      args.push('--auth-user-pass', authPath);
    }

    // Add management interface for status monitoring
    const managementSocket = `/tmp/openvpn-mgmt-${connectionId}.sock`;
    args.push('--management', managementSocket, 'unix');
    args.push('--management-client-auth');

    try {
      await this.writeLog(profile.id, 'info', `Starting OpenVPN connection: ${profile.name}`);

      const child = spawn('openvpn', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
      });

      child.unref(); // Allow parent process to exit

      const connection = {
        id: connectionId,
        profileId: profile.id,
        process: child,
        pid: null,
        status: 'connecting',
        connectedAt: null,
        managementSocket,
        configPath,
        authPath,
        estimatedTime: 30,
        type: 'openvpn',
      };

      // Read PID from file after daemon starts
      setTimeout(async () => {
        try {
          const pidFile = `/tmp/openvpn-${connectionId}.pid`;
          const pid = await fs.readFile(pidFile, 'utf-8');
          connection.pid = parseInt(pid.trim());

          await this.writeLog(profile.id, 'info', `OpenVPN daemon started with PID: ${connection.pid}`);
        } catch (error) {
          logger.warn('Failed to read OpenVPN PID:', error);
        }
      }, 2000);

      // Monitor connection establishment
      this.monitorConnection(connection);

      this.activeConnections.set(connectionId, connection);

      return connection;
    } catch (error) {
      await this.writeLog(profile.id, 'error', `OpenVPN connection failed: ${error.message}`);

      // Cleanup files
      await this.cleanupFiles(configPath, authPath);

      throw new ApiError(500, 'OPENVPN_CONNECTION_FAILED',
        `Failed to start OpenVPN: ${error.message}`);
    }
  }

  /**
   * Disconnect from OpenVPN
   */
  async disconnect(connection) {
    if (!connection || connection.type !== 'openvpn') {
      throw new ApiError(400, 'INVALID_CONNECTION', 'Invalid OpenVPN connection');
    }

    const { id, pid, configPath, authPath, managementSocket } = connection;

    try {
      await this.writeLog(connection.profileId, 'info', 'Disconnecting OpenVPN');

      // Try graceful shutdown via management interface first
      if (await this.gracefulShutdown(managementSocket)) {
        await this.writeLog(connection.profileId, 'info', 'OpenVPN disconnected gracefully');
      } else {
        // Force kill the process
        if (pid && await this.killProcess(pid)) {
          await this.writeLog(connection.profileId, 'info', `Killed OpenVPN process ${pid}`);
        }

        // Fallback: kill by pattern
        const pids = await this.findProcesses(`openvpn.*${id}`);
        for (const foundPid of pids) {
          await this.killProcess(foundPid, 'SIGKILL');
        }
      }

      // Cleanup files and sockets
      await this.cleanupFiles(configPath, authPath, managementSocket);
      await this.cleanupPidFile(id);

      this.activeConnections.delete(id);

    } catch (error) {
      logger.error('OpenVPN disconnection error:', error);
      throw new ApiError(500, 'OPENVPN_DISCONNECT_FAILED',
        `Failed to disconnect OpenVPN: ${error.message}`);
    }
  }

  /**
   * Get OpenVPN connection status
   */
  async getStatus(connection) {
    if (!connection || connection.type !== 'openvpn') {
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
      // Check if process is still running
      if (!connection.pid || !await this.isProcessRunning(connection.pid)) {
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

      // Get status via management interface
      const statusData = await this.getManagementStatus(connection.managementSocket);

      // Check if we have tun interface
      const tunInterface = await this.getTunInterface();
      const connected = statusData.connected && tunInterface !== null;

      const status = {
        status: connected ? 'connected' : 'connecting',
        connected,
        connectedAt: connection.connectedAt || statusData.connectedAt,
        duration: connection.connectedAt ?
          Math.floor((Date.now() - new Date(connection.connectedAt).getTime()) / 1000) : 0,
        publicIp: connected ? await this.getPublicIp() : null,
        localIp: tunInterface?.address || null,
        bytesReceived: statusData.bytesReceived || 0,
        bytesSent: statusData.bytesSent || 0,
        latency: connected ? await this.measureLatency() : null,
      };

      // Update connection object
      if (connected && !connection.connectedAt) {
        connection.connectedAt = new Date().toISOString();
        connection.status = 'connected';
        await this.writeLog(connection.profileId, 'info', 'OpenVPN connection established');
      }

      return status;
    } catch (error) {
      logger.error('Failed to get OpenVPN status:', error);
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
   * Test OpenVPN connection
   */
  async testConnection(profile, options = {}) {
    const timeout = options.timeout || 30;

    try {
      // Validate configuration first
      await this.validateConfig(profile.config);

      const startTime = Date.now();

      // Create temporary connection for testing
      const tempConnection = await this.connect(profile, { timeout });

      // Wait for connection or timeout
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
        message: connected ? 'OpenVPN test successful' : 'OpenVPN connection test failed',
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
        message: `OpenVPN test failed: ${error.message}`,
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
   * Validate OpenVPN configuration
   */
  async validateConfig(config) {
    if (!config.configFile && !config.server) {
      throw new ApiError(400, 'INVALID_CONFIG', 'OpenVPN configuration must have configFile or server');
    }

    if (config.configFile) {
      // Validate config file content
      if (typeof config.configFile !== 'string' || config.configFile.trim().length === 0) {
        throw new ApiError(400, 'INVALID_CONFIG', 'OpenVPN config file content is required');
      }

      // Basic validation of OpenVPN config syntax
      const requiredDirectives = ['remote', 'dev'];
      const configLines = config.configFile.split('\n');

      for (const directive of requiredDirectives) {
        if (!configLines.some(line => line.trim().startsWith(directive))) {
          logger.warn(`OpenVPN config missing recommended directive: ${directive}`);
        }
      }
    }

    return true;
  }

  /**
   * Parse OpenVPN configuration
   */
  async parseConfig(content) {
    const config = {
      configFile: content,
      parsed: {},
    };

    // Parse OpenVPN config directives
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith(';')) {
        const [directive, ...args] = trimmed.split(/\s+/);
        config.parsed[directive] = args.length === 1 ? args[0] : args;
      }
    }

    return config;
  }

  /**
   * Export OpenVPN configuration
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
      // Return native .ovpn format
      return profile.config.configFile || '';
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Prepare OpenVPN configuration file
   */
  async prepareConfigFile(profile) {
    const configPath = path.join('/tmp', `openvpn-config-${profile.id}.ovpn`);

    let configContent = profile.config.configFile || '';

    // Add additional directives for mobile API
    configContent += '\n\n# Mobile API additions\n';
    configContent += 'client\n';
    configContent += 'nobind\n';
    configContent += 'persist-key\n';
    configContent += 'persist-tun\n';
    configContent += 'resolv-retry infinite\n';

    await fs.writeFile(configPath, configContent, { mode: 0o600 });

    return configPath;
  }

  /**
   * Prepare authentication file
   */
  async prepareAuthFile(profile) {
    if (!profile.credentials?.username || !profile.credentials?.password) {
      return null;
    }

    const authPath = path.join('/tmp', `openvpn-auth-${profile.id}.txt`);
    const authContent = `${profile.credentials.username}\n${profile.credentials.password}\n`;

    await fs.writeFile(authPath, authContent, { mode: 0o600 });

    return authPath;
  }

  /**
   * Monitor connection establishment
   */
  async monitorConnection(connection) {
    // This will be called periodically by the VPN manager's monitoring
    // We don't need to set up a separate monitor here
  }

  /**
   * Graceful shutdown via management interface
   */
  async gracefulShutdown(managementSocket) {
    try {
      // TODO: Implement management interface communication
      // For now, return false to use process killing
      return false;
    } catch (error) {
      logger.warn('Failed to use OpenVPN management interface:', error);
      return false;
    }
  }

  /**
   * Get status via management interface
   */
  async getManagementStatus(managementSocket) {
    try {
      // TODO: Implement management interface status query
      // For now, return basic status
      return {
        connected: false,
        connectedAt: null,
        bytesReceived: 0,
        bytesSent: 0,
      };
    } catch (error) {
      logger.warn('Failed to get OpenVPN management status:', error);
      return {
        connected: false,
        connectedAt: null,
        bytesReceived: 0,
        bytesSent: 0,
      };
    }
  }

  /**
   * Check if process is running
   */
  async isProcessRunning(pid) {
    try {
      process.kill(pid, 0); // Signal 0 checks if process exists
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get TUN interface for OpenVPN
   */
  async getTunInterface() {
    try {
      const { networkInterfaces } = require('os');
      const interfaces = networkInterfaces();

      // Look for tun interfaces
      for (const [name, addrs] of Object.entries(interfaces)) {
        if (name.startsWith('tun') && addrs?.length > 0) {
          return {
            name,
            address: addrs.find(addr => addr.family === 'IPv4')?.address,
            addrs,
          };
        }
      }

      return null;
    } catch (error) {
      logger.warn('Failed to get TUN interface:', error);
      return null;
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

  /**
   * Cleanup PID file
   */
  async cleanupPidFile(connectionId) {
    try {
      await fs.unlink(`/tmp/openvpn-${connectionId}.pid`);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

module.exports = OpenVpnService;