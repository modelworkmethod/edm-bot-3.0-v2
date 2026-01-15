/**
 * Double XP Event Manager
 * Handles scheduled 2x XP events
 *
 * NEW REQUIREMENTS:
 * - Admin schedules "Fri 10am ET -> Sun 9pm ET"
 * - Announcement at start (Fri 10am ET)
 * - 4-hour notifications through weekend while active
 * - End announcement at Sun 9pm ET
 * - Admin can cancel upcoming/active event
 */

const { createLogger } = require('../../utils/logger');
const { query, queryRow, queryRows } = require('../../database/postgres');
const { EmbedBuilder } = require('discord.js');
const { DateTime } = require('luxon');

const logger = createLogger('DoubleXPManager');

const TZ = 'America/New_York';
const FOUR_HOURS_MIN = 4 * 60;
const START_HOUR = 10; // 10:00 AM ET
const END_HOUR = 21;   // 9:00 PM ET

class DoubleXPManager {
  constructor(channelService) {
    this.channelService = channelService;
  }

  // -------------------------
  // DB helpers
  // -------------------------
  async getEvent(eventId) {
    return await queryRow('SELECT * FROM double_xp_events WHERE id = $1', [eventId]);
  }

  async getActiveEvent() {
    return await queryRow(
      `SELECT * FROM double_xp_events
       WHERE status = 'active'
         AND start_time <= NOW()
         AND end_time > NOW()
       ORDER BY start_time DESC
       LIMIT 1`
    );
  }

  async getUpcomingEvents(limit = 10) {
    return await queryRows(
      `SELECT * FROM double_xp_events
       WHERE status = 'scheduled'
         AND start_time > NOW()
       ORDER BY start_time ASC
       LIMIT $1`,
      [limit]
    );
  }

  async getLatestScheduledOrActiveEvent() {
    return await queryRow(
      `SELECT *
       FROM double_xp_events
       WHERE status IN ('scheduled','active')
       ORDER BY start_time DESC
       LIMIT 1`
    );
  }

  async hasNotification(eventId, notificationType) {
    const row = await queryRow(
      `SELECT 1 FROM double_xp_notifications
       WHERE event_id = $1 AND notification_type = $2
       LIMIT 1`,
      [eventId, notificationType]
    );
    return !!row;
  }

