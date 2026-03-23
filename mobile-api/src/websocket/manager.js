const WebSocket = require('ws');
const logger = require('../utils/logger');
const { verifyToken } = require('../middleware/auth');
const { recordWebSocketConnection, recordWebSocketMessage } = require('../middleware/metrics');
const daemonClient = require('../services/daemonClient');

let wss = null;
const connections = new Map(); // deviceId -> WebSocket

/**
 * Initialize WebSocket server
 * @param {http.Server} server - HTTP server instance
 * @returns {Object} WebSocket server instance
 */
function initializeWebSocket(server) {
  wss = new WebSocket.Server({
    server,
    path: '/ws',
    verifyClient: (info) => {
      // Basic verification - detailed auth happens in connection handler
      return true;
    },
  });

  wss.on('connection', handleConnection);
  wss.on('error', (error) => {
    logger.error('WebSocket server error:', error);
  });

  logger.info('WebSocket server initialized', {
    path: '/ws',
  });

  // Start periodic cleanup of dead connections
  setInterval(cleanupConnections, 30000); // 30 seconds

  return { wss };
}

/**
 * Handle new WebSocket connection
 * @param {WebSocket} ws - WebSocket connection
 * @param {http.IncomingMessage} req - HTTP request
 */
function handleConnection(ws, req) {
  const startTime = Date.now();
  let deviceId = null;
  let platform = null;
  let authenticated = false;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'auth') {
        // Handle authentication
        const authResult = await authenticateWebSocket(data, req);
        if (authResult.success) {
          deviceId = authResult.deviceId;
          platform = authResult.platform;
          authenticated = true;

          // Store connection
          connections.set(deviceId, ws);

          // Record metrics
          recordWebSocketConnection('robot_state', platform, true);

          ws.send(JSON.stringify({
            type: 'auth_success',
            deviceId,
            timestamp: Date.now(),
          }));

          logger.info('WebSocket authenticated', {
            deviceId,
            platform,
            ip: req.socket.remoteAddress,
          });
        } else {
          ws.send(JSON.stringify({
            type: 'auth_error',
            error: authResult.error,
            timestamp: Date.now(),
          }));
          ws.close(1008, 'Authentication failed');
          return;
        }
      } else if (data.type === 'subscribe') {
        // Handle subscription to robot state stream
        if (!authenticated) {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Not authenticated',
          }));
          return;
        }

        await handleSubscription(ws, data, deviceId);
      } else if (data.type === 'ping') {
        // Handle ping/pong for connection health
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: Date.now(),
        }));
      }

      recordWebSocketMessage('robot_state', 'received', message.length);
    } catch (error) {
      logger.error('WebSocket message error:', error, { deviceId });
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Invalid message format',
      }));
    }
  });

  ws.on('close', (code, reason) => {
    const duration = Date.now() - startTime;

    // Cleanup daemon subscription if exists
    if (ws._robotStateSubscriptionId) {
      daemonClient.unsubscribeFromRobotState(ws._robotStateSubscriptionId);
    }

    // Cleanup polling interval if exists
    if (ws._streamInterval) {
      clearInterval(ws._streamInterval);
    }

    if (deviceId) {
      connections.delete(deviceId);
      recordWebSocketConnection('robot_state', platform, false);
    }

    logger.info('WebSocket disconnected', {
      deviceId,
      platform,
      duration: `${duration}ms`,
      code,
      reason: reason.toString(),
    });
  });

  ws.on('error', (error) => {
    logger.error('WebSocket connection error:', error, { deviceId });
  });

  // Send initial connection acknowledgment
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'WebSocket connected, please authenticate',
    timestamp: Date.now(),
  }));
}

/**
 * Authenticate WebSocket connection
 * @param {Object} authData - Authentication data from client
 * @param {http.IncomingMessage} req - HTTP request
 * @returns {Object} Authentication result
 */
async function authenticateWebSocket(authData, req) {
  try {
    const { token, deviceId } = authData;

    if (!token || !deviceId) {
      return {
        success: false,
        error: 'Token and device ID are required',
      };
    }

    // Verify JWT token
    const decoded = verifyToken(token);

    if (decoded.deviceId !== deviceId) {
      return {
        success: false,
        error: 'Device ID mismatch',
      };
    }

    return {
      success: true,
      deviceId: decoded.deviceId,
      platform: decoded.platform,
      permissions: decoded.permissions,
    };
  } catch (error) {
    logger.error('WebSocket authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed',
    };
  }
}

/**
 * Handle subscription requests
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} data - Subscription data
 * @param {string} deviceId - Device ID
 */
async function handleSubscription(ws, data, deviceId) {
  const { stream, frequency = 10 } = data;

  if (stream === 'robot_state') {
    // Start robot state streaming
    startRobotStateStream(ws, deviceId, frequency);

    ws.send(JSON.stringify({
      type: 'subscription_success',
      stream: 'robot_state',
      frequency,
      timestamp: Date.now(),
    }));

    logger.info('Robot state subscription started', {
      deviceId,
      frequency,
    });
  } else {
    ws.send(JSON.stringify({
      type: 'subscription_error',
      error: `Unknown stream: ${stream}`,
    }));
  }
}

/**
 * Start robot state streaming
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} deviceId - Device ID
 * @param {number} frequency - Streaming frequency (Hz)
 */
