/**
 * Archetype History Repository
 * Manages archetype change history for trend analysis and coaching insights
 */

const { query, queryRow } = require('../postgres');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('ArchetypeHistoryRepository');

class ArchetypeHistoryRepository {
  /**
   * Log an archetype change to history
   * @param {string} userId - Discord user ID
   * @param {string} previousArchetype - Previous archetype (null for initial)
   * @param {string} newArchetype - New archetype
   * @param {object} archetypeData - Archetype points and percentages
   * @param {number} totalXP - User's total XP
   * @param {number} volatility - Dampening factor (0.3-1.0)
   */
  async logArchetypeChange(userId, previousArchetype, newArchetype, archetypeData, totalXP, volatility) {
    try {
      const { warrior, mage, templar, warriorPercent, magePercent } = archetypeData;
      
      await query(
        `INSERT INTO archetype_history (
          user_id, previous_archetype, new_archetype,
          warrior_points, mage_points, templar_points,
          warrior_percent, mage_percent, total_xp, volatility
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          userId,
          previousArchetype,
          newArchetype,
          warrior,
          mage,
          templar,
          warriorPercent,
          magePercent,
          totalXP,
          volatility
        ]
      );
      
      logger.info(`Logged archetype change: ${userId} ${previousArchetype || 'New'} → ${newArchetype}`);
      
    } catch (error) {
      logger.error('Failed to log archetype change', { userId, error: error.message });
      throw error;
    }
  }
  
  /**
   * Get user's archetype history
   * @param {string} userId - Discord user ID
   * @param {number} limit - Number of records to retrieve
   * @returns {Promise<Array>} Archetype history records
   */
  async getUserHistory(userId, limit = 30) {
    try {
      const result = await query(
        `SELECT * FROM archetype_history 
         WHERE user_id = $1 
         ORDER BY changed_at DESC 
         LIMIT $2`,
        [userId, limit]
      );
      
      return result.rows || [];
      
    } catch (error) {
      logger.error('Failed to get user history', { userId, error: error.message });
      return [];
    }
  }
  
  /**
   * Get most recent archetype change for user
   * @param {string} userId - Discord user ID
   * @returns {Promise<object|null>} Most recent archetype change record
   */
  async getLastChange(userId) {
    try {
      const result = await queryRow(
        `SELECT * FROM archetype_history 
         WHERE user_id = $1 
         ORDER BY changed_at DESC 
         LIMIT 1`,
        [userId]
      );
      
      return result || null;
      
    } catch (error) {
      logger.error('Failed to get last change', { userId, error: error.message });
      return null;
    }
  }
  
  /**
   * Get days since last archetype change
   * @param {string} userId - Discord user ID
   * @returns {Promise<number|null>} Days since last change
   */
  async getDaysSinceLastChange(userId) {
    try {
      const lastChange = await this.getLastChange(userId);
      
      if (!lastChange) return null;
      
      const now = new Date();
      const changeDate = new Date(lastChange.changed_at);
      const diffTime = Math.abs(now - changeDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays;
      
    } catch (error) {
      logger.error('Failed to get days since last change', { userId, error: error.message });
      return null;
    }
  }
  
  /**
   * Get users who have been out of Templar for X+ days
   * @param {number} days - Minimum days out of balance
   * @returns {Promise<Array>} Users who need attention
   */
  async getUsersOutOfBalance(days = 14) {
    try {
      const result = await query(
        `SELECT DISTINCT ON (ah.user_id) 
          ah.user_id,
          ah.new_archetype,
          ah.warrior_percent,
          ah.mage_percent,
          ah.changed_at,
          EXTRACT(DAY FROM NOW() - ah.changed_at) as days_in_archetype,
          u.username
        FROM archetype_history ah
        JOIN users u ON ah.user_id = u.user_id
        WHERE ah.new_archetype != 'Templar'
        ORDER BY ah.user_id, ah.changed_at DESC`
      );
      
      // Filter to users who have been in non-Templar for X+ days
      return (result.rows || []).filter(row => row.days_in_archetype >= days);
      
    } catch (error) {
      logger.error('Failed to get users out of balance', { days, error: error.message });
      return [];
    }
  }
  
  /**
   * Get archetype distribution across all users
   * @returns {Promise<object>} Distribution object
   */
  async getArchetypeDistribution() {
    try {
      const result = await query(
        `SELECT DISTINCT ON (user_id)
          user_id, new_archetype
        FROM archetype_history
        ORDER BY user_id, changed_at DESC`
      );
      
      const distribution = {
        Warrior: 0,
        Templar: 0,
        Mage: 0,
        'New Initiate': 0
      };
      
      (result.rows || []).forEach(row => {
        if (distribution[row.new_archetype] !== undefined) {
          distribution[row.new_archetype]++;
        }
      });
      
      return distribution;
      
    } catch (error) {
      logger.error('Failed to get archetype distribution', { error: error.message });
      return { Warrior: 0, Templar: 0, Mage: 0, 'New Initiate': 0 };
    }
  }
  
  /**
   * Get archetype trend for user (last N days)
   * @param {string} userId - Discord user ID
   * @param {number} days - Number of days to look back
   * @returns {Promise<Array>} Array of archetype changes
   */
  async getArchetypeTrend(userId, days = 7) {
    try {
      const result = await query(
        `SELECT new_archetype, changed_at
         FROM archetype_history
         WHERE user_id = $1 
           AND changed_at >= NOW() - INTERVAL '${days} days'
         ORDER BY changed_at ASC`,
        [userId]
      );
      
      return result.rows || [];
      
    } catch (error) {
      logger.error('Failed to get archetype trend', { userId, days, error: error.message });
      return [];
    }
  }
}

module.exports = new ArchetypeHistoryRepository();

