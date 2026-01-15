// ═══════════════════════════════════════════════════════════════════════════════
// TEMP STUB — DO NOT SHIP
// User progress repository for SQLite checklist tracking
// ═══════════════════════════════════════════════════════════════════════════════

const db = require('../sqlite');
const logger = require('../../utils/logger');

class UserProgressRepository {
  /**
   * Get user's completed challenges
   */
  getUserProgress(userId) {
    const stmt = db.get().prepare(`
      SELECT challenge_idx, completed_count, last_completed_at
      FROM user_progress
      WHERE user_id = ?
      ORDER BY challenge_idx ASC
    `);
    
    return stmt.all(userId);
  }
  
  /**
   * Record challenge completion
   */
  recordCompletion(userId, challengeIdx) {
    const stmt = db.get().prepare(`
      INSERT INTO user_progress (user_id, challenge_idx, completed_count, last_completed_at)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(user_id, challenge_idx) 
      DO UPDATE SET 
        completed_count = completed_count + 1,
        last_completed_at = ?
    `);
    
    const now = new Date().toISOString();
    return stmt.run(userId, challengeIdx, now, now);
  }
  
  /**
   * Remove completion (undo)
   */
  removeCompletion(userId, challengeIdx) {
    const stmt = db.get().prepare(`
      DELETE FROM user_progress
      WHERE user_id = ? AND challenge_idx = ?
    `);
    
    const result = stmt.run(userId, challengeIdx);
    return result.changes > 0;
  }
  
  /**
   * Get challenge stats across all users
   */
  getChallengeStats() {
    const stmt = db.get().prepare(`
      SELECT 
        challenge_idx,
        SUM(completed_count) as total_completions,
        COUNT(DISTINCT user_id) as user_count
      FROM user_progress
      GROUP BY challenge_idx
      ORDER BY total_completions DESC
    `);
    
    return stmt.all();
  }
}

module.exports = new UserProgressRepository();

