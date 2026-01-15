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
const { initializePool } = require('../database/postgres');
const { startMonthlyCallsScheduler } = require('../services/reminders/MonthlyCallsScheduler');
const { startNightlyStatsReminder } = require('../services/reminders/NightlyStatsReminder');
const JobScheduler = require('../jobs/JobScheduler');
const { getGeneralChannelId } = require('../config/environment');
const { handleError } = require('../utils/errorHandler');

const config = require('../config/settings');

// ✅ Weekly "days out" hype scheduler + preview
const {
  startGroupCallHypeScheduler,
  previewGroupCallHype,
} = require('../jobs/groupCallHypeScheduler');

// ✅ Daily reminders (9am, 3pm, 8pm ET)
const { startWeeklyCallDailyReminders } = require('../jobs/weeklyCallDailyReminders');

const logger = createLogger('ReadyEvent');

/**
 * Start scheduled background jobs
 * @param {object} services - Services object
 * @param {object} config - Configuration object
 */
function startScheduledJobs(services, config) {
  logger.info('Starting scheduled jobs...');

  // Announcement queue processor (every 30 seconds)
  setInterval(async () => {
    try {
      if (services?.announcementQueue && typeof services.announcementQueue.processQueue === 'function') {
        await services.announcementQueue.processQueue();
      }
    } catch (error) {
      handleError(error, 'ScheduledJob.AnnouncementQueue');
    }
  }, 30000);

  // Daily reminder check (every hour, triggers at 5pm EST)
  const checkReminders = async () => {
    const now = new Date();
    const hour = now.getHours();

    // Run at 5pm EST (17:00)
    if (hour === 17 && services?.reminderService) {
      try {
        logger.info('Running daily reminder check...');
        await services.reminderService.checkAndSendReminders();
      } catch (error) {
        handleError(error, 'ScheduledJob.DailyReminder');
      }
    }
  };

  setInterval(checkReminders, 3600000); // Check every hour

  // Double XP event processor (every 5 minutes)
  setInterval(async () => {
    try {
      if (services?.doubleXPManager) {
        await services.doubleXPManager.processEventUpdates(config.discord.announcementsChannelId);
      }
    } catch (error) {
      handleError(error, 'ScheduledJob.DoubleXPProcessor');
    }
  }, 300000);

  // Duel finalization check (every 5 minutes)
  setInterval(async () => {
    try {
      if (services?.duelManager) {
        await services.duelManager.checkExpiredDuels(config.discord.announcementsChannelId);
      }
    } catch (error) {
      handleError(error, 'ScheduledJob.DuelFinalization');
    }
  }, 300000);

  // Clean engagement monitor cooldowns (every 30 minutes)
  setInterval(() => {
    try {
      if (services?.chatEngagementMonitor) {
        services.chatEngagementMonitor.clearOldCooldowns();
      }
      if (services?.winsMonitor) {
        services.winsMonitor.clearOldCooldowns();
      }
    } catch (error) {
      handleError(error, 'ScheduledJob.CooldownCleanup');
    }
  }, 1800000);

  // Clear expired timeouts (every 10 minutes)
  setInterval(async () => {
    try {
      if (services?.warningSystem) {
        await services.warningSystem.clearExpiredTimeouts();
      }
    } catch (error) {
      handleError(error, 'ScheduledJob.TimeoutCleanup');
    }
  }, 600000);

  // Daily analytics calculation (every hour, triggers at 2 AM)
  const runDailyAnalytics = async () => {
    const now = new Date();
    const hour = now.getHours();

    if (hour === 2 && services?.riskScorer) {
      try {
        logger.info('Running daily analytics...');

        // Calculate risk scores for all users
        await services.riskScorer.calculateAllUsers();

        // Generate interventions for at-risk users
        const atRisk = await services.riskScorer.getAtRiskUsers(60, 30);

        for (const user of atRisk) {
          const pattern = await services.patternDetector.detectPattern(user.user_id);
          await services.interventionGenerator.generateIntervention(
            user.user_id,
            user.risk_score,
            pattern
          );
        }

        logger.info('Daily analytics complete', { atRiskCount: atRisk.length });

      } catch (error) {
        handleError(error, 'ScheduledJob.DailyAnalytics');
      }
    }
  };

  setInterval(runDailyAnalytics, 3600000); // Check every hour

  logger.info('✓ Scheduled jobs started');
}

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

      // 1) Initialize database pool (must happen before repositories)
      await initializePool(config.database);
      logger.info('✓ Database connected');

      // 2) Initialize repositories
      initializeRepositories();
      logger.info('✓ Repositories initialized');

      // 3) Initialize services
      const services = await initializeServices(client, config, require('../database/repositories').getRepositories());
      logger.info('✓ Services initialized');

      // 4) Store services on client for access in commands
      client.services = services;

      // 5) Inject Discord client into UserService for level-up announcements
      try {
        if (services?.userService && typeof services.userService.setDiscordClient === 'function') {
          services.userService.setDiscordClient(client);
          logger.info('✓ UserService Discord client injected (level-up announcements enabled)');
        } else {
          logger.warn('⚠️ services.userService.setDiscordClient missing — level-up announcements will not work');
        }
      } catch (e) {
        logger.warn('UserService.setDiscordClient failed (non-fatal)', { error: e?.message });
      }

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

      // ─────────────────────────────────────────────────────────────
      // ✅ CHANNEL RESOLUTION (single source of truth)
      // ─────────────────────────────────────────────────────────────
      const generalChannelId = getGeneralChannelId() || config.channels?.general || null;

      if (!generalChannelId) {
        logger.warn('⚠️ GENERAL channel id not configured. Set GENERAL_CHANNEL_ID or CHANNEL_GENERAL_ID in .env');
      } else {
        logger.info('✓ General channel resolved', { generalChannelId });
      }

      // ─────────────────────────────────────────────────────────────
      // ✅ MONTHLY CALLS REMINDERS (Jules/Saks) — post in General
      // ─────────────────────────────────────────────────────────────
      if (generalChannelId) {
        try {
          startMonthlyCallsScheduler(client, {
            channelId: generalChannelId,
            julesZoomUrl: process.env.JULES_ZOOM_URL || null,
            saksZoomUrl: process.env.SAKS_ZOOM_URL || null,
            zoomPlaceholder: '🔗 (Zoom link TBD)',
            durationMinutesJules: 90,
            durationMinutesSaks: 90,
          });
          logger.info('✓ MonthlyCallsScheduler started', { channelId: generalChannelId });
        } catch (e) {
          logger.warn('MonthlyCallsScheduler failed to start', { error: e?.message });
        }
      } else {
        logger.warn('MonthlyCallsScheduler NOT started (missing channelId). Set GENERAL_CHANNEL_ID.');
      }

      // ─────────────────────────────────────────────────────────────
      // ✅ NIGHTLY REMINDER at 10pm ET in General
      // ─────────────────────────────────────────────────────────────
      if (generalChannelId) {
        try {
          startNightlyStatsReminder(client, {
            channelId: generalChannelId,
          });
          logger.info('✓ NightlyStatsReminder started', { channelId: generalChannelId });
        } catch (e) {
          logger.warn('NightlyStatsReminder failed to start', { error: e?.message });
        }
      } else {
        logger.warn('NightlyStatsReminder NOT started (missing channelId). Set GENERAL_CHANNEL_ID.');
      }

      // ─────────────────────────────────────────────────────────────
      // ✅ STATIC CARDS / PERSISTENT UI JOBS (Barbie static menu, etc.)
      // ─────────────────────────────────────────────────────────────
      try {
        await JobScheduler.start(client);
        logger.info('✓ JobScheduler started');
      } catch (e) {
        logger.warn('JobScheduler.start failed', { error: e?.message });
      }

      // ─────────────────────────────────────────────────────────────
      // ✅ SCHEDULED BACKGROUND JOBS
      // ─────────────────────────────────────────────────────────────
      startScheduledJobs(services, config);

      // ─────────────────────────────────────────────────────────────
      // ✅ HEALTH CHECKS & BACKUPS
      // ─────────────────────────────────────────────────────────────
      if (services?.healthCheck) {
        services.healthCheck.scheduleChecks(5); // Every 5 minutes
        logger.info('✓ Health checks scheduled');
      }

      if (services?.backupManager) {
        services.backupManager.scheduleAutoBackup();
        logger.info('✓ Auto-backup scheduled');
      }

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
