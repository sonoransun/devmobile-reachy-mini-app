const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');
const { ApiError } = require('../../utils/errors');

/**
 * Base VPN Service - Abstract base class for VPN implementations
 */
class BaseVpnService {
  constructor(vpnManager) {
    this.vpnManager = vpnManager;
    this.activeConnections = new Map(); // connectionId -> process/data

    if (this.constructor === BaseVpnService) {
      throw new Error('BaseVpnService is abstract and cannot be instantiated directly');
    }
  }

  /**
   * Connect to VPN - Must be implemented by subclasses
   * @param {Object} profile - VPN profile
   * @param {Object} options - Connection options (timeout, etc.)
   * @returns {Object} Connection object with id, estimatedTime, etc.
   */
  async connect(profile, options = {}) {
    throw new Error('connect() must be implemented by subclass');
  }

  /**
   * Disconnect from VPN - Must be implemented by subclasses
   * @param {Object} connection - Connection object
   */
  async disconnect(connection) {
    throw new Error('disconnect() must be implemented by subclass');
  }

  /**
   * Get connection status - Must be implemented by subclasses
   * @param {Object} connection - Connection object
   * @returns {Object} Status object
   */
  async getStatus(connection) {
    throw new Error('getStatus() must be implemented by subclass');
  }

  /**
   * Test VPN connection - Must be implemented by subclasses
   * @param {Object} profile - VPN profile
   * @param {Object} options - Test options
   * @returns {Object} Test results
   */
  async testConnection(profile, options = {}) {
    throw new Error('testConnection() must be implemented by subclass');
  }

  /**
   * Validate VPN configuration - Optional, can be overridden
   * @param {Object} config - VPN configuration
   * @returns {boolean} Whether config is valid
   */
  async validateConfig(config) {
    return true; // Default: assume valid
  }

  /**
   * Parse configuration content - Optional, can be overridden
   * @param {string} content - Configuration file content
   * @returns {Object} Parsed configuration
   */
  async parseConfig(content) {
    throw new ApiError(400, 'PARSE_NOT_SUPPORTED', 'Configuration parsing not supported for this VPN type');
  }

  /**
   * Export configuration - Optional, can be overridden
   * @param {Object} profile - VPN profile
   * @param {string} format - Export format
   * @returns {string|Object} Exported configuration
   */
  async exportConfig(profile, format = 'native') {
    throw new ApiError(400, 'EXPORT_NOT_SUPPORTED', 'Configuration export not supported for this VPN type');
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Execute system command with timeout
   */
  async execCommand(command, args = [], options = {}) {
    const timeout = options.timeout || 30000;

    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        ...options,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Command timeout after ${timeout}ms: ${command} ${args.join(' ')}`));
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timeoutId);

        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * Check if command is available
   */
  async isCommandAvailable(command) {
    try {
      await this.execCommand('which', [command], { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate connection ID
   */
  generateConnectionId() {
    return uuidv4();
  }

  /**
   * Get log file path for profile
   */
  getLogPath(profileId) {
    return path.join(this.vpnManager.logDir, `${profileId}.log`);
  }

  /**
   * Write log entry
   */
  async writeLog(profileId, level, message) {
    const logPath = this.getLogPath(profileId);
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} ${level.toUpperCase()} ${message}\n`;

    try {
      await fs.appendFile(logPath, logEntry);
    } catch (error) {
      logger.error('Failed to write VPN log:', error, { profileId });
    }
  }

  /**
   * Get network interface information
   */
  async getNetworkInterface(interfaceName) {
    const { networkInterfaces } = require('os');
    const interfaces = networkInterfaces();

    return interfaces[interfaceName] || null;
  }

  /**
   * Check if interface exists
   */
  async interfaceExists(interfaceName) {
    const iface = await this.getNetworkInterface(interfaceName);
    return iface !== null;
  }

  /**
   * Get public IP address
   */
  async getPublicIp(timeout = 5000) {
    try {
      const axios = require('axios');
      const response = await axios.get('https://api.ipify.org?format=json', {
        timeout,
      });
      return response.data.ip;
    } catch (error) {
      logger.warn('Failed to get public IP:', error);
      return null;
    }
  }

  /**
   * Test network connectivity
   */
  async testConnectivity(host = '8.8.8.8', timeout = 5000) {
    try {
      await this.execCommand('ping', ['-c', '1', '-W', Math.floor(timeout / 1000).toString(), host], {
        timeout,
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Measure network latency
   */
  async measureLatency(host = '8.8.8.8', count = 3) {
    try {
      const result = await this.execCommand('ping', ['-c', count.toString(), host], {
        timeout: count * 2000 + 5000,
      });

      // Parse ping output to extract average latency
      const output = result.stdout;
      const avgMatch = output.match(/avg[/=]\s*([\d.]+)/);

      if (avgMatch) {
        return parseFloat(avgMatch[1]);
      }

      return null;
    } catch (error) {
      logger.warn('Failed to measure latency:', error);
      return null;
    }
  }

  /**
   * Kill process by PID
   */
  async killProcess(pid, signal = 'SIGTERM') {
    try {
      process.kill(pid, signal);
      return true;
    } catch (error) {
      logger.warn(`Failed to kill process ${pid}:`, error);
      return false;
    }
  }

  /**
   * Find process by name pattern
   */
  async findProcesses(pattern) {
    try {
      const result = await this.execCommand('pgrep', ['-f', pattern]);
      const pids = result.stdout.trim().split('\n')
        .filter(line => line.trim())
        .map(pid => parseInt(pid.trim()));

      return pids;
    } catch (error) {
      return [];
    }
  }
}

module.exports = BaseVpnService;