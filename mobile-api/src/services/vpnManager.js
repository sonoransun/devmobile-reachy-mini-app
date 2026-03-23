const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/errors');

// VPN service implementations
const OpenVpnService = require('./vpn/openVpnService');
const WireguardService = require('./vpn/wireguardService');
const IpsecService = require('./vpn/ipsecService');
const CommercialVpnService = require('./vpn/commercialVpnService');

/**
 * VPN Manager - Centralized VPN connection management
 * Supports OpenVPN, Wireguard, IPsec, and commercial VPN services
 */
class VpnManager {
  constructor() {
    this.profiles = new Map(); // profileId -> profile data
    this.connections = new Map(); // profileId -> connection instance
    this.services = {
      openvpn: new OpenVpnService(this),
      wireguard: new WireguardService(this),
      ipsec: new IpsecService(this),
      commercial: new CommercialVpnService(this),
    };

    this.configDir = process.env.VPN_CONFIG_DIR || '/etc/reachy-vpn';
    this.logDir = process.env.VPN_LOG_DIR || '/var/log/reachy-vpn';

    // Initialize directories asynchronously
    this.initializeDirectories().catch(error => {
      logger.error('Failed to initialize VPN directories:', error);
    });

    // Start monitoring after a delay to prevent blocking constructor
    setTimeout(() => {
      this.startMonitoring();
    }, 1000);
  }

  /**
   * Initialize VPN directories
   */
  async initializeDirectories() {
    try {
      await fs.mkdir(this.configDir, { recursive: true, mode: 0o700 });
      await fs.mkdir(this.logDir, { recursive: true, mode: 0o755 });

      logger.info('VPN directories initialized', {
        configDir: this.configDir,
        logDir: this.logDir,
      });
    } catch (error) {
      logger.error('Failed to initialize VPN directories:', error);
    }
  }

  /**
   * Get all VPN profiles
   */
  async getProfiles() {
    // TODO: Load from database
    return Array.from(this.profiles.values());
  }

  /**
   * Get specific VPN profile
   */
  async getProfile(id) {
    // TODO: Load from database
    return this.profiles.get(id) || null;
  }

