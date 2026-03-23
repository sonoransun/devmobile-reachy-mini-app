const logger = require('../utils/logger');
const { updateCircuitBreakerState, recordCircuitBreakerFailure } = require('./metrics');
const { NetworkError } = require('../utils/errors');

/**
 * Circuit Breaker implementation for external service resilience
 * Prevents cascading failures when external services are down
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitorTimeout = options.monitorTimeout || 5000; // 5 seconds

    this.state = 'closed'; // closed, open, half-open
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = 0;
    this.serviceName = options.serviceName || 'unknown';

    // Update initial metrics
    updateCircuitBreakerState(this.serviceName, this.state);
  }

  /**
   * Execute a function through the circuit breaker
   * @param {Function} fn - Function to execute
   * @returns {Promise} Result of function execution
   */
  async execute(fn) {
    if (this.state === 'open') {
      if (Date.now() < this.nextAttempt) {
        throw new NetworkError(this.serviceName,
          new Error('Circuit breaker is open - service unavailable'));
      }
      // Try to transition to half-open
      this.state = 'half-open';
      updateCircuitBreakerState(this.serviceName, this.state);
      logger.circuitBreakerEvent(this.serviceName, 'half-open', {
        message: 'Attempting to recover from open state'
      });
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  onSuccess() {
    this.failureCount = 0;

    if (this.state === 'half-open') {
      this.successCount++;
      // After successful execution in half-open, transition back to closed
      this.state = 'closed';
      this.successCount = 0;
      updateCircuitBreakerState(this.serviceName, this.state);
      logger.circuitBreakerEvent(this.serviceName, 'closed', {
        message: 'Circuit breaker recovered - service is healthy'
      });
    }
  }

  /**
   * Handle failed execution
   */
  onFailure() {
    this.failureCount++;
    recordCircuitBreakerFailure(this.serviceName);

    if (this.state === 'half-open' || this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      this.nextAttempt = Date.now() + this.resetTimeout;
      updateCircuitBreakerState(this.serviceName, this.state);

      logger.circuitBreakerEvent(this.serviceName, 'open', {
        message: 'Circuit breaker opened - service failures detected',
        failureCount: this.failureCount,
        nextAttempt: new Date(this.nextAttempt).toISOString()
      });
    }
  }

  /**
   * Get current circuit breaker stats
   */
  getStats() {
    return {
      serviceName: this.serviceName,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt,
      failureThreshold: this.failureThreshold,
      resetTimeout: this.resetTimeout
    };
  }

  /**
   * Manually reset circuit breaker
   */
  reset() {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = 0;
    updateCircuitBreakerState(this.serviceName, this.state);

    logger.circuitBreakerEvent(this.serviceName, 'reset', {
      message: 'Circuit breaker manually reset'
    });
  }
}

// Create circuit breakers for different services
const circuitBreakers = {
  robotDaemon: new CircuitBreaker({
    serviceName: 'robot_daemon',
    failureThreshold: 3, // Stricter for robot daemon
    resetTimeout: 30000, // 30 seconds
  }),

  huggingFace: new CircuitBreaker({
    serviceName: 'hugging_face',
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
  }),

  externalApi: new CircuitBreaker({
    serviceName: 'external_api',
    failureThreshold: 5,
    resetTimeout: 60000,
  }),
};

/**
 * Circuit breaker middleware for Express routes
 * Automatically applies circuit breaker to external service calls
 */
const circuitBreakerMiddleware = (req, res, next) => {
  // Add circuit breaker utilities to request object
  req.circuitBreakers = circuitBreakers;

  req.executeWithCircuitBreaker = async (serviceName, fn) => {
    const breaker = circuitBreakers[serviceName];
    if (!breaker) {
      throw new Error(`Unknown service: ${serviceName}`);
    }

    return breaker.execute(fn);
  };

  next();
};

/**
 * Robot daemon circuit breaker wrapper
 * Convenience function for robot daemon calls
 */
const executeRobotDaemonCall = async (fn) => {
  return circuitBreakers.robotDaemon.execute(fn);
};

/**
 * Hugging Face API circuit breaker wrapper
 * Convenience function for HF API calls
 */
const executeHuggingFaceCall = async (fn) => {
  return circuitBreakers.huggingFace.execute(fn);
};

/**
 * Generic external API circuit breaker wrapper
 */
const executeExternalApiCall = async (fn) => {
  return circuitBreakers.externalApi.execute(fn);
};

/**
 * Get all circuit breaker stats for health checks
 */
const getAllCircuitBreakerStats = () => {
  const stats = {};
  for (const [name, breaker] of Object.entries(circuitBreakers)) {
    stats[name] = breaker.getStats();
  }
  return stats;
};

/**
 * Health check for circuit breakers
 * Returns true if all circuit breakers are closed or half-open
 */
const areCircuitBreakersHealthy = () => {
  return Object.values(circuitBreakers).every(breaker =>
    breaker.state === 'closed' || breaker.state === 'half-open'
  );
};

/**
 * Reset all circuit breakers
 * Useful for manual recovery or testing
 */
const resetAllCircuitBreakers = () => {
  Object.values(circuitBreakers).forEach(breaker => breaker.reset());
  logger.systemEvent('all_circuit_breakers_reset');
};

/**
 * Advanced circuit breaker with adaptive thresholds
 * Adjusts failure thresholds based on recent performance
 */
class AdaptiveCircuitBreaker extends CircuitBreaker {
  constructor(options = {}) {
    super(options);
    this.baseFailureThreshold = this.failureThreshold;
    this.adaptiveWindow = options.adaptiveWindow || 300000; // 5 minutes
    this.performanceHistory = [];
  }

  /**
   * Adjust failure threshold based on recent performance
   */
  adjustThreshold() {
    const now = Date.now();
    // Remove old entries
    this.performanceHistory = this.performanceHistory.filter(
      entry => now - entry.timestamp < this.adaptiveWindow
    );

    const recentFailureRate = this.performanceHistory.length > 0
      ? this.performanceHistory.filter(entry => !entry.success).length / this.performanceHistory.length
      : 0;

    // Increase threshold if failure rate is high (be more tolerant)
    if (recentFailureRate > 0.5) {
      this.failureThreshold = Math.min(this.baseFailureThreshold * 2, 10);
    } else if (recentFailureRate < 0.1) {
      this.failureThreshold = this.baseFailureThreshold;
    }

    logger.debug('Circuit breaker threshold adjusted', {
      service: this.serviceName,
      recentFailureRate: recentFailureRate.toFixed(2),
      newThreshold: this.failureThreshold,
      historyLength: this.performanceHistory.length,
    });
  }

  onSuccess() {
    super.onSuccess();
    this.performanceHistory.push({ timestamp: Date.now(), success: true });
    this.adjustThreshold();
  }

  onFailure() {
    super.onFailure();
    this.performanceHistory.push({ timestamp: Date.now(), success: false });
    this.adjustThreshold();
  }
}

/**
 * VPN-aware circuit breaker
 * Adjusts behavior based on network conditions
 */
class VpnAwareCircuitBreaker extends CircuitBreaker {
  constructor(options = {}) {
    super(options);
    this.vpnMode = false;
    this.baseResetTimeout = this.resetTimeout;
  }

  /**
   * Enable VPN mode with different thresholds
   */
  enableVpnMode() {
    this.vpnMode = true;
    this.failureThreshold *= 2; // Be more tolerant on VPN
    this.resetTimeout = this.baseResetTimeout * 1.5; // Longer recovery time

    logger.networkEvent('vpn_mode_enabled', {
      service: this.serviceName,
      newFailureThreshold: this.failureThreshold,
      newResetTimeout: this.resetTimeout,
    });
  }

  /**
   * Disable VPN mode
   */
  disableVpnMode() {
    this.vpnMode = false;
    this.failureThreshold = this.baseFailureThreshold;
    this.resetTimeout = this.baseResetTimeout;

    logger.networkEvent('vpn_mode_disabled', {
      service: this.serviceName,
    });
  }
}

module.exports = {
  CircuitBreaker,
  AdaptiveCircuitBreaker,
  VpnAwareCircuitBreaker,
  circuitBreakerMiddleware,
  executeRobotDaemonCall,
  executeHuggingFaceCall,
  executeExternalApiCall,
  getAllCircuitBreakerStats,
  areCircuitBreakersHealthy,
  resetAllCircuitBreakers,
  circuitBreakers,
};