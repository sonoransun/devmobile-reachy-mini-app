/**
 * Custom API Error class for consistent error handling
 */
class ApiError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON response format
   * @param {string} correlationId - Request correlation ID
   * @returns {Object} Error response object
   */
  toJSON(correlationId = null) {
    const errorResponse = {
      error: {
        code: this.code,
        message: this.message,
        timestamp: this.timestamp,
      }
    };

    if (correlationId) {
      errorResponse.error.correlationId = correlationId;
    }

    if (this.details) {
      errorResponse.error.details = this.details;
    }

    // Don't include stack trace in production
    if (process.env.NODE_ENV === 'development') {
      errorResponse.error.stack = this.stack;
    }

    return errorResponse;
  }

  /**
   * Check if error is a client error (4xx)
   * @returns {boolean}
   */
  isClientError() {
    return this.statusCode >= 400 && this.statusCode < 500;
  }

  /**
   * Check if error is a server error (5xx)
   * @returns {boolean}
   */
  isServerError() {
    return this.statusCode >= 500;
  }
}

/**
 * Validation Error class for request validation failures
 */
class ValidationError extends ApiError {
  constructor(message, errors = []) {
    super(400, 'VALIDATION_ERROR', message, { errors });
  }

  /**
   * Create ValidationError from express-validator errors
   * @param {Array} validationErrors - Array of validation errors
   * @returns {ValidationError}
   */
  static fromExpressValidator(validationErrors) {
    const errors = validationErrors.map(error => ({
      field: error.param || error.path,
      message: error.msg,
      value: error.value,
      location: error.location,
    }));

    const message = errors.length === 1
      ? `Validation failed: ${errors[0].message}`
      : `Validation failed: ${errors.length} errors`;

    return new ValidationError(message, errors);
  }
}

/**
 * Robot Error class for robot-specific errors
 */
class RobotError extends ApiError {
  constructor(statusCode, code, message, robotStatus = null, details = null) {
    super(statusCode, code, message, details);
    this.robotStatus = robotStatus;
  }

  toJSON(correlationId = null) {
    const json = super.toJSON(correlationId);
    if (this.robotStatus) {
      json.error.robotStatus = this.robotStatus;
    }
    return json;
  }
}

/**
 * Network Error class for external service failures
 */
class NetworkError extends ApiError {
  constructor(service, originalError, timeout = false) {
    const message = timeout
      ? `Service ${service} timed out`
      : `Service ${service} is unavailable: ${originalError.message}`;

    super(503, timeout ? 'SERVICE_TIMEOUT' : 'SERVICE_UNAVAILABLE', message, {
      service,
      timeout,
      originalError: originalError.message,
    });

    this.service = service;
    this.timeout = timeout;
  }
}

/**
 * Authentication Error class
 */
class AuthError extends ApiError {
  constructor(code, message, details = null) {
    super(401, code, message, details);
  }
}

/**
 * Authorization Error class
 */
class AuthorizationError extends ApiError {
  constructor(code, message, details = null) {
    super(403, code, message, details);
  }
}

/**
 * Rate Limit Error class
 */
class RateLimitError extends ApiError {
  constructor(message, retryAfter = null) {
    super(429, 'RATE_LIMIT_EXCEEDED', message, { retryAfter });
    this.retryAfter = retryAfter;
  }
}

