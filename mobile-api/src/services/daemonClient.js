const axios = require('axios');
const WebSocket = require('ws');
const logger = require('../utils/logger');
const { ApiError, RobotError } = require('../utils/errors');
const { executeRobotDaemonCall } = require('../middleware/circuitBreaker');

/**
 * Daemon Client - Centralized communication with Reachy Mini Python daemon
 * Handles REST API calls and WebSocket streaming to the robot daemon
 */
class DaemonClient {
  constructor() {
    this.baseUrl = process.env.DAEMON_URL || 'http://127.0.0.1:8000';
    this.wsBaseUrl = process.env.DAEMON_WS_URL || 'ws://127.0.0.1:8000';

    // Connection state management
    this.isConnected = false;
    this.lastHealthCheck = null;
    this.connectionRetries = 0;
    this.maxRetries = 3;
    this.retryDelayMs = 1000;

    // WebSocket streams management
    this.robotStateWs = null;
    this.robotStateSubscriptions = new Map(); // subscription id -> callback

    // HTTP client with circuit breaker configuration
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Reachy-Mobile-API/1.0.0',
      },
    });

    // Configure request/response interceptors
    this.httpClient.interceptors.request.use(
      (config) => {
        logger.debug('Daemon request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          data: config.data ? 'present' : 'none',
        });
        return config;
      },
      (error) => {
        logger.error('Daemon request error:', error);
        return Promise.reject(error);
      }
    );

    this.httpClient.interceptors.response.use(
      (response) => {
        this.isConnected = true;
        this.connectionRetries = 0;
        return response;
      },
      (error) => {
        this.handleConnectionError(error);
        return Promise.reject(this.convertError(error));
      }
    );

    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Check daemon health and connectivity
   */
  async checkHealth() {
    try {
      const response = await executeRobotDaemonCall(async () => {
        return await this.httpClient.get('/health', { timeout: 2000 });
      });

      this.lastHealthCheck = Date.now();
      this.isConnected = true;

      return {
        status: 'healthy',
        daemon: response.data,
        lastCheck: this.lastHealthCheck,
      };
    } catch (error) {
      this.isConnected = false;
      logger.warn('Daemon health check failed:', error.message);

      return {
        status: 'unhealthy',
        error: error.message,
        lastCheck: this.lastHealthCheck,
      };
    }
  }

  /**
   * Get current robot status
   */
  async getRobotStatus() {
    try {
      const response = await executeRobotDaemonCall(async () => {
        return await this.httpClient.get('/api/status');
      });
      return response.data;
    } catch (error) {
      throw this.convertError(error, 'Failed to get robot status');
    }
  }

  /**
   * Get connection information
   */
  async getConnectionInfo() {
    try {
      const response = await executeRobotDaemonCall(async () => {
        return await this.httpClient.get('/api/connection');
      });
      return response.data;
    } catch (error) {
      throw this.convertError(error, 'Failed to get connection info');
    }
  }

  /**
   * Initiate robot connection
   */
  async connectRobot(connectionData) {
    try {
      const response = await executeRobotDaemonCall(async () => {
        return await this.httpClient.post('/api/connect', connectionData);
      });
      return response.data;
    } catch (error) {
      throw this.convertError(error, 'Failed to connect to robot');
    }
  }

  /**
   * Disconnect from robot
   */
  async disconnectRobot() {
    try {
      const response = await executeRobotDaemonCall(async () => {
        return await this.httpClient.post('/api/disconnect');
      });
      return response.data;
    } catch (error) {
      throw this.convertError(error, 'Failed to disconnect from robot');
    }
  }

  /**
   * Get current robot state snapshot
   */
  async getRobotState() {
    try {
      const response = await executeRobotDaemonCall(async () => {
        return await this.httpClient.get('/api/state/current');
      });
      return {
        ...response.data,
        timestamp: Date.now(), // Ensure fresh timestamp
      };
    } catch (error) {
      throw this.convertError(error, 'Failed to get robot state');
    }
  }

  /**
   * Set movement target
   */
  async setMovementTarget(targetData) {
    try {
      const response = await executeRobotDaemonCall(async () => {
        return await this.httpClient.post('/api/targets/move', targetData);
      });
      return response.data;
    } catch (error) {
      throw this.convertError(error, 'Failed to set movement target');
    }
  }

  /**
   * Play expression or emotion
   */
  async playExpression(expressionData) {
    try {
      const response = await executeRobotDaemonCall(async () => {
        return await this.httpClient.post('/api/moves/expression', {
          expression: expressionData.expression,
          dataset: expressionData.dataset,
        });
      });
      return response.data;
    } catch (error) {
      throw this.convertError(error, 'Failed to play expression');
    }
  }

  /**
   * Execute choreography or dance
   */
  async executeChoreography(choreographyData) {
    try {
      const response = await executeRobotDaemonCall(async () => {
        return await this.httpClient.post('/api/moves/choreography', {
          choreography: choreographyData.choreography,
          dataset: choreographyData.dataset,
        });
      });
      return response.data;
    } catch (error) {
      throw this.convertError(error, 'Failed to execute choreography');
    }
  }

  /**
   * Execute wake up sequence
   */
  async executeWakeSequence() {
    try {
      const response = await executeRobotDaemonCall(async () => {
        return await this.httpClient.post('/api/moves/wake');
      });
      return response.data;
    } catch (error) {
      throw this.convertError(error, 'Failed to execute wake sequence');
    }
  }

  /**
   * Execute sleep sequence
   */
  async executeSleepSequence() {
    try {
      const response = await executeRobotDaemonCall(async () => {
        return await this.httpClient.post('/api/moves/sleep');
      });
      return response.data;
    } catch (error) {
      throw this.convertError(error, 'Failed to execute sleep sequence');
    }
  }

  /**
   * Stop all robot movement
   */
  async stopMovement() {
    try {
      const response = await executeRobotDaemonCall(async () => {
        return await this.httpClient.post('/api/moves/stop');
      });
      return response.data;
    } catch (error) {
      throw this.convertError(error, 'Failed to stop movement');
    }
  }

  /**
   * Get list of active moves
   */
  async getActiveMoves() {
    try {
      const response = await executeRobotDaemonCall(async () => {
        return await this.httpClient.get('/api/moves/active');
      });
      return response.data;
    } catch (error) {
      throw this.convertError(error, 'Failed to get active moves');
    }
  }

  /**
   * Subscribe to real-time robot state updates
   */
  async subscribeToRobotState(callback, frequency = 20) {
    const subscriptionId = require('uuid').v4();

    try {
      // Store subscription callback
      this.robotStateSubscriptions.set(subscriptionId, callback);

      // Initialize WebSocket connection if needed
      if (!this.robotStateWs || this.robotStateWs.readyState !== WebSocket.OPEN) {
        await this.initializeRobotStateWebSocket();
      }

      // Send subscription request
      this.robotStateWs.send(JSON.stringify({
        type: 'subscribe',
        stream: 'robot_state',
        frequency: frequency,
        subscriptionId: subscriptionId,
      }));

      logger.info('Robot state subscription created', {
        subscriptionId,
        frequency,
      });

      return subscriptionId;
    } catch (error) {
      this.robotStateSubscriptions.delete(subscriptionId);
      throw this.convertError(error, 'Failed to subscribe to robot state');
    }
  }

  /**
   * Unsubscribe from robot state updates
   */
  unsubscribeFromRobotState(subscriptionId) {
    try {
      this.robotStateSubscriptions.delete(subscriptionId);

      if (this.robotStateWs && this.robotStateWs.readyState === WebSocket.OPEN) {
        this.robotStateWs.send(JSON.stringify({
          type: 'unsubscribe',
          subscriptionId: subscriptionId,
        }));
      }

      // Close WebSocket if no more subscriptions
      if (this.robotStateSubscriptions.size === 0 && this.robotStateWs) {
        this.robotStateWs.close();
        this.robotStateWs = null;
      }

      logger.info('Robot state subscription removed', { subscriptionId });
    } catch (error) {
      logger.error('Failed to unsubscribe from robot state:', error);
    }
  }

  /**
   * Initialize WebSocket connection for robot state streaming
   */
  async initializeRobotStateWebSocket() {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${this.wsBaseUrl}/api/state/ws/full`;
        this.robotStateWs = new WebSocket(wsUrl);

        this.robotStateWs.on('open', () => {
          logger.info('Robot state WebSocket connected', { url: wsUrl });
          resolve();
        });

        this.robotStateWs.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleRobotStateMessage(message);
          } catch (error) {
            logger.error('Failed to parse robot state message:', error);
          }
        });

        this.robotStateWs.on('error', (error) => {
          logger.error('Robot state WebSocket error:', error);
          reject(error);
        });

        this.robotStateWs.on('close', () => {
          logger.warn('Robot state WebSocket closed');
          this.robotStateWs = null;

          // Attempt to reconnect if there are active subscriptions
          if (this.robotStateSubscriptions.size > 0) {
            setTimeout(() => {
              this.initializeRobotStateWebSocket().catch(error => {
                logger.error('Failed to reconnect robot state WebSocket:', error);
              });
            }, 2000);
          }
        });

        // Connection timeout
        setTimeout(() => {
          if (this.robotStateWs.readyState !== WebSocket.OPEN) {
            this.robotStateWs.terminate();
            reject(new Error('WebSocket connection timeout'));
          }
        }, 5000);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming robot state messages
   */
  handleRobotStateMessage(message) {
    if (message.type === 'robot_state' && message.data) {
      // Broadcast to all subscriptions
      this.robotStateSubscriptions.forEach((callback, subscriptionId) => {
        try {
          callback(message.data);
        } catch (error) {
          logger.error('Robot state callback error:', error, { subscriptionId });
        }
      });
    }
  }

  /**
   * Handle connection errors and implement retry logic
   */
  handleConnectionError(error) {
    this.isConnected = false;
    this.connectionRetries++;

    if (this.connectionRetries <= this.maxRetries) {
      logger.warn(`Daemon connection failed (attempt ${this.connectionRetries}/${this.maxRetries}):`, error.message);
    } else {
      logger.error('Daemon connection failed after maximum retries:', error.message);
    }
  }

  /**
   * Convert axios errors to appropriate API errors
   */
  convertError(error, defaultMessage = 'Daemon communication failed') {
    if (error.response) {
      // HTTP error response from daemon
      const status = error.response.status;
      const message = error.response.data?.error || error.response.data?.message || defaultMessage;

      if (status >= 500) {
        return new RobotError(message, 'DAEMON_ERROR');
      } else if (status === 404) {
        return new ApiError(message, status);
      } else {
        return new RobotError(message, 'COMMAND_FAILED');
      }
    } else if (error.request) {
      // Network error - daemon not reachable
      return new RobotError('Robot daemon not reachable', 'CONNECTION_FAILED');
    } else {
      // Other error
      return new RobotError(error.message || defaultMessage, 'UNKNOWN_ERROR');
    }
  }

  /**
   * Start periodic health monitoring
   */
  startHealthMonitoring() {
    // Check health every 30 seconds
    setInterval(async () => {
      try {
        await this.checkHealth();
      } catch (error) {
        // Health check errors are already handled in checkHealth method
      }
    }, 30000);

    // Initial health check
    setTimeout(() => {
      this.checkHealth().catch(() => {
        // Initial health check failure is acceptable
      });
    }, 1000);
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    return {
      isConnected: this.isConnected,
      lastHealthCheck: this.lastHealthCheck,
      connectionRetries: this.connectionRetries,
      activeSubscriptions: this.robotStateSubscriptions.size,
      websocketConnected: this.robotStateWs?.readyState === WebSocket.OPEN,
    };
  }

  /**
   * Cleanup resources and close connections
   */
  async cleanup() {
    try {
      // Clear all subscriptions
      this.robotStateSubscriptions.clear();

      // Close WebSocket connection
      if (this.robotStateWs) {
        this.robotStateWs.close();
        this.robotStateWs = null;
      }

      logger.info('Daemon client cleanup completed');
    } catch (error) {
      logger.error('Daemon client cleanup error:', error);
    }
  }
}

// Singleton instance
const daemonClient = new DaemonClient();

module.exports = daemonClient;