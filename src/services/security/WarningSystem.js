/**
 * Warning System
 * 3-strike progressive discipline system
 */

const { createLogger } = require('../../utils/logger');
const { query, queryRow, queryRows } = require('../../database/postgres');
const { EmbedBuilder } = require('discord.js');

const logger = createLogger('WarningSystem');

class WarningSystem {
  constructor(channelService) {
    this.channelService = channelService;
    
    // Strike thresholds
    this.STRIKE_ACTIONS = {
      1: { action: 'warning', duration: null },
      2: { action: 'timeout', duration: 86400000 }, // 24 hours
      3: { action: 'ban', duration: null }
    };
  }

  /**
   * Issue warning to user
   */
  async warnUser(userId, warnedBy, reason, severity = 'medium', evidence = {}) {
    try {
      // Record warning
      await query(
        `INSERT INTO user_warnings 
         (user_id, warned_by, reason, severity, evidence_message_id, evidence_channel_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, warnedBy, reason, severity, evidence.messageId || null, evidence.channelId || null]
      );

      // Get total warning count
      const count = await this.getWarningCount(userId);

      logger.warn('User warned', { userId, warnedBy, reason, severity, totalWarnings: count });

      // Take action based on warning count
      await this.enforceStrikeAction(userId, count, reason);

      return {
        success: true,
        warningCount: count,
        actionTaken: this.STRIKE_ACTIONS[count]?.action || 'none'
      };

    } catch (error) {
      logger.error('Failed to warn user', { error: error.message, userId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get warning count for user
   */
  async getWarningCount(userId) {
    const result = await queryRow(
      `SELECT COUNT(*) as count FROM user_warnings 
       WHERE user_id = $1 
       AND created_at > NOW() - INTERVAL '30 days'`,
      [userId]
    );

    return parseInt(result.count) || 0;
  }

  /**
   * Get user warnings
   */
  async getUserWarnings(userId, limit = 10) {
    return await queryRows(
      `SELECT * FROM user_warnings 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );
  }

  /**
   * Enforce strike-based action
   */
  async enforceStrikeAction(userId, strikeCount, reason) {
    const strike = this.STRIKE_ACTIONS[strikeCount];
    if (!strike) return;

    // Gate enforcement with environment variable (safety for dev/staging)
    const enforcementEnabled = process.env.SECOPS_ENFORCE_MODERATION === 'true';

    if (enforcementEnabled) {
      if (strike.action === 'timeout') {
        await this.timeoutUser(userId, reason, strike.duration);
      } else if (strike.action === 'ban') {
        await this.banUser(userId, reason);
      }
    } else {
      logger.warn('Moderation enforcement DISABLED (dev/staging mode)', { 
        userId, 
        strikeCount, 
        wouldHave: strike.action 
      });
    }

    // Send DM to user (always notify, even in dev)
    await this.notifyUser(userId, strikeCount, strike.action, reason);
  }

  /**
   * Timeout user
   */
  async timeoutUser(userId, reason, duration) {
    const expiresAt = new Date(Date.now() + duration);

    await query(
      `INSERT INTO user_moderation 
       (user_id, moderation_type, reason, moderator_id, expires_at, active)
       VALUES ($1, 'timeout', $2, 'system', $3, true)`,
      [userId, reason, expiresAt]
    );

    logger.info('User timed out', { userId, reason, expiresAt });
  }

  /**
   * Ban user
   */
  async banUser(userId, reason) {
    await query(
      `INSERT INTO user_moderation 
       (user_id, moderation_type, reason, moderator_id, active)
       VALUES ($1, 'ban', $2, 'system', true)`,
      [userId, reason]
    );

    logger.info('User banned', { userId, reason });
  }

  /**
   * Notify user of warning/action
   */
  async notifyUser(userId, strikeCount, action, reason) {
    try {
      const enforcementEnabled = process.env.SECOPS_ENFORCE_MODERATION === 'true';
      
      const messages = {
        1: {
          title: '⚠️ Warning - Strike 1/3',
          description: `You have received your first warning.\n\n**Reason:** ${reason}\n\nPlease review our community guidelines. Two more strikes will result in a ban.`
        },
        2: {
          title: `🚨 Strike 2/3${enforcementEnabled ? ' - 24 Hour Timeout' : ' (Dev Mode)'}`,
          description: `You have received your second warning${enforcementEnabled ? ' and a 24-hour timeout' : ''}.\n\n**Reason:** ${reason}\n\n${enforcementEnabled ? 'You will not be able to participate for 24 hours.' : '(In production, you would receive a 24-hour timeout.)'} One more strike will result in a permanent ban.`
        },
        3: {
          title: `🔨 Strike 3/3${enforcementEnabled ? ' - Banned' : ' (Dev Mode)'}`,
          description: `You have${enforcementEnabled ? ' been banned from' : ' received your third strike in'} the community.\n\n**Reason:** ${reason}\n\n${enforcementEnabled ? 'If you believe this is an error, please contact an administrator.' : '(In production, this would be a permanent ban.)'}`
        }
      };

      const msg = messages[strikeCount];
      if (!msg) return;

      const embed = new EmbedBuilder()
        .setColor(strikeCount === 3 ? 0xFF0000 : strikeCount === 2 ? 0xFF6B00 : 0xFFAA00)
        .setTitle(msg.title)
        .setDescription(msg.description)
        .setFooter({ text: 'Embodied Dating Mastermind - Community Guidelines' })
        .setTimestamp();

      await this.channelService.sendDM(userId, { embeds: [embed] });

    } catch (error) {
      // Soft-fail if user has DMs closed
      if (error.code === 50007) {
        logger.warn('Cannot send DM (user has DMs closed)', { userId, strikeCount });
      } else {
        logger.error('Failed to notify user of warning', { error: error.message, userId });
      }
    }
  }

  /**
   * Check if user is currently moderated
   */
  async isUserModerated(userId) {
    const result = await queryRow(
      `SELECT * FROM user_moderation 
       WHERE user_id = $1 
       AND active = true 
       AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [userId]
    );

    return result || null;
  }

  /**
   * Clear expired timeouts
   */
  async clearExpiredTimeouts() {
    const result = await query(
      `UPDATE user_moderation 
       SET active = false 
       WHERE moderation_type = 'timeout' 
       AND active = true 
       AND expires_at < NOW()
       RETURNING user_id`
    );

    const cleared = result.rows.length;
    if (cleared > 0) {
      logger.info('Expired timeouts cleared', { count: cleared });
    }

    return cleared;
  }

  /**
   * Appeal/remove warning (admin only)
   */
  async removeWarning(warningId, adminId) {
    await query(
      `DELETE FROM user_warnings WHERE id = $1`,
      [warningId]
    );

    logger.info('Warning removed', { warningId, adminId });
  }
}

module.exports = WarningSystem;

