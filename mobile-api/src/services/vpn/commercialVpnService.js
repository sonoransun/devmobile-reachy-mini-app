const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const BaseVpnService = require('./baseVpnService');
const logger = require('../../utils/logger');
const { ApiError } = require('../../utils/errors');

/**
 * Commercial VPN Service - Manages connections to commercial VPN providers
 * Supports NordVPN, ExpressVPN, Surfshark, and other major providers
 */
class CommercialVpnService extends BaseVpnService {
  constructor(vpnManager) {
    super(vpnManager);
    this.serviceName = 'commercial';

    // Provider-specific implementations
    this.providers = {
      nordvpn: new NordVpnProvider(this),
      expressvpn: new ExpressVpnProvider(this),
      surfshark: new SurfsharkProvider(this),
    };
  }

  /**
   * Connect to commercial VPN
   */
  async connect(profile, options = {}) {
    const connectionId = this.generateConnectionId();
    const providerId = profile.provider || 'generic';

    const provider = this.providers[providerId];
    if (!provider) {
      throw new ApiError(400, 'UNSUPPORTED_PROVIDER',
        `Commercial VPN provider not supported: ${providerId}`);
    }

    try {
      await this.writeLog(profile.id, 'info',
        `Starting commercial VPN connection: ${profile.name} (${providerId})`);

      const connection = await provider.connect(profile, options, connectionId);

      this.activeConnections.set(connectionId, connection);

      return connection;
    } catch (error) {
      await this.writeLog(profile.id, 'error',
        `Commercial VPN connection failed: ${error.message}`);

      throw new ApiError(500, 'COMMERCIAL_VPN_CONNECTION_FAILED',
        `Failed to connect to ${providerId}: ${error.message}`);
    }
  }

  /**
   * Disconnect from commercial VPN
   */
  async disconnect(connection) {
    if (!connection || connection.type !== 'commercial') {
      throw new ApiError(400, 'INVALID_CONNECTION', 'Invalid commercial VPN connection');
    }

    const providerId = connection.provider;
    const provider = this.providers[providerId];

    if (!provider) {
      throw new ApiError(400, 'UNSUPPORTED_PROVIDER',
        `Commercial VPN provider not supported: ${providerId}`);
    }

    try {
      await provider.disconnect(connection);
      this.activeConnections.delete(connection.id);

      await this.writeLog(connection.profileId, 'info', 'Commercial VPN disconnected successfully');
    } catch (error) {
      logger.error('Commercial VPN disconnection error:', error);
      throw new ApiError(500, 'COMMERCIAL_VPN_DISCONNECT_FAILED',
        `Failed to disconnect from ${providerId}: ${error.message}`);
    }
  }

