const express = require('express');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  extractDeviceInfo
} = require('../middleware/auth');
const { recordAuthenticationAttempt } = require('../middleware/metrics');
const { ApiError, ValidationError } = require('../utils/errors');
const { asyncHandler } = require('../utils/errors');

const router = express.Router();

/**
 * Device login/registration
 * Generates JWT tokens for device authentication
 */
router.post('/login', [
  body('deviceId')
    .isLength({ min: 10, max: 128 })
    .withMessage('Device ID must be between 10 and 128 characters')
    .matches(/^[a-zA-Z0-9\-_]+$/)
    .withMessage('Device ID can only contain alphanumeric characters, hyphens, and underscores'),

  body('deviceName')
    .isLength({ min: 1, max: 100 })
    .withMessage('Device name must be between 1 and 100 characters')
    .trim()
    .escape(),

  body('platform')
    .isIn(['mobile-ios', 'mobile-android', 'pwa'])
    .withMessage('Platform must be mobile-ios, mobile-android, or pwa'),

  body('biometricEnabled')
    .optional()
    .isBoolean()
    .withMessage('Biometric enabled must be a boolean'),
], asyncHandler(async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const validationError = ValidationError.fromExpressValidator(errors.array());
    recordAuthenticationAttempt(false, req.body.platform);
    throw validationError;
  }

  const { deviceId, deviceName, platform, biometricEnabled = false } = req.body;
  const deviceInfo = extractDeviceInfo(req);

  try {
    // TODO: Check if device is already registered
    // TODO: Implement device registration logic
    // TODO: Store device info in database

    // For now, generate tokens for any valid request
    const tokenPayload = {
      deviceId,
      deviceName,
      platform,
      biometricEnabled,
      registeredAt: new Date().toISOString(),
      // TODO: Add user ID when user management is implemented
      // userId: user.id,
      permissions: ['robot:control', 'apps:manage'], // Default permissions
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Log successful authentication
    logger.info('Device authenticated successfully', {
      deviceId,
      platform,
      correlationId: req.correlationId,
      ip: req.ip,
    });

    recordAuthenticationAttempt(true, platform);

    res.json({
      accessToken,
      refreshToken,
      expiresIn: 3600, // 1 hour in seconds
      tokenType: 'Bearer',
      deviceId,
      permissions: tokenPayload.permissions,
    });

  } catch (error) {
    logger.error('Authentication failed:', error, {
      deviceId,
      correlationId: req.correlationId,
    });

    recordAuthenticationAttempt(false, platform);
    throw new ApiError(500, 'AUTH_FAILED', 'Authentication failed');
  }
}));

/**
 * Refresh access token
 */
router.post('/refresh', [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ValidationError.fromExpressValidator(errors.array());
  }

  const { refreshToken } = req.body;

  try {
    // Verify refresh token
    const decoded = verifyToken(refreshToken);

    // TODO: Check if refresh token is revoked in database
    // TODO: Implement refresh token rotation

    // Generate new access token
    const tokenPayload = {
      deviceId: decoded.deviceId,
      deviceName: decoded.deviceName,
      platform: decoded.platform,
      biometricEnabled: decoded.biometricEnabled,
      permissions: decoded.permissions,
    };

    const newAccessToken = generateAccessToken(tokenPayload);

    logger.info('Access token refreshed', {
      deviceId: decoded.deviceId,
      correlationId: req.correlationId,
    });

    res.json({
      accessToken: newAccessToken,
      expiresIn: 3600, // 1 hour in seconds
      tokenType: 'Bearer',
    });

  } catch (error) {
    logger.warn('Token refresh failed:', error, {
      correlationId: req.correlationId,
    });

    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'REFRESH_TOKEN_EXPIRED', 'Refresh token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
    }

    throw new ApiError(401, 'TOKEN_REFRESH_FAILED', 'Failed to refresh token');
  }
}));

/**
 * Logout - invalidate tokens
 */
router.post('/logout', asyncHandler(async (req, res) => {
  const deviceId = req.headers['x-device-id'];

  if (!deviceId) {
    throw new ApiError(400, 'MISSING_DEVICE_ID', 'X-Device-ID header is required');
  }

  try {
    // TODO: Add refresh token to blacklist in Redis/Database
    // TODO: Implement token revocation

    logger.info('Device logged out', {
      deviceId,
      correlationId: req.correlationId,
      ip: req.ip,
    });

    res.json({
      message: 'Logged out successfully',
      deviceId,
    });

  } catch (error) {
    logger.error('Logout failed:', error, {
      deviceId,
      correlationId: req.correlationId,
    });

    throw new ApiError(500, 'LOGOUT_FAILED', 'Failed to logout');
  }
}));

/**
 * Get authentication status
 */
router.get('/status', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  const deviceId = req.headers['x-device-id'];

  if (!authHeader || !deviceId) {
    return res.json({
      authenticated: false,
      deviceId: null,
    });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (decoded.deviceId === deviceId) {
      res.json({
        authenticated: true,
        deviceId: decoded.deviceId,
        deviceName: decoded.deviceName,
        platform: decoded.platform,
        permissions: decoded.permissions,
        expiresAt: decoded.exp * 1000, // Convert to milliseconds
        issuedAt: decoded.iat * 1000,
      });
    } else {
      res.json({
        authenticated: false,
        deviceId: null,
        error: 'Device ID mismatch',
      });
    }

  } catch (error) {
    res.json({
      authenticated: false,
      deviceId: null,
      error: error.message,
    });
  }
}));

/**
 * Register new device (alternative endpoint)
 */
router.post('/register-device', [
  body('deviceId')
    .isLength({ min: 10, max: 128 })
    .withMessage('Device ID must be between 10 and 128 characters'),

  body('deviceName')
    .isLength({ min: 1, max: 100 })
    .withMessage('Device name is required'),

  body('platform')
    .isIn(['mobile-ios', 'mobile-android', 'pwa'])
    .withMessage('Valid platform is required'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ValidationError.fromExpressValidator(errors.array());
  }

  const { deviceId, deviceName, platform } = req.body;

  try {
    // TODO: Check if device is already registered
    // TODO: Implement device registration in database

    logger.info('Device registered', {
      deviceId,
      deviceName,
      platform,
      correlationId: req.correlationId,
      ip: req.ip,
    });

    res.status(201).json({
      message: 'Device registered successfully',
      deviceId,
      deviceName,
      platform,
      registeredAt: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Device registration failed:', error, {
      deviceId,
      correlationId: req.correlationId,
    });

    throw new ApiError(500, 'REGISTRATION_FAILED', 'Device registration failed');
  }
}));

module.exports = router;