const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { handleValidationErrors, asyncHandler } = require('../middleware/errorHandlers');
const { recordRobotCommand } = require('../middleware/metrics');
const { ApiError, RobotError } = require('../utils/errors');
const daemonClient = require('../services/daemonClient');

const router = express.Router();

/**
 * Get current robot status
 */
router.get('/status', asyncHandler(async (req, res) => {
  const robotStatus = await daemonClient.getRobotStatus();
  res.json(robotStatus);
}));

/**
 * Get connection information
 */
router.get('/connection', asyncHandler(async (req, res) => {
  const connectionInfo = await daemonClient.getConnectionInfo();
  res.json(connectionInfo);
}));

/**
 * Initiate robot connection
 */
router.post('/connect', [
  body('mode').isIn(['usb', 'wifi', 'simulation']).withMessage('Invalid connection mode'),
  body('host').optional().isString(),
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { mode, host } = req.body;
  const startTime = Date.now();

  try {
    const connectionResult = await daemonClient.connectRobot({ mode, host });
    const duration = Date.now() - startTime;
    recordRobotCommand('connect', req.auth.deviceId, true, duration);

    res.json(connectionResult);
  } catch (error) {
    const duration = Date.now() - startTime;
    recordRobotCommand('connect', req.auth.deviceId, false, duration);
    throw error;
  }
}));

/**
 * Disconnect from robot
 */
router.post('/disconnect', asyncHandler(async (req, res) => {
  const startTime = Date.now();

  try {
    const disconnectResult = await daemonClient.disconnectRobot();
    const duration = Date.now() - startTime;
    recordRobotCommand('disconnect', req.auth.deviceId, true, duration);

    res.json(disconnectResult);
  } catch (error) {
    const duration = Date.now() - startTime;
    recordRobotCommand('disconnect', req.auth.deviceId, false, duration);
    throw error;
  }
}));

/**
 * Get current robot state snapshot
 */
router.get('/state/current', asyncHandler(async (req, res) => {
  const robotState = await daemonClient.getRobotState();
  res.json(robotState);
}));

/**
 * Set movement target (continuous control)
 */
router.post('/move/target', [
  body('headPose').optional().isArray(),
  body('bodyYaw').optional().isFloat(),
  body('antennasPosition').optional().isArray().isLength({ min: 2, max: 2 }),
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { headPose, bodyYaw, antennasPosition } = req.body;
  const startTime = Date.now();

  try {
    const moveResult = await daemonClient.setMovementTarget({
      headPose,
      bodyYaw,
      antennasPosition,
    });
    const duration = Date.now() - startTime;
    recordRobotCommand('move_target', req.auth.deviceId, true, duration);

    res.json(moveResult);
  } catch (error) {
    const duration = Date.now() - startTime;
    recordRobotCommand('move_target', req.auth.deviceId, false, duration);
    throw error;
  }
}));

/**
 * Play expression or emotion
 */
router.post('/move/expression', [
  body('dataset').notEmpty().withMessage('Dataset is required'),
  body('expression').notEmpty().withMessage('Expression is required'),
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { dataset, expression } = req.body;
  const startTime = Date.now();

  try {
    const expressionResult = await daemonClient.playExpression({ dataset, expression });
    const duration = Date.now() - startTime;
    recordRobotCommand('expression', req.auth.deviceId, true, duration);

    res.json(expressionResult);
  } catch (error) {
    const duration = Date.now() - startTime;
    recordRobotCommand('expression', req.auth.deviceId, false, duration);
    throw error;
  }
}));

/**
 * Execute choreography or dance
 */
router.post('/move/choreography', [
  body('dataset').notEmpty().withMessage('Dataset is required'),
  body('choreography').notEmpty().withMessage('Choreography is required'),
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { dataset, choreography } = req.body;
  const startTime = Date.now();

  try {
    const choreographyResult = await daemonClient.executeChoreography({ dataset, choreography });
    const duration = Date.now() - startTime;
    recordRobotCommand('choreography', req.auth.deviceId, true, duration);

    res.json(choreographyResult);
  } catch (error) {
    const duration = Date.now() - startTime;
    recordRobotCommand('choreography', req.auth.deviceId, false, duration);
    throw error;
  }
}));

/**
 * Execute wake up sequence
 */
router.post('/move/wake', asyncHandler(async (req, res) => {
  const startTime = Date.now();

  try {
    const wakeResult = await daemonClient.executeWakeSequence();
    const duration = Date.now() - startTime;
    recordRobotCommand('wake', req.auth.deviceId, true, duration);

    res.json(wakeResult);
  } catch (error) {
    const duration = Date.now() - startTime;
    recordRobotCommand('wake', req.auth.deviceId, false, duration);
    throw error;
  }
}));

/**
 * Execute sleep sequence
 */
router.post('/move/sleep', asyncHandler(async (req, res) => {
  const startTime = Date.now();

  try {
    const sleepResult = await daemonClient.executeSleepSequence();
    const duration = Date.now() - startTime;
    recordRobotCommand('sleep', req.auth.deviceId, true, duration);

    res.json(sleepResult);
  } catch (error) {
    const duration = Date.now() - startTime;
    recordRobotCommand('sleep', req.auth.deviceId, false, duration);
    throw error;
  }
}));

/**
 * Stop all robot movement
 */
router.post('/move/stop', asyncHandler(async (req, res) => {
  const startTime = Date.now();

  try {
    const stopResult = await daemonClient.stopMovement();
    const duration = Date.now() - startTime;
    recordRobotCommand('stop', req.auth.deviceId, true, duration);

    res.json(stopResult);
  } catch (error) {
    const duration = Date.now() - startTime;
    recordRobotCommand('stop', req.auth.deviceId, false, duration);
    throw error;
  }
}));

/**
 * Get list of active moves
 */
router.get('/move/active', asyncHandler(async (req, res) => {
  const activeMoves = await daemonClient.getActiveMoves();
  res.json(activeMoves);
}));

module.exports = router;