async function startRobotStateStream(ws, deviceId, frequency) {
  try {
    // Subscribe to daemon's real-time robot state
    const subscriptionId = await daemonClient.subscribeToRobotState(
      (robotState) => {
        if (ws.readyState !== WebSocket.OPEN) {
          // Unsubscribe if WebSocket is closed
          daemonClient.unsubscribeFromRobotState(subscriptionId);
          return;
        }

        const message = JSON.stringify({
          type: 'robot_state',
          data: robotState,
          timestamp: Date.now(),
          deviceId,
        });

        ws.send(message);
        recordWebSocketMessage('robot_state', 'sent', message.length);
      },
      frequency
    );

    // Store subscription ID for cleanup
    ws._robotStateSubscriptionId = subscriptionId;

    logger.info('Robot state streaming started via daemon client', {
      deviceId,
      frequency,
      subscriptionId,
    });

  } catch (error) {
    logger.error('Failed to start robot state streaming:', error, { deviceId });

    // Fallback to polling if daemon streaming fails
    startRobotStatePolling(ws, deviceId, frequency);
  }
}

/**
 * Fallback polling for robot state when streaming is not available
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} deviceId - Device ID
 * @param {number} frequency - Polling frequency (Hz)
 */
function startRobotStatePolling(ws, deviceId, frequency) {
  const interval = 1000 / frequency; // Convert Hz to ms

  const pollInterval = setInterval(async () => {
    if (ws.readyState !== WebSocket.OPEN) {
      clearInterval(pollInterval);
      return;
    }

    try {
      const robotState = await daemonClient.getRobotState();

      const message = JSON.stringify({
        type: 'robot_state',
        data: robotState,
        timestamp: Date.now(),
        deviceId,
      });

      ws.send(message);
      recordWebSocketMessage('robot_state', 'sent', message.length);

    } catch (error) {
      logger.error('Robot state polling failed:', error, { deviceId });

      // Send error message to client
      const errorMessage = JSON.stringify({
        type: 'robot_state_error',
        error: 'Failed to retrieve robot state',
        timestamp: Date.now(),
        deviceId,
      });

      ws.send(errorMessage);
    }
  }, interval);

  // Store interval for cleanup
  ws._streamInterval = pollInterval;

  logger.info('Robot state polling started (fallback mode)', {
    deviceId,
    frequency,
  });
}

/**
 * Broadcast message to all connected devices
 * @param {Object} message - Message to broadcast
 * @param {string} [excludeDeviceId] - Device ID to exclude from broadcast
 */
function broadcast(message, excludeDeviceId = null) {
  const messageString = JSON.stringify({
    ...message,
    timestamp: Date.now(),
  });

  let sentCount = 0;
  connections.forEach((ws, deviceId) => {
    if (deviceId === excludeDeviceId) return;

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageString);
      sentCount++;
      recordWebSocketMessage('broadcast', 'sent', messageString.length);
    }
  });

  logger.debug('Broadcast message sent', {
    recipients: sentCount,
    messageType: message.type,
    excludedDevice: excludeDeviceId,
  });

  return sentCount;
}

/**
 * Send message to specific device
 * @param {string} deviceId - Target device ID
 * @param {Object} message - Message to send
 * @returns {boolean} Success status
 */
function sendToDevice(deviceId, message) {
  const ws = connections.get(deviceId);

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return false;
  }

  const messageString = JSON.stringify({
    ...message,
    timestamp: Date.now(),
  });

  ws.send(messageString);
  recordWebSocketMessage('direct', 'sent', messageString.length);

  return true;
}

/**
 * Get connection statistics
 * @returns {Object} Connection statistics
 */
function getConnectionStats() {
  const stats = {
    totalConnections: connections.size,
    deviceConnections: {},
  };

  connections.forEach((ws, deviceId) => {
    stats.deviceConnections[deviceId] = {
      state: ws.readyState === WebSocket.OPEN ? 'connected' : 'disconnected',
      // TODO: Add more connection-specific stats
    };
  });

  return stats;
}

/**
 * Cleanup dead connections
 */
function cleanupConnections() {
  let cleanedCount = 0;

  connections.forEach((ws, deviceId) => {
    if (ws.readyState === WebSocket.CLOSED) {
      connections.delete(deviceId);
      cleanedCount++;
    }
  });

  if (cleanedCount > 0) {
    logger.debug('Cleaned up dead WebSocket connections', {
      cleaned: cleanedCount,
      remaining: connections.size,
    });
  }
}

/**
 * Close all connections gracefully
 */
function closeAllConnections() {
  connections.forEach((ws, deviceId) => {
    // Cleanup daemon subscription
    if (ws._robotStateSubscriptionId) {
      daemonClient.unsubscribeFromRobotState(ws._robotStateSubscriptionId);
    }

    // Cleanup polling interval
    if (ws._streamInterval) {
      clearInterval(ws._streamInterval);
    }

    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1000, 'Server shutting down');
    }
  });

  connections.clear();

  // Cleanup daemon client
  daemonClient.cleanup().catch(error => {
    logger.error('Failed to cleanup daemon client:', error);
  });

  logger.info('All WebSocket connections closed');
}

module.exports = {
  initializeWebSocket,
  broadcast,
  sendToDevice,
  getConnectionStats,
  closeAllConnections,
};