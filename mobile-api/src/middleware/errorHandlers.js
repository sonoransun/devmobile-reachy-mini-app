const logger = require('../utils/logger');
const { ApiError, normalizeError } = require('../utils/errors');

/**
 * Global error handler middleware
 * Converts all errors to consistent API responses
 */
const errorHandler = (error, req, res, next) => {
  // Skip if response already sent
  if (res.headersSent) {
    return next(error);
  }

  // Normalize error to ApiError
  const apiError = normalizeError(error);

  // Log error with context
  const logContext = {
    correlationId: req.correlationId,
    deviceId: req.headers['x-device-id'],
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    platform: req.headers['x-platform'],
    statusCode: apiError.statusCode,
    errorCode: apiError.code,
  };

  if (apiError.isServerError()) {
    // Log server errors as errors with full stack
    logger.error('Server Error:', {
      message: apiError.message,
      stack: apiError.stack,
      ...logContext,
    });
  } else if (apiError.isClientError()) {
    // Log client errors as warnings (less verbose)
    if (apiError.statusCode === 401 || apiError.statusCode === 403) {
      // Security-related errors
      logger.securityEvent('client_error', req, {
        errorCode: apiError.code,
        message: apiError.message,
      });
    } else {
      logger.warn('Client Error:', {
        message: apiError.message,
        ...logContext,
      });
    }
  }

  // Set error response headers
  res.setHeader('Content-Type', 'application/json');

  // Add retry-after header for rate limiting errors
  if (apiError.statusCode === 429 && apiError.retryAfter) {
    res.setHeader('Retry-After', apiError.retryAfter);
  }

  // Send error response
  res.status(apiError.statusCode).json(apiError.toJSON(req.correlationId));
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res, next) => {
  const error = new ApiError(
    404,
    'ENDPOINT_NOT_FOUND',
    `Endpoint ${req.method} ${req.originalUrl} not found`
  );

  // Log 404s as warnings
  logger.warn('404 Not Found:', {
    method: req.method,
    url: req.originalUrl,
    correlationId: req.correlationId,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  next(error);
};

/**
 * Validation error handler for express-validator
 * Should be used after validation middleware
 */
const handleValidationErrors = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const { ValidationError } = require('../utils/errors');
    const validationError = ValidationError.fromExpressValidator(errors.array());

    logger.warn('Validation Error:', {
      errors: validationError.details.errors,
      method: req.method,
      url: req.originalUrl,
      correlationId: req.correlationId,
      deviceId: req.headers['x-device-id'],
    });

    return next(validationError);
  }

  next();
};

/**
 * Async error wrapper
 * Automatically catches async errors and passes to error handler
 */
const asyncErrorHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Robot daemon error handler
 * Converts robot daemon HTTP errors to appropriate API errors
 */
const handleRobotDaemonError = (error, operation = 'robot_operation') => {
  const { RobotError, NetworkError } = require('../utils/errors');

  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return new NetworkError('robot_daemon', error);
  }

  if (error.code === 'ETIMEDOUT') {
    return new NetworkError('robot_daemon', error, true);
  }

  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;

    switch (status) {
      case 423: // Robot busy
        return new RobotError(423, 'ROBOT_BUSY', 'Robot is busy executing another command', data?.status);

      case 400: // Bad request to robot
        return new RobotError(400, 'INVALID_ROBOT_COMMAND',
          data?.message || 'Invalid robot command', data?.status, data);

      case 404: // Robot resource not found
        return new RobotError(404, 'ROBOT_RESOURCE_NOT_FOUND',
          data?.message || 'Robot resource not found', data?.status);

      case 500: // Robot internal error
        return new RobotError(500, 'ROBOT_INTERNAL_ERROR',
          data?.message || 'Robot internal error', data?.status);

      case 503: // Robot service unavailable
        return new RobotError(503, 'ROBOT_UNAVAILABLE',
          'Robot service is unavailable', data?.status);

      default:
        return new RobotError(status, 'ROBOT_ERROR',
          data?.message || `Robot operation failed: ${operation}`, data?.status);
    }
  }

  // Generic robot error
  return new RobotError(500, 'ROBOT_COMMUNICATION_ERROR',
    `Failed to communicate with robot during: ${operation}`);
};

/**
 * Application management error handler
 * Converts app-related errors to appropriate API errors
 */
const handleAppError = (error, operation = 'app_operation', appId = null) => {
  const { ApiError } = require('../utils/errors');

  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;

    switch (status) {
      case 404:
        return new ApiError(404, 'APP_NOT_FOUND',
          `Application ${appId ? `'${appId}'` : ''} not found`);

      case 409:
        return new ApiError(409, 'APP_CONFLICT',
          data?.message || 'Application conflict');

      case 422:
        return new ApiError(422, 'APP_INSTALLATION_ERROR',
          data?.message || 'Application installation failed');

      default:
        return new ApiError(status, 'APP_ERROR',
          data?.message || `Application ${operation} failed`);
    }
  }

  return new ApiError(500, 'APP_COMMUNICATION_ERROR',
    `Failed to communicate with app service during: ${operation}`);
};

/**
 * Middleware to handle multipart/form-data errors
 */
const handleMulterError = (error, req, res, next) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    const apiError = new ApiError(413, 'FILE_TOO_LARGE',
      `File size exceeds limit of ${error.limit} bytes`);
    return next(apiError);
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    const apiError = new ApiError(400, 'TOO_MANY_FILES',
      `Too many files. Maximum allowed: ${error.limit}`);
    return next(apiError);
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    const apiError = new ApiError(400, 'UNEXPECTED_FILE',
      `Unexpected file field: ${error.field}`);
    return next(apiError);
  }

  next(error);
};

/**
 * Security event error handler
 * Special handling for security-related errors
 */
const handleSecurityError = (error, req, res, next) => {
  // Rate limiting errors
  if (error.statusCode === 429) {
    logger.securityEvent('rate_limit_exceeded', req, {
      limit: error.limit,
      current: error.current,
      resetTime: error.resetTime,
    });
  }

  // Authentication errors
  if (error.statusCode === 401) {
    logger.securityEvent('authentication_failure', req, {
      reason: error.code,
      message: error.message,
    });
  }

  // Authorization errors
  if (error.statusCode === 403) {
    logger.securityEvent('authorization_failure', req, {
      reason: error.code,
      requiredPermissions: error.details?.permissions,
    });
  }

  next(error);
};

/**
 * Development error handler with detailed stack traces
 */
const developmentErrorHandler = (error, req, res, next) => {
  if (process.env.NODE_ENV !== 'development') {
    return next(error);
  }

  // In development, always show full error details
  const apiError = normalizeError(error);
  const errorResponse = apiError.toJSON(req.correlationId);

  // Add extra debugging info in development
  errorResponse.debug = {
    stack: error.stack,
    headers: req.headers,
    body: req.body,
    params: req.params,
    query: req.query,
  };

  res.status(apiError.statusCode).json(errorResponse);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  handleValidationErrors,
  asyncErrorHandler,
  asyncHandler: asyncErrorHandler, // Alias for compatibility
  handleRobotDaemonError,
  handleAppError,
  handleMulterError,
  handleSecurityError,
  developmentErrorHandler,
};