const { getRedisClient, isRedisReady } = require('../config/redis');

// Simple in-memory fallback map used ONLY when Redis is offline
const memoryFallbackStore = new Map();

/**
 * Creates an Express middleware for Redis-backed API rate limiting.
 * Prevents excessive requests to expensive AI endpoints (Groq / Hugging Face).
 *
 * @param {Object} options
 * @param {number} options.windowSeconds - Time window in seconds (default: 60s)
 * @param {number} options.maxRequests - Max allowed requests per IP per window (default: 30)
 */
function createRateLimiter({ windowSeconds = 60, maxRequests = 30 } = {}) {
  return async function rateLimiterMiddleware(req, res, next) {
    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `ratelimit:ai:${clientIp}`;

    try {
      if (isRedisReady()) {
        const redis = getRedisClient();
        // Increment request counter for this IP
        const currentCount = await redis.incr(key);

        // Set expiration on the first request in the window
        if (currentCount === 1) {
          await redis.expire(key, windowSeconds);
        }

        const remaining = Math.max(0, maxRequests - currentCount);
        res.setHeader('X-RateLimit-Limit', String(maxRequests));
        res.setHeader('X-RateLimit-Remaining', String(remaining));
        res.setHeader('X-RateLimit-Backend', 'redis');

        if (currentCount > maxRequests) {
          return res.status(429).json({
            error: `Rate limit exceeded. Maximum ${maxRequests} AI requests per ${windowSeconds} seconds. Please wait and try again.`,
          });
        }

        return next();
      }

      // Fallback when Redis is not connected
      const now = Date.now();
      const entry = memoryFallbackStore.get(key);

      if (!entry || now > entry.resetAt) {
        memoryFallbackStore.set(key, {
          count: 1,
          resetAt: now + windowSeconds * 1000,
        });
        res.setHeader('X-RateLimit-Backend', 'memory-fallback');
        return next();
      }

      entry.count += 1;
      res.setHeader('X-RateLimit-Backend', 'memory-fallback');

      if (entry.count > maxRequests) {
        return res.status(429).json({
          error: `Rate limit exceeded. Maximum ${maxRequests} AI requests per ${windowSeconds} seconds. Please wait and try again.`,
        });
      }

      return next();
    } catch (error) {
      console.error(`[RateLimiter] Error checking rate limit: ${error.message}`);
      // Do not block legitimate traffic if rate limiter itself encounters a transient error
      return next();
    }
  };
}

module.exports = {
  createRateLimiter,
};
