const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { handleValidationErrors, asyncHandler } = require('../middleware/errorHandlers');
const { recordAppOperation } = require('../middleware/metrics');
const { ApiError } = require('../utils/errors');

const router = express.Router();

/**
 * Get available applications from store
 */
router.get('/available', [
  query('category').optional().isString(),
  query('search').optional().isString(),
  query('official').optional().isBoolean(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { category, search, official, limit = 20, offset = 0 } = req.query;

  // TODO: Implement Hugging Face app store API integration
  res.json({
    applications: [
      {
        id: 'sample-app-1',
        name: 'Sample Robot App',
        description: 'A sample application for demonstration',
        author: 'Reachy Team',
        version: '1.0.0',
        category: 'demo',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        installStatus: 'not_installed',
        isRunning: false,
        lastUpdated: Date.now(),
      }
    ],
    total: 1,
    hasMore: false,
  });
}));

/**
 * Get installed applications
 */
router.get('/installed', asyncHandler(async (req, res) => {
  // TODO: Implement installed apps retrieval
  res.json([
    {
      id: 'installed-app-1',
      name: 'Demo App',
      description: 'Installed demo application',
      author: 'Reachy Team',
      version: '1.0.0',
      category: 'demo',
      installStatus: 'installed',
      isRunning: false,
      lastUpdated: Date.now(),
    }
  ]);
}));

/**
 * Get currently running application
 */
router.get('/current', asyncHandler(async (req, res) => {
  // TODO: Implement current app retrieval
  res.status(404).json({
    error: {
      code: 'NO_RUNNING_APP',
      message: 'No application currently running',
    }
  });
}));

/**
 * Install application (async operation)
 */
router.post('/install', [
  body('appId').notEmpty().withMessage('App ID is required'),
  body('source').optional().isString(),
  body('version').optional().isString(),
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { appId, source = 'huggingface.co', version = 'latest' } = req.body;
  const startTime = Date.now();

  try {
    // TODO: Implement app installation
    const jobId = `install_${appId}_${Date.now()}`;

    recordAppOperation('install', appId, true);

    res.status(202).json({
      id: jobId,
      type: 'install',
      status: 'pending',
      appId,
      progress: 0,
      message: 'Installation job created',
      startTime: Date.now(),
      endTime: null,
      logs: ['Installation job created'],
    });
  } catch (error) {
    recordAppOperation('install', appId, false);
    throw error;
  }
}));

/**
 * Uninstall application
 */
router.delete('/:appId', [
  param('appId').notEmpty().withMessage('App ID is required'),
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const startTime = Date.now();

  try {
    // TODO: Implement app uninstallation
    const jobId = `uninstall_${appId}_${Date.now()}`;

    recordAppOperation('uninstall', appId, true);

    res.status(202).json({
      id: jobId,
      type: 'uninstall',
      status: 'pending',
      appId,
      progress: 0,
      message: 'Uninstall job created',
      startTime: Date.now(),
      endTime: null,
      logs: ['Uninstall job created'],
    });
  } catch (error) {
    recordAppOperation('uninstall', appId, false);
    throw error;
  }
}));

/**
 * Start application
 */
router.post('/:appId/start', [
  param('appId').notEmpty().withMessage('App ID is required'),
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { appId } = req.params;

  try {
    // TODO: Implement app start
    recordAppOperation('start', appId, true);

    res.json({
      message: 'Application started successfully',
      appId,
      startedAt: Date.now(),
    });
  } catch (error) {
    recordAppOperation('start', appId, false);
    throw error;
  }
}));

/**
 * Stop application
 */
router.post('/:appId/stop', [
  param('appId').notEmpty().withMessage('App ID is required'),
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { appId } = req.params;

  try {
    // TODO: Implement app stop
    recordAppOperation('stop', appId, true);

    res.json({
      message: 'Application stopped successfully',
      appId,
      stoppedAt: Date.now(),
    });
  } catch (error) {
    recordAppOperation('stop', appId, false);
    throw error;
  }
}));

/**
 * Get installation job status
 */
router.get('/jobs', [
  query('jobId').optional().isString(),
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { jobId } = req.query;

  // TODO: Implement job status retrieval
  res.json([
    {
      id: jobId || 'sample_job_123',
      type: 'install',
      status: 'completed',
      appId: 'sample-app',
      progress: 1,
      message: 'Installation completed successfully',
      startTime: Date.now() - 30000,
      endTime: Date.now() - 5000,
      logs: [
        'Installation job created',
        'Downloading application...',
        'Installing dependencies...',
        'Installation completed successfully'
      ],
    }
  ]);
}));

module.exports = router;