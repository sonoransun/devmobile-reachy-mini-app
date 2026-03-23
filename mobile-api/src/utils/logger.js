const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, '../../logs');
require('fs').mkdirSync(logDir, { recursive: true });

// Custom format for structured logging
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, correlationId, deviceId, ...metadata }) => {
    let logEntry = `${timestamp} [${level.toUpperCase()}]`;

    // Add correlation ID if available
    if (correlationId) {
      logEntry += ` [${correlationId}]`;
    }

    // Add device ID if available
    if (deviceId) {
      logEntry += ` [${deviceId}]`;
    }

    logEntry += `: ${message}`;

    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      logEntry += ` ${JSON.stringify(metadata)}`;
    }

    return logEntry;
  })
);

// JSON format for machine-readable logs (production)
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Development vs Production logging
const isDevelopment = process.env.NODE_ENV !== 'production';

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  format: isDevelopment ? customFormat : jsonFormat,
  defaultMeta: {
    service: 'reachy-mobile-api',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    // Console logging
    new winston.transports.Console({
      format: isDevelopment ? customFormat : jsonFormat,
      silent: process.env.NODE_ENV === 'test', // Disable console logs in tests
    }),

    // File logging - All logs
    new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: jsonFormat,
    }),

    // File logging - Errors only
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
      format: jsonFormat,
    }),

    // File logging - API access logs
    new DailyRotateFile({
      filename: path.join(logDir, 'access-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '7d',
      format: jsonFormat,
      // Custom filter for access logs
      filter: (info) => info.type === 'api_access',
    }),
  ],

  // Handle exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      format: jsonFormat,
    })
  ],

  // Handle rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
      format: jsonFormat,
    })
  ],

  // Exit on error
  exitOnError: false,
});

// Add methods for structured logging
logger.apiAccess = (req, res, responseTime) => {
  const logData = {
    type: 'api_access',
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.get('User-Agent'),
    correlationId: req.correlationId,
    deviceId: req.headers['x-device-id'],
    platform: req.headers['x-platform'],
    appVersion: req.headers['x-app-version'],
    ip: req.ip,
    contentLength: res.get('Content-Length') || 0,
  };

  // Log as info for successful requests, warn for client errors, error for server errors
  if (res.statusCode >= 500) {
    logger.error('API Access', logData);
  } else if (res.statusCode >= 400) {
    logger.warn('API Access', logData);
  } else {
    logger.info('API Access', logData);
  }
};

logger.robotCommand = (command, deviceId, correlationId, success = true, details = {}) => {
  logger.info('Robot Command', {
    type: 'robot_command',
    command,
    deviceId,
    correlationId,
    success,
    ...details,
  });
};

logger.appOperation = (operation, appId, deviceId, correlationId, details = {}) => {
  logger.info('App Operation', {
    type: 'app_operation',
    operation,
    appId,
    deviceId,
    correlationId,
    ...details,
  });
};

logger.systemEvent = (event, details = {}) => {
  logger.info('System Event', {
    type: 'system_event',
    event,
    ...details,
  });
};

logger.securityEvent = (event, req, details = {}) => {
  logger.warn('Security Event', {
    type: 'security_event',
    event,
    ip: req?.ip,
    userAgent: req?.get('User-Agent'),
    correlationId: req?.correlationId,
    deviceId: req?.headers['x-device-id'],
    ...details,
  });
};

logger.performanceMetric = (metric, value, unit = 'ms', details = {}) => {
  logger.debug('Performance Metric', {
    type: 'performance_metric',
    metric,
    value,
    unit,
    ...details,
  });
};

logger.networkEvent = (event, details = {}) => {
  logger.info('Network Event', {
    type: 'network_event',
    event,
    ...details,
  });
};

logger.circuitBreakerEvent = (service, state, details = {}) => {
  const level = state === 'open' ? 'error' : state === 'half-open' ? 'warn' : 'info';
  logger[level]('Circuit Breaker', {
    type: 'circuit_breaker',
    service,
    state,
    ...details,
  });
};

// Add request context to child logger
logger.withContext = (req) => {
  return logger.child({
    correlationId: req.correlationId,
    deviceId: req.headers['x-device-id'],
    platform: req.headers['x-platform'],
    ip: req.ip,
  });
};

module.exports = logger;