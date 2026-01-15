const db = require('../sqlite');
const logger = require('../../utils/logger');

class PendingAwardsRepository {
  /**
   * Create new pending award
   */
  create({ userId, challengeIdx, completedAt, awardScheduledAt }) {
    try {
      const stmt = db.get().prepare(`
        INSERT INTO pending_xp_awards (
          user_id, challenge_idx, completed_at, award_scheduled_at
        ) VALUES (?, ?, ?, ?)
      `);
      
      return stmt.run(
        userId,
        challengeIdx,
        completedAt.toISOString(),
        awardScheduledAt.toISOString()
      );
      
    } catch (err) {
      logger.error('Failed to create pending award', { userId, challengeIdx, err });
      throw err;
    }
  }
  
  /**
   * Find pending award for user + challenge
   */
  findPending(userId, challengeIdx) {
    const stmt = db.get().prepare(`
      SELECT * FROM pending_xp_awards
      WHERE user_id = ? AND challenge_idx = ? AND awarded_at IS NULL
    `);
    
    return stmt.get(userId, challengeIdx);
  }
  
  /**
   * Find all awards due for processing
   */
  findDue() {
    const now = new Date().toISOString();
    const stmt = db.get().prepare(`
      SELECT * FROM pending_xp_awards
      WHERE awarded_at IS NULL
        AND award_scheduled_at <= ?
        AND retry_count < 5
      ORDER BY award_scheduled_at ASC
      LIMIT 100
    `);
    
    return stmt.all(now);
  }
  
  /**
   * Mark award as completed
   */
  markAwarded(id) {
    const stmt = db.get().prepare(`
      UPDATE pending_xp_awards
      SET awarded_at = ?, retry_count = 0
      WHERE id = ?
    `);
    
    return stmt.run(new Date().toISOString(), id);
  }
  
  /**
   * Increment retry count
   */
  incrementRetries(id) {
    const stmt = db.get().prepare(`
      UPDATE pending_xp_awards
      SET retry_count = retry_count + 1
      WHERE id = ?
    `);
    
    return stmt.run(id);
  }
  
  /**
   * Delete pending award (for undo)
   */
  deletePending(userId, challengeIdx) {
    const stmt = db.get().prepare(`
      DELETE FROM pending_xp_awards
      WHERE user_id = ? AND challenge_idx = ? AND awarded_at IS NULL
    `);
    
    const result = stmt.run(userId, challengeIdx);
    return result.changes > 0;
  }
  
  /**
   * Get count of pending awards
   */
  countPending() {
    const stmt = db.get().prepare(`
      SELECT COUNT(*) as count FROM pending_xp_awards
      WHERE awarded_at IS NULL
    `);
    
    return stmt.get().count;
  }
}

module.exports = new PendingAwardsRepository();

