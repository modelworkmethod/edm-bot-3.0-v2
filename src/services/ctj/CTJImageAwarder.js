/**
 * CTJ Image Awarder
 * Flow:
 * 1) After user submits /journal modal, we "expect" an image in the same channel for X minutes.
 * 2) When user posts an image attachment, we award 1 CTJ stat + XP (once per day).
 */

const { createLogger } = require('../../utils/logger');
const { getLocalDayString } = require('../../utils/timeUtils');
const { queryRow, query } = require('../../database/postgres');

const logger = createLogger('CTJImageAwarder');

// How long after modal submit we accept an image (minutes)
const DEFAULT_WINDOW_MINUTES = 15;

function isImageAttachment(att) {
  if (!att) return false;
  const ct = (att.contentType || '').toLowerCase();
  if (ct.startsWith('image/')) return true;

  const name = (att.name || '').toLowerCase();
  return (
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.gif') ||
    name.endsWith('.webp')
  );
}

class CTJImageAwarder {
  constructor({ statsProcessor, tz = null } = {}) {
    this.statsProcessor = statsProcessor; // instance of StatsProcessor (services.statsProcessor)
    this.tz = tz;
    this.pending = new Map();
    // pending key: userId -> { channelId, expiresAtMs }
  }

  /**
   * Call this after CTJ modal submission is successfully saved.
   */
  expectImage(userId, channelId, windowMinutes = DEFAULT_WINDOW_MINUTES) {
    if (!userId || !channelId) return;
    const expiresAtMs = Date.now() + windowMinutes * 60 * 1000;
    this.pending.set(userId, { channelId, expiresAtMs });

    logger.info('CTJ image expected', { userId, channelId, windowMinutes });
  }

  clear(userId) {
    this.pending.delete(userId);
  }

  _isPending(userId, channelId) {
    const p = this.pending.get(userId);
    if (!p) return false;
    if (p.channelId !== channelId) return false;
    if (Date.now() > p.expiresAtMs) {
      this.pending.delete(userId);
      return false;
    }
    return true;
  }

  /**
   * Call from messageCreate
   */
  async handleMessage(message) {
    try {
      if (!message || message.author?.bot) return;

      const userId = message.author.id;
      const channelId = message.channelId;

      // Only if we're expecting an image from this user in this channel
      if (!this._isPending(userId, channelId)) return;

      const attachments = Array.from(message.attachments?.values?.() || []);
      const img = attachments.find(isImageAttachment);
      if (!img) return;

      // We got the image → stop pending
      this.pending.delete(userId);

      // ✅ Dedup by day in DB
      const day = getLocalDayString();

      // If you haven't created ctj_image_awards yet, this will fail.
      // We'll catch and fallback to memory-only.
      let inserted = false;

      try {
        const row = await queryRow(
          `
          INSERT INTO ctj_image_awards (user_id, day, message_id, channel_id)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id, day) DO NOTHING
          RETURNING user_id
          `,
          [userId, day, message.id, channelId]
        );

        inserted = !!row;
      } catch (e) {
        logger.warn('CTJImageAwarder: ctj_image_awards insert failed (DB dedupe not available)', {
          error: e?.message,
        });
        // Fallback: no DB dedupe → award anyway (or you can choose to return).
        inserted = true;
      }

      if (!inserted) {
        logger.info('CTJImageAwarder: already awarded today, skipping', { userId, day });
        return;
      }

      // ✅ Award CTJ stat using StatsProcessor (updates user_stats + user_daily + XP)
      if (!this.statsProcessor || typeof this.statsProcessor.processSubmission !== 'function') {
        logger.warn('CTJImageAwarder: statsProcessor not available, cannot award', { userId });
        return;
      }

      const result = await this.statsProcessor.processSubmission(
        userId,
        { 'Confidence Tension Journal Entry': 1 },
        day,
        { source: 'ctj_image', username: message.author.username || null }
      );

      if (!result?.success) {
        logger.warn('CTJImageAwarder: award failed', { userId, error: result?.error });
        return;
      }

      // Optional: react to the image message as confirmation (non-spammy)
      try {
        await message.react('✅');
      } catch {}

      logger.info('CTJImageAwarder: CTJ image awarded', {
        userId,
        day,
        xpAwarded: result?.xpAwarded || 0,
      });
    } catch (e) {
      logger.error('CTJImageAwarder: handleMessage failed', { error: e?.message || String(e) });
    }
  }
}

module.exports = CTJImageAwarder;
