/**
 * GDPR Exporter
 * Export all user data for compliance
 */

const { createLogger } = require('../../utils/logger');
const { query, queryRows } = require('../../database/postgres');
const AuditLogger = require('../security/AuditLogger');

const logger = createLogger('GDPRExporter');

class GDPRExporter {
  /**
   * Export all user data
   */
  async exportUserData(userId, requestedBy) {
    try {
      logger.info('GDPR export initiated', { userId, requestedBy });

      const userData = {
        exportDate: new Date().toISOString(),
        userId,
        profile: await this.getUserProfile(userId),
        stats: await this.getUserStats(userId),
        dailyRecords: await this.getDailyRecords(userId),
        tenseys: await this.getTenseys(userId),
        barbieList: await this.getBarbieList(userId),
        journalEntries: await this.getJournalEntries(userId),
        courseProgress: await this.getCourseProgress(userId),
        duels: await this.getDuels(userId),
        warnings: await this.getWarnings(userId),
        auditLog: await this.getAuditLog(userId)
      };

      // Log the export
      await AuditLogger.logAction(
        requestedBy,
        'gdpr_export',
        { exportedFields: Object.keys(userData).length },
        userId
      );

      logger.info('GDPR export completed', { userId, requestedBy });

      return {
        success: true,
        data: userData
      };

    } catch (error) {
      logger.error('GDPR export failed', { error: error.message, userId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId) {
    const result = await query(
      `SELECT user_id, username, xp, level, warrior_affinity, mage_affinity, 
              archetype, current_streak, longest_streak, last_submission, 
              created_at, updated_at
       FROM users WHERE user_id = $1`,
      [userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get user stats
   */
  async getUserStats(userId) {
    return await queryRows(
      `SELECT stat, total FROM user_stats WHERE user_id = $1`,
      [userId]
    );
  }

  /**
   * Get daily records
   */
  async getDailyRecords(userId) {
    return await queryRows(
      `SELECT day, state, active, dom, eng_chat, xp_earned, streak_day 
       FROM user_daily WHERE user_id = $1 ORDER BY day DESC`,
      [userId]
    );
  }

  /**
   * Get tenseys
   */
  async getTenseys(userId) {
    return await queryRows(
      `SELECT challenge_idx, reps, completed_at 
       FROM tensey_completions WHERE user_id = $1 ORDER BY completed_at DESC`,
      [userId]
    );
  }

  /**
   * Get barbie list
   */
  async getBarbieList(userId) {
    return await queryRows(
      `SELECT name, vibe_rating, how_met, approached_at, notes, status, created_at 
       FROM barbie_list WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
  }

  /**
   * Get journal entries
   */
  async getJournalEntries(userId) {
    const entries = await queryRows(
      `SELECT e.image_url, e.entry_text, e.submitted_at,
              a.sentiment, a.breakthrough_score, a.key_themes
       FROM ctj_entries e
       LEFT JOIN ctj_analysis a ON e.id = a.entry_id
       WHERE e.user_id = $1 ORDER BY e.submitted_at DESC`,
      [userId]
    );

    return entries;
  }

  /**
   * Get course progress
   */
  async getCourseProgress(userId) {
    return await queryRows(
      `SELECT m.title, p.status, p.completion_percentage, 
              p.videos_watched, p.started_at, p.completed_at
       FROM user_module_progress p
       JOIN course_modules m ON p.module_id = m.id
       WHERE p.user_id = $1`,
      [userId]
    );
  }

  /**
   * Get duels
   */
  async getDuels(userId) {
    return await queryRows(
      `SELECT challenger_id, opponent_id, status, winner_id,
              challenger_start_xp, opponent_start_xp,
              challenger_final_xp, opponent_final_xp,
              start_time, end_time, completed_at
       FROM duels 
       WHERE challenger_id = $1 OR opponent_id = $1
       ORDER BY start_time DESC`,
      [userId]
    );
  }

  /**
   * Get warnings
   */
  async getWarnings(userId) {
    return await queryRows(
      `SELECT reason, severity, created_at 
       FROM user_warnings WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
  }

  /**
   * Get audit log
   */
  async getAuditLog(userId) {
    return await queryRows(
      `SELECT action_type, details, created_at 
       FROM audit_log 
       WHERE admin_id = $1 OR target_user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 100`,
      [userId]
    );
  }

  /**
   * Delete all user data (Right to be forgotten)
   */
  async deleteUserData(userId, requestedBy) {
    try {
      logger.warn('User data deletion initiated', { userId, requestedBy });

      // Delete from all tables (CASCADE will handle related records)
      await query('DELETE FROM users WHERE user_id = $1', [userId]);

      // Log the deletion
      await AuditLogger.logAction(
        requestedBy,
        'gdpr_deletion',
        { permanent: true },
        userId
      );

      logger.warn('User data deleted', { userId, requestedBy });

      return { success: true };

    } catch (error) {
      logger.error('User data deletion failed', { error: error.message, userId });
      return { success: false, error: error.message };
    }
  }
}

module.exports = GDPRExporter;

