/**
 * Audit Logger
 * Logs all sensitive admin actions for compliance and security
 */

const { createLogger } = require('../../utils/logger');
const { query } = require('../../database/postgres');

const logger = createLogger('AuditLogger');

class AuditLogger {
  /**
   * Log admin action
   */
  static async logAction(adminId, actionType, details = {}, targetUserId = null) {
    try {
      await query(
        `INSERT INTO audit_log (admin_id, action_type, target_user_id, details)
         VALUES ($1, $2, $3, $4)`,
        [adminId, actionType, targetUserId, JSON.stringify(details)]
      );

      logger.info('Admin action logged', {
        adminId,
        actionType,
        targetUserId
      });
    } catch (error) {
      logger.error('Failed to log admin action', {
        error: error.message,
        adminId,
        actionType
      });
    }
  }

  /**
   * Get audit history for user
   */
  static async getUserAuditHistory(userId, limit = 50) {
    const result = await query(
      `SELECT * FROM audit_log 
       WHERE admin_id = $1 OR target_user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  /**
   * Get recent admin actions
   */
  static async getRecentActions(limit = 100) {
    const result = await query(
      `SELECT * FROM audit_log 
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  /**
   * Search audit log
   */
  static async searchAudit(filters = {}) {
    let sql = 'SELECT * FROM audit_log WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.adminId) {
      sql += ` AND admin_id = $${paramCount}`;
      params.push(filters.adminId);
      paramCount++;
    }

    if (filters.actionType) {
      sql += ` AND action_type = $${paramCount}`;
      params.push(filters.actionType);
      paramCount++;
    }

    if (filters.targetUserId) {
      sql += ` AND target_user_id = $${paramCount}`;
      params.push(filters.targetUserId);
      paramCount++;
    }

    if (filters.startDate) {
      sql += ` AND created_at >= $${paramCount}`;
      params.push(filters.startDate);
      paramCount++;
    }

    sql += ' ORDER BY created_at DESC LIMIT 100';

    const result = await query(sql, params);
    return result.rows;
  }
}

module.exports = AuditLogger;

