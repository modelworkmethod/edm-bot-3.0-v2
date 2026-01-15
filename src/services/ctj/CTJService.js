/**
 * CTJ Service
 * Handles modal-based Confidence-Tension Journal entries
 */

const { createLogger } = require('../../utils/logger');
const { query, queryRow } = require('../../database/postgres');

const logger = createLogger('CTJService');

class CTJService {
  constructor(ctjAnalyzer, secondaryXPProcessor) {
    this.ctjAnalyzer = ctjAnalyzer;
    this.secondaryXPProcessor = secondaryXPProcessor;
  }

  /**
   * Compat layer para el modal:
   * addEntry y saveEntry llaman a createEntry
   */
  async addEntry(payload) {
    // payload: { userId, date, confidence, tension, notes }
    return this.createEntry(payload);
  }

  async saveEntry(payload) {
    return this.createEntry(payload);
  }

  /**
   * Create journal entry from modal submission
   */
  async createEntry({ userId, date, confidence, tension, notes }) {
    try {
      // Insert entry
      const entry = await queryRow(
        `INSERT INTO ctj_entries (
          user_id, message_id, channel_id, entry_text, confidence, tension, submitted_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          userId,
          null, // No message for modal entries
          null, // No channel for modal entries
          notes || '',
          confidence,
          tension,
          date ? new Date(date) : new Date()
        ]
      );

      logger.info('CTJ entry created', {
        userId,
        entryId: entry.id,
        confidence,
        tension
      });

      // Award XP for journal entry
      if (this.secondaryXPProcessor) {
        await this.secondaryXPProcessor.awardSecondaryXP(
          userId,
          'journal',
          'submitEntry',
          { entryId: entry.id, confidence, tension }
        );
      }

      // Analyze entry for breakthroughs
      if (this.ctjAnalyzer && notes) {
        await this.ctjAnalyzer.analyzeEntry(entry.id);
      }

      return { success: true, entry };

    } catch (error) {
      logger.error('Failed to create CTJ entry', { error: error.message, userId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get breakthrough entries for user
   */
  async getBreakthroughs(userId, options = {}) {
    try {
      const {
        range = '30d',
        type = 'all',
        limit = 10
      } = options;

      // Calculate date filter
      let dateFilter = '';
      const params = [userId];
      
      if (range === '7d') {
        dateFilter = 'AND e.submitted_at >= NOW() - INTERVAL \'7 days\'';
      } else if (range === '30d') {
        dateFilter = 'AND e.submitted_at >= NOW() - INTERVAL \'30 days\'';
      }
      // 'all' = no date filter

      // Type filter
      let typeFilter = '';
      if (type === 'confidence') {
        typeFilter = 'AND e.confidence >= 8';
      } else if (type === 'tension') {
        typeFilter = 'AND e.tension <= 3';
      }

      const breakthroughs = await query(
        `SELECT 
          e.id,
          e.confidence,
          e.tension,
          e.entry_text,
          e.submitted_at,
          a.sentiment,
          a.breakthrough_score,
          a.key_themes
        FROM ctj_entries e
        JOIN ctj_analysis a ON e.id = a.entry_id
        WHERE e.user_id = $1
          AND a.teachable_moment = true
          ${dateFilter}
          ${typeFilter}
        ORDER BY a.breakthrough_score DESC, e.submitted_at DESC
        LIMIT ${limit}`,
        params
      );

      return { success: true, breakthroughs };

    } catch (error) {
      logger.error('Failed to get breakthroughs', { error: error.message, userId });
      return { success: false, error: error.message };
    }
  }
}

module.exports = CTJService;
