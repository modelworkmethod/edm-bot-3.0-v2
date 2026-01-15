/**
 * Secondary XP Processor
 * Handles XP from non-stats activities
 */

const { createLogger } = require('../../utils/logger');
const { getSecondaryXP, isOnCooldown } = require('../../config/secondaryXPSources');
const { query, queryRow } = require('../../database/postgres');
const { getLocalDayString } = require('../../utils/timeUtils');

const logger = createLogger('SecondaryXPProcessor');

class SecondaryXPProcessor {
  constructor(xpCalculator, userService) {
    this.xpCalculator = xpCalculator;
    this.userService = userService;
  }

  /**
   * Award XP for secondary activity
   */
  async awardSecondaryXP(userId, category, action, metadata = {}) {
    try {
      const config = getSecondaryXP(category, action);

      if (!config) {
        return { success: false, error: 'Invalid action or disabled category' };
      }

      // Check if one-time only and already claimed
      if (config.oneTime) {
        const claimed = await this.hasClaimedOneTime(userId, category, action);
        if (claimed) {
          return { success: false, error: 'One-time bonus already claimed' };
        }
      }

      // Check cooldown
      if (config.cooldown) {
        const lastUsed = await this.getLastUsedTime(userId, category, action);
        if (isOnCooldown(lastUsed, config.cooldown)) {
          const remaining = Math.ceil(config.cooldown - ((Date.now() - lastUsed) / 1000));
          return { 
            success: false, 
            error: `On cooldown. ${remaining}s remaining` 
          };
        }
      }

      // Check daily limit
      if (config.maxPerDay) {
        const todayCount = await this.getTodayCount(userId, category, action);
        if (todayCount >= config.maxPerDay) {
          return { 
            success: false, 
            error: `Daily limit reached (${config.maxPerDay})` 
          };
        }
      }

      // Calculate XP (apply multipliers)
      let finalXP = config.xp;

      if (finalXP > 0) {
        // Apply user's current multipliers
        const multipliers = await this.xpCalculator.calculateMultipliers(
          userId,
          getLocalDayString(),
          {} // No state bonus for secondary XP
        );

        finalXP = Math.round(finalXP * multipliers.multiplier);
      }

      // Record the action
      await this.recordSecondaryAction(userId, category, action, finalXP, metadata);

      // Award XP if applicable
      if (finalXP > 0) {
        await this.userService.updateUserStats(
          userId,
          finalXP,
          {}, // No affinity changes
          `secondary_xp_${category}_${action}`
        );
      }

      // Handle unlocks (texting simulator multipliers)
      let unlocked = null;
      if (config.unlocks) {
        unlocked = await this.processUnlocks(userId, config.unlocks, metadata);
      }

      logger.info('Secondary XP awarded', {
        userId,
        category,
        action,
        xp: finalXP,
        unlocked
      });

      return {
        success: true,
        xp: finalXP,
        description: config.description,
        unlocked
      };

    } catch (error) {
      logger.error('Failed to award secondary XP', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Process unlocks (multiplier boosts)
   */
  async processUnlocks(userId, unlocks, metadata) {
    const score = metadata.score || 0;
    let unlocked = null;

    // Check perfect score first (highest reward)
    if (unlocks.perfectScore && score >= 95) {
      unlocked = unlocks.perfectScore;
    } else if (unlocks.score80Plus && score >= 80) {
      unlocked = unlocks.score80Plus;
    }

    if (!unlocked) return null;

    // Store active multiplier boost
    const expiresAt = new Date(Date.now() + (unlocked.duration * 1000));

    await query(
      `INSERT INTO active_multiplier_boosts (user_id, multiplier, applies_to, expires_at, source)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, unlocked.multiplier, unlocked.appliesTo, expiresAt, 'texting_practice']
    );

    return unlocked;
  }

  /**
   * Get active multiplier boosts for user
   */
  async getActiveBoosts(userId, statName) {
    const result = await query(
      `SELECT * FROM active_multiplier_boosts 
       WHERE user_id = $1 
       AND expires_at > NOW() 
       AND $2 = ANY(applies_to)
       ORDER BY multiplier DESC`,
      [userId, statName]
    );

    return result.rows;
  }

  /**
   * Record secondary action
   */
  async recordSecondaryAction(userId, category, action, xp, metadata) {
    await query(
      `INSERT INTO secondary_xp_log (user_id, category, action, xp_earned, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, category, action, xp, JSON.stringify(metadata)]
    );
  }

  /**
   * Check if one-time bonus claimed
   */
  async hasClaimedOneTime(userId, category, action) {
    const result = await queryRow(
      `SELECT COUNT(*) as count FROM secondary_xp_log 
       WHERE user_id = $1 AND category = $2 AND action = $3`,
      [userId, category, action]
    );

    return result.count > 0;
  }

  /**
   * Get last used time for action
   */
  async getLastUsedTime(userId, category, action) {
    const result = await queryRow(
      `SELECT created_at FROM secondary_xp_log 
       WHERE user_id = $1 AND category = $2 AND action = $3 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId, category, action]
    );

    return result ? new Date(result.created_at).getTime() : null;
  }

  /**
   * Get today's count for action
   */
  async getTodayCount(userId, category, action) {
    const today = getLocalDayString();

    const result = await queryRow(
      `SELECT COUNT(*) as count FROM secondary_xp_log 
       WHERE user_id = $1 
       AND category = $2 
       AND action = $3 
       AND DATE(created_at) = $4`,
      [userId, category, action, today]
    );

    return parseInt(result.count) || 0;
  }
}

module.exports = SecondaryXPProcessor;