// Pre-defined common errors
const CommonErrors = {
  // Authentication & Authorization
  INVALID_TOKEN: new AuthError('INVALID_TOKEN', 'Invalid or expired authentication token'),
  MISSING_TOKEN: new AuthError('MISSING_TOKEN', 'Authentication token is required'),
  INSUFFICIENT_PERMISSIONS: new AuthorizationError('INSUFFICIENT_PERMISSIONS', 'Insufficient permissions for this operation'),
  DEVICE_NOT_REGISTERED: new AuthError('DEVICE_NOT_REGISTERED', 'Device is not registered'),

  // Validation
  INVALID_REQUEST: new ValidationError('Invalid request parameters'),
  MISSING_REQUIRED_FIELD: new ValidationError('Required field is missing'),
  INVALID_JSON: new ValidationError('Invalid JSON in request body'),

  // Robot Control
  ROBOT_NOT_CONNECTED: new RobotError(503, 'ROBOT_NOT_CONNECTED', 'Robot is not connected'),
  ROBOT_BUSY: new RobotError(423, 'ROBOT_BUSY', 'Robot is busy executing another command'),
  ROBOT_ERROR: new RobotError(500, 'ROBOT_ERROR', 'Robot command failed'),
  INVALID_ROBOT_COMMAND: new RobotError(400, 'INVALID_COMMAND', 'Invalid robot command'),
  ROBOT_SAFETY_LIMIT: new RobotError(400, 'SAFETY_LIMIT_EXCEEDED', 'Command exceeds robot safety limits'),

  // Applications
  APP_NOT_FOUND: new ApiError(404, 'APP_NOT_FOUND', 'Application not found'),
  APP_ALREADY_INSTALLED: new ApiError(409, 'APP_ALREADY_INSTALLED', 'Application is already installed'),
  APP_NOT_INSTALLED: new ApiError(404, 'APP_NOT_INSTALLED', 'Application is not installed'),
  APP_INSTALLATION_FAILED: new ApiError(500, 'APP_INSTALLATION_FAILED', 'Application installation failed'),
  APP_START_FAILED: new ApiError(500, 'APP_START_FAILED', 'Failed to start application'),

  // System
  SYSTEM_ERROR: new ApiError(500, 'SYSTEM_ERROR', 'Internal system error'),
  SERVICE_UNAVAILABLE: new ApiError(503, 'SERVICE_UNAVAILABLE', 'Service is temporarily unavailable'),
  CONFIGURATION_ERROR: new ApiError(500, 'CONFIGURATION_ERROR', 'System configuration error'),

  // Network
  NETWORK_ERROR: new ApiError(503, 'NETWORK_ERROR', 'Network communication error'),
  TIMEOUT_ERROR: new ApiError(504, 'TIMEOUT_ERROR', 'Operation timed out'),
  CONNECTION_FAILED: new ApiError(503, 'CONNECTION_FAILED', 'Failed to connect to external service'),

  // General
  NOT_FOUND: new ApiError(404, 'NOT_FOUND', 'Resource not found'),
  METHOD_NOT_ALLOWED: new ApiError(405, 'METHOD_NOT_ALLOWED', 'HTTP method not allowed'),
  INTERNAL_ERROR: new ApiError(500, 'INTERNAL_ERROR', 'Internal server error'),
  BAD_REQUEST: new ApiError(400, 'BAD_REQUEST', 'Bad request'),
};

/**
 * Create error from HTTP response
 * @param {Object} response - HTTP response object
 * @param {string} service - Service name
 * @returns {ApiError}
 */
const createErrorFromResponse = (response, service = 'external_service') => {
  const statusCode = response.status || response.statusCode || 500;
  const message = response.statusText || response.data?.message || 'External service error';

  if (statusCode >= 500) {
    return new NetworkError(service, new Error(message));
  } else if (statusCode === 429) {
    return new RateLimitError(`Rate limit exceeded for ${service}`);
  } else if (statusCode >= 400) {
    return new ApiError(statusCode, 'EXTERNAL_SERVICE_ERROR', `${service}: ${message}`);
  }

  return new ApiError(500, 'UNKNOWN_ERROR', 'Unknown error occurred');
};

/**
 * Wrap async function to catch and convert errors
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Convert unknown error to ApiError
 * @param {Error} error - Original error
 * @param {string} defaultMessage - Default error message
 * @returns {ApiError}
 */
const normalizeError = (error, defaultMessage = 'An error occurred') => {
  if (error instanceof ApiError) {
    return error;
  }

  // Handle specific error types
  if (error.name === 'ValidationError') {
    return new ValidationError(error.message);
  }

  if (error.name === 'CastError' || error.name === 'TypeError') {
    return new ValidationError('Invalid data type in request');
  }

  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return new NetworkError('external_service', error);
  }

  if (error.code === 'ETIMEDOUT') {
    return new NetworkError('external_service', error, true);
  }

  // Default to internal server error
  return new ApiError(500, 'INTERNAL_ERROR', defaultMessage, {
    originalError: error.message,
    code: error.code,
  });
};

module.exports = {
  ApiError,
  ValidationError,
  RobotError,
  NetworkError,
  AuthError,
  AuthorizationError,
  RateLimitError,
  CommonErrors,
  createErrorFromResponse,
  asyncHandler,
  normalizeError,
};