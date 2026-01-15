/**
 * Stats repository
 * Handles user stats and daily tracking
 */

const BaseRepository = require('./BaseRepository');
const { queryRow, queryRows, query } = require('../postgres');

class StatsRepository extends BaseRepository {
  constructor() {
    super('user_stats');
  }

  async getOrCreate(userId, statType) {
    let stat = await queryRow(
      'SELECT * FROM user_stats WHERE user_id = $1 AND stat = $2',
      [userId, statType]
    );

    if (!stat) {
      stat = await this.create({
        user_id: userId,
        stat: statType,
        total: 0
      });
    }

    return stat;
  }

  async updateTotal(userId, statType, increment) {
    return await queryRow(
      `INSERT INTO user_stats (user_id, stat, total, updated_at) 
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, stat) 
       DO UPDATE SET 
         total = user_stats.total + $3,
         updated_at = NOW()
       RETURNING *`,
      [userId, statType, increment]
    );
  }

  async getTopStatsForUser(userId, limit = 5) {
    return await queryRows(
      `SELECT stat, total 
       FROM user_stats 
       WHERE user_id = $1 
       ORDER BY total DESC 
       LIMIT $2`,
      [userId, limit]
    );
  }

  async getDailyRecord(userId, day) {
    return await queryRow(
      'SELECT * FROM user_daily WHERE user_id = $1 AND day = $2',
      [userId, day]
    );
  }

  async upsertDailyRecord(userId, day, data) {
    const { state, active, dom, eng_chat } = data;

    return await queryRow(
      `INSERT INTO user_daily (user_id, day, state, active, dom, eng_chat, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id, day) 
       DO UPDATE SET 
         state = COALESCE(EXCLUDED.state, user_daily.state),
         active = GREATEST(user_daily.active, EXCLUDED.active),
         dom = COALESCE(EXCLUDED.dom, user_daily.dom),
         eng_chat = GREATEST(user_daily.eng_chat, EXCLUDED.eng_chat),
         updated_at = NOW()
       RETURNING *`,
      [userId, day, state, active ? 1 : 0, dom, eng_chat ? 1 : 0]
    );
  }

  async getRecentDailyRecords(userId, limit = 30) {
    return await queryRows(
      `SELECT * FROM user_daily 
       WHERE user_id = $1 
       ORDER BY day DESC 
       LIMIT $2`,
      [userId, limit]
    );
  }

  async isMessageProcessed(messageId) {
    const result = await queryRow(
      'SELECT msg_id FROM processed_msgs WHERE msg_id = $1',
      [messageId]
    );
    return !!result;
  }

  async markMessageProcessed(messageId, userId, day) {
    await query(
      `INSERT INTO processed_msgs (msg_id, user_id, day) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (msg_id) DO NOTHING`,
      [messageId, userId, day]
    );
  }
}

module.exports = StatsRepository;