  async recordNotification(eventId, notificationType) {
    try {
      await query(
        `INSERT INTO double_xp_notifications (event_id, notification_type)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [eventId, notificationType]
      );
    } catch (e) {
      // si no existe UNIQUE, no rompemos; en ese caso puede duplicar si corre 2 veces
      logger.warn('Failed to record notification (non-blocking)', {
        eventId,
        notificationType,
        error: e?.message
      });
    }
  }

  // -------------------------
  // Create events
  // -------------------------
  async createEvent(startTime, endTime, multiplier, createdBy) {
    const event = await queryRow(
      `INSERT INTO double_xp_events (start_time, end_time, multiplier, status, created_by)
       VALUES ($1, $2, $3, 'scheduled', $4)
       RETURNING *`,
      [startTime, endTime, multiplier, createdBy]
    );

    logger.info('Double XP event created', {
      eventId: event.id,
      startTime,
      endTime,
      multiplier
    });

    return event;
  }

  /**
   * NEW: Fri 10am ET -> Sun 9pm ET (next occurrence)
   */
  async createFriToSunWeekendEvent(createdBy, multiplier = 2.0) {
    const nowEt = DateTime.now().setZone(TZ);

    // Luxon weekday: Mon=1 ... Sun=7
    const FRIDAY = 5;
    const SUNDAY = 7;

    // Candidate start = this week's Friday 10:00 ET
    let startEt = nowEt.set({ hour: START_HOUR, minute: 0, second: 0, millisecond: 0 });

    // Move to Friday of this week
    const daysUntilFriday = (FRIDAY - nowEt.weekday + 7) % 7;
    startEt = startEt.plus({ days: daysUntilFriday });

    // If it's already past Friday 10am ET (with small grace), schedule next week
    if (nowEt > startEt.plus({ minutes: 5 })) {
      startEt = startEt.plus({ days: 7 });
    }

    // End = Sunday 9pm ET of same weekend
    const endEt = startEt
      .plus({ days: (SUNDAY - FRIDAY) }) // +2 days
      .set({ hour: END_HOUR, minute: 0, second: 0, millisecond: 0 });

    // Store as JS Date (UTC instant)
    const startUtc = startEt.toUTC().toJSDate();
    const endUtc = endEt.toUTC().toJSDate();

    return await this.createEvent(startUtc, endUtc, multiplier, createdBy);
  }

  // -------------------------
  // Announcements
  // -------------------------
  async startEvent(eventId, channelId) {
    await query(`UPDATE double_xp_events SET status = 'active' WHERE id = $1`, [eventId]);
    const event = await this.getEvent(eventId);
    if (!event) return;

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('⚡ DOUBLE XP WEEKEND IS LIVE! ⚡')
      .setDescription([
        `**${event.multiplier}x XP is now active!**`,
        '',
        'Submit your stats and earn **DOUBLE XP** all weekend.',
        '',
        `Ends: <t:${Math.floor(new Date(event.end_time).getTime() / 1000)}:F>`,
        `⏳ Ends: <t:${Math.floor(new Date(event.end_time).getTime() / 1000)}:R>`,
        '',
        'Let’s go. 💪'
      ].join('\n'))
      .setFooter({ text: 'Double XP Weekend' })
      .setTimestamp();

    await this.channelService.sendToChannel(channelId, { embeds: [embed] });

    // mark notification to avoid duplicates
    await this.recordNotification(eventId, 'start');

    logger.info('Double XP event started', { eventId });
  }

  async endEvent(eventId, channelId) {
    await query(`UPDATE double_xp_events SET status = 'completed' WHERE id = $1`, [eventId]);

    const embed = new EmbedBuilder()
      .setColor(0xFF6B6B)
      .setTitle('🏁 DOUBLE XP WEEKEND ENDED')
      .setDescription([
        'XP rates are back to normal.',
        '',
        'Great work this weekend. 🔥'
      ].join('\n'))
      .setFooter({ text: 'See you next time!' })
      .setTimestamp();

    await this.channelService.sendToChannel(channelId, { embeds: [embed] });

    await this.recordNotification(eventId, 'end');

    logger.info('Double XP event ended', { eventId });
  }

  async sendEvery4HoursPing(event, channelId) {
    const eventId = event.id;

    // We dedup per exact scheduled slot in ET, e.g. "4h:2026-01-03T14:00"
    const nowEt = DateTime.now().setZone(TZ);
    const startEt = DateTime.fromJSDate(new Date(event.start_time)).setZone(TZ);
    const endEt = DateTime.fromJSDate(new Date(event.end_time)).setZone(TZ);

    if (nowEt < startEt || nowEt >= endEt) return;

    const minutesSinceStart = Math.floor(nowEt.diff(startEt, 'minutes').minutes);
    if (minutesSinceStart <= 0) return;

    // We want pings every 4 hours aligned to start time.
    const mod = minutesSinceStart % FOUR_HOURS_MIN;

    // Fire window: within first 5 minutes of the slot (because process runs every 5 min)
    if (mod > 5) return;

    const slotIndex = Math.floor(minutesSinceStart / FOUR_HOURS_MIN); // 1,2,3...
    const slotEt = startEt.plus({ minutes: slotIndex * FOUR_HOURS_MIN }).startOf('minute');

    // Do not fire at/after end time; end announcement is separate.
    if (slotEt >= endEt) return;

    const slotKey = `4h:${slotEt.toISO()}`;
    if (await this.hasNotification(eventId, slotKey)) return;

    const endTs = Math.floor(endEt.toSeconds());
    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('⏰ Double XP Weekend Reminder')
      .setDescription([
        `**${event.multiplier}x XP** is still live!`,
        '',
        `Ends: <t:${endTs}:R>`,
        'Keep submitting stats. 💥'
      ].join('\n'))
      .setFooter({ text: 'Every 4 hours' })
      .setTimestamp();

    await this.channelService.sendToChannel(channelId, { embeds: [embed] });
    await this.recordNotification(eventId, slotKey);

    logger.info('4-hour ping sent', { eventId, slot: slotEt.toISO() });
  }

  // -------------------------
  // Cancel
  // -------------------------
  async cancelLatestScheduledOrActiveEvent(cancelledBy, channelId, reason = 'Cancelled by admin') {
    const ev = await this.getLatestScheduledOrActiveEvent();
    if (!ev) return { cancelled: false, message: 'No scheduled/active event found.' };

    if (ev.status === 'completed' || ev.status === 'cancelled') {
      return { cancelled: false, message: `Event is already ${ev.status}.` };
    }

    await query(
      `UPDATE double_xp_events
       SET status = 'cancelled'
       WHERE id = $1`,
      [ev.id]
    );

    // Optional: announce cancellation
    if (channelId) {
      const embed = new EmbedBuilder()
        .setColor(0x999999)
        .setTitle('🛑 Double XP Weekend Cancelled')
        .setDescription([
          `An upcoming/active Double XP weekend has been cancelled.`,
          '',
          `**Reason:** ${reason}`
        ].join('\n'))
        .setFooter({ text: `Cancelled by ${cancelledBy}` })
        .setTimestamp();

      await this.channelService.sendToChannel(channelId, { embeds: [embed] });
    }

    logger.info('Double XP event cancelled', { eventId: ev.id, cancelledBy, reason });
    return { cancelled: true, eventId: ev.id };
  }

  // -------------------------
  // Runtime multiplier
  // -------------------------
  async getCurrentMultiplier() {
    const activeEvent = await this.getActiveEvent();
    return activeEvent ? parseFloat(activeEvent.multiplier) : 1.0;
  }

  // -------------------------
  // Processor (called every 5 min)
  // -------------------------
  async processEventUpdates(channelId) {
    const now = new Date();

    // 1) Start scheduled events
    const toStart = await queryRows(
      `SELECT * FROM double_xp_events
       WHERE status = 'scheduled'
         AND start_time <= $1`,
      [now]
    );

    for (const event of toStart) {
      // dedup start notification
      if (!(await this.hasNotification(event.id, 'start'))) {
        await this.startEvent(event.id, channelId);
      } else {
        // still ensure status flips to active
        await query(`UPDATE double_xp_events SET status = 'active' WHERE id = $1`, [event.id]);
      }
    }

    // 2) End active events
    const toEnd = await queryRows(
      `SELECT * FROM double_xp_events
       WHERE status = 'active'
         AND end_time <= $1`,
      [now]
    );

    for (const event of toEnd) {
      if (!(await this.hasNotification(event.id, 'end'))) {
        await this.endEvent(event.id, channelId);
      } else {
        await query(`UPDATE double_xp_events SET status = 'completed' WHERE id = $1`, [event.id]);
      }
    }

    // 3) 4-hour pings while active
    const active = await this.getActiveEvent();
    if (active) {
      await this.sendEvery4HoursPing(active, channelId);
    }
  }
}

module.exports = DoubleXPManager;
