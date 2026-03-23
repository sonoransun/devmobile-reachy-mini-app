const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { handleValidationErrors, asyncHandler } = require('../middleware/errorHandlers');
const { requirePermissions } = require('../middleware/auth');
const { ApiError } = require('../utils/errors');
const VpnManager = require('../services/vpnManager');
const { broadcast } = require('../websocket/manager');

const router = express.Router();
const vpnManager = new VpnManager();

// Require admin permissions for VPN management
router.use(requirePermissions('admin'));

/**
 * Get all VPN profiles
 */
router.get('/profiles', asyncHandler(async (req, res) => {
  const profiles = await vpnManager.getProfiles();
  res.json({
    profiles: profiles.map(profile => ({
      id: profile.id,
      name: profile.name,
      type: profile.type,
      provider: profile.provider,
      status: profile.status,
      autoConnect: profile.autoConnect,
      createdAt: profile.createdAt,
      lastConnected: profile.lastConnected,
      // Don't expose credentials in response
    })),
  });
}));

/**
 * Get specific VPN profile
 */
router.get('/profiles/:id', [
  param('id').isUUID().withMessage('Invalid profile ID'),
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const profile = await vpnManager.getProfile(id);

  if (!profile) {
    throw new ApiError(404, 'VPN_PROFILE_NOT_FOUND', 'VPN profile not found');
  }

  res.json({
    ...profile,
    credentials: undefined, // Never expose credentials
  });
}));

/**
 * Create new VPN profile
 */
router.post('/profiles', [
  body('name').notEmpty().withMessage('Profile name is required'),
  body('type').isIn(['openvpn', 'wireguard', 'ipsec', 'commercial']).withMessage('Invalid VPN type'),
  body('provider').optional().isString(),
  body('config').notEmpty().withMessage('VPN configuration is required'),
  body('credentials').optional().isObject(),
  body('autoConnect').optional().isBoolean(),
  body('description').optional().isString(),
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { name, type, provider, config, credentials, autoConnect = false, description } = req.body;

  const profile = await vpnManager.createProfile({
    name,
    type,
    provider,
    config,
    credentials,
    autoConnect,
    description,
    createdBy: req.auth.deviceId,
  });

  logger.info('VPN profile created', {
    profileId: profile.id,
    name,
    type,
    provider,
    deviceId: req.auth.deviceId,
    correlationId: req.correlationId,
  });

  res.status(201).json({
    id: profile.id,
    name: profile.name,
    type: profile.type,
    provider: profile.provider,
    status: profile.status,
    createdAt: profile.createdAt,
  });
}));

/**
 * Update VPN profile
 */
router.patch('/profiles/:id', [
  param('id').isUUID().withMessage('Invalid profile ID'),
  body('name').optional().notEmpty(),
  body('config').optional().isObject(),
  body('credentials').optional().isObject(),
  body('autoConnect').optional().isBoolean(),
  body('description').optional().isString(),
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const profile = await vpnManager.updateProfile(id, updates);

  logger.info('VPN profile updated', {
    profileId: id,
    updates: Object.keys(updates),
    deviceId: req.auth.deviceId,
    correlationId: req.correlationId,
  });

  res.json({
    id: profile.id,
    name: profile.name,
    type: profile.type,
    provider: profile.provider,
    status: profile.status,
    updatedAt: profile.updatedAt,
  });
}));

/**
 * Delete VPN profile
 */
router.delete('/profiles/:id', [
  param('id').isUUID().withMessage('Invalid profile ID'),
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Ensure VPN is disconnected before deletion
  await vpnManager.disconnect(id);
  await vpnManager.deleteProfile(id);

  logger.info('VPN profile deleted', {
    profileId: id,
    deviceId: req.auth.deviceId,
    correlationId: req.correlationId,
  });

  res.json({
    message: 'VPN profile deleted successfully',
    profileId: id,
  });
}));

/**
 * Connect to VPN
 */
router.post('/profiles/:id/connect', [
  param('id').isUUID().withMessage('Invalid profile ID'),
  body('timeout').optional().isInt({ min: 10, max: 300 }),
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { timeout = 60 } = req.body;

  const result = await vpnManager.connect(id, { timeout });

  logger.info('VPN connection initiated', {
    profileId: id,
    success: result.success,
    deviceId: req.auth.deviceId,
    correlationId: req.correlationId,
  });

  // Broadcast VPN status change
  broadcast({
    type: 'vpn_status_changed',
    profileId: id,
    status: result.success ? 'connecting' : 'disconnected',
    timestamp: Date.now(),
  });

  res.json({
    success: result.success,
    message: result.message,
    profileId: id,
    connectionId: result.connectionId,
    estimatedTime: result.estimatedTime,
  });
}));

/**
 * Disconnect from VPN
 */
router.post('/profiles/:id/disconnect', [
  param('id').isUUID().withMessage('Invalid profile ID'),
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await vpnManager.disconnect(id);

  logger.info('VPN disconnection initiated', {
    profileId: id,
    success: result.success,
    deviceId: req.auth.deviceId,
    correlationId: req.correlationId,
  });

  // Broadcast VPN status change
  broadcast({
    type: 'vpn_status_changed',
    profileId: id,
    status: 'disconnected',
    timestamp: Date.now(),
  });

  res.json({
    success: result.success,
    message: result.message,
    profileId: id,
  });
}));

/**
 * Get VPN connection status
 */
