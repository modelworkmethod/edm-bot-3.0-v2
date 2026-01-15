/**
 * Tensey Manager
 * Handles Tensey challenge completions and rewards
 */

const { createLogger } = require('../../utils/logger');

const logger = createLogger('TenseyManager');

class TenseyManager {
  constructor(repositories, userService) {
    this.tenseyRepo = repositories.tensey;
    this.userRepo = repositories.user;
    this.userService = userService;
  }

  /**
   * Add Tensey completion
   * @param {string} userId - Discord user ID
   * @param {number} challengeIdx - Challenge index (0-302)
   * @returns {Promise<object>} Result
   */
  async addCompletion(userId, challengeIdx) {
    try {
      // Add to completions table
      await this.tenseyRepo.addCompletion(userId, challengeIdx);

      // Add to ledger (positive entry)
      await this.tenseyRepo.addLedgerEntry(userId, challengeIdx, 1);

      // Award XP and update counter
      const result = await this.userService.updateUserStats(
        userId,
        100, // Tensey XP
        { warrior: 2, mage: 1, templar: 2 },
        'tensey_completion'
      );

      // Update Tensey counter
      await this.userRepo.updateTenseyCounter(userId, 1);

      logger.info('Tensey completion added', {
        userId,
        challengeIdx,
        xpAwarded: 100
      });

      return {
        success: true,
        xpAwarded: 100,
        levelChange: result.levelChange,
        archetypeChange: result.archetypeChange
      };

    } catch (error) {
      logger.error('Failed to add Tensey completion', {
        userId,
        challengeIdx,
        error: error.message
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Remove Tensey completion (undo)
   * @param {string} userId - Discord user ID
   * @param {number} challengeIdx - Challenge index
   * @returns {Promise<boolean>} Success
   */
  async removeCompletion(userId, challengeIdx) {
    try {
      const removed = await this.tenseyRepo.removeCompletion(userId, challengeIdx);

      if (!removed) {
        return false;
      }

      // Add negative ledger entry
      await this.tenseyRepo.addLedgerEntry(userId, challengeIdx, -1);

      // Deduct XP
      await this.userService.updateUserStats(
        userId,
        -100,
        { warrior: -2, mage: -1, templar: -2 },
        'tensey_undo'
      );

      // Update counter
      await this.userRepo.updateTenseyCounter(userId, -1);

      logger.info('Tensey completion removed', { userId, challengeIdx });
      return true;

    } catch (error) {
      logger.error('Failed to remove Tensey completion', {
        userId,
        challengeIdx,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get user's completions
   * @param {string} userId - Discord user ID
   * @returns {Promise<Set>} Set of completed challenge indices
   */
  async getUserCompletions(userId) {
    const indices = await this.tenseyRepo.getUserCompletions(userId);
    return new Set(indices);
  }

  /**
   * Get user's completion counts
   * @param {string} userId - Discord user ID
   * @returns {Promise<Map>} Map of challenge index to reps
   */
  async getUserCompletionCounts(userId) {
    return await this.tenseyRepo.getUserCompletionCounts(userId);
  }

  /**
   * Get leaderboard stats
   * @returns {Promise<object>} Leaderboard statistics
   */
  async getLeaderboardStats() {
    return await this.tenseyRepo.getLeaderboardStats(303);
  }
}

module.exports = TenseyManager;

