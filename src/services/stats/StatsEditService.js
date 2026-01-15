/**
 * Stats Edit Service
 * Safe editing and deletion of past stats with audit logging
 */

const { createLogger } = require('../../utils/logger');
const { query, queryRow, queryRows } = require('../../database/postgres');
const { STAT_WEIGHTS, STAT_ALIASES, AFFINITY_WEIGHTS } = require('../../config/constants');
const AuditLogger = require('../security/AuditLogger');

const logger = createLogger('StatsEditService');

// Edit window for non-admins (days)
const EDIT_WINDOW_DAYS = 7;

/**
 * Category → stat keys (canonical names in daily_records.stat_name)
 * Keys here should match what you store in DB (usually STAT_WEIGHTS keys / normalized keys).
 */
const CATEGORY_MAP = {
  core_social: [
    'Approaches',
    'Numbers',
    'New Contact Response',
    'Hellos To Strangers',
    'In Action Release',
  ],
  inner_work: [
    'Courage Welcoming',
    'SBMM Meditation',
    'Grounding',
    'Releasing Sesh',
  ],
  dating: [
    'Dates Booked',
    'Dates Had',
    'Instant Date',
    'Got Laid',
    'Same Night Pull',
  ],
  learning: [
    'Course Module',
    'Course Experiment',
  ],
  daily_state: [
    'Overall State Today (1-10)',
    'Retention Streak',
  ],
};

class StatsEditService {
  constructor(repositories) {
    this.repositories = repositories;
  }

