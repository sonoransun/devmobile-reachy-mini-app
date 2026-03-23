const express = require('express');
const logger = require('../utils/logger');
const { getAllCircuitBreakerStats, areCircuitBreakersHealthy } = require('../middleware/circuitBreaker');
const { getCurrentMetrics } = require('../middleware/metrics');
const daemonClient = require('../services/daemonClient');

const router = express.Router();

/**
 * Basic health check endpoint
 * Returns 200 if API is running
 */
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

/**
 * Detailed health check endpoint
 * Returns comprehensive health status of all components
 */
router.get('/detailed', async (req, res) => {
  const startTime = Date.now();

  try {
    const healthChecks = {
      api: await checkApiHealth(),
      database: await checkDatabaseHealth(),
      redis: await checkRedisHealth(),
      robotDaemon: await checkRobotDaemonHealth(),
      circuitBreakers: checkCircuitBreakerHealth(),
      memory: checkMemoryHealth(),
      system: checkSystemHealth(),
    };

    const allHealthy = Object.values(healthChecks).every(
      check => check.status === 'healthy'
    );

    const overallStatus = allHealthy ? 'healthy' :
                         Object.values(healthChecks).some(check => check.status === 'unhealthy') ?
                         'unhealthy' : 'degraded';

    const responseTime = Date.now() - startTime;

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      components: healthChecks,
    };

    const statusCode = overallStatus === 'healthy' ? 200 :
                      overallStatus === 'degraded' ? 200 : 503;

    res.status(statusCode).json(response);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check system failure',
    });
  }
});

/**
 * Robot-specific health check
 * Checks connectivity to robot daemon
 */
router.get('/robot', async (req, res) => {
  try {
    const robotHealth = await checkRobotDaemonHealth();
    const statusCode = robotHealth.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      ...robotHealth,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Robot health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      connected: false,
      error: 'Robot health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Readiness probe endpoint
 * Used by Kubernetes/container orchestration
 */
router.get('/ready', async (req, res) => {
  try {
    // Check if essential services are ready
    const essentialChecks = await Promise.all([
      checkApiHealth(),
      checkCircuitBreakerHealth(),
    ]);

    const isReady = essentialChecks.every(check =>
      check.status === 'healthy' || check.status === 'degraded'
    );

    if (isReady) {
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        checks: essentialChecks,
      });
    }
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not_ready',
      error: 'Readiness check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Liveness probe endpoint
 * Used by Kubernetes/container orchestration
 */
router.get('/live', (req, res) => {
  // Simple liveness check - if we can respond, we're alive
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ============================================================================
// HEALTH CHECK FUNCTIONS
// ============================================================================

/**
 * Check API health
 */
async function checkApiHealth() {
  try {
    // Basic API functionality check
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      status: 'healthy',
      details: {
        memory: {
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        uptime: process.uptime(),
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
    };
  }
}

/**
 * Check database health (placeholder)
 */
async function checkDatabaseHealth() {
  try {
    // TODO: Implement actual database connection check
    // For now, return healthy if DATABASE_URL is configured
    if (process.env.DATABASE_URL) {
      return {
        status: 'healthy',
        details: {
          type: 'postgresql',
          configured: true,
        },
      };
    } else {
      return {
        status: 'degraded',
        details: {
          type: 'postgresql',
          configured: false,
          message: 'Database not configured, using in-memory storage',
        },
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
    };
  }
}

/**
 * Check Redis health (placeholder)
 */
async function checkRedisHealth() {
  try {
    // TODO: Implement actual Redis connection check
    // For now, return healthy if REDIS_URL is configured
    if (process.env.REDIS_URL) {
      return {
        status: 'healthy',
        details: {
          configured: true,
        },
      };
    } else {
      return {
        status: 'degraded',
        details: {
          configured: false,
          message: 'Redis not configured, using in-memory caching',
        },
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
    };
  }
}

/**
 * Check robot daemon health
 */
async function checkRobotDaemonHealth() {
  try {
    const startTime = Date.now();
    const healthResult = await daemonClient.checkHealth();
    const latency = Date.now() - startTime;

    if (healthResult.status === 'healthy') {
      return {
        status: 'healthy',
        connected: true,
        latency: `${latency}ms`,
        lastSeen: new Date().toISOString(),
        details: {
          ...healthResult.daemon,
          connectionStats: daemonClient.getConnectionStats(),
        },
      };
    } else {
      return {
        status: 'unhealthy',
        connected: false,
        error: healthResult.error,
        details: {
          connectionStats: daemonClient.getConnectionStats(),
        },
      };
    }
  } catch (error) {
    let status = 'unhealthy';
    let details = { connected: false };

    if (error.code === 'ECONNREFUSED') {
      details.error = 'Robot daemon not running or not accessible';
    } else if (error.code === 'ETIMEDOUT') {
      details.error = 'Robot daemon connection timeout';
    } else {
      details.error = error.message;
    }

    details.connectionStats = daemonClient.getConnectionStats();

    return { status, ...details };
  }
}

/**
 * Check circuit breaker health
 */
function checkCircuitBreakerHealth() {
  try {
    const stats = getAllCircuitBreakerStats();
    const allHealthy = areCircuitBreakersHealthy();

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      details: stats,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
    };
  }
}

/**
 * Check memory health
 */
function checkMemoryHealth() {
  try {
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.rss + memoryUsage.external;
    const memoryLimitMB = 512; // Adjust based on container limits

    const status = totalMemory < (memoryLimitMB * 1024 * 1024 * 0.9) ? 'healthy' : 'degraded';

    return {
      status,
      details: {
        rss: memoryUsage.rss,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        total: totalMemory,
        limit: memoryLimitMB * 1024 * 1024,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
    };
  }
}

/**
 * Check system health
 */
function checkSystemHealth() {
  try {
    const loadAvg = require('os').loadavg();
    const cpuCount = require('os').cpus().length;
    const freeMemory = require('os').freemem();
    const totalMemory = require('os').totalmem();

    // Simple load average check
    const highLoad = loadAvg[0] > cpuCount * 0.8;
    const lowMemory = freeMemory < totalMemory * 0.1;

    const status = (highLoad || lowMemory) ? 'degraded' : 'healthy';

    return {
      status,
      details: {
        loadAverage: loadAvg,
        cpuCount,
        memoryUsage: {
          free: freeMemory,
          total: totalMemory,
          used: totalMemory - freeMemory,
          percentage: ((totalMemory - freeMemory) / totalMemory * 100).toFixed(2),
        },
        platform: require('os').platform(),
        arch: require('os').arch(),
        nodeVersion: process.version,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
    };
  }
}

module.exports = router;