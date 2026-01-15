/**
 * User repository
 * Handles all user-related database operations
 */

const BaseRepository = require('./BaseRepository');
const { queryRow, queryRows, query, transaction } = require('../postgres');

class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  /**
   * ✅ Raw SQL helper
   * Some services (legacy) expect repositories.users.raw(...)
   */
  async raw(sql, params = []) {
    return query(sql, params);
  }

  /**
   * Find user by Discord user ID
   * @param {string} userId - Discord user ID
   * @returns {Promise<object|null>} User or null
   */
  async findByUserId(userId) {
    return await this.findById(userId, 'user_id');
  }

  /**
   * Get or create user
   * @param {string} userId - Discord user ID
   * @param {string} username - Discord username
   * @returns {Promise<object>} User record
   */
  async getOrCreate(userId, username = null) {
    let user = await this.findByUserId(userId);

    if (!user) {
      // ✅ Use affinity columns (consistent with UserService.updateUserStats)
      user = await this.create({
        user_id: userId,
        username: username,
        xp: 0,
        warrior_affinity: 0,
        mage_affinity: 0,
        templar_affinity: 0,
        prestige: 0,
        faction: null
      });
    }

    return user;
  }

  /**
   * Update user XP and affinities
   * @param {string} userId - Discord user ID
   * @param {number} xpDelta - XP change
   * @param {object} affinityDeltas - Affinity changes {warrior, mage, templar}
   * @returns {Promise<object>} Updated user
   */
  async updateXPAndAffinities(userId, xpDelta, affinityDeltas = {}) {
    const { warrior = 0, mage = 0, templar = 0 } = affinityDeltas;

    return await queryRow(
      `UPDATE users
       SET xp = xp + $1,
           warrior_affinity = COALESCE(warrior_affinity, 0) + $2,
           mage_affinity = COALESCE(mage_affinity, 0) + $3,
           templar_affinity = COALESCE(templar_affinity, 0) + $4,
           updated_at = NOW()
       WHERE user_id = $5
       RETURNING *`,
      [xpDelta, warrior, mage, templar, userId]
    );
  }

  /**
   * Update Tensey counter
   * @param {string} userId - Discord user ID
   * @param {number} delta - Change amount
   * @returns {Promise<object>} Updated user
   */
  async updateTenseyCounter(userId, delta = 1) {
    return await queryRow(
      `UPDATE users
       SET social_freedom_exercises_tenseys = GREATEST(0, COALESCE(social_freedom_exercises_tenseys, 0) + $1),
           updated_at = NOW()
       WHERE user_id = $2
       RETURNING *`,
      [delta, userId]
    );
  }

  /**
   * Set user faction
   * @param {string} userId - Discord user ID
   * @param {string} faction - Faction name
   * @returns {Promise<object>} Updated user
   */
  async setFaction(userId, faction) {
    return await this.update(userId, { faction }, 'user_id');
  }

  /**
   * Get top users by XP
   * @param {number} limit - Number of users to return
   * @returns {Promise<Array>} Top users
   */
  async getTopByXP(limit = 100) {
    return await queryRows(
      `SELECT * FROM users
       WHERE xp > 0
       ORDER BY xp DESC
       LIMIT $1`,
      [limit]
    );
  }

  /**
   * Get user rank by XP
   * @param {string} userId - Discord user ID
   * @returns {Promise<number>} User rank (1-based)
   */
  async getRankByXP(userId) {
    const result = await queryRow(
      `SELECT COUNT(*) + 1 as rank
       FROM users
       WHERE xp > (SELECT COALESCE(xp, 0) FROM users WHERE user_id = $1)`,
      [userId]
    );
    return parseInt(result.rank, 10);
  }

  /**
   * Get faction member counts
   * @returns {Promise<object>} Faction counts {Luminarchs, Noctivores}
   */
  async getFactionCounts() {
    const rows = await queryRows(
      `SELECT faction, COUNT(*) as count
       FROM users
       WHERE faction IS NOT NULL
       GROUP BY faction`
    );

    const counts = { Luminarchs: 0, Noctivores: 0 };
    for (const row of rows) {
      if (row.faction === 'Luminarchs' || row.faction === 'Noctivores') {
        counts[row.faction] = parseInt(row.count, 10);
      }
    }
    return counts;
  }

  /**
   * Update user's archetype points with XP-based dampening
   * NOTE: Left as-is conceptually, but uses queryRow from postgres wrapper.
   */
  async updateArchetypePoints(userId, archetypeData) {
    const { warrior, mage, templar } = archetypeData;

    // Get user's current total XP for dampening calculation
    const userResult = await queryRow(
      'SELECT total_xp FROM users WHERE user_id = $1',
      [userId]
    );

    if (!userResult) {
      console.error(`[Archetype] User ${userId} not found`);
      return;
    }

    const totalXP = userResult.total_xp || 0;

    const MIN_XP = 1000;
    const MAX_XP = 50000;
    const MIN_DAMPENING = 0.3;
    const MAX_DAMPENING = 1.0;

    let dampening;
    if (totalXP <= MIN_XP) {
      dampening = MAX_DAMPENING;
    } else if (totalXP >= MAX_XP) {
      dampening = MIN_DAMPENING;
    } else {
      const ratio = (totalXP - MIN_XP) / (MAX_XP - MIN_XP);
      dampening = MAX_DAMPENING - (ratio * (MAX_DAMPENING - MIN_DAMPENING));
    }

    const dampenedWarrior = warrior * dampening;
    const dampenedMage = mage * dampening;
    const dampenedTemplar = templar * dampening;

    console.log(
      `[Archetype] User: ${userId} | XP: ${totalXP} | Dampening: ${dampening.toFixed(3)} | W: ${dampenedWarrior.toFixed(2)} M: ${dampenedMage.toFixed(2)}`
    );

    await queryRow(
      `UPDATE users
       SET archetype_warrior = COALESCE(archetype_warrior, 0) + $1,
           archetype_mage = COALESCE(archetype_mage, 0) + $2,
           archetype_templar = COALESCE(archetype_templar, 0) + $3,
           updated_at = NOW()
       WHERE user_id = $4`,
      [dampenedWarrior, dampenedMage, dampenedTemplar, userId]
    );
  }

  /**
   * Reset user stats (admin function)
   * ✅ Fixed: removed this.db.getClient() which would crash
   * Uses postgres.transaction wrapper
   */
  async resetStats(userId) {
    const { createLogger } = require('../../utils/logger');
    const logger = createLogger('UserRepository');

    try {
      const result = await transaction(async (client) => {
        await client.query(
          `UPDATE users
           SET xp = 0,
               level = 1,
               warrior_affinity = 0,
               mage_affinity = 0,
               templar_affinity = 0,
               updated_at = NOW()
           WHERE user_id = $1`,
          [userId]
        );

        await client.query('DELETE FROM user_stats WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM user_daily WHERE user_id = $1', [userId]);

        // If you still have these legacy tables:
        await client.query('DELETE FROM users_stats WHERE user_id = $1', [userId]).catch(() => {});
        await client.query('DELETE FROM daily_records WHERE user_id = $1', [userId]).catch(() => {});

        const { rows } = await client.query(
          `SELECT user_id, xp, level, warrior_affinity, mage_affinity, templar_affinity
           FROM users
           WHERE user_id = $1`,
          [userId]
        );

        return rows[0] || null;
      });

      return result;
    } catch (err) {
      logger.error('UserRepository.resetStats failed', { userId, error: err.message });
      throw err;
    }
  }
}

module.exports = UserRepository;
