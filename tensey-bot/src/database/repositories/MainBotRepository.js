const postgres = require('../postgres');
const logger = require('../../utils/logger');
const { XP_AWARD } = require('../../config/constants');

class MainBotRepository {
  /**
   * Award Tensey XP to user in main bot database
   * This writes directly to the shared PostgreSQL database
   * 
   * @param {string} userId - Discord user ID
   * @param {number} challengeIdx - Challenge index (for logging)
   * @returns {Promise<boolean>}
   */
  async awardTenseyXP(userId, challengeIdx) {
    try {
      const result = await postgres.query(`
        UPDATE users
        SET 
          ${XP_AWARD.STAT_COLUMN} = ${XP_AWARD.STAT_COLUMN} + $1,
          xp = xp + $2,
          updated_at = NOW()
        WHERE user_id = $3
        RETURNING user_id, xp, ${XP_AWARD.STAT_COLUMN}
      `, [XP_AWARD.INCREMENT_AMOUNT, XP_AWARD.BASE_XP, userId]);
      
      if (result.rowCount === 0) {
        // User doesn't exist in main bot DB yet - create them
        await this._createUser(userId);
        // Retry the update
        return await this.awardTenseyXP(userId, challengeIdx);
      }
      
      const user = result.rows[0];
      logger.info('XP awarded to main bot DB', {
        userId,
        challengeIdx,
        newXP: user.xp,
        newTenseyCount: user[XP_AWARD.STAT_COLUMN]
      });
      
      return true;
      
    } catch (err) {
      logger.error('Failed to award XP in main bot DB', {
        userId,
        challengeIdx,
        error: err.message
      });
      return false;
    }
  }
  
  /**
   * Remove Tensey XP from user (for undo)
   */
  async removeTenseyXP(userId, challengeIdx) {
    try {
      const result = await postgres.query(`
        UPDATE users
        SET 
          ${XP_AWARD.STAT_COLUMN} = GREATEST(0, ${XP_AWARD.STAT_COLUMN} - $1),
          xp = GREATEST(0, xp - $2),
          updated_at = NOW()
        WHERE user_id = $3
        RETURNING user_id, xp, ${XP_AWARD.STAT_COLUMN}
      `, [XP_AWARD.INCREMENT_AMOUNT, XP_AWARD.BASE_XP, userId]);
      
      if (result.rowCount > 0) {
        const user = result.rows[0];
        logger.info('XP removed from main bot DB', {
          userId,
          challengeIdx,
          newXP: user.xp,
          newTenseyCount: user[XP_AWARD.STAT_COLUMN]
        });
        return true;
      }
      
      return false;
      
    } catch (err) {
      logger.error('Failed to remove XP from main bot DB', {
        userId,
        challengeIdx,
        error: err.message
      });
      return false;
    }
  }
  
  /**
   * Get leaderboard data from main bot database
   */
  async getLeaderboard(limit = 100) {
    try {
      const result = await postgres.query(`
        SELECT 
          user_id,
          ${XP_AWARD.STAT_COLUMN} as tensey_count,
          xp,
          faction
        FROM users
        WHERE ${XP_AWARD.STAT_COLUMN} > 0
        ORDER BY ${XP_AWARD.STAT_COLUMN} DESC, xp DESC
        LIMIT $1
      `, [limit]);
      
      return result.rows;
      
    } catch (err) {
      logger.error('Failed to get leaderboard from main bot DB', err);
      return [];
    }
  }
  
  /**
   * Get faction breakdown
   */
  async getFactionStats() {
    try {
      const result = await postgres.query(`
        SELECT 
          faction,
          COUNT(DISTINCT user_id) as user_count,
          SUM(${XP_AWARD.STAT_COLUMN}) as total_completions
        FROM users
        WHERE ${XP_AWARD.STAT_COLUMN} > 0
        GROUP BY faction
      `);
      
      return result.rows;
      
    } catch (err) {
      logger.error('Failed to get faction stats', err);
      return [];
    }
  }
  
  /**
   * Create user if they don't exist
   * @private
   */
  async _createUser(userId) {
    try {
      await postgres.query(`
        INSERT INTO users (user_id, xp, ${XP_AWARD.STAT_COLUMN}, created_at, updated_at)
        VALUES ($1, 0, 0, NOW(), NOW())
        ON CONFLICT (user_id) DO NOTHING
      `, [userId]);
      
      logger.info('Created user in main bot DB', { userId });
      
    } catch (err) {
      logger.error('Failed to create user in main bot DB', { userId, error: err.message });
      throw err;
    }
  }
}

module.exports = new MainBotRepository();

