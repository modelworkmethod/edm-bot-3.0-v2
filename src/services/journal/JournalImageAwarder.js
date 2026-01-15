/**
 * JournalImageAwarder
 * - Awards XP when user posts an image in allowed channels
 * - Sends confirmation message in SAME channel
 * - Uses processedMsgsRepo to prevent duplicates across restarts / multi-instances
 */

const { createLogger } = require('../../utils/logger');
const logger = createLogger('JournalImageAwarder');

class JournalImageAwarder {
  constructor({
    userService,
    processedMsgsRepo = null, // ✅ NEW
    channelId,                // (legacy) single channel
    channelIds = [],          // array
    xpAmount = 100,
    cooldownMs = 24 * 60 * 60 * 1000,
    sendConfirmationMessage = true,
    debug = false,
  }) {
    if (!userService) throw new Error('JournalImageAwarder: userService is required');

    const ids = []
      .concat(channelId ? [String(channelId)] : [])
      .concat(Array.isArray(channelIds) ? channelIds.map(String) : [])
      .map(s => String(s).trim())
      .filter(Boolean);

    if (!ids.length) {
      throw new Error('JournalImageAwarder: channelId/channelIds required');
    }

    this.userService = userService;
    this.processedMsgsRepo = processedMsgsRepo; // ✅ NEW
    this.channelIds = new Set(ids);
    this.xpAmount = Number(xpAmount) || 100;
    this.cooldownMs = Number(cooldownMs) || 0;
    this.sendConfirmationMessage = !!sendConfirmationMessage;
    this.debug = !!debug;

    this.lastAwardAtByUser = new Map(); // userId -> ts
  }

  isAllowedChannel(message) {
    const ch = message?.channel;
    if (!ch) return false;
    return this.channelIds.has(String(ch.id)) || (ch.parentId && this.channelIds.has(String(ch.parentId)));
  }

  hasImage(message) {
    const atts = Array.from(message?.attachments?.values?.() || []);
    const hasAttImage = atts.some(a => {
      const ct = String(a.contentType || '').toLowerCase();
      if (ct.startsWith('image/')) return true;

      const name = String(a.name || '').toLowerCase();
      return (
        name.endsWith('.png') ||
        name.endsWith('.jpg') ||
        name.endsWith('.jpeg') ||
        name.endsWith('.webp') ||
        name.endsWith('.gif')
      );
    });

    if (hasAttImage) return true;

    const embeds = Array.isArray(message?.embeds) ? message.embeds : [];
    const hasEmbedImage = embeds.some(e => {
      const url = e?.image?.url || e?.thumbnail?.url;
      return typeof url === 'string' && url.length > 0;
    });

    return hasEmbedImage;
  }

  canAward(userId) {
    if (!this.cooldownMs || this.cooldownMs <= 0) return true;
    const last = this.lastAwardAtByUser.get(userId);
    if (!last) return true;
    return (Date.now() - last) >= this.cooldownMs;
  }

  markAwarded(userId) {
    this.lastAwardAtByUser.set(userId, Date.now());
  }

  async handleMessage(message) {
    try {
      if (!message?.author || message.author.bot) return;
      if (!message.guild) return;

      if (!this.isAllowedChannel(message)) return;
      if (!this.hasImage(message)) return;

      const userId = message.author.id;

      if (!this.canAward(userId)) {
        if (this.debug) logger.debug('JournalImageAwarder: cooldown active', { userId });
        return;
      }

      // ✅ HARD DEDUPE by message.id (works even with multiple bot instances)
      if (this.processedMsgsRepo?.isProcessed && this.processedMsgsRepo?.markProcessed) {
        const already = await this.processedMsgsRepo.isProcessed(message.id).catch(() => false);
        if (already) {
          if (this.debug) logger.debug('JournalImageAwarder: already processed', { messageId: message.id });
          return;
        }

        // Mark first. If duplicate race happens, DB should reject; then we stop.
        try {
          await this.processedMsgsRepo.markProcessed({
            messageId: message.id,
            userId,
            type: 'journal_image_xp',
          });
        } catch (e) {
          // If another instance already inserted, stop silently
          if (this.debug) logger.debug('JournalImageAwarder: markProcessed failed (likely duplicate)', { error: e?.message });
          return;
        }
      }

      // ensure user exists
      if (this.userService.getOrCreateUser) {
        await this.userService.getOrCreateUser(userId, message.author.username).catch(() => {});
      }

      // Award XP
      const res = await this.userService.updateUserStats(
        userId,
        this.xpAmount,
        {},
        'journal_entry_photo'
      );

      this.markAwarded(userId);

      await message.react('✅').catch(() => {});

      if (this.sendConfirmationMessage) {
        const text = `🏆 Congratulations <@${userId}> — you earned **${this.xpAmount} XP**!`;

        try {
          await message.reply({
            content: text,
            allowedMentions: { users: [userId], roles: [], repliedUser: false },
          });
        } catch (err) {
          await message.channel.send({
            content: text,
            allowedMentions: { users: [userId], roles: [] },
          }).catch(() => {});
          logger.warn('JournalImageAwarder: confirmation failed', { error: err?.message });
        }
      }

      logger.info('Journal photo XP awarded', {
        userId,
        xp: this.xpAmount,
        channelId: message.channel?.id,
        newTotalXp: res?.user?.xp,
      });
    } catch (err) {
      logger.error('JournalImageAwarder.handleMessage failed', { error: err?.message });
    }
  }
}

module.exports = JournalImageAwarder;
