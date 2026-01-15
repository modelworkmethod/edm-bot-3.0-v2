/**
 * Group Call Tracker
 * Automated scheduling and posting of group call check-in messages
 */

const cron = require('node-cron');
const moment = require('moment-timezone');
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { createLogger } = require('../utils/logger');
const config = require('../config/settings');

const logger = createLogger('GroupCallTracker');

class GroupCallTracker {
  constructor(client, channelService) {
    this.client = client;
    this.channelService = channelService;

    // ✅ Always post in General
    this.generalChannelId = config.channels?.general;

    // ✅ Use server timezone (ET)
    this.timezone = config.advanced?.timezone || 'America/New_York';

    // ✅ Preferred: Legends call schedule channel (clickable mention)
    // Add to settings: config.channels.legendsCallSched OR env LEGENDS_CALL_SCHED_CHANNEL_ID
    this.legendsCallSchedChannelId =
      config.channels?.legendsCallSched ||
      process.env.LEGENDS_CALL_SCHED_CHANNEL_ID ||
      null;

    // Legacy (fallback only)
    this.callScheduleEpicChannelId = config.channels?.callScheduleEpic || null;
    this.callSchedule29ClubChannelId = config.channels?.callSchedule29Club || null;

    // Optional: how long message lives
    this.deleteAfterSeconds = 7200; // 2 hours

    // ✅ prevent duplicate schedules
    this.started = false;
    this.tasks = [];
  }

  /**
   * Start the group call tracker with scheduled jobs
   */
  async start() {
    if (this.started) {
      logger.warn('GroupCallTracker already started — skipping duplicate schedule');
      return;
    }

    logger.info('Starting Group Call Tracker...');

    // ✅ TEST: fire once on boot (then auto-disable)
    // You can also set GROUPCALL_TEST_DAY=Sunday|Wednesday|Saturday|ALL
    if (String(process.env.GROUPCALL_TEST_ON_START || '').toLowerCase() === 'true') {
      setTimeout(() => {
        const day = String(process.env.GROUPCALL_TEST_DAY || 'TEST').trim();
        if (day.toUpperCase() === 'ALL') {
          this.postGroupCallCheckIn('Sunday').catch(() => {});
          this.postGroupCallCheckIn('Wednesday').catch(() => {});
          this.postGroupCallCheckIn('Saturday').catch(() => {});
        } else {
          this.postGroupCallCheckIn(day).catch(() => {});
        }
      }, 3000);
    }

    try {
      /**
       * Client schedule (ET):
       * - Sunday: Dating Strategy & Model Work Call — 8:00 PM ET
       * - Wednesday: Embodiment Call — 7:00 PM ET
       * - Saturday: Social Flow Call — 5:00 PM ET
       *
       * ✅ Post check-in AT the exact start time.
       */

      // Sunday -> 20:00 ET (8pm)
      this.tasks.push(
        cron.schedule('0 20 * * SUN', () => this.postGroupCallCheckIn('Sunday'), {
          timezone: this.timezone,
        })
      );

      // Wednesday -> 19:00 ET (7pm)
      this.tasks.push(
        cron.schedule('0 19 * * WED', () => this.postGroupCallCheckIn('Wednesday'), {
          timezone: this.timezone,
        })
      );

      // Saturday -> 17:00 ET (5pm)
      this.tasks.push(
        cron.schedule('0 17 * * SAT', () => this.postGroupCallCheckIn('Saturday'), {
          timezone: this.timezone,
        })
      );

      this.started = true;

      logger.info('Group Call Tracker schedules set:', {
        timezone: this.timezone,
        sunday: '20:00 ET (Dating Strategy & Model Work)',
        wednesday: '19:00 ET (Embodiment)',
        saturday: '17:00 ET (Social Flow)',
        legendsCallSchedChannelId: this.legendsCallSchedChannelId || null,
      });
    } catch (error) {
      logger.error('Failed to start Group Call Tracker', { error: error.message });
    }
  }