  /**
   * Create new VPN profile
   */
  async createProfile(profileData) {
    const profile = {
      id: uuidv4(),
      ...profileData,
      status: 'disconnected',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Validate configuration
    await this.validateConfig(profile.type, profile.config);

    // Store configuration file
    await this.storeConfig(profile);

    // TODO: Save to database
    this.profiles.set(profile.id, profile);

    logger.info('VPN profile created', {
      profileId: profile.id,
      name: profile.name,
      type: profile.type,
    });

    return profile;
  }

  /**
   * Update VPN profile
   */
  async updateProfile(id, updates) {
    const profile = await this.getProfile(id);
    if (!profile) {
      throw new ApiError(404, 'VPN_PROFILE_NOT_FOUND', 'VPN profile not found');
    }

    // Ensure VPN is disconnected before updating
    if (profile.status === 'connected' || profile.status === 'connecting') {
      throw new ApiError(409, 'VPN_PROFILE_IN_USE', 'Cannot update profile while connected');
    }

    const updatedProfile = {
      ...profile,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Validate updated configuration if provided
    if (updates.config) {
      await this.validateConfig(profile.type, updates.config);
      await this.storeConfig(updatedProfile);
    }

    // TODO: Update in database
    this.profiles.set(id, updatedProfile);

    logger.info('VPN profile updated', {
      profileId: id,
      updates: Object.keys(updates),
    });

    return updatedProfile;
  }

  /**
   * Delete VPN profile
   */
  async deleteProfile(id) {
    const profile = await this.getProfile(id);
    if (!profile) {
      throw new ApiError(404, 'VPN_PROFILE_NOT_FOUND', 'VPN profile not found');
    }

    // Ensure disconnected
    await this.disconnect(id);

    // Remove configuration files
    await this.removeConfig(profile);

    // TODO: Remove from database
    this.profiles.delete(id);

    logger.info('VPN profile deleted', { profileId: id });
  }

  /**
   * Connect to VPN
   */
  async connect(profileId, options = {}) {
    const profile = await this.getProfile(profileId);
    if (!profile) {
      throw new ApiError(404, 'VPN_PROFILE_NOT_FOUND', 'VPN profile not found');
    }

    if (profile.status === 'connected' || profile.status === 'connecting') {
      throw new ApiError(409, 'VPN_ALREADY_CONNECTED', 'VPN is already connected or connecting');
    }

    const service = this.services[profile.type];
    if (!service) {
      throw new ApiError(400, 'UNSUPPORTED_VPN_TYPE', `Unsupported VPN type: ${profile.type}`);
    }

    try {
      // Update status to connecting
      await this.updateProfileStatus(profileId, 'connecting');

      const connection = await service.connect(profile, options);
      this.connections.set(profileId, connection);

      logger.info('VPN connection initiated', {
        profileId,
        type: profile.type,
        provider: profile.provider,
      });

      return {
        success: true,
        message: 'VPN connection initiated successfully',
        connectionId: connection.id,
        estimatedTime: connection.estimatedTime || 30,
      };
    } catch (error) {
      await this.updateProfileStatus(profileId, 'disconnected');
      logger.error('VPN connection failed:', error, { profileId });

      throw new ApiError(500, 'VPN_CONNECTION_FAILED',
        `Failed to connect VPN: ${error.message}`);
    }
  }

  /**
   * Disconnect from VPN
   */
  async disconnect(profileId) {
    const profile = await this.getProfile(profileId);
    if (!profile) {
      throw new ApiError(404, 'VPN_PROFILE_NOT_FOUND', 'VPN profile not found');
    }

    const connection = this.connections.get(profileId);
    if (!connection) {
      await this.updateProfileStatus(profileId, 'disconnected');
      return {
        success: true,
        message: 'VPN was not connected',
      };
    }

    const service = this.services[profile.type];
    if (!service) {
      throw new ApiError(400, 'UNSUPPORTED_VPN_TYPE', `Unsupported VPN type: ${profile.type}`);
    }

    try {
      await this.updateProfileStatus(profileId, 'disconnecting');
      await service.disconnect(connection);

      this.connections.delete(profileId);
      await this.updateProfileStatus(profileId, 'disconnected');

      logger.info('VPN disconnected successfully', { profileId });

      return {
        success: true,
        message: 'VPN disconnected successfully',
      };
    } catch (error) {
      logger.error('VPN disconnection failed:', error, { profileId });

      // Force cleanup
      this.connections.delete(profileId);
      await this.updateProfileStatus(profileId, 'disconnected');

      return {
        success: true,
        message: 'VPN disconnected with errors',
        error: error.message,
      };
    }
  }

  /**
   * Get VPN connection status
   */
  async getConnectionStatus(profileId) {
    const profile = await this.getProfile(profileId);
    if (!profile) {
      throw new ApiError(404, 'VPN_PROFILE_NOT_FOUND', 'VPN profile not found');
    }

    const connection = this.connections.get(profileId);
    if (!connection) {
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
        lastCheck: new Date().toISOString(),
      };
    }

    const service = this.services[profile.type];
    const status = await service.getStatus(connection);

    return {
      status: status.status,
      connected: status.connected,
      connectedAt: status.connectedAt,
      duration: status.duration,
      publicIp: status.publicIp,
      localIp: status.localIp,
      bytesReceived: status.bytesReceived || 0,
      bytesSent: status.bytesSent || 0,
      latency: status.latency,
      lastCheck: new Date().toISOString(),
    };
  }

  /**
   * Get connection logs
   */
  async getConnectionLogs(profileId, options = {}) {
    const profile = await this.getProfile(profileId);
    if (!profile) {
      throw new ApiError(404, 'VPN_PROFILE_NOT_FOUND', 'VPN profile not found');
    }

    const logFile = path.join(this.logDir, `${profileId}.log`);

    try {
      const content = await fs.readFile(logFile, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      // Apply filters
      let filteredLines = lines;

      if (options.since) {
        const sinceTime = new Date(options.since);
        filteredLines = lines.filter(line => {
          const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
          if (match) {
            const lineTime = new Date(match[1]);
            return lineTime >= sinceTime;
          }
          return false;
        });
      }

      // Apply limit
      if (options.limit) {
        filteredLines = filteredLines.slice(-options.limit);
      }

      return filteredLines.map(line => {
        const parts = line.split(' ');
        return {
          timestamp: parts[0],
          level: parts[1],
          message: parts.slice(2).join(' '),
        };
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Test VPN connection
   */
  async testConnection(profileId, options = {}) {
    const profile = await this.getProfile(profileId);
    if (!profile) {
      throw new ApiError(404, 'VPN_PROFILE_NOT_FOUND', 'VPN profile not found');
    }

    const service = this.services[profile.type];
    if (!service) {
      throw new ApiError(400, 'UNSUPPORTED_VPN_TYPE', `Unsupported VPN type: ${profile.type}`);
    }

    return await service.testConnection(profile, options);
  }

  /**
   * Get supported VPN providers
   */
  async getSupportedProviders() {
    return [
      {
        id: 'nordvpn',
        name: 'NordVPN',
        type: 'commercial',
        description: 'NordVPN commercial VPN service',
        configTemplate: {
          server: 'string',
          port: 'number',
          protocol: 'tcp|udp',
        },
        credentialsSchema: {
          username: 'string',
          password: 'string',
        },
        features: ['kill-switch', 'dns-leak-protection', 'auto-connect'],
      },
      {
        id: 'expressvpn',
        name: 'ExpressVPN',
        type: 'commercial',
        description: 'ExpressVPN commercial VPN service',
        configTemplate: {
          server: 'string',
          activationCode: 'string',
        },
        credentialsSchema: {
          activationCode: 'string',
        },
        features: ['kill-switch', 'split-tunneling', 'dns-leak-protection'],
      },
      {
        id: 'surfshark',
        name: 'Surfshark',
        type: 'commercial',
        description: 'Surfshark VPN service',
        configTemplate: {
          server: 'string',
          port: 'number',
        },
        credentialsSchema: {
          username: 'string',
          password: 'string',
        },
        features: ['unlimited-devices', 'kill-switch', 'bypasser'],
      },
      {
        id: 'openvpn-generic',
        name: 'Generic OpenVPN',
        type: 'openvpn',
        description: 'Generic OpenVPN configuration',
        configTemplate: {
          configFile: 'file',
        },
        credentialsSchema: {
          username: 'string',
          password: 'string',
          certificate: 'optional',
          privateKey: 'optional',
        },
        features: ['custom-config', 'certificate-auth'],
      },
      {
        id: 'wireguard-generic',
        name: 'Generic Wireguard',
        type: 'wireguard',
        description: 'Generic Wireguard configuration',
        configTemplate: {
          privateKey: 'string',
          publicKey: 'string',
          endpoint: 'string',
          allowedIPs: 'string',
        },
        credentialsSchema: {
          privateKey: 'string',
        },
        features: ['fast-handshake', 'low-overhead', 'modern-crypto'],
      },
    ];
  }

  /**
   * Get provider locations/servers
   */
  async getProviderLocations(providerId) {
    const service = this.services.commercial;
    if (!service || !service.getProviderLocations) {
      throw new ApiError(400, 'PROVIDER_NOT_SUPPORTED', 'Provider not supported');
    }

    return await service.getProviderLocations(providerId);
  }

  /**
   * Import VPN configuration
   */
  async importConfig(importData) {
    const { type, name, configContent, credentials, createdBy } = importData;

    // Parse and validate configuration
    const config = await this.parseConfigContent(type, configContent);

    return await this.createProfile({
      name,
      type,
      config,
      credentials,
      createdBy,
      imported: true,
    });
  }

  /**
   * Export VPN configuration
   */
  async exportConfig(profileId, format = 'native') {
    const profile = await this.getProfile(profileId);
    if (!profile) {
      throw new ApiError(404, 'VPN_PROFILE_NOT_FOUND', 'VPN profile not found');
    }

    const service = this.services[profile.type];
    if (!service || !service.exportConfig) {
      throw new ApiError(400, 'EXPORT_NOT_SUPPORTED', 'Export not supported for this VPN type');
    }

    return await service.exportConfig(profile, format);
  }

  /**
   * Get system VPN capabilities
   */
  async getSystemCapabilities() {
    const capabilities = {
      supported: [],
      available: [],
      installed: [],
      platform: process.platform,
      permissions: {},
      features: {},
    };

    // Check OpenVPN
    try {
      await this.checkCommand('openvpn', '--version');
      capabilities.installed.push('openvpn');
      capabilities.supported.push('openvpn');
    } catch (error) {
      // OpenVPN not installed
    }

    // Check Wireguard
    try {
      await this.checkCommand('wg', '--version');
      capabilities.installed.push('wireguard');
      capabilities.supported.push('wireguard');
    } catch (error) {
      // Wireguard not installed
    }

    // Check IPsec (strongSwan)
    try {
      await this.checkCommand('ipsec', 'version');
      capabilities.installed.push('ipsec');
      capabilities.supported.push('ipsec');
    } catch (error) {
      // IPsec not installed
    }

    // Commercial VPN is always available (uses native protocols)
    capabilities.supported.push('commercial');
    capabilities.available.push('commercial');

    // Check permissions
    capabilities.permissions = {
      root: process.getuid ? process.getuid() === 0 : false,
      network: true, // Assume we have network permissions
      tun: await this.checkTunInterface(),
    };

    return capabilities;
  }

  /**
   * Get current network status
   */
  async getNetworkStatus() {
    const networkStatus = {
      interfaces: {},
      publicIp: null,
      location: null,
      dns: [],
      routes: [],
      vpnActive: false,
      activeVpnProfile: null,
    };

    try {
      // Get network interfaces
      const { networkInterfaces } = require('os');
      networkStatus.interfaces = networkInterfaces();

      // Get public IP
      try {
        const response = await axios.get('https://api.ipify.org?format=json', {
          timeout: 5000,
        });
        networkStatus.publicIp = response.data.ip;
      } catch (error) {
        // Ignore public IP fetch errors
      }

      // Check for active VPN connections
      for (const [profileId, connection] of this.connections.entries()) {
        if (connection && connection.status === 'connected') {
          networkStatus.vpnActive = true;
          networkStatus.activeVpnProfile = profileId;
          break;
        }
      }

      return networkStatus;
    } catch (error) {
      logger.error('Failed to get network status:', error);
      return networkStatus;
    }
  }

  /**
   * Reconnect all auto-connect VPN profiles
   */
  async reconnectAll() {
    const profiles = await this.getProfiles();
    const autoConnectProfiles = profiles.filter(p => p.autoConnect);

    const results = {
      profiles: autoConnectProfiles.length,
      started: 0,
      failed: 0,
    };

    for (const profile of autoConnectProfiles) {
      try {
        await this.connect(profile.id);
        results.started++;
      } catch (error) {
        logger.error(`Failed to reconnect VPN profile ${profile.id}:`, error);
        results.failed++;
      }
    }

    logger.info('VPN reconnect all completed', results);
    return results;
  }

  /**
   * Kill all VPN connections
   */
  async killAll() {
    const activeConnections = Array.from(this.connections.keys());
    let killed = 0;

    for (const profileId of activeConnections) {
      try {
        await this.disconnect(profileId);
        killed++;
      } catch (error) {
        logger.error(`Failed to kill VPN connection ${profileId}:`, error);
        // Force remove from connections map
        this.connections.delete(profileId);
        await this.updateProfileStatus(profileId, 'disconnected');
      }
    }

    logger.info('VPN kill all completed', { killed });
    return { killed };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Update profile status
   */
  async updateProfileStatus(profileId, status) {
    const profile = this.profiles.get(profileId);
    if (profile) {
      profile.status = status;
      profile.updatedAt = new Date().toISOString();

      if (status === 'connected') {
        profile.lastConnected = new Date().toISOString();
      }

      // TODO: Update in database
      this.profiles.set(profileId, profile);
    }
  }

  /**
   * Validate VPN configuration
   */
  async validateConfig(type, config) {
    const service = this.services[type];
    if (!service) {
      throw new ApiError(400, 'UNSUPPORTED_VPN_TYPE', `Unsupported VPN type: ${type}`);
    }

    if (service.validateConfig) {
      return await service.validateConfig(config);
    }

    return true;
  }

  /**
   * Store VPN configuration files
   */
  async storeConfig(profile) {
    const configPath = path.join(this.configDir, `${profile.id}.json`);

    // Store profile metadata (without sensitive credentials)
    const configData = {
      ...profile,
      credentials: undefined, // Don't store credentials in plain text
    };

    await fs.writeFile(configPath, JSON.stringify(configData, null, 2), {
      mode: 0o600, // Readable only by owner
    });

    // Store credentials separately if provided
    if (profile.credentials) {
      const credentialsPath = path.join(this.configDir, `${profile.id}.creds`);
      await fs.writeFile(credentialsPath, JSON.stringify(profile.credentials), {
        mode: 0o600,
      });
    }
  }

  /**
   * Remove VPN configuration files
   */
  async removeConfig(profile) {
    const configPath = path.join(this.configDir, `${profile.id}.json`);
    const credentialsPath = path.join(this.configDir, `${profile.id}.creds`);
    const logPath = path.join(this.logDir, `${profile.id}.log`);

    try {
      await fs.unlink(configPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }

    try {
      await fs.unlink(credentialsPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }

    try {
      await fs.unlink(logPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }

  /**
   * Parse configuration content
   */
  async parseConfigContent(type, content) {
    const service = this.services[type];
    if (!service || !service.parseConfig) {
      throw new ApiError(400, 'PARSE_NOT_SUPPORTED', 'Configuration parsing not supported');
    }

    return await service.parseConfig(content);
  }

  /**
   * Check if command is available
   */
  async checkCommand(command, args = '--version') {
    return new Promise((resolve, reject) => {
      exec(`${command} ${args}`, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  }

  /**
   * Check TUN interface availability
   */
  async checkTunInterface() {
    try {
      await fs.access('/dev/net/tun');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start connection monitoring
   */
  startMonitoring() {
    setInterval(async () => {
      try {
        await this.monitorConnections();
      } catch (error) {
        logger.error('VPN monitoring error:', error);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Monitor active VPN connections
   */
  async monitorConnections() {
    for (const [profileId, connection] of this.connections.entries()) {
      try {
        const profile = await this.getProfile(profileId);
        if (!profile) continue;

        const service = this.services[profile.type];
        if (!service) continue;

        const status = await service.getStatus(connection);

        if (status.status !== profile.status) {
          await this.updateProfileStatus(profileId, status.status);

          logger.info('VPN status changed', {
            profileId,
            oldStatus: profile.status,
            newStatus: status.status,
          });

          // TODO: Send WebSocket notification
        }

        // Check for dead connections
        if (!status.connected && profile.status === 'connected') {
          logger.warn('VPN connection died unexpectedly', { profileId });

          // Attempt reconnection for auto-connect profiles
          if (profile.autoConnect) {
            setTimeout(() => {
              this.connect(profileId).catch(error => {
                logger.error('VPN auto-reconnect failed:', error, { profileId });
              });
            }, 10000); // Wait 10 seconds before reconnecting
          }
        }
      } catch (error) {
        logger.error('VPN connection monitoring error:', error, { profileId });
      }
    }
  }
}

module.exports = VpnManager;