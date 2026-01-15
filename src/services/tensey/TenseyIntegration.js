/**
 * Tensey Integration
 * Bridge between Tensey bot and main bot (replaces old TenseyAdapter)
 */

const { createLogger } = require('../../utils/logger');
const { LevelCalculator } = require('../xp/LevelCalculator');

const logger = createLogger('TenseyIntegration');

class TenseyIntegration {
  constructor(tenseyManager, userRepo, announcementQueue, generalChannelId) {
    this.tenseyManager = tenseyManager;
    this.userRepo = userRepo;
    this.announcementQueue = announcementQueue;
    this.generalChannelId = generalChannelId;
    this.initialized = true;
  }

  /**
   * Handle Tensey increment from Tensey bot
   * @param {string} userId - Discord user ID
   * @returns {Promise<boolean>} Success
   */
  async handleIncrement(userId) {
    try {
      // This is called after 60-second timer in Tensey bot
      // No need to award XP here - it's already done in TenseyManager.addCompletion
      
      logger.info('Tensey increment processed', { userId });
      return true;

    } catch (error) {
      logger.error('Failed to handle Tensey increment', {
        userId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Handle Tensey decrement (undo)
   * @param {string} userId - Discord user ID
   * @returns {Promise<boolean>} Success
   */
  async handleDecrement(userId) {
    try {
      // Get user's most recent completion
      const completions = await this.tenseyManager.getUserCompletions(userId);
      
      if (completions.size === 0) {
        return false;
      }

      // Remove most recent (highest index)
      const indices = Array.from(completions).sort((a, b) => b - a);
      const mostRecent = indices[0];

      const success = await this.tenseyManager.removeCompletion(userId, mostRecent);

      if (success) {
        logger.info('Tensey decrement processed', { userId, challengeIdx: mostRecent });
      }

      return success;

    } catch (error) {
      logger.error('Failed to handle Tensey decrement', {
        userId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Check if integration is ready
   * @returns {boolean} Ready status
   */
  isReady() {
    return this.initialized;
  }
}

module.exports = TenseyIntegration;

