/**
 * TenseyProgressService (Tensey Bot)
 * SQLite-backed progress tracking for the checklist UI.
 *
 * Assumes table:
 * user_progress(user_id TEXT, challenge_idx INTEGER, completed_count INTEGER, last_completed_at TEXT)
 *
 * Behavior:
 * - getUserProgress(userId) -> number[] (list of completed challenge indices)
 * - markComplete(userId, idx) -> boolean
 * - undoLastCompletion(userId) -> { challengeIdx } | null
 */

const db = require('../database/sqlite');
const logger = require('../utils/logger');


function nowIso() {
  return new Date().toISOString();
}

class TenseyProgressService {
  /**
   * Returns list of completed challenge indices for this user (0-based)
   */
  static async getUserProgress(userId) {
    try {
      const stmt = db.get().prepare(`
        SELECT challenge_idx
        FROM user_progress
        WHERE user_id = ?
          AND completed_count > 0
        ORDER BY challenge_idx ASC
      `);

      const rows = stmt.all(userId) || [];
      return rows
        .map(r => Number(r.challenge_idx))
        .filter(v => Number.isInteger(v) && v >= 0);
    } catch (e) {
      logger.error('TenseyProgressService.getUserProgress failed', {
        userId,
        error: e?.message,
      });
      return [];
    }
  }

  /**
   * Marks a challenge complete (idempotent-ish).
   * If row exists -> set completed_count = max(current, 1) and update last_completed_at.
   * If not -> insert completed_count = 1.
   */
  static async markComplete(userId, challengeIdx) {
    try {
      const idx = Number(challengeIdx);
      if (!Number.isInteger(idx) || idx < 0) return false;

      const getStmt = db.get().prepare(`
        SELECT completed_count
        FROM user_progress
        WHERE user_id = ? AND challenge_idx = ?
      `);

      const row = getStmt.get(userId, idx);

      if (!row) {
        const ins = db.get().prepare(`
          INSERT INTO user_progress (user_id, challenge_idx, completed_count, last_completed_at)
          VALUES (?, ?, 1, ?)
        `);
        ins.run(userId, idx, nowIso());
        return true;
      }

      // If already complete, keep it complete (do not increment).
      const current = Number(row.completed_count || 0);
      const next = current > 0 ? current : 1;

      const upd = db.get().prepare(`
        UPDATE user_progress
        SET completed_count = ?,
            last_completed_at = ?
        WHERE user_id = ? AND challenge_idx = ?
      `);
      upd.run(next, nowIso(), userId, idx);
      return true;
    } catch (e) {
      logger.error('TenseyProgressService.markComplete failed', {
        userId,
        challengeIdx,
        error: e?.message,
      });
      return false;
    }
  }

  /**
   * Undoes the most recently completed challenge (based on last_completed_at).
   * Sets completed_count = 0 and clears last_completed_at.
   */
  static async undoLastCompletion(userId) {
    try {
      const lastStmt = db.get().prepare(`
        SELECT challenge_idx, last_completed_at
        FROM user_progress
        WHERE user_id = ?
          AND completed_count > 0
          AND last_completed_at IS NOT NULL
        ORDER BY datetime(last_completed_at) DESC
        LIMIT 1
      `);

      const last = lastStmt.get(userId);
      if (!last) return null;

      const idx = Number(last.challenge_idx);
      if (!Number.isInteger(idx) || idx < 0) return null;

      const upd = db.get().prepare(`
        UPDATE user_progress
        SET completed_count = 0,
            last_completed_at = NULL
        WHERE user_id = ? AND challenge_idx = ?
      `);

      upd.run(userId, idx);
      return { challengeIdx: idx };
    } catch (e) {
      logger.error('TenseyProgressService.undoLastCompletion failed', {
        userId,
        error: e?.message,
      });
      return null;
    }
  }
}

module.exports = TenseyProgressService;
