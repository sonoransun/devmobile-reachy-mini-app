const client = require('prom-client');

// Create a Registry to register the metrics
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'reachy-mobile-api',
  version: process.env.npm_package_version || '1.0.0',
});

// Enable the collection of default metrics
client.collectDefaultMetrics({ register });

// ============================================================================
// CUSTOM METRICS
// ============================================================================

// HTTP request metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'platform'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10], // Response time buckets
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'platform'],
});

const httpRequestSize = new client.Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000], // Request size buckets
});

const httpResponseSize = new client.Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 1000, 10000, 100000, 1000000], // Response size buckets
});

// Robot command metrics
const robotCommandTotal = new client.Counter({
  name: 'robot_commands_total',
  help: 'Total number of robot commands',
  labelNames: ['command_type', 'device_id', 'success'],
});

const robotCommandDuration = new client.Histogram({
  name: 'robot_command_duration_seconds',
  help: 'Duration of robot commands in seconds',
  labelNames: ['command_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30], // Command duration buckets
});

const robotConnectionStatus = new client.Gauge({
  name: 'robot_connection_status',
  help: 'Robot connection status (1 = connected, 0 = disconnected)',
  labelNames: ['connection_mode'],
});

// Application metrics
const appOperationTotal = new client.Counter({
  name: 'app_operations_total',
  help: 'Total number of app operations',
  labelNames: ['operation', 'app_id', 'success'],
});

const appInstallationDuration = new client.Histogram({
  name: 'app_installation_duration_seconds',
  help: 'Duration of app installations in seconds',
  labelNames: ['app_id'],
  buckets: [10, 30, 60, 120, 300, 600], // Installation time buckets
});

const installedAppsGauge = new client.Gauge({
  name: 'installed_apps_total',
  help: 'Number of installed applications',
});

const runningAppsGauge = new client.Gauge({
  name: 'running_apps_total',
  help: 'Number of currently running applications',
});

// WebSocket metrics
const websocketConnections = new client.Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections',
  labelNames: ['type', 'device_platform'],
});

const websocketMessages = new client.Counter({
  name: 'websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['type', 'direction'], // direction: sent/received
});

const websocketDataTransferred = new client.Counter({
  name: 'websocket_data_bytes_total',
  help: 'Total bytes transferred via WebSocket',
  labelNames: ['type', 'direction'],
});

// Authentication metrics
const authenticationTotal = new client.Counter({
  name: 'authentication_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['result', 'platform'], // result: success/failure
});

const activeDevices = new client.Gauge({
  name: 'active_devices_total',
  help: 'Number of active authenticated devices',
});

// System health metrics
const systemHealth = new client.Gauge({
  name: 'system_health_status',
  help: 'System health status (1 = healthy, 0 = unhealthy)',
  labelNames: ['component'], // component: api, database, redis, robot_daemon
});

const externalServiceHealth = new client.Gauge({
  name: 'external_service_health_status',
  help: 'External service health status (1 = healthy, 0 = unhealthy)',
  labelNames: ['service'], // service: robot_daemon, huggingface, etc.
});

// Network quality metrics
const networkLatency = new client.Histogram({
  name: 'network_latency_seconds',
  help: 'Network latency to external services',
  labelNames: ['service'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2], // Latency buckets
});

const vpnConnectionQuality = new client.Gauge({
  name: 'vpn_connection_quality',
  help: 'VPN connection quality score (0-1)',
  labelNames: ['device_id'],
});

// Error metrics
const errorTotal = new client.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'code', 'route'],
});

// Circuit breaker metrics
const circuitBreakerState = new client.Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state (0 = closed, 1 = open, 0.5 = half-open)',
  labelNames: ['service'],
});

