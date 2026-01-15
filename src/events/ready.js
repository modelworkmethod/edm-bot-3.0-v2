/**
 * Ready Event
 * Fires when bot successfully connects to Discord
 */

const { ActivityType } = require('discord.js');
const path = require('path');
const { createLogger } = require('../utils/logger');
const { initializeRepositories } = require('../database/repositories');
const { initializeServices } = require('../services');
const { getCommands } = require('../commands');
const { CommandRegistry, registerCommands } = require('../commands/commandRegistry');

const config = require('../config/settings');

// ✅ Weekly "days out" hype scheduler + preview
const {
  startGroupCallHypeScheduler,
  previewGroupCallHype,
} = require('../jobs/groupCallHypeScheduler');

// ✅ Daily reminders (9am, 3pm, 8pm ET)
const { startWeeklyCallDailyReminders } = require('../jobs/weeklyCallDailyReminders');

const logger = createLogger('ReadyEvent');

module.exports = {
  name: 'ready',
  once: true,

  /**
   * Execute ready event
   */
  async execute(client) {
    try {
      logger.info(`Bot logged in as ${client.user.tag}`);
      logger.info(`Serving ${client.guilds.cache.size} guild(s)`);
      logger.info(`Watching ${client.users.cache.size} users`);

      // Initialize repositories
      initializeRepositories();
      logger.info('Repositories initialized');

      // Initialize services
      const services = await initializeServices(client);
      logger.info('Services initialized');

      // Store services on client for access in commands
      client.services = services;

      // Load commands map for runtime dispatch
      client.commands = getCommands();
      logger.info(`${client.commands.size} commands loaded`);

      // Register commands with Discord
      const registry = new CommandRegistry(client);
      await registry.registerAll();

      // Set bot presence
      client.user.setPresence({
        activities: [{ name: 'your daily progress', type: ActivityType.Watching }],
        status: 'online',
      });

      // Ensure faction role colors are set (Factions Redesign)
      if (services.roleSync) {
        const guild = client.guilds.cache.first();
        if (guild) {
          await services.roleSync.ensureFactionRoleColors(guild);
        }
      }

      // Start scheduled jobs
      const { scheduleDuelsFinalizer } = require('../jobs/duelsFinalizer');
      scheduleDuelsFinalizer(client, services);

      // Start wingman matcher scheduler
      const { scheduleWingmanMatcher } = require('../jobs/wingmanScheduler');
      scheduleWingmanMatcher(client, services);

      // Start group call tracker (check-in at start time)
      const GroupCallTracker = require('../jobs/groupCallTracker');
      const groupCallTracker = new GroupCallTracker(client, services.channelService);
      await groupCallTracker.start();

      // ─────────────────────────────────────────────────────────────
      // ✅ CHANNEL RESOLUTION (single source of truth)
      // ─────────────────────────────────────────────────────────────
      const legendsCallSchedChannelId =
        process.env.LEGENDS_CALL_SCHED_CHANNEL_ID || '1455693612699619370';

      // Where ALL reminders + previews should post
      const remindersChannelId =
        process.env.CALL_REMINDERS_CHANNEL_ID ||
        process.env.GENERAL_CHANNEL_ID ||
        config?.channels?.general;

      if (!remindersChannelId) {
        logger.warn(
          'No reminders channel found. Set CALL_REMINDERS_CHANNEL_ID (recommended) or GENERAL_CHANNEL_ID or config.channels.general'
        );
      }

      // ─────────────────────────────────────────────────────────────
      // ✅ DAILY REMINDERS (every day: 9am / 3pm / 8pm ET)
      // ─────────────────────────────────────────────────────────────
      if (!remindersChannelId) {
        logger.warn(
          'WeeklyCallDailyReminders NOT started (missing channelId). Set CALL_REMINDERS_CHANNEL_ID.'
        );
      } else {
        startWeeklyCallDailyReminders(client, {
          channelId: remindersChannelId,
          legendsCallSchedChannelId,
        });

        logger.info('WeeklyCallDailyReminders started', {
          channelId: remindersChannelId,
          legendsCallSchedChannelId,
        });
      }

      // ─────────────────────────────────────────────────────────────
      // ✅ HYPE SCHEDULER (days-out)
      // ─────────────────────────────────────────────────────────────
      if (!remindersChannelId) {
        logger.warn(
          'GroupCallHypeScheduler NOT started (missing channelId). Set CALL_REMINDERS_CHANNEL_ID.'
        );
      } else {
        startGroupCallHypeScheduler(client, { channelId: remindersChannelId });
        logger.info('GroupCallHypeScheduler started', { channelId: remindersChannelId });
      }

      // ─────────────────────────────────────────────────────────────
      // 🔥 TEMP TEST — manual fire on startup (single TEST check-in)
      // env: GROUPCALL_FORCE_POST=true
      // ─────────────────────────────────────────────────────────────
      if (String(process.env.GROUPCALL_FORCE_POST || '').toLowerCase() === 'true') {
        setTimeout(async () => {
          try {
            await groupCallTracker.postGroupCallCheckIn('TEST');
            logger.info('✅ GroupCall TEST check-in sent');
          } catch (e) {
            logger.error('GroupCall TEST failed', { error: e?.message, stack: e?.stack });
          }
        }, 5000);
      }

      // ─────────────────────────────────────────────────────────────
      // 🧪 PREVIEW — Group Calls check-ins (3 messages)
      // env: GROUPCALL_PREVIEW=true
      // ─────────────────────────────────────────────────────────────
      if (String(process.env.GROUPCALL_PREVIEW || '').toLowerCase() === 'true') {
        logger.warn('⚠️ GROUPCALL_PREVIEW ENABLED — sending preview check-in messages');

        setTimeout(async () => {
          try {
            await groupCallTracker.postGroupCallCheckIn('Sunday');
            await groupCallTracker.postGroupCallCheckIn('Wednesday');
            await groupCallTracker.postGroupCallCheckIn('Saturday');
            logger.info('✅ Group Call PREVIEW check-ins sent');
          } catch (e) {
            logger.error('Group Call PREVIEW failed', { error: e?.message, stack: e?.stack });
          }
        }, 5000);
      }

      // ─────────────────────────────────────────────────────────────
      // 🧪 PREVIEW — Hype cards (client demo)
      // env: GROUPCALL_HYPE_PREVIEW=true
      // ─────────────────────────────────────────────────────────────
      if (String(process.env.GROUPCALL_HYPE_PREVIEW || '').toLowerCase() === 'true') {
        logger.warn('⚠️ GROUPCALL_HYPE_PREVIEW ENABLED — sending hype preview cards');

        setTimeout(async () => {
          try {
            if (!remindersChannelId) {
              logger.warn(
                'Hype PREVIEW skipped (missing remindersChannelId). Set CALL_REMINDERS_CHANNEL_ID.'
              );
              return;
            }

            await previewGroupCallHype(client, {
              channelId: remindersChannelId,
              legendsCallSchedChannelId,
            });

            logger.info('✅ Group Call Hype PREVIEW sent', { channelId: remindersChannelId });
          } catch (e) {
            logger.error('Group Call Hype PREVIEW failed', { error: e?.message, stack: e?.stack });
          }
        }, 4000);
      }

      // Start nickname refresh scheduler
      const { scheduleNicknameRefresh } = require('../jobs/nicknameRefresh');
      scheduleNicknameRefresh(client, services);

      logger.info('Scheduled jobs started');
      logger.info('Bot is ready and operational');
    } catch (error) {
      logger.error('Error during ready event', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }

    await registerCommands(client, path.join(__dirname, '..', 'commands'));
  },
};
