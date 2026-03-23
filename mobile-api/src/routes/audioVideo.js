const express = require('express');
const { asyncHandler } = require('../middleware/errorHandlers');

const router = express.Router();

router.get('/volume', asyncHandler(async (req, res) => {
  res.json({
    speaker: {
      volume: 50,
      muted: false,
      device: 'Default Speaker',
    },
    microphone: {
      volume: 75,
      muted: false,
      device: 'Default Microphone',
      doa: {
        angle: 0,
        speechDetected: false,
      },
    },
  });
}));

router.post('/volume', asyncHandler(async (req, res) => {
  res.json({ message: 'Volume settings updated' });
}));

router.get('/microphone', asyncHandler(async (req, res) => {
  res.json({
    volume: 75,
    muted: false,
    device: 'Default Microphone',
    doa: {
      angle: 0,
      speechDetected: false,
      confidence: 0.8,
    },
  });
}));

router.get('/webrtc/offer', asyncHandler(async (req, res) => {
  res.json({
    sdp: 'placeholder-sdp-offer',
    type: 'offer',
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302'] }
    ],
  });
}));

router.post('/webrtc/answer', asyncHandler(async (req, res) => {
  res.json({ message: 'WebRTC answer processed' });
}));

module.exports = router;