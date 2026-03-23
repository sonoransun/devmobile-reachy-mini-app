const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/errors');

// JWT Secret - should be loaded from environment
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '1h';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '30d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

/**
 * Generate JWT access token
 * @param {Object} payload - Token payload
 * @returns {string} JWT token
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRY,
    issuer: 'reachy-mobile-api',
    audience: 'mobile-app',
  });
};

/**
 * Generate JWT refresh token
 * @param {Object} payload - Token payload
 * @returns {string} JWT token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRY,
    issuer: 'reachy-mobile-api',
    audience: 'mobile-app',
  });
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'reachy-mobile-api',
      audience: 'mobile-app',
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'TOKEN_EXPIRED', 'Access token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new ApiError(401, 'INVALID_TOKEN', 'Invalid access token');
    } else {
      throw new ApiError(401, 'TOKEN_VERIFICATION_FAILED', 'Token verification failed');
    }
  }
};

/**
 * Authentication middleware
 * Verifies JWT token and device ID
 */
const authenticate = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      logger.securityEvent('missing_authorization_header', req);
      throw new ApiError(401, 'NO_TOKEN', 'Authorization header is required');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      logger.securityEvent('invalid_authorization_format', req);
      throw new ApiError(401, 'NO_TOKEN', 'Bearer token is required');
    }

    // Verify JWT token
    const decoded = verifyToken(token);

    // Extract device ID from headers
    const deviceId = req.headers['x-device-id'];
    if (!deviceId) {
      logger.securityEvent('missing_device_id', req);
      throw new ApiError(401, 'NO_DEVICE_ID', 'X-Device-ID header is required');
    }

    // Verify device ID matches token
    if (decoded.deviceId !== deviceId) {
      logger.securityEvent('device_id_mismatch', req, {
        tokenDeviceId: decoded.deviceId,
        headerDeviceId: deviceId,
      });
      throw new ApiError(401, 'DEVICE_MISMATCH', 'Device ID does not match token');
    }

    // TODO: Check if device is revoked/blacklisted in Redis/Database
    // const isRevoked = await checkDeviceRevocation(deviceId);
    // if (isRevoked) {
    //   logger.securityEvent('revoked_device_access_attempt', req, { deviceId });
    //   throw new ApiError(401, 'DEVICE_REVOKED', 'Device access has been revoked');
    // }

    // Add user/device info to request
    req.auth = {
      deviceId: decoded.deviceId,
      deviceName: decoded.deviceName,
      platform: decoded.platform,
      userId: decoded.userId, // If user-based auth is added later
      permissions: decoded.permissions || [],
      tokenIssuedAt: decoded.iat,
      tokenExpiresAt: decoded.exp,
    };

    // Log successful authentication (debug level)
    logger.debug('Authentication successful', {
      deviceId: req.auth.deviceId,
      platform: req.auth.platform,
      correlationId: req.correlationId,
    });

    next();
  } catch (error) {
    // Log authentication failure
    if (error instanceof ApiError) {
      logger.securityEvent('authentication_failed', req, {
        reason: error.code,
        message: error.message,
      });
    } else {
      logger.error('Authentication error:', error, {
        correlationId: req.correlationId,
      });
    }

    next(error);
  }
};

/**
 * Optional authentication middleware
 * Similar to authenticate but doesn't require auth - sets req.auth if token is valid
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const deviceId = req.headers['x-device-id'];

    if (!authHeader || !deviceId) {
      // No authentication provided, continue without auth
      req.auth = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      req.auth = null;
      return next();
    }

    // Try to verify token
    const decoded = verifyToken(token);

    if (decoded.deviceId === deviceId) {
      req.auth = {
        deviceId: decoded.deviceId,
        deviceName: decoded.deviceName,
        platform: decoded.platform,
        userId: decoded.userId,
        permissions: decoded.permissions || [],
        tokenIssuedAt: decoded.iat,
        tokenExpiresAt: decoded.exp,
      };
    } else {
      req.auth = null;
    }

    next();
  } catch (error) {
    // Authentication failed, but it's optional so continue without auth
    req.auth = null;
    next();
  }
};

/**
 * Permission check middleware factory
 * @param {string|string[]} requiredPermissions - Required permission(s)
 * @returns {Function} Express middleware
 */
const requirePermissions = (requiredPermissions) => {
  const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

  return (req, res, next) => {
    if (!req.auth) {
      throw new ApiError(401, 'NOT_AUTHENTICATED', 'Authentication required');
    }

    const userPermissions = req.auth.permissions || [];
    const hasPermission = permissions.some(permission =>
      userPermissions.includes(permission) || userPermissions.includes('admin')
    );

    if (!hasPermission) {
      logger.securityEvent('insufficient_permissions', req, {
        required: permissions,
        available: userPermissions,
      });
      throw new ApiError(403, 'INSUFFICIENT_PERMISSIONS', `Required permissions: ${permissions.join(', ')}`);
    }

    next();
  };
};

/**
 * Device rate limiting by device ID
 * @param {number} maxRequests - Maximum requests per window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Function} Express middleware
 */
const deviceRateLimit = (maxRequests, windowMs) => {
  const deviceCounts = new Map();

  // Clean up expired entries every minute
  setInterval(() => {
    const now = Date.now();
    for (const [deviceId, data] of deviceCounts.entries()) {
      if (now - data.resetTime > windowMs) {
        deviceCounts.delete(deviceId);
      }
    }
  }, 60000);

  return (req, res, next) => {
    if (!req.auth) {
      return next(); // Skip if not authenticated
    }

    const deviceId = req.auth.deviceId;
    const now = Date.now();

    let deviceData = deviceCounts.get(deviceId);
    if (!deviceData || now - deviceData.resetTime > windowMs) {
      deviceData = {
        count: 0,
        resetTime: now,
      };
      deviceCounts.set(deviceId, deviceData);
    }

    deviceData.count++;

    if (deviceData.count > maxRequests) {
      logger.securityEvent('device_rate_limit_exceeded', req, {
        maxRequests,
        windowMs,
        currentCount: deviceData.count,
      });

      throw new ApiError(429, 'DEVICE_RATE_LIMIT_EXCEEDED',
        `Too many requests from this device. Limit: ${maxRequests} requests per ${windowMs/1000} seconds`);
    }

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - deviceData.count));
    res.setHeader('X-RateLimit-Reset', new Date(deviceData.resetTime + windowMs).toISOString());

    next();
  };
};

/**
 * Extract device information from request headers
 * @param {Object} req - Express request object
 * @returns {Object} Device information
 */
const extractDeviceInfo = (req) => {
  return {
    deviceId: req.headers['x-device-id'],
    platform: req.headers['x-platform'],
    appVersion: req.headers['x-app-version'],
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  };
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  requirePermissions,
  deviceRateLimit,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  extractDeviceInfo,
};