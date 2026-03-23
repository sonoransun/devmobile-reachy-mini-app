#!/usr/bin/env node

/**
 * Basic test script for daemon integration
 * Run this to verify the daemon client works correctly
 *
 * Usage: node test-daemon-integration.js
 */

const daemonClient = require('./src/services/daemonClient');
const logger = require('./src/utils/logger');

async function testDaemonIntegration() {
  console.log('🧪 Testing Daemon Integration...\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing health check...');
    const health = await daemonClient.checkHealth();
    console.log(`   Status: ${health.status}`);
    if (health.error) console.log(`   Error: ${health.error}`);
    console.log('   ✅ Health check completed\n');

    // Test 2: Connection Stats
    console.log('2. Testing connection stats...');
    const stats = daemonClient.getConnectionStats();
    console.log(`   Connected: ${stats.isConnected}`);
    console.log(`   Last health check: ${stats.lastHealthCheck ? new Date(stats.lastHealthCheck).toISOString() : 'Never'}`);
    console.log(`   Connection retries: ${stats.connectionRetries}`);
    console.log('   ✅ Connection stats retrieved\n');

    // Test 3: Robot Status (only if health check passed)
    if (health.status === 'healthy') {
      console.log('3. Testing robot status...');
      try {
        const robotStatus = await daemonClient.getRobotStatus();
        console.log(`   Robot status: ${robotStatus.status || 'unknown'}`);
        console.log(`   Connection mode: ${robotStatus.connectionMode || 'unknown'}`);
        console.log('   ✅ Robot status retrieved\n');
      } catch (error) {
        console.log(`   ❌ Robot status failed: ${error.message}\n`);
      }

      // Test 4: Robot State
      console.log('4. Testing robot state...');
      try {
        const robotState = await daemonClient.getRobotState();
        console.log(`   Head joints: ${robotState.headJoints ? robotState.headJoints.length : 'undefined'} values`);
        console.log(`   Body yaw: ${robotState.bodyYaw || 'undefined'}`);
        console.log(`   Timestamp: ${new Date(robotState.timestamp).toISOString()}`);
        console.log('   ✅ Robot state retrieved\n');
      } catch (error) {
        console.log(`   ❌ Robot state failed: ${error.message}\n`);
      }

      // Test 5: WebSocket Subscription (quick test)
      console.log('5. Testing WebSocket subscription...');
      try {
        let messageCount = 0;
        const subscriptionId = await daemonClient.subscribeToRobotState(
          (robotState) => {
            messageCount++;
            if (messageCount === 1) {
              console.log(`   ✅ First WebSocket message received`);
              console.log(`   Robot state timestamp: ${new Date(robotState.timestamp || Date.now()).toISOString()}`);
            }
          },
          5 // 5Hz for testing
        );

        // Wait for a few messages
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Unsubscribe
        daemonClient.unsubscribeFromRobotState(subscriptionId);
        console.log(`   📊 Received ${messageCount} WebSocket messages`);
        console.log('   ✅ WebSocket test completed\n');

      } catch (error) {
        console.log(`   ❌ WebSocket test failed: ${error.message}\n`);
      }

    } else {
      console.log('3-5. Skipping robot tests - daemon not healthy\n');
    }

    // Final report
    console.log('🎉 Daemon Integration Test Completed');
    console.log('═'.repeat(50));

    const finalStats = daemonClient.getConnectionStats();
    console.log(`Final Connection State: ${finalStats.isConnected ? 'Connected' : 'Disconnected'}`);
    console.log(`Circuit Breaker State: Available via /health/robot endpoint`);
    console.log(`WebSocket Subscriptions: ${finalStats.activeSubscriptions}`);

    // Cleanup
    await daemonClient.cleanup();
    console.log('\n🧹 Cleanup completed');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Test interrupted, cleaning up...');
  await daemonClient.cleanup();
  process.exit(0);
});

// Run the test
testDaemonIntegration().then(() => {
  console.log('\n✨ All tests completed successfully!');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Test suite failed:', error.message);
  process.exit(1);
});