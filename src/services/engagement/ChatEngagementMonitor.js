/**
 * Chat Engagement Monitor
 * Auto-awards XP for text and voice messages in general chat
 */

const { createLogger } = require('../../utils/logger');
const { query, queryRow } = require('../../database/postgres');

const logger = createLogger('ChatEngagementMonitor');

class ChatEngagementMonitor {
  constructor(secondaryXPProcessor) {
    this.secondaryXPProcessor = secondaryXPProcessor;
    this.generalChannelId = process.env.CHANNEL_GENERAL_ID;
    this.minTextLength = 50; // Minimum characters for text XP
    this.cooldownMinutes = 5; // 5 minutes between XP awards per user
    this.lastAwardTimes = new Map(); // userId -> timestamp
  }

  /**
   * Check if message is in general channel
   */
  isGeneralChannel(channelId) {
    return channelId === this.generalChannelId;
  }

  /**
   * Process message for engagement XP
   */
  async processMessage(message) {
    try {
      // Ignore bots
      if (message.author.bot) return;

      // Check cooldown
      if (this.isOnCooldown(message.author.id)) {
        logger.debug('User on cooldown', { userId: message.author.id });
        return;
      }

      const isVoiceNote = message.flags.has('IsVoiceMessage');
      const isLongText = message.content.length >= this.minTextLength;

      if (!isVoiceNote && !isLongText) {
        logger.debug('Message too short and not voice', { 
          userId: message.author.id, 
          length: message.content.length 
        });
        return;
      }

      // Award XP
      const engagementType = isVoiceNote ? 'voiceMessage' : 'textMessage';
      
      if (this.secondaryXPProcessor) {
        const result = await this.secondaryXPProcessor.awardSecondaryXP(
          message.author.id,
          'chatEngagement',
          engagementType,
          { messageId: message.id, length: message.content.length }
        );

        if (result.success) {
          this.setLastAwardTime(message.author.id);
          logger.info('Chat engagement XP awarded', {
            userId: message.author.id,
            type: engagementType,
            xp: result.xp
          });
        }
      }

    } catch (error) {
      logger.error('Failed to process chat engagement', { error: error.message });
    }
  }

  /**
   * Check if user is on cooldown
   */
  isOnCooldown(userId) {
    const lastTime = this.lastAwardTimes.get(userId);
    if (!lastTime) return false;

    const cooldownMs = this.cooldownMinutes * 60 * 1000;
    return (Date.now() - lastTime) < cooldownMs;
  }

  /**
   * Set last award time for user
   */
  setLastAwardTime(userId) {
    this.lastAwardTimes.set(userId, Date.now());
  }

  /**
   * Clear old cooldown entries (run periodically)
   */
  clearOldCooldowns() {
    const cutoff = Date.now() - (this.cooldownMinutes * 60 * 1000 * 2);
    for (const [userId, timestamp] of this.lastAwardTimes.entries()) {
      if (timestamp < cutoff) {
        this.lastAwardTimes.delete(userId);
      }
    }
  }
}

module.exports = ChatEngagementMonitor;

