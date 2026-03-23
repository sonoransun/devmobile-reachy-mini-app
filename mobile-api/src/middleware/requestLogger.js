const logger = require('../utils/logger');

/**
 * Request logging middleware
 * Logs all incoming requests with response time and status
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Skip logging for certain endpoints to reduce noise
  const skipPaths = [
    '/health',
    '/metrics',
    '/favicon.ico',
  ];

  const shouldSkip = skipPaths.some(path => req.path.startsWith(path));

  if (shouldSkip) {
    return next();
  }

  // Override res.end to capture response time and status
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = Date.now() - startTime;

    // Log API access
    logger.apiAccess(req, res, responseTime);

    // Restore original end function and call it
    res.end = originalEnd;
    res.end.apply(this, args);
  };

  // Log request start (debug level)
  logger.debug('Request started', {
    method: req.method,
    url: req.originalUrl,
    correlationId: req.correlationId,
    deviceId: req.headers['x-device-id'],
    platform: req.headers['x-platform'],
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  next();
};

/**
 * Detailed request logger for debugging
 * Logs request and response details (development only)
 */
const detailedRequestLogger = (req, res, next) => {
  if (process.env.NODE_ENV !== 'development') {
    return next();
  }

  const startTime = Date.now();

  // Log detailed request info
  logger.debug('Detailed Request', {
    method: req.method,
    url: req.originalUrl,
    headers: req.headers,
    body: req.body,
    params: req.params,
    query: req.query,
    correlationId: req.correlationId,
  });

  // Capture response details
  const originalSend = res.send;
  const originalJson = res.json;

  res.send = function(data) {
    logger.debug('Response sent', {
      correlationId: req.correlationId,
      statusCode: res.statusCode,
      responseTime: `${Date.now() - startTime}ms`,
      responseSize: data ? data.length : 0,
      data: data && data.length < 1000 ? data : '[Large Response]', // Truncate large responses
    });

    res.send = originalSend;
    return originalSend.call(this, data);
  };

  res.json = function(data) {
    logger.debug('JSON response sent', {
      correlationId: req.correlationId,
      statusCode: res.statusCode,
      responseTime: `${Date.now() - startTime}ms`,
      data: typeof data === 'object' ? JSON.stringify(data).substring(0, 500) : data,
    });

    res.json = originalJson;
    return originalJson.call(this, data);
  };

  next();
};

/**
 * Security-focused request logger
 * Logs security-relevant request information
 */
const securityRequestLogger = (req, res, next) => {
  const securityEndpoints = [
    '/api/v1/auth',
    '/api/v1/settings',
    '/api/v1/system',
  ];

  const isSecurityEndpoint = securityEndpoints.some(endpoint =>
    req.path.startsWith(endpoint)
  );

  if (isSecurityEndpoint) {
    logger.info('Security-relevant request', {
      type: 'security_request',
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      correlationId: req.correlationId,
      deviceId: req.headers['x-device-id'],
      platform: req.headers['x-platform'],
      timestamp: new Date().toISOString(),
    });
  }

  next();
};

/**
 * Performance logging middleware
 * Logs slow requests for performance monitoring
 */
const performanceLogger = (req, res, next) => {
  const startTime = Date.now();
  const slowRequestThreshold = 1000; // 1 second

  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = Date.now() - startTime;

    // Log slow requests
    if (responseTime > slowRequestThreshold) {
      logger.warn('Slow request detected', {
        type: 'slow_request',
        method: req.method,
        url: req.originalUrl,
        responseTime: `${responseTime}ms`,
        statusCode: res.statusCode,
        correlationId: req.correlationId,
        deviceId: req.headers['x-device-id'],
        threshold: `${slowRequestThreshold}ms`,
      });
    }

    // Log performance metric
    logger.performanceMetric('api_response_time', responseTime, 'ms', {
      method: req.method,
      endpoint: req.route?.path || req.path,
      statusCode: res.statusCode,
    });

    res.end = originalEnd;
    res.end.apply(this, args);
  };

  next();
};

/**
 * Error request logger
 * Logs additional context for failed requests
 */
const errorRequestLogger = (error, req, res, next) => {
  // Log request context for errors
  logger.error('Request failed', {
    type: 'request_error',
    error: error.message,
    method: req.method,
    url: req.originalUrl,
    correlationId: req.correlationId,
    deviceId: req.headers['x-device-id'],
    body: req.body,
    params: req.params,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  next(error);
};

/**
 * Robot command logger
 * Specifically logs robot control commands for audit trail
 */
const robotCommandLogger = (req, res, next) => {
  if (!req.path.startsWith('/api/v1/robot/')) {
    return next();
  }

  // Extract command type from path
  const pathParts = req.path.split('/');
  const commandType = pathParts[pathParts.length - 1];

  const originalSend = res.send;
  const originalJson = res.json;

  const logRobotCommand = (success) => {
    logger.robotCommand(
      commandType,
      req.headers['x-device-id'],
      req.correlationId,
      success,
      {
        method: req.method,
        path: req.path,
        body: req.body,
        statusCode: res.statusCode,
      }
    );
  };

  res.send = function(data) {
    logRobotCommand(res.statusCode < 400);
    res.send = originalSend;
    return originalSend.call(this, data);
  };

  res.json = function(data) {
    logRobotCommand(res.statusCode < 400);
    res.json = originalJson;
    return originalJson.call(this, data);
  };

  next();
};

/**
 * Combine all request loggers into a single middleware
 */
const requestLoggerMiddleware = [
  requestLogger,
  securityRequestLogger,
  performanceLogger,
  robotCommandLogger,
];

module.exports = {
  requestLogger,
  detailedRequestLogger,
  securityRequestLogger,
  performanceLogger,
  errorRequestLogger,
  robotCommandLogger,
  requestLoggerMiddleware,
};