/**
 * Content Moderator
 * Filters and flags inappropriate content
 */

const { createLogger } = require('../../utils/logger');
const { query } = require('../../database/postgres');

const logger = createLogger('ContentModerator');

class ContentModerator {
  constructor() {
    // Toxic language patterns (basic - expand as needed)
    this.toxicPatterns = [
      // Misogynistic slurs
      /\b(bitch|slut|whore|cunt)\b/i,
      // Violent threats
      /\b(kill|hurt|attack|assault)\s+(you|her|them)/i,
      // Sexual harassment
      /\b(rape|molest|grope)\b/i,
      // Racial slurs (add as needed for your context)
      /\bn[i1]gg[ae]r\b/i
    ];

    // Red flag patterns (incel/red pill ideology)
    this.redFlagPatterns = [
      /\b(blackpill|redpill|looksmaxxing|incel)\b/i,
      /\b(femoid|foid|roastie|chad|stacy)\b/i,
      /\bwomen\s+(are|deserve|should)\s+(raped|beaten|controlled)/i,
      /\b(all|every)\s+women\s+(are|want)\b/i
    ];

    // Spam patterns
    this.spamPatterns = [
      /(.)\1{10,}/, // Repeated characters
      /https?:\/\/.*discord\.gg/i, // Discord invite links
      /https?:\/\/.*\.ru\b/i // Suspicious TLDs
    ];
  }

  /**
   * Check if content contains toxic language
   */
  isToxic(content) {
    return this.toxicPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check if content contains red flag ideology
   */
  hasRedFlags(content) {
    return this.redFlagPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check if content is spam
   */
  isSpam(content) {
    return this.spamPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Analyze content and flag if necessary
   */
  async analyzeContent(userId, contentType, contentId, content) {
    const flags = [];

    if (this.isToxic(content)) {
      flags.push('toxic_language');
    }

    if (this.hasRedFlags(content)) {
      flags.push('red_flag_ideology');
    }

    if (this.isSpam(content)) {
      flags.push('spam');
    }

    // Log all flags
    for (const flagReason of flags) {
      await this.flagContent(userId, contentType, contentId, flagReason);
    }

    return {
      flagged: flags.length > 0,
      flags,
      severity: this.getSeverity(flags)
    };
  }

  /**
   * Get severity level
   */
  getSeverity(flags) {
    if (flags.includes('toxic_language') || flags.includes('red_flag_ideology')) {
      return 'high';
    }
    if (flags.includes('spam')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Flag content for review
   */
  async flagContent(userId, contentType, contentId, flagReason) {
    try {
      await query(
        `INSERT INTO content_flags (user_id, content_type, content_id, flag_reason)
         VALUES ($1, $2, $3, $4)`,
        [userId, contentType, contentId, flagReason]
      );

      logger.warn('Content flagged', {
        userId,
        contentType,
        flagReason
      });
    } catch (error) {
      logger.error('Failed to flag content', { error: error.message });
    }
  }

  /**
   * Get unreviewed flags
   */
  async getUnreviewedFlags(limit = 20) {
    const result = await query(
      `SELECT * FROM content_flags 
       WHERE reviewed = false
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  /**
   * Mark flag as reviewed
   */
  async reviewFlag(flagId, reviewerId, actionTaken) {
    await query(
      `UPDATE content_flags 
       SET reviewed = true, reviewed_by = $1, action_taken = $2
       WHERE id = $3`,
      [reviewerId, actionTaken, flagId]
    );

    logger.info('Flag reviewed', { flagId, reviewerId, actionTaken });
  }
}

module.exports = ContentModerator;