router.get('/profiles/:id/status', [
  param('id').isUUID().withMessage('Invalid profile ID'),
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const status = await vpnManager.getConnectionStatus(id);

  res.json({
    profileId: id,
    status: status.status,
    connected: status.connected,
    connectedAt: status.connectedAt,
    duration: status.duration,
    publicIp: status.publicIp,
    localIp: status.localIp,
    bytesReceived: status.bytesReceived,
    bytesSent: status.bytesSent,
    latency: status.latency,
    lastCheck: status.lastCheck,
  });
}));

/**
 * Get connection logs
 */
router.get('/profiles/:id/logs', [
  param('id').isUUID().withMessage('Invalid profile ID'),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  query('since').optional().isISO8601(),
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 100, since } = req.query;

  const logs = await vpnManager.getConnectionLogs(id, { limit, since });

  res.json({
    profileId: id,
    logs,
    count: logs.length,
  });
}));

/**
 * Test VPN configuration
 */
router.post('/profiles/:id/test', [
  param('id').isUUID().withMessage('Invalid profile ID'),
  body('timeout').optional().isInt({ min: 5, max: 60 }),
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { timeout = 30 } = req.body;

  const result = await vpnManager.testConnection(id, { timeout });

  logger.info('VPN connection test', {
    profileId: id,
    success: result.success,
    latency: result.latency,
    deviceId: req.auth.deviceId,
    correlationId: req.correlationId,
  });

  res.json({
    success: result.success,
    message: result.message,
    latency: result.latency,
    publicIp: result.publicIp,
    location: result.location,
    testResults: result.details,
  });
}));

/**
 * Get supported VPN providers
 */
router.get('/providers', asyncHandler(async (req, res) => {
  const providers = await vpnManager.getSupportedProviders();

  res.json({
    providers: providers.map(provider => ({
      id: provider.id,
      name: provider.name,
      type: provider.type,
      description: provider.description,
      configTemplate: provider.configTemplate,
      credentialsSchema: provider.credentialsSchema,
      features: provider.features,
    })),
  });
}));

/**
 * Get VPN provider locations/servers
 */
router.get('/providers/:providerId/locations', [
  param('providerId').notEmpty().withMessage('Provider ID is required'),
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { providerId } = req.params;

  const locations = await vpnManager.getProviderLocations(providerId);

  res.json({
    providerId,
    locations,
  });
}));

/**
 * Import VPN configuration file
 */
router.post('/import', [
  body('type').isIn(['openvpn', 'wireguard']).withMessage('Unsupported import type'),
  body('name').notEmpty().withMessage('Profile name is required'),
  body('configContent').notEmpty().withMessage('Configuration content is required'),
  body('credentials').optional().isObject(),
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { type, name, configContent, credentials } = req.body;

  const profile = await vpnManager.importConfig({
    type,
    name,
    configContent,
    credentials,
    createdBy: req.auth.deviceId,
  });

  logger.info('VPN configuration imported', {
    profileId: profile.id,
    type,
    name,
    deviceId: req.auth.deviceId,
    correlationId: req.correlationId,
  });

  res.status(201).json({
    id: profile.id,
    name: profile.name,
    type: profile.type,
    status: profile.status,
    imported: true,
  });
}));

/**
 * Export VPN configuration
 */
router.get('/profiles/:id/export', [
  param('id').isUUID().withMessage('Invalid profile ID'),
  query('format').optional().isIn(['json', 'native']),
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { format = 'native' } = req.query;

  const exportData = await vpnManager.exportConfig(id, format);

  const profile = await vpnManager.getProfile(id);

  if (format === 'json') {
    res.json(exportData);
  } else {
    // Return native config file
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${profile.name}.${profile.type}"`);
    res.send(exportData);
  }

  logger.info('VPN configuration exported', {
    profileId: id,
    format,
    deviceId: req.auth.deviceId,
    correlationId: req.correlationId,
  });
}));

/**
 * Get system VPN capabilities
 */
router.get('/capabilities', asyncHandler(async (req, res) => {
  const capabilities = await vpnManager.getSystemCapabilities();

  res.json({
    supported: capabilities.supported,
    available: capabilities.available,
    installed: capabilities.installed,
    platform: capabilities.platform,
    permissions: capabilities.permissions,
    features: capabilities.features,
  });
}));

/**
 * Get current network status
 */
router.get('/network/status', asyncHandler(async (req, res) => {
  const networkStatus = await vpnManager.getNetworkStatus();

  res.json({
    interfaces: networkStatus.interfaces,
    publicIp: networkStatus.publicIp,
    location: networkStatus.location,
    dns: networkStatus.dns,
    routes: networkStatus.routes,
    vpnActive: networkStatus.vpnActive,
    activeVpnProfile: networkStatus.activeVpnProfile,
  });
}));

/**
 * Reconnect all auto-connect VPN profiles
 */
router.post('/reconnect-all', asyncHandler(async (req, res) => {
  const result = await vpnManager.reconnectAll();

  logger.info('VPN reconnect all initiated', {
    profiles: result.profiles,
    deviceId: req.auth.deviceId,
    correlationId: req.correlationId,
  });

  res.json({
    message: 'Reconnection initiated for all auto-connect profiles',
    profiles: result.profiles,
    started: result.started,
    failed: result.failed,
  });
}));

/**
 * Kill all VPN connections
 */
router.post('/kill-all', asyncHandler(async (req, res) => {
  const result = await vpnManager.killAll();

  logger.info('VPN kill all initiated', {
    killed: result.killed,
    deviceId: req.auth.deviceId,
    correlationId: req.correlationId,
  });

  // Broadcast VPN status change
  broadcast({
    type: 'vpn_all_disconnected',
    killed: result.killed,
    timestamp: Date.now(),
  });

  res.json({
    message: 'All VPN connections terminated',
    killed: result.killed,
  });
}));

module.exports = router;