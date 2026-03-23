const express = require('express');
const { asyncHandler } = require('../middleware/errorHandlers');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json({
    theme: 'dark',
    telemetryEnabled: false,
    streamingQuality: 'auto',
    adaptiveStreaming: true,
    backgroundUpdates: true,
    notifications: {
      robotStatus: true,
      appUpdates: true,
      systemAlerts: true,
    },
  });
}));

router.patch('/', asyncHandler(async (req, res) => {
  res.json({
    message: 'Settings updated successfully',
    ...req.body,
  });
}));

module.exports = router;