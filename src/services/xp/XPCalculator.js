/**
 * XP Calculator
 * Calculates XP from stats with multipliers
 */

const { createLogger } = require('../../utils/logger');
const { STAT_CONFIG } = require('../../config/constants');

const logger = createLogger('XPCalculator');

class XPCalculator {
  constructor(doubleXPManager = null) {
    this.doubleXPManager = doubleXPManager;
  }

  /**
   * Calculate base XP from stats
   * @param {object} stats - Validated stats object
   * @returns {number} Base XP
   */
  static calculateXPFromStats(stats) {
    let totalXP = 0;

    for (const [statName, value] of Object.entries(stats)) {
      const statConfig = STAT_CONFIG[statName];
      if (statConfig && value > 0) {
        totalXP += statConfig.xp * value;
      }
    }

    return totalXP;
  }

  /**
   * Calculate XP with all multipliers applied
   * @param {object} stats - Validated stats
   * @param {string} userId - User ID
   * @param {string} day - Day string
   * @returns {Promise<object>} XP calculation result
   */
  async calculateXP(stats, userId, day) {
    try {
      // Calculate base XP
      const baseXP = XPCalculator.calculateXPFromStats(stats);

      // Get regular multipliers (streak, state, templar, etc.)
      const MultiplierService = require('./MultiplierService');
      const multiplierService = new MultiplierService(require('../../database/repositories'));
      
      const regularMultiplier = await multiplierService.calculateMultiplier(
        userId,
        day,
        { state: stats['Overall State Today (1-10)'], active: true },
        null
      );

      // Apply regular multipliers
      let finalXP = Math.floor(baseXP * regularMultiplier.multiplier);

      // Check for active Double XP event
      let doubleXPMultiplier = 1.0;
      if (this.doubleXPManager) {
        doubleXPMultiplier = await this.doubleXPManager.getCurrentMultiplier();
      }

      // Apply Double XP multiplier
      if (doubleXPMultiplier > 1.0) {
        finalXP = Math.floor(finalXP * doubleXPMultiplier);
      }

      // Build multiplier breakdown
      const components = {
        ...regularMultiplier.components,
        doubleXPEvent: doubleXPMultiplier > 1.0 ? doubleXPMultiplier : 0
      };

      const totalMultiplier = regularMultiplier.multiplier * doubleXPMultiplier;

      logger.info('XP calculated', {
        userId,
        baseXP,
        finalXP,
        regularMultiplier: regularMultiplier.multiplier,
        doubleXPMultiplier,
        totalMultiplier
      });

      return {
        baseXP,
        finalXP,
        multiplierInfo: {
          multiplier: totalMultiplier,
          components
        }
      };

    } catch (error) {
      logger.error('XP calculation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Calculate affinities from stats
   * @param {object} stats - Validated stats
   * @returns {object} Affinity totals
   */
  static calculateAffinities(stats) {
    let warrior = 0;
    let mage = 0;

    for (const [statName, value] of Object.entries(stats)) {
      const statConfig = STAT_CONFIG[statName];
      if (statConfig && value > 0) {
        warrior += (statConfig.warrior_affinity || 0) * value;
        mage += (statConfig.mage_affinity || 0) * value;
      }
    }

    return { warrior, mage };
  }
}

module.exports = { XPCalculator };

