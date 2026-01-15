/**
 * CTJ Analyzer
 * AI-powered breakthrough detection for journal entries
 */

const { createLogger } = require('../../utils/logger');
const { query, queryRow } = require('../../database/postgres');
const { EmbedBuilder } = require('discord.js');

const logger = createLogger('CTJAnalyzer');

class CTJAnalyzer {
  constructor(channelService, secondaryXPProcessor) {
    this.channelService = channelService;
    this.secondaryXPProcessor = secondaryXPProcessor;
  }

  /**
   * Analyze journal entry
   */
  async analyzeEntry(entryId) {
    try {
      const entry = await queryRow(
        'SELECT * FROM ctj_entries WHERE id = $1',
        [entryId]
      );

      if (!entry) {
        return { success: false, error: 'Entry not found' };
      }

      // TODO: Implement AI analysis (Phase 11 - AI Client Brain)
      // For now, use rule-based detection

      const analysis = this.performRuleBasedAnalysis(entry.entry_text);

      // Store analysis
      const result = await queryRow(
        `INSERT INTO ctj_analysis (
          entry_id, analysis_text, sentiment, key_themes, teachable_moment, breakthrough_score
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          entryId,
          analysis.analysisText,
          analysis.sentiment,
          analysis.keyThemes,
          analysis.isBreakthrough,
          analysis.breakthroughScore
        ]
      );

      // Award bonus XP if breakthrough detected
      if (analysis.isBreakthrough && this.secondaryXPProcessor) {
        await this.secondaryXPProcessor.awardSecondaryXP(
          entry.user_id,
          'journal',
          'breakthrough',
          { entryId, breakthroughScore: analysis.breakthroughScore }
        );
      }

      logger.info('CTJ entry analyzed', {
        entryId,
        sentiment: analysis.sentiment,
        isBreakthrough: analysis.isBreakthrough
      });

      return { success: true, analysis: result };

    } catch (error) {
      logger.error('Failed to analyze CTJ entry', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Rule-based analysis (placeholder for AI)
   */
  performRuleBasedAnalysis(text) {
    const lowerText = text.toLowerCase();

    // Breakthrough indicators
    const breakthroughKeywords = [
      'breakthrough', 'realization', 'finally understood', 'clicked',
      'pattern', 'released', 'let go', 'noticed'
    ];

    // Resistance indicators
    const resistanceKeywords = [
      'stuck', 'can\'t', 'afraid', 'anxious', 'resistance', 'avoiding'
    ];

    let breakthroughScore = 0;
    let sentiment = 'neutral';
    const themes = [];

    // Score breakthrough
    for (const keyword of breakthroughKeywords) {
      if (lowerText.includes(keyword)) {
        breakthroughScore += 15;
        themes.push(keyword);
      }
    }

    // Detect resistance
    for (const keyword of resistanceKeywords) {
      if (lowerText.includes(keyword)) {
        breakthroughScore -= 5;
        themes.push('resistance');
      }
    }

    // Determine sentiment
    if (breakthroughScore >= 30) {
      sentiment = 'breakthrough';
    } else if (breakthroughScore > 10) {
      sentiment = 'progress';
    } else if (breakthroughScore < 0) {
      sentiment = 'resistance';
    } else {
      sentiment = 'stuck';
    }

    const isBreakthrough = breakthroughScore >= 30;

    return {
      analysisText: isBreakthrough 
        ? 'Significant breakthrough detected! This shows deep self-awareness and growth.'
        : 'Entry recorded. Keep journaling for deeper insights.',
      sentiment,
      keyThemes: [...new Set(themes)], // Deduplicate
      isBreakthrough,
      breakthroughScore: Math.max(0, Math.min(100, breakthroughScore))
    };
  }

  /**
   * Get breakthrough entries (for admin review)
   */
  async getBreakthroughEntries(limit = 10) {
    return await query(
      `SELECT e.*, a.*, u.username
       FROM ctj_entries e
       JOIN ctj_analysis a ON e.id = a.entry_id
       LEFT JOIN users u ON e.user_id = u.user_id
       WHERE a.teachable_moment = true
       ORDER BY a.breakthrough_score DESC, e.submitted_at DESC
       LIMIT $1`,
      [limit]
    );
  }
}

module.exports = CTJAnalyzer;