const circuitBreakerFailures = new client.Counter({
  name: 'circuit_breaker_failures_total',
  help: 'Total number of circuit breaker failures',
  labelNames: ['service'],
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(httpRequestSize);
register.registerMetric(httpResponseSize);
register.registerMetric(robotCommandTotal);
register.registerMetric(robotCommandDuration);
register.registerMetric(robotConnectionStatus);
register.registerMetric(appOperationTotal);
register.registerMetric(appInstallationDuration);
register.registerMetric(installedAppsGauge);
register.registerMetric(runningAppsGauge);
register.registerMetric(websocketConnections);
register.registerMetric(websocketMessages);
register.registerMetric(websocketDataTransferred);
register.registerMetric(authenticationTotal);
register.registerMetric(activeDevices);
register.registerMetric(systemHealth);
register.registerMetric(externalServiceHealth);
register.registerMetric(networkLatency);
register.registerMetric(vpnConnectionQuality);
register.registerMetric(errorTotal);
register.registerMetric(circuitBreakerState);
register.registerMetric(circuitBreakerFailures);

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Metrics collection middleware
 * Collects HTTP request metrics automatically
 */
const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Skip metrics collection for metrics endpoint itself
  if (req.path === '/metrics') {
    return next();
  }

  // Get route pattern for better grouping
  const route = req.route?.path || req.path;
  const method = req.method;
  const platform = req.headers['x-platform'] || 'unknown';

  // Measure request size
  const requestSize = req.get('Content-Length') || 0;
  if (requestSize > 0) {
    httpRequestSize.observe({ method, route }, parseInt(requestSize));
  }

  // Override res.end to collect response metrics
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = (Date.now() - startTime) / 1000; // Convert to seconds
    const statusCode = res.statusCode.toString();
    const responseSize = res.get('Content-Length') || 0;

    // Record HTTP metrics
    httpRequestDuration.observe({ method, route, status_code: statusCode, platform }, responseTime);
    httpRequestTotal.inc({ method, route, status_code: statusCode, platform });

    if (responseSize > 0) {
      httpResponseSize.observe({ method, route, status_code: statusCode }, parseInt(responseSize));
    }

    // Record errors
    if (res.statusCode >= 400) {
      const errorType = res.statusCode >= 500 ? 'server_error' : 'client_error';
      const errorCode = res.locals.errorCode || 'unknown';
      errorTotal.inc({ type: errorType, code: errorCode, route });
    }

    res.end = originalEnd;
    res.end.apply(this, args);
  };

  next();
};

/**
 * Metrics endpoint handler
 * Serves Prometheus metrics
 */
const metricsEndpoint = async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end(error.message);
  }
};

// ============================================================================
// METRIC HELPER FUNCTIONS
// ============================================================================

/**
 * Record robot command metrics
 */
const recordRobotCommand = (commandType, deviceId, success, duration = null) => {
  robotCommandTotal.inc({ command_type: commandType, device_id: deviceId, success: success.toString() });

  if (duration !== null) {
    robotCommandDuration.observe({ command_type: commandType }, duration / 1000);
  }
};

/**
 * Record app operation metrics
 */
const recordAppOperation = (operation, appId, success, duration = null) => {
  appOperationTotal.inc({ operation, app_id: appId, success: success.toString() });

  if (operation === 'install' && duration !== null) {
    appInstallationDuration.observe({ app_id: appId }, duration / 1000);
  }
};

/**
 * Update robot connection status
 */
const updateRobotConnectionStatus = (connectionMode, connected) => {
  robotConnectionStatus.set({ connection_mode: connectionMode }, connected ? 1 : 0);
};

/**
 * Record authentication attempt
 */
const recordAuthenticationAttempt = (success, platform = 'unknown') => {
  const result = success ? 'success' : 'failure';
  authenticationTotal.inc({ result, platform });
};

/**
 * Update active devices count
 */
const updateActiveDevices = (count) => {
  activeDevices.set(count);
};

/**
 * Update system health status
 */
const updateSystemHealth = (component, healthy) => {
  systemHealth.set({ component }, healthy ? 1 : 0);
};

/**
 * Record WebSocket connection
 */
const recordWebSocketConnection = (type, platform, connected) => {
  const change = connected ? 1 : -1;
  websocketConnections.inc({ type, device_platform: platform }, change);
};

/**
 * Record WebSocket message
 */
const recordWebSocketMessage = (type, direction, size = 0) => {
  websocketMessages.inc({ type, direction });
  if (size > 0) {
    websocketDataTransferred.inc({ type, direction }, size);
  }
};

/**
 * Record network latency
 */
const recordNetworkLatency = (service, latency) => {
  networkLatency.observe({ service }, latency / 1000);
};

/**
 * Update circuit breaker state
 */
const updateCircuitBreakerState = (service, state) => {
  const stateValue = state === 'open' ? 1 : state === 'half-open' ? 0.5 : 0;
  circuitBreakerState.set({ service }, stateValue);
};

/**
 * Record circuit breaker failure
 */
const recordCircuitBreakerFailure = (service) => {
  circuitBreakerFailures.inc({ service });
};

/**
 * Get current metrics for health checks
 */
const getCurrentMetrics = async () => {
  const metrics = await register.getMetricsAsJSON();
  return metrics.reduce((acc, metric) => {
    acc[metric.name] = metric.values;
    return acc;
  }, {});
};

module.exports = {
  register,
  metricsMiddleware,
  metricsEndpoint,
  // Metric recording functions
  recordRobotCommand,
  recordAppOperation,
  updateRobotConnectionStatus,
  recordAuthenticationAttempt,
  updateActiveDevices,
  updateSystemHealth,
  recordWebSocketConnection,
  recordWebSocketMessage,
  recordNetworkLatency,
  updateCircuitBreakerState,
  recordCircuitBreakerFailure,
  getCurrentMetrics,
  // Direct access to metrics for advanced use cases
  metrics: {
    httpRequestDuration,
    httpRequestTotal,
    robotCommandTotal,
    robotConnectionStatus,
    appOperationTotal,
    websocketConnections,
    authenticationTotal,
    systemHealth,
    errorTotal,
  },
};