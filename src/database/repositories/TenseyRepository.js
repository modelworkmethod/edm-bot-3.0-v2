/**
 * Tensey repository
 * Handles Tensey challenge completions and ledger
 */

const BaseRepository = require('./BaseRepository');
const { queryRow, queryRows, query } = require('../postgres');

class TenseyRepository extends BaseRepository {
  constructor() {
    super('tensey_completions');
  }

  /**
   * Get user's completions
   * @param {string} userId - Discord user ID
   * @returns {Promise<Array>} Array of challenge indices
   */
  async getUserCompletions(userId) {
    const rows = await queryRows(
      `SELECT challenge_idx FROM tensey_completions 
       WHERE user_id = $1 AND reps > 0 
       ORDER BY challenge_idx ASC`,
      [userId]
    );
    return rows.map(r => r.challenge_idx);
  }

  /**
   * Get user's completion counts (with reps)
   * @param {string} userId - Discord user ID
   * @returns {Promise<Map>} Map of challenge_idx => reps
   */
  async getUserCompletionCounts(userId) {
    const rows = await queryRows(
      `SELECT challenge_idx, reps FROM tensey_completions 
       WHERE user_id = $1 AND reps > 0 
       ORDER BY challenge_idx ASC`,
      [userId]
    );
    const map = new Map();
    rows.forEach(r => map.set(r.challenge_idx, r.reps));
    return map;
  }

  /**
   * Add completion (increment reps)
   * @param {string} userId - Discord user ID
   * @param {number} challengeIdx - Challenge index
   * @returns {Promise<object>} Updated completion
   */
  async addCompletion(userId, challengeIdx) {
    return await queryRow(
      `INSERT INTO tensey_completions (user_id, challenge_idx, reps, completed_at) 
       VALUES ($1, $2, 1, NOW())
       ON CONFLICT (user_id, challenge_idx) 
       DO UPDATE SET 
         reps = tensey_completions.reps + 1,
         completed_at = NOW()
       RETURNING *`,
      [userId, challengeIdx]
    );
  }

  /**
   * Remove completion (decrement reps)
   * @param {string} userId - Discord user ID
   * @param {number} challengeIdx - Challenge index
   * @returns {Promise<boolean>} True if removed
   */
  async removeCompletion(userId, challengeIdx) {
    // Get current reps
    const current = await queryRow(
      'SELECT reps FROM tensey_completions WHERE user_id = $1 AND challenge_idx = $2',
      [userId, challengeIdx]
    );

    if (!current || current.reps <= 0) {
      return false;
    }

    if (current.reps === 1) {
      // Delete if going to 0
      await query(
        'DELETE FROM tensey_completions WHERE user_id = $1 AND challenge_idx = $2',
        [userId, challengeIdx]
      );
    } else {
      // Decrement
      await query(
        `UPDATE tensey_completions 
         SET reps = reps - 1, completed_at = NOW() 
         WHERE user_id = $1 AND challenge_idx = $2`,
        [userId, challengeIdx]
      );
    }

    return true;
  }

  /**
   * Add ledger entry
   * @param {string} userId - Discord user ID
   * @param {number} challengeIdx - Challenge index
   * @param {number} amount - Amount (1 or -1)
   * @returns {Promise<object>} Ledger entry
   */
  async addLedgerEntry(userId, challengeIdx, amount) {
    return await queryRow(
      `INSERT INTO tensey_ledger (user_id, challenge_idx, amount) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [userId, challengeIdx, amount]
    );
  }

  /**
   * Get user's total completions (from ledger)
   * @param {string} userId - Discord user ID
   * @returns {Promise<number>} Total completions
   */
  async getUserTotalCompletions(userId) {
    const result = await queryRow(
      `SELECT COALESCE(SUM(amount), 0) as total 
       FROM tensey_ledger 
       WHERE user_id = $1`,
      [userId]
    );
    return parseInt(result.total);
  }

  /**
   * Get leaderboard stats
   * @param {number} totalChallenges - Total number of challenges
   * @returns {Promise<object>} Stats object
   */
  async getLeaderboardStats(totalChallenges = 303) {
    // Per user totals
    const perUserRows = await queryRows(
      `SELECT user_id, SUM(amount) as count 
       FROM tensey_ledger 
       GROUP BY user_id`
    );
    const perUser = perUserRows.map(r => ({ 
      userId: r.user_id, 
      count: parseInt(r.count) 
    }));

    // Per challenge totals
    const perChallengeRows = await queryRows(
      `SELECT challenge_idx, SUM(amount) as count 
       FROM tensey_ledger 
       GROUP BY challenge_idx 
       ORDER BY challenge_idx ASC`
    );
    const perChallenge = Array(totalChallenges).fill(0);
    perChallengeRows.forEach(r => {
      if (r.challenge_idx >= 0 && r.challenge_idx < totalChallenges) {
        perChallenge[r.challenge_idx] = parseInt(r.count);
      }
    });

    const usersWithProgress = perUser.filter(u => u.count > 0).length;
    const totalCompletions = perChallenge.reduce((a, b) => a + b, 0);
    const avgPerUser = usersWithProgress > 0 ? totalCompletions / usersWithProgress : 0;

    return {
      perUser,
      perChallenge,
      usersWithProgress,
      totalCompletions,
      avgPerUser
    };
  }

  /**
   * Reset user's Tensey data
   * @param {string} userId - Discord user ID
   * @returns {Promise<void>}
   */
  async resetUser(userId) {
    await query('DELETE FROM tensey_completions WHERE user_id = $1', [userId]);
    await query('DELETE FROM tensey_ledger WHERE user_id = $1', [userId]);
  }
}

module.exports = TenseyRepository;

