/**
 * Rate Limiter Middleware
 * Prevents command spam and API abuse
 */

const { createLogger } = require('../utils/logger');

const logger = createLogger('RateLimiter');

class RateLimiter {
  constructor() {
    // user_id -> { command -> { count, resetAt } }
    this.limits = new Map();
    
    // Command-specific limits (requests per window)
    this.commandLimits = {
      'submit-stats': { max: 3, window: 3600000 }, // 3 per hour
      'stats-days': { max: 6, window: 60000 }, // 6 per minute
      'stats-edit': { max: 3, window: 60000 }, // 3 per minute
      'stats-delete': { max: 2, window: 60000 }, // 2 per minute
      'leaderboard': { max: 6, window: 60000 }, // 6 per minute
      'duel': { max: 5, window: 3600000 }, // 5 per hour
      'barbie': { max: 20, window: 3600000 }, // 20 per hour
      'journal': { max: 1, window: 60000 }, // 1 per 60s
      'breakthroughs': { max: 4, window: 60000 }, // 4 per 60s (15s effective)
      'texting-practice': { max: 2, window: 30000 }, // 2 per 30s (1 per 30s effective)
      'texting-send': { max: 6, window: 60000 }, // 6 per 60s
      'texting-finish': { max: 2, window: 30000 }, // 2 per 30s (1 per 30s effective)
      'faction-admin': { max: 10, window: 60000 }, // 10 per minute (admin)
      'wingman-admin': { max: 10, window: 60000 }, // 10 per minute (admin)
      'preflight': { max: 4, window: 60000 }, // 4 per minute (admin)
      'status': { max: 6, window: 60000 }, // 6 per minute (admin)
      'admin': { max: 50, window: 60000 }, // 50 per minute (admin)
      'default': { max: 30, window: 60000 } // 30 per minute (global)
    };

    // Clean up old entries every 10 minutes
    setInterval(() => this.cleanup(), 600000);
  }

  /**
   * Check if user is rate limited for command
   */
  isRateLimited(userId, commandName) {
    const now = Date.now();
    
    if (!this.limits.has(userId)) {
      this.limits.set(userId, new Map());
    }

    const userLimits = this.limits.get(userId);
    const limit = this.commandLimits[commandName] || this.commandLimits.default;

    if (!userLimits.has(commandName)) {
      userLimits.set(commandName, {
        count: 1,
        resetAt: now + limit.window
      });
      return false;
    }

    const cmdLimit = userLimits.get(commandName);

    // Reset window if expired
    if (now > cmdLimit.resetAt) {
      cmdLimit.count = 1;
      cmdLimit.resetAt = now + limit.window;
      return false;
    }

    // Check if over limit
    if (cmdLimit.count >= limit.max) {
      logger.warn('Rate limit exceeded', { userId, commandName, count: cmdLimit.count });
      return true;
    }

    // Increment count
    cmdLimit.count++;
    return false;
  }

  /**
   * Get remaining time for rate limit
   */
  getRemainingTime(userId, commandName) {
    if (!this.limits.has(userId)) return 0;
    
    const userLimits = this.limits.get(userId);
    if (!userLimits.has(commandName)) return 0;

    const cmdLimit = userLimits.get(commandName);
    const remaining = Math.max(0, cmdLimit.resetAt - Date.now());
    
    return Math.ceil(remaining / 1000); // Return seconds
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [userId, userLimits] of this.limits.entries()) {
      for (const [commandName, limit] of userLimits.entries()) {
        if (now > limit.resetAt) {
          userLimits.delete(commandName);
          cleaned++;
        }
      }

      if (userLimits.size === 0) {
        this.limits.delete(userId);
      }
    }

    if (cleaned > 0) {
      logger.debug('Rate limiter cleanup', { entriesRemoved: cleaned });
    }
  }

  /**
   * Reset user's limits (admin override)
   */
  resetUser(userId) {
    this.limits.delete(userId);
    logger.info('User rate limits reset', { userId });
  }
}

module.exports = RateLimiter;