  /**
   * Get commercial VPN connection status
   */
  async getStatus(connection) {
    if (!connection || connection.type !== 'commercial') {
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

    const providerId = connection.provider;
    const provider = this.providers[providerId];

    if (!provider) {
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

    return await provider.getStatus(connection);
  }

  /**
   * Test commercial VPN connection
   */
  async testConnection(profile, options = {}) {
    const providerId = profile.provider || 'generic';
    const provider = this.providers[providerId];

    if (!provider) {
      return {
        success: false,
        message: `Commercial VPN provider not supported: ${providerId}`,
        latency: null,
        publicIp: null,
        duration: 0,
        location: null,
        details: {
          error: `Provider ${providerId} not supported`,
        },
      };
    }

    return await provider.testConnection(profile, options);
  }

  /**
   * Get provider locations/servers
   */
  async getProviderLocations(providerId) {
    const provider = this.providers[providerId];
    if (!provider || !provider.getLocations) {
      throw new ApiError(400, 'PROVIDER_NOT_SUPPORTED',
        `Provider ${providerId} does not support location listing`);
    }

    return await provider.getLocations();
  }

  /**
   * Validate commercial VPN configuration
   */
  async validateConfig(config) {
    if (!config.provider) {
      throw new ApiError(400, 'INVALID_CONFIG', 'Provider is required for commercial VPN');
    }

    const provider = this.providers[config.provider];
    if (!provider) {
      throw new ApiError(400, 'UNSUPPORTED_PROVIDER',
        `Commercial VPN provider not supported: ${config.provider}`);
    }

    if (provider.validateConfig) {
      return await provider.validateConfig(config);
    }

    return true;
  }
}

// ============================================================================
// PROVIDER IMPLEMENTATIONS
// ============================================================================

/**
 * Base Provider Class
 */
class BaseProvider {
  constructor(service) {
    this.service = service;
  }

  async connect(profile, options, connectionId) {
    throw new Error('connect() must be implemented by provider');
  }

  async disconnect(connection) {
    throw new Error('disconnect() must be implemented by provider');
  }

  async getStatus(connection) {
    throw new Error('getStatus() must be implemented by provider');
  }

  async testConnection(profile, options) {
    throw new Error('testConnection() must be implemented by provider');
  }
}

/**
 * NordVPN Provider
 */
class NordVpnProvider extends BaseProvider {
  async connect(profile, options, connectionId) {
    const timeout = options.timeout || 60;

    // Check if nordvpn CLI is available
    if (!(await this.service.isCommandAvailable('nordvpn'))) {
      throw new Error('NordVPN CLI is not installed or not available in PATH');
    }

    // Login if credentials provided
    if (profile.credentials?.username && profile.credentials?.password) {
      await this.service.execCommand('nordvpn', [
        'login',
        '--username', profile.credentials.username,
        '--password', profile.credentials.password,
      ], { timeout: 30000 });
    }

    // Connect to server
    const connectArgs = ['connect'];

    if (profile.config?.server) {
      connectArgs.push(profile.config.server);
    } else if (profile.config?.country) {
      connectArgs.push(profile.config.country);
    }

    await this.service.execCommand('nordvpn', connectArgs, {
      timeout: timeout * 1000,
    });

    return {
      id: connectionId,
      profileId: profile.id,
      provider: 'nordvpn',
      status: 'connected',
      connectedAt: new Date().toISOString(),
      estimatedTime: 30,
      type: 'commercial',
    };
  }

  async disconnect(connection) {
    try {
      await this.service.execCommand('nordvpn', ['disconnect'], {
        timeout: 30000,
      });
    } catch (error) {
      // NordVPN sometimes returns non-zero exit code even on successful disconnect
      logger.warn('NordVPN disconnect command returned error:', error);
    }
  }

  async getStatus(connection) {
    try {
      const result = await this.service.execCommand('nordvpn', ['status'], {
        timeout: 10000,
      });

      const isConnected = result.stdout.includes('Connected');
      const serverMatch = result.stdout.match(/Server:\s*(.+)/);
      const ipMatch = result.stdout.match(/Your new IP:\s*([0-9.]+)/);

      return {
        status: isConnected ? 'connected' : 'disconnected',
        connected: isConnected,
        connectedAt: connection.connectedAt,
        duration: connection.connectedAt ?
          Math.floor((Date.now() - new Date(connection.connectedAt).getTime()) / 1000) : 0,
        publicIp: ipMatch ? ipMatch[1] : null,
        localIp: null,
        server: serverMatch ? serverMatch[1].trim() : null,
        bytesReceived: 0, // NordVPN CLI doesn't provide traffic stats
        bytesSent: 0,
        latency: isConnected ? await this.service.measureLatency() : null,
      };
    } catch (error) {
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

  async testConnection(profile, options = {}) {
    const timeout = options.timeout || 60;

    try {
      const startTime = Date.now();

      // Create temporary connection for testing
      const tempConnection = await this.connect(profile, { timeout }, 'test-' + Date.now());

      // Wait for connection establishment
      await new Promise(resolve => setTimeout(resolve, 5000));

      const status = await this.getStatus(tempConnection);
      const connected = status.connected;

      // Cleanup test connection
      await this.disconnect(tempConnection);

      const duration = Date.now() - startTime;

      return {
        success: connected,
        message: connected ? 'NordVPN test successful' : 'NordVPN connection test failed',
        latency: status.latency,
        publicIp: status.publicIp,
        duration,
        location: status.server,
        details: {
          connectionTime: duration,
          server: status.server,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `NordVPN test failed: ${error.message}`,
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

  async getLocations() {
    try {
      const result = await this.service.execCommand('nordvpn', ['countries'], {
        timeout: 15000,
      });

      // Parse country list
      const countries = result.stdout
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.includes('Available countries'))
        .map(country => ({
          id: country.toLowerCase().replace(/\s+/g, '_'),
          name: country,
          country: country,
          servers: [], // NordVPN CLI doesn't provide server details
        }));

      return countries;
    } catch (error) {
      logger.error('Failed to get NordVPN locations:', error);
      return [];
    }
  }

  async validateConfig(config) {
    // NordVPN is pretty flexible, just need provider credentials
    if (!config.credentials?.username || !config.credentials?.password) {
      throw new ApiError(400, 'INVALID_CONFIG',
        'NordVPN requires username and password credentials');
    }

    return true;
  }
}

/**
 * ExpressVPN Provider
 */
class ExpressVpnProvider extends BaseProvider {
  async connect(profile, options, connectionId) {
    const timeout = options.timeout || 60;

    // Check if expressvpn CLI is available
    if (!(await this.service.isCommandAvailable('expressvpn'))) {
      throw new Error('ExpressVPN CLI is not installed or not available in PATH');
    }

    // Activate if activation code provided
    if (profile.credentials?.activationCode) {
      await this.service.execCommand('expressvpn', [
        'activate', profile.credentials.activationCode
      ], { timeout: 30000 });
    }

    // Connect to server
    const connectArgs = ['connect'];

    if (profile.config?.server) {
      connectArgs.push(profile.config.server);
    }

    await this.service.execCommand('expressvpn', connectArgs, {
      timeout: timeout * 1000,
    });

    return {
      id: connectionId,
      profileId: profile.id,
      provider: 'expressvpn',
      status: 'connected',
      connectedAt: new Date().toISOString(),
      estimatedTime: 30,
      type: 'commercial',
    };
  }

  async disconnect(connection) {
    await this.service.execCommand('expressvpn', ['disconnect'], {
      timeout: 30000,
    });
  }

  async getStatus(connection) {
    try {
      const result = await this.service.execCommand('expressvpn', ['status'], {
        timeout: 10000,
      });

      const isConnected = result.stdout.includes('Connected to');
      const locationMatch = result.stdout.match(/Connected to\s*(.+)/);

      return {
        status: isConnected ? 'connected' : 'disconnected',
        connected: isConnected,
        connectedAt: connection.connectedAt,
        duration: connection.connectedAt ?
          Math.floor((Date.now() - new Date(connection.connectedAt).getTime()) / 1000) : 0,
        publicIp: isConnected ? await this.service.getPublicIp() : null,
        localIp: null,
        server: locationMatch ? locationMatch[1].trim() : null,
        bytesReceived: 0,
        bytesSent: 0,
        latency: isConnected ? await this.service.measureLatency() : null,
      };
    } catch (error) {
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

  async testConnection(profile, options = {}) {
    const timeout = options.timeout || 60;

    try {
      const startTime = Date.now();
      const tempConnection = await this.connect(profile, { timeout }, 'test-' + Date.now());

      await new Promise(resolve => setTimeout(resolve, 5000));

      const status = await this.getStatus(tempConnection);
      const connected = status.connected;

      await this.disconnect(tempConnection);

      const duration = Date.now() - startTime;

      return {
        success: connected,
        message: connected ? 'ExpressVPN test successful' : 'ExpressVPN connection test failed',
        latency: status.latency,
        publicIp: status.publicIp,
        duration,
        location: status.server,
        details: {
          connectionTime: duration,
          server: status.server,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `ExpressVPN test failed: ${error.message}`,
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

  async getLocations() {
    try {
      const result = await this.service.execCommand('expressvpn', ['list'], {
        timeout: 15000,
      });

      // Parse server list (simplified)
      const locations = [];
      const lines = result.stdout.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.includes('ALIAS') && !trimmed.includes('-----')) {
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 2) {
            locations.push({
              id: parts[0],
              name: parts.slice(1).join(' '),
              alias: parts[0],
              servers: [],
            });
          }
        }
      }

      return locations;
    } catch (error) {
      logger.error('Failed to get ExpressVPN locations:', error);
      return [];
    }
  }

  async validateConfig(config) {
    if (!config.credentials?.activationCode) {
      throw new ApiError(400, 'INVALID_CONFIG',
        'ExpressVPN requires activation code credential');
    }

    return true;
  }
}

/**
 * Surfshark Provider (uses OpenVPN under the hood)
 */
class SurfsharkProvider extends BaseProvider {
  async connect(profile, options, connectionId) {
    // Surfshark typically uses OpenVPN with their configs
    // This is a simplified implementation

    if (!profile.credentials?.username || !profile.credentials?.password) {
      throw new Error('Surfshark requires username and password');
    }

    // Download or use provided Surfshark config
    const server = profile.config?.server || 'us-nyc.prod.surfshark.com';
    const port = profile.config?.port || 1194;

    // Create OpenVPN-compatible config for Surfshark
    const surfsharkConfig = this.generateSurfsharkConfig(server, port);

    // Use the OpenVPN service to connect
    const OpenVpnService = require('./openVpnService');
    const openVpnService = new OpenVpnService(this.service.vpnManager);

    const tempProfile = {
      ...profile,
      type: 'openvpn',
      config: { configFile: surfsharkConfig },
    };

    const connection = await openVpnService.connect(tempProfile, options);

    return {
      ...connection,
      id: connectionId,
      provider: 'surfshark',
      type: 'commercial',
      openVpnConnection: connection,
    };
  }

  async disconnect(connection) {
    if (connection.openVpnConnection) {
      const OpenVpnService = require('./openVpnService');
      const openVpnService = new OpenVpnService(this.service.vpnManager);
      await openVpnService.disconnect(connection.openVpnConnection);
    }
  }

  async getStatus(connection) {
    if (connection.openVpnConnection) {
      const OpenVpnService = require('./openVpnService');
      const openVpnService = new OpenVpnService(this.service.vpnManager);
      return await openVpnService.getStatus(connection.openVpnConnection);
    }

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

  async testConnection(profile, options = {}) {
    try {
      const startTime = Date.now();
      const tempConnection = await this.connect(profile, options, 'test-' + Date.now());

      await new Promise(resolve => setTimeout(resolve, 10000));

      const status = await this.getStatus(tempConnection);
      const connected = status.connected;

      await this.disconnect(tempConnection);

      const duration = Date.now() - startTime;

      return {
        success: connected,
        message: connected ? 'Surfshark test successful' : 'Surfshark connection test failed',
        latency: status.latency,
        publicIp: status.publicIp,
        duration,
        location: profile.config?.server,
        details: {
          connectionTime: duration,
          server: profile.config?.server,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Surfshark test failed: ${error.message}`,
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

  generateSurfsharkConfig(server, port) {
    return `client
dev tun
proto udp
remote ${server} ${port}
resolv-retry infinite
nobind
persist-key
persist-tun
cipher AES-256-GCM
ncp-disable
auth SHA512
tls-client
tls-version-min 1.2
tls-cipher TLS-ECDHE-RSA-WITH-AES-256-GCM-SHA384
setenv opt block-outside-dns
verb 3
auth-user-pass
compress lz4

# Surfshark CA certificate would go here
# <ca>
# ... certificate content ...
# </ca>`;
  }

  async validateConfig(config) {
    if (!config.credentials?.username || !config.credentials?.password) {
      throw new ApiError(400, 'INVALID_CONFIG',
        'Surfshark requires username and password credentials');
    }

    return true;
  }
}

module.exports = CommercialVpnService;