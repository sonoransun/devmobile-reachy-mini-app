const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/errors');

/**
 * Express middleware for request validation
 */
function validateRequest(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map(error => ({
      field: error.param,
      message: error.msg,
      value: error.value,
    }));

    logger.warn('Request validation failed', {
      path: req.path,
      method: req.method,
      errors: validationErrors,
      deviceId: req.headers['x-device-id'],
      correlationId: req.correlationId,
    });

    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: validationErrors,
      correlationId: req.correlationId,
    });
  }

  next();
}

/**
 * Create validation middleware for specific validation rules
 * @param {Array} validationRules - Array of express-validator validation rules
 * @returns {Array} Array of validation rules + validation middleware
 */
function createValidation(validationRules) {
  return [...validationRules, validateRequest];
}

module.exports = {
  validateRequest,
  createValidation,
};