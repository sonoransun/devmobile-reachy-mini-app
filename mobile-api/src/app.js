const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
require('dotenv').config();

// Import custom middleware and utilities
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandlers');
const { requestLogger } = require('./middleware/requestLogger');
const { metricsMiddleware, metricsEndpoint } = require('./middleware/metrics');
const { authenticate } = require('./middleware/auth');
const { validateRequest } = require('./middleware/validation');
const { circuitBreakerMiddleware } = require('./middleware/circuitBreaker');

// Import route handlers
const authRoutes = require('./routes/auth');
const robotRoutes = require('./routes/robot');
const appsRoutes = require('./routes/apps');
const systemRoutes = require('./routes/system');
const audioVideoRoutes = require('./routes/audioVideo');
const networkRoutes = require('./routes/network');
const settingsRoutes = require('./routes/settings');
const batchRoutes = require('./routes/batch');
const healthRoutes = require('./routes/health');
const vpnRoutes = require('./routes/vpn');

// Import WebSocket manager
const { initializeWebSocket } = require('./websocket/manager');

const app = express();
const PORT = process.env.API_PORT || 3001;

// ============================================================================
// SECURITY & BASIC MIDDLEWARE
// ============================================================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow WebRTC
  crossOriginOpenerPolicy: false,   // Allow cross-origin WebRTC
}));

// CORS configuration for mobile apps and PWAs
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3000', // React Native dev
      'http://localhost:19006', // Expo dev
      'capacitor://localhost', // Capacitor apps
      'ionic://localhost',     // Ionic apps
      'https://your-pwa-domain.com', // PWA domain
      // Add your specific mobile app origins here
    ];

    // Allow all origins in development
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    // Check allowed origins in production
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow mobile app deep link origins
    if (origin && (origin.startsWith('capacitor://') || origin.startsWith('ionic://'))) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Device-ID',
    'X-App-Version',
    'X-Platform',
    'X-Request-ID',
  ],
}));

// Enable trust proxy for accurate client IPs behind load balancers/proxies
app.set('trust proxy', 1);

// Request parsing
app.use(express.json({ limit: '10mb' })); // Allow larger payloads for diagnostic exports
app.use(express.urlencoded({ extended: true }));

// Response compression (gzip)
app.use(compression({
  filter: (req, res) => {
    // Don't compress already compressed content or WebSocket upgrades
    if (req.headers['x-no-compression'] || req.path.startsWith('/ws/')) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024, // Only compress responses > 1KB
}));

// ============================================================================
// RATE LIMITING
// ============================================================================

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,  // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/health' || req.path === '/metrics',
});

// Authentication rate limiting (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login attempts per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Robot control rate limiting (per device)
const robotControlLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // Limit each device to 120 robot commands per minute (2 per second)
  keyGenerator: (req) => {
    // Rate limit per device ID instead of IP
    return req.headers['x-device-id'] || req.ip;
  },
  message: {
    error: 'Too many robot control commands, please slow down.',
    retryAfter: '1 minute'
  },
});

app.use(globalLimiter);

// ============================================================================
// MONITORING & LOGGING
// ============================================================================

// Request correlation ID
app.use((req, res, next) => {
  req.correlationId = req.headers['x-request-id'] || require('uuid').v4();
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
});

// Request logging
app.use(requestLogger);

// Prometheus metrics
app.use(metricsMiddleware);
app.get('/metrics', metricsEndpoint);

// ============================================================================
// API DOCUMENTATION
// ============================================================================

// Serve OpenAPI documentation
const swaggerDocument = YAML.load(path.join(__dirname, '../docs/openapi.yaml'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Reachy Mini Mobile API Documentation',
}));

// Serve OpenAPI spec as JSON
app.get('/docs/openapi.json', (req, res) => {
  res.json(swaggerDocument);
});

// ============================================================================
// API ROUTES
// ============================================================================

// Health checks (no authentication required)
app.use('/health', healthRoutes);

// API version prefix
const API_BASE = '/api/v1';

// Authentication routes (no auth required)
app.use(`${API_BASE}/auth`, authLimiter, authRoutes);

// All other routes require authentication
app.use(`${API_BASE}`, authenticate);

// Add circuit breaker for external dependencies
app.use(`${API_BASE}`, circuitBreakerMiddleware);

// Route handlers (all require authentication)
app.use(`${API_BASE}/robot`, robotControlLimiter, robotRoutes);
app.use(`${API_BASE}/apps`, appsRoutes);
app.use(`${API_BASE}/system`, systemRoutes);
app.use(`${API_BASE}/audio`, audioVideoRoutes);
app.use(`${API_BASE}/media`, audioVideoRoutes);
app.use(`${API_BASE}/network`, networkRoutes);
app.use(`${API_BASE}/settings`, settingsRoutes);
app.use(`${API_BASE}/batch`, batchRoutes);
app.use(`${API_BASE}/vpn`, vpnRoutes);

// Root endpoint - API information
app.get('/', (req, res) => {
  res.json({
    name: 'Reachy Mini Mobile API',
    version: '1.0.0',
    description: 'Comprehensive REST API for mobile control of Reachy Mini robots',
    documentation: '/docs',
    health: '/health',
    metrics: '/metrics',
    features: [
      'Complete robot control',
      'Application management',
      'Real-time streaming',
      'VPN management & optimization',
      'Cross-platform mobile support',
    ],
    endpoints: {
      authentication: `${API_BASE}/auth`,
      robot: `${API_BASE}/robot`,
      applications: `${API_BASE}/apps`,
      system: `${API_BASE}/system`,
      audio: `${API_BASE}/audio`,
      media: `${API_BASE}/media`,
      network: `${API_BASE}/network`,
      settings: `${API_BASE}/settings`,
      batch: `${API_BASE}/batch`,
      vpn: `${API_BASE}/vpn`,
    }
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// ============================================================================
// SERVER STARTUP
// ============================================================================

// Graceful shutdown handling
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Reachy Mini Mobile API server running on port ${PORT}`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    platform: process.platform,
  });

  logger.info(`📚 API Documentation available at http://localhost:${PORT}/docs`);
  logger.info(`🏥 Health check available at http://localhost:${PORT}/health`);
  logger.info(`📊 Metrics available at http://localhost:${PORT}/metrics`);
});

// Initialize WebSocket server
const { wss } = initializeWebSocket(server);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, starting graceful shutdown');

  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown:', err);
      process.exit(1);
    }

    // Close WebSocket connections
    wss.clients.forEach((ws) => {
      ws.terminate();
    });

    // Close database connections, Redis, etc.
    // TODO: Add cleanup for external dependencies

    logger.info('Graceful shutdown completed');
    process.exit(0);
  });

  // Force close after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, starting graceful shutdown');
  process.emit('SIGTERM');
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;