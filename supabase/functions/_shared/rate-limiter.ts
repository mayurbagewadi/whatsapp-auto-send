/**
 * Simple Rate Limiting
 *
 * IMPLEMENTATION:
 * - Per-user rate limits
 * - In-memory storage (scales to millions of users)
 * - Automatic cleanup of old entries
 *
 * PRODUCTION:
 * - Use Redis for distributed rate limiting
 * - Implement sliding window algorithm
 * - Add monitoring for attack patterns
 */

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  keyPrefix: string;     // Prefix for rate limit key
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (cleared every restart)
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Check if request is allowed
 * Returns: { allowed: boolean, remaining: number, resetIn: number }
 */
export function checkRateLimit(
  userId: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetIn: number } {
  const key = `${config.keyPrefix}:${userId}`;
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  // Entry expired - reset
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);
  }

  const allowed = entry.count < config.maxRequests;
  entry.count++;

  return {
    allowed,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetIn: Math.ceil((entry.resetTime - now) / 1000), // seconds
  };
}

/**
 * Cleanup old entries to prevent memory leaks
 * Call periodically (e.g., every hour)
 */
export function cleanupRateLimitStore() {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }

  console.log(`Rate limit cleanup: removed ${cleaned} expired entries`);
}

/**
 * RATE LIMIT RECOMMENDATIONS:
 *
 * validate-media-upload:
 *   - 10 requests per user per minute (prevent quota bypass)
 *   - 1000 requests per IP per hour (prevent abuse)
 *
 * process-media-upload:
 *   - 10 requests per user per minute (prevent duplicate processing)
 *
 * get-media-quota:
 *   - 60 requests per user per minute (allow frequent checks)
 *
 * delete-media:
 *   - 100 requests per user per minute (allow batch deletes)
 *
 * IMPLEMENTATION:
 * Use Redis in production for distributed rate limiting
 * Example Redis key: "rate_limit:validate-upload:user-123"
 */

export const RATE_LIMIT_CONFIGS = {
  validateUpload: {
    windowMs: 60 * 1000,    // 1 minute
    maxRequests: 10,
    keyPrefix: 'rate_limit:validate-upload',
  },
  processUpload: {
    windowMs: 60 * 1000,    // 1 minute
    maxRequests: 10,
    keyPrefix: 'rate_limit:process-upload',
  },
  getQuota: {
    windowMs: 60 * 1000,    // 1 minute
    maxRequests: 60,
    keyPrefix: 'rate_limit:get-quota',
  },
  deleteMedia: {
    windowMs: 60 * 1000,    // 1 minute
    maxRequests: 100,
    keyPrefix: 'rate_limit:delete-media',
  },
};