  /**
   * Build clickable call schedule line
   * ✅ Client request: "tell them to check the Legends-Call-Sched channel make it clickable"
   */
  _buildCallScheduleLine() {
    if (this.legendsCallSchedChannelId) {
      return `\n\n📌 Check the call schedule here: <#${this.legendsCallSchedChannelId}>`;
    }

    // fallback to legacy if Legends not configured
    const epicId = this.callScheduleEpicChannelId;
    const clubId = this.callSchedule29ClubChannelId;
    if (!epicId && !clubId) return '';

    const epic = epicId ? `<#${epicId}>` : null;
    const club = clubId ? `<#${clubId}>` : null;

    if (epic && club) return `\n\n📌 Call schedule: ${epic} • ${club}`;
    if (epic) return `\n\n📌 Call schedule: ${epic}`;
    if (club) return `\n\n📌 Call schedule: ${club}`;
    return '';
  }

  /**
   * Call naming + time copy
   */
  _getCallMeta(dayOfWeek) {
    const d = String(dayOfWeek || '').toLowerCase();

    if (d === 'sunday') {
      return { title: 'Dating Strategy & Model Work Call', time: '8:00 PM ET' };
    }
    if (d === 'wednesday') {
      return { title: 'Embodiment Call', time: '7:00 PM ET' };
    }
    if (d === 'saturday') {
      return { title: 'Saturday Social Flow Call', time: '5:00 PM ET' };
    }

    // fallback (TEST / unknown)
    return { title: `${dayOfWeek} Group Call`, time: 'ET' };
  }

  /**
   * Post group call check-in message to general channel
   */
  async postGroupCallCheckIn(dayOfWeek) {
    logger.info(`Attempting to post group call check-in for ${dayOfWeek}.`);

    try {
      const generalChannel = await this.channelService.getChannel(this.generalChannelId);

      if (!generalChannel) {
        logger.error(`General channel not found with ID: ${this.generalChannelId}`);
        return;
      }

      const nowEt = moment().tz(this.timezone).format('YYYY-MM-DD h:mm A z');
      const meta = this._getCallMeta(dayOfWeek);

      const embed = new EmbedBuilder()
        .setTitle('📞 Group Call Check-In')
        .setDescription(
          `**${meta.title}** — **${meta.time}**\n\n` +
          `Did you attend the call?\n` +
          `Click below to record your attendance.` +
          this._buildCallScheduleLine()
        )
        .setColor(0x5865F2)
        .setFooter({ text: `This message will disappear in 2 hours • Posted: ${nowEt}` })
        .setTimestamp();

      const yesButton = new ButtonBuilder()
        .setCustomId('group_call_yes')
        .setLabel('Yes, I attended')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅');

      const noButton = new ButtonBuilder()
        .setCustomId('group_call_no')
        .setLabel('No, I missed it')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌');

      const actionRow = new ActionRowBuilder().addComponents(yesButton, noButton);

      const message = await generalChannel.send({
        embeds: [embed],
        components: [actionRow],
      });

      logger.info(`Posted group call check-in message to #${generalChannel.name}`, {
        messageId: message.id,
        dayOfWeek,
      });

      setTimeout(async () => {
        try {
          await message.delete();
          logger.info(`Deleted group call check-in message`, { messageId: message.id });
        } catch (deleteError) {
          logger.warn(`Failed to delete group call check-in message`, {
            messageId: message.id,
            error: deleteError.message,
          });
        }
      }, this.deleteAfterSeconds * 1000);
    } catch (error) {
      logger.error('Failed to post group call check-in message', {
        error: error.message,
        dayOfWeek,
      });
    }
  }

  /**
   * Stop the group call tracker
   */
  stop() {
    logger.info('Stopping Group Call Tracker...');

    try {
      for (const t of this.tasks) {
        try {
          t.stop?.();
          t.destroy?.();
        } catch {}
      }
    } finally {
      this.tasks = [];
      this.started = false;
    }
  }
}

module.exports = GroupCallTracker;
