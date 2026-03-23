const express = require('express');
const { asyncHandler } = require('../middleware/errorHandlers');

const router = express.Router();

router.get('/wifi/status', asyncHandler(async (req, res) => {
  res.json({
    connected: true,
    ssid: 'WiFi Network',
    signalStrength: -45,
    ipAddress: '192.168.1.100',
    mode: 'client',
  });
}));

router.get('/wifi/scan', asyncHandler(async (req, res) => {
  res.json([
    {
      ssid: 'WiFi Network 1',
      signalStrength: -45,
      security: 'wpa2',
      frequency: 2.4,
    },
    {
      ssid: 'WiFi Network 2',
      signalStrength: -67,
      security: 'wpa3',
      frequency: 5.0,
    },
  ]);
}));

router.post('/wifi/connect', asyncHandler(async (req, res) => {
  res.json({ message: 'WiFi connection successful' });
}));

router.post('/wifi/disconnect', asyncHandler(async (req, res) => {
  res.json({ message: 'WiFi disconnected successfully' });
}));

module.exports = router;