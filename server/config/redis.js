const { createClient } = require('redis');

let redisClient = null;
let redisConnected = false;
let lastRedisError = null;

/**
 * Creates and connects the Redis client using REDIS_URL from .env.
 * If Redis is unavailable, we log the error clearly and mark redisConnected = false
 * so the rest of the app can fall back to MongoDB where possible instead of crashing.
 */
async function connectRedis() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    lastRedisError = 'REDIS_URL is not set in .env';
    console.warn(`[Redis] ${lastRedisError}. Redis features will be unavailable.`);
    redisConnected = false;
    return null;
  }

  try {
    redisClient = createClient({
      url: redisUrl,
      socket: {
        // Reconnect with a capped backoff so logs stay clean if Redis is offline
        reconnectStrategy: (retries) => {
          if (retries > 5) {
            return false; // Stop retrying after 5 attempts on startup/outage
          }
          return Math.min(retries * 500, 3000);
        },
      },
    });

    // Listen for connection lifecycle events
    redisClient.on('ready', () => {
      redisConnected = true;
      lastRedisError = null;
      console.log('[Redis] Connected and ready');
    });

    redisClient.on('error', (err) => {
      redisConnected = false;
      lastRedisError = err.message;
      console.error(`[Redis] Connection error: ${err.message}`);
    });

    redisClient.on('end', () => {
      redisConnected = false;
      console.warn('[Redis] Connection closed');
    });

    await redisClient.connect();
    redisConnected = true;
    return redisClient;
  } catch (error) {
    redisConnected = false;
    lastRedisError = error.message;
    console.error(`[Redis] Failed to connect: ${error.message}`);
    return null;
  }
}

/**
 * Returns true ONLY when Redis is genuinely connected and ready.
 */
function isRedisReady() {
  return Boolean(redisClient && redisConnected && redisClient.isOpen);
}

/**
 * Returns the active Redis client instance (or null if disconnected).
 */
function getRedisClient() {
  return isRedisReady() ? redisClient : null;
}

/**
 * Returns a human-readable status object for health checks and UI indicators.
 */
function getRedisStatus() {
  return {
    connected: isRedisReady(),
    error: isRedisReady() ? null : lastRedisError || 'Redis is not connected',
  };
}

module.exports = {
  connectRedis,
  isRedisReady,
  getRedisClient,
  getRedisStatus,
};