  /**
   * List recent days with stats for a user
   */
  async listDays(userId, limit = 7) {
    try {
      const days = await queryRows(
        `SELECT 
          date,
          COUNT(*) as stat_count,
          SUM(count) as total_actions
         FROM daily_records
         WHERE user_id = $1
         GROUP BY date
         ORDER BY date DESC
         LIMIT $2`,
        [userId, limit]
      );

      return {
        success: true,
        days: days.map(d => ({
          date: d.date,
          statCount: parseInt(d.stat_count),
          totalActions: parseInt(d.total_actions)
        }))
      };

    } catch (error) {
      logger.error('Failed to list days', { error: error.message, userId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get stats for a specific day (ALL stats)
   */
  async getDay(userId, date) {
    try {
      const records = await queryRows(
        `SELECT stat_name, count 
         FROM daily_records 
         WHERE user_id = $1 AND date = $2`,
        [userId, date]
      );

      const stats = {};
      for (const r of records) {
        stats[r.stat_name] = parseInt(r.count);
      }

      return {
        success: true,
        date,
        stats
      };

    } catch (error) {
      logger.error('Failed to get day', { error: error.message, userId, date });
      return { success: false, error: error.message };
    }
  }

  /**
   * ✅ NEW: Get stats for a day filtered by category
   * @param {string} userId
   * @param {string} date (YYYY-MM-DD)
   * @param {string} categoryKey (core_social | inner_work | dating | learning | daily_state | all)
   * @returns {object} stats map { statName: value }
   */
  async getDayStats(userId, date, categoryKey = 'all') {
    const day = await this.getDay(userId, date);
    if (!day.success) {
      throw new Error(day.error || 'Failed to load day');
    }

    const all = day.stats || {};
    if (!categoryKey || categoryKey === 'all') return all;

    const allowed = CATEGORY_MAP[categoryKey];
    if (!allowed || allowed.length === 0) {
      // Unknown category → return all (safe fallback)
      return all;
    }

    const out = {};
    for (const k of allowed) {
      if (all[k] !== undefined) out[k] = all[k];
    }
    return out;
  }

  /**
   * ✅ NEW: Get a single stat value (defaults to 0)
   */
  async getStatValue(userId, date, categoryKey, statKey) {
    // normalize in case UI passed alias / different casing
    const normalized = this.normalizeStatKey(statKey) || statKey;

    // Optional: if category is known, verify stat belongs to it (soft check)
    const allowed = CATEGORY_MAP[categoryKey];
    if (allowed && allowed.length > 0 && !allowed.includes(normalized)) {
      // Not in category → still try DB, but this guards UI mismatch
      logger.warn('getStatValue: stat not in category map', {
        userId,
        date,
        categoryKey,
        statKey,
        normalized,
      });
    }

    const row = await queryRow(
      `SELECT count FROM daily_records WHERE user_id = $1 AND date = $2 AND stat_name = $3`,
      [userId, date, normalized]
    );

    if (!row) return 0;
    const n = parseInt(row.count, 10);
    return Number.isNaN(n) ? 0 : n;
  }

  /**
   * Parse patch string like "Approaches=5, Gym Hours=2"
   */
  parsePatch(patchString) {
    const patch = {};
    const pairs = patchString.split(',').map(s => s.trim());

    for (const pair of pairs) {
      const [key, value] = pair.split('=').map(s => s.trim());
      
      if (!key || !value) continue;

      // Normalize stat key (case-insensitive, aliases)
      const normalized = this.normalizeStatKey(key);
      if (!normalized) {
        return { success: false, error: `Unknown stat: ${key}` };
      }

      const numValue = parseInt(value);
      if (isNaN(numValue) || numValue < 0) {
        return { success: false, error: `Invalid value for ${key}: ${value}` };
      }

      // Guardrail: max 500 per stat per day
      if (numValue > 500) {
        return { success: false, error: `Value too high for ${key}: ${numValue} (max 500)` };
      }

      patch[normalized] = numValue;
    }

    if (Object.keys(patch).length === 0) {
      return { success: false, error: 'No valid stats in patch' };
    }

    return { success: true, patch };
  }

  /**
   * Normalize stat key using aliases
   */
  normalizeStatKey(key) {
    const lower = (key || '').toLowerCase().trim();
    if (!lower) return null;

    // Check direct match
    if (STAT_WEIGHTS[key]) return key;
    
    // Check alias
    if (STAT_ALIASES && STAT_ALIASES[lower]) return STAT_ALIASES[lower];
    
    // Check case-insensitive match
    for (const statKey of Object.keys(STAT_WEIGHTS || {})) {
      if (statKey.toLowerCase() === lower) return statKey;
    }

    return null;
  }

  /**
   * Check if user can edit date (within window or is admin)
   */
  canEditDate(userId, date, adminId) {
    const isAdmin = adminId && adminId === process.env.ADMIN_USER_ID;
    
    if (isAdmin) return true;

    const dateObj = new Date(date);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - EDIT_WINDOW_DAYS);

    return dateObj >= cutoff;
  }

  /**
   * Edit stats for a specific day
   */
  async editDay(userId, date, patch, editorId) {
    try {
      // Permission check
      const isAdmin = editorId === process.env.ADMIN_USER_ID;
      const isSelf = userId === editorId;

      if (!isSelf && !isAdmin) {
        return { success: false, error: 'Cannot edit another user\'s stats' };
      }

      // Time window check
      if (!this.canEditDate(userId, date, editorId)) {
        return { 
          success: false, 
          error: `Edit window expired (>${EDIT_WINDOW_DAYS} days old)` 
        };
      }

      // Get current stats for this day
      const before = await this.getDay(userId, date);
      if (!before.success) {
        return { success: false, error: 'Failed to load current stats' };
      }

      // Calculate changes
      const changes = [];
      
      for (const [statName, newValue] of Object.entries(patch)) {
        const oldValue = before.stats[statName] || 0;
        const delta = newValue - oldValue;

        if (delta !== 0) {
          changes.push({
            stat: statName,
            before: oldValue,
            after: newValue,
            delta
          });

          // Update or insert daily record
          await query(
            `INSERT INTO daily_records (user_id, date, stat_name, count)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, date, stat_name)
            DO UPDATE SET count = EXCLUDED.count`,
            [userId, date, statName, newValue]
          );

          // Update users_stats aggregate
          await query(
            `INSERT INTO user_stats (user_id, stat, total)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, stat)
            DO UPDATE
              SET total = user_stats.total + EXCLUDED.total,
                  updated_at = NOW()`,
            [userId, statName, delta]
          );
        }
      }

      // Audit log
      await AuditLogger.logAction(
        editorId,
        'stats_edit',
        { date, changes, isSelf, isAdmin },
        userId
      );

      logger.info('Stats edited', {
        userId,
        editorId,
        date,
        changeCount: changes.length
      });

      return {
        success: true,
        date,
        changes,
        message: `${changes.length} stat${changes.length === 1 ? '' : 's'} updated for ${date}`
      };

    } catch (error) {
      logger.error('Failed to edit day', { error: error.message, userId, date });
      return { success: false, error: error.message };
    }
  }

  /**
   * ✅ NEW: Delete ONE stat for a specific day (adjust aggregates + audit)
   * This is what the Admin menu will call.
   */
  async deleteSingleStat(userId, date, categoryKey, statKey, editorId) {
    try {
      const isAdmin = editorId === process.env.ADMIN_USER_ID;
      const isSelf = userId === editorId;

      if (!isSelf && !isAdmin) {
        return { success: false, error: 'Cannot delete another user\'s stats' };
      }

      if (!this.canEditDate(userId, date, editorId)) {
        return {
          success: false,
          error: `Delete window expired (>${EDIT_WINDOW_DAYS} days old)`
        };
      }

      const normalized = this.normalizeStatKey(statKey) || statKey;

      // Soft-check against category
      const allowed = CATEGORY_MAP[categoryKey];
      if (allowed && allowed.length > 0 && !allowed.includes(normalized)) {
        logger.warn('deleteSingleStat: stat not in category map (continuing)', {
          userId,
          date,
          categoryKey,
          statKey,
          normalized,
        });
      }

      // Get current value
      const row = await queryRow(
        `SELECT count FROM daily_records WHERE user_id = $1 AND date = $2 AND stat_name = $3`,
        [userId, date, normalized]
      );

      if (!row) {
        return { success: false, error: 'Stat not found for that date' };
      }

      const current = parseInt(row.count, 10) || 0;

      // Delete daily record row (instead of setting 0)
      await query(
        `DELETE FROM daily_records WHERE user_id = $1 AND date = $2 AND stat_name = $3`,
        [userId, date, normalized]
      );

      // Rollback aggregate
      await query(
        `UPDATE users_stats
        SET total_count = total_count - $1, updated_at = NOW()
        WHERE user_id = $2 AND stat_name = $3`,
        [current, userId, normalized]
      );


      // Audit log
      await AuditLogger.logAction(
        editorId,
        'stats_delete_single',
        { date, categoryKey, stat: normalized, deletedCount: current, isSelf, isAdmin },
        userId
      );

      logger.info('Single stat deleted', {
        userId,
        editorId,
        date,
        stat: normalized,
        deletedCount: current
      });

      return {
        success: true,
        date,
        stat: normalized,
        deletedCount: current,
        message: `Deleted ${normalized} (${current}) for ${date}`
      };

    } catch (error) {
      logger.error('Failed to delete single stat', { error: error.message, userId, date, statKey });
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete (zero out) stats for a specific day
   */
  async deleteDay(userId, date, editorId) {
    try {
      // Permission check
      const isAdmin = editorId === process.env.ADMIN_USER_ID;
      const isSelf = userId === editorId;

      if (!isSelf && !isAdmin) {
        return { success: false, error: 'Cannot delete another user\'s stats' };
      }

      // Time window check
      if (!this.canEditDate(userId, date, editorId)) {
        return { 
          success: false, 
          error: `Delete window expired (>${EDIT_WINDOW_DAYS} days old)` 
        };
      }

      // Get current stats for rollback info
      const before = await this.getDay(userId, date);
      if (!before.success || Object.keys(before.stats).length === 0) {
        return { success: false, error: 'No stats found for this date' };
      }

      // Delete all records for this day
      await query(
        `DELETE FROM daily_records WHERE user_id = $1 AND date = $2`,
        [userId, date]
      );

      // Rollback aggregates
      for (const [statName, count] of Object.entries(before.stats)) {
        await query(
        `UPDATE user_stats
        SET total = total - $1,
            updated_at = NOW()
        WHERE user_id = $2 AND stat = $3`,
        [count, userId, statName]
      );
      }

      // Audit log
      await AuditLogger.logAction(
        editorId,
        'stats_delete',
        { date, deletedStats: before.stats, isSelf, isAdmin },
        userId
      );

      logger.info('Stats deleted', {
        userId,
        editorId,
        date,
        statCount: Object.keys(before.stats).length
      });

      return {
        success: true,
        date,
        deletedStats: before.stats,
        message: `Cleared ${Object.keys(before.stats).length} stat${Object.keys(before.stats).length === 1 ? '' : 's'} for ${date}`
      };

    } catch (error) {
      logger.error('Failed to delete day', { error: error.message, userId, date });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get valid stat keys (for help/validation)
   */
  getValidStatKeys() {
    return Object.keys(STAT_WEIGHTS);
  }
}

module.exports = StatsEditService;
