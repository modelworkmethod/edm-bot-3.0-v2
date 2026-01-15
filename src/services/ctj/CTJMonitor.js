/**
 * CTJ Monitor
 * Monitors journal channel for confidence tension entries
 */

const { createLogger } = require('../../utils/logger');
const { query, queryRow } = require('../../database/postgres');

const logger = createLogger('CTJMonitor');

class CTJMonitor {
  constructor(secondaryXPProcessor, ctjAnalyzer) {
    this.secondaryXPProcessor = secondaryXPProcessor;
    this.ctjAnalyzer = ctjAnalyzer;
    this.journalChannelId = process.env.JOURNAL_CHANNEL_ID;
  }

  /**
   * Check if message is in journal channel
   */
  isJournalChannel(channelId) {
    return channelId === this.journalChannelId;
  }

  /**
   * Handle message in journal channel
   */
  async handleMessage(message) {
    try {
      // Only process journal channel
      if (!this.isJournalChannel(message.channel.id)) {
        return;
      }

      // Ignore bots
      if (message.author.bot) return;

      // Must have image attachment
      const hasImage = message.attachments.size > 0 && 
                       message.attachments.some(a => a.contentType?.startsWith('image/'));

      if (!hasImage) {
        logger.debug('CTJ entry missing image', { userId: message.author.id });
        return;
      }

      // Store entry
      const imageUrl = message.attachments.first().url;
      const entryText = message.content || '';

      const entry = await queryRow(
        `INSERT INTO ctj_entries (user_id, message_id, channel_id, image_url, entry_text)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [message.author.id, message.id, message.channel.id, imageUrl, entryText]
      );

      logger.info('CTJ entry recorded', {
        userId: message.author.id,
        entryId: entry.id
      });

      // Award XP for journal entry
      if (this.secondaryXPProcessor) {
        await this.secondaryXPProcessor.awardSecondaryXP(
          message.author.id,
          'journal',
          'submitEntry',
          { entryId: entry.id, hasImage: true }
        );
      }

      // Queue for AI analysis (Phase 6 - CTJAnalyzer)
      if (this.ctjAnalyzer) {
        await this.ctjAnalyzer.analyzeEntry(entry.id);
      }

      // React to confirm receipt
      await message.react('✅');

    } catch (error) {
      logger.error('Failed to process CTJ entry', { error: error.message });
    }
  }
}

module.exports = CTJMonitor;

