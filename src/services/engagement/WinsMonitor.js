/**
 * Wins Monitor
 * Auto-awards XP for sharing wins in designated channel
 */

const { createLogger } = require('../../utils/logger');

const logger = createLogger('WinsMonitor');

class WinsMonitor {
  constructor(secondaryXPProcessor, channelService) {
    this.secondaryXPProcessor = secondaryXPProcessor;
    this.channelService = channelService;
    this.winsChannelId = process.env.WINS_CHANNEL_ID || process.env.CHANNEL_GENERAL_ID;
    this.lastWinTimes = new Map(); // userId -> timestamp
    this.cooldownHours = 1; // 1 hour between win XP awards
  }

  /**
   * Check if message is in wins channel
   */
  isWinsChannel(channelId) {
    return channelId === this.winsChannelId;
  }

  /**
   * Handle message in wins channel
   */
  async handleMessage(message) {
    try {
      // Only process if in wins channel
      if (!this.isWinsChannel(message.channel.id)) {
        return;
      }

      // Ignore bots
      if (message.author.bot) return;

      // Check cooldown
      if (this.isOnCooldown(message.author.id)) {
        logger.debug('Win post on cooldown', { userId: message.author.id });
        return;
      }

      // Must have text content (no image-only posts)
      if (!message.content || message.content.length < 20) {
        return;
      }

      // Award XP for sharing win
      if (this.secondaryXPProcessor) {
        const result = await this.secondaryXPProcessor.awardSecondaryXP(
          message.author.id,
          'wins',
          'shareWin',
          { messageId: message.id, length: message.content.length }
        );

        if (result.success) {
          this.setLastWinTime(message.author.id);
          
          // React to the win post
          await message.react('🔥');
          
          logger.info('Win XP awarded', {
            userId: message.author.id,
            xp: result.xp
          });
        }
      }

    } catch (error) {
      logger.error('Failed to process win post', { error: error.message });
    }
  }

  /**
   * Check if user is on cooldown
   */
  isOnCooldown(userId) {
    const lastTime = this.lastWinTimes.get(userId);
    if (!lastTime) return false;

    const cooldownMs = this.cooldownHours * 60 * 60 * 1000;
    return (Date.now() - lastTime) < cooldownMs;
  }

  /**
   * Set last win time
   */
  setLastWinTime(userId) {
    this.lastWinTimes.set(userId, Date.now());
  }

  /**
   * Clear old cooldown entries
   */
  clearOldCooldowns() {
    const cutoff = Date.now() - (this.cooldownHours * 60 * 60 * 1000 * 2);
    for (const [userId, timestamp] of this.lastWinTimes.entries()) {
      if (timestamp < cutoff) {
        this.lastWinTimes.delete(userId);
      }
    }
  }
}

module.exports = WinsMonitor;

