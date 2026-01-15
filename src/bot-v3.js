/**
 * Embodied Dating Mastermind Bot v3
 * Main entry point
 *
 * This bot includes:
 * - XP and leveling system
 * - Archetype system (Warrior/Mage/Templar)
 * - Stats tracking with multipliers
 * - Boss raids
 * - Barbie list (contact manager)
 * - Texting simulator
 * - Dueling system
 * - Double XP events
 * - CTJ analysis with breakthrough detection
 * - Course hosting system (7 modules)
 * - Chat engagement & wins auto-XP
 * - Security & moderation system
 * - Predictive coaching analytics
 * - Admin commands and coaching dashboard
 */

require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { createLogger } = require('./utils/logger');
const { handleError } = require('./utils/errorHandler');
const config = require('./config/settings');
const { initializePool, closePool } = require('./database/postgres');

const logger = createLogger('BotMain');

// ✅ Main bot JobScheduler (static cards, etc.)
const JobScheduler = require('./jobs/JobScheduler');

// ✅ Monthly calls reminders (Jules/Saks)
const { startMonthlyCallsScheduler } = require('./services/reminders/MonthlyCallsScheduler');


// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [
    Partials.Channel,
    Partials.Message
  ]
});

// Service instances (initialized in ready event)
let services = null;

/**
 * Initialize all services
 */
async function initializeServices() {
  logger.info('Initializing services...');

  try {
    // 1) Initialize database pool
    await initializePool(config.database);
    logger.info('✓ Database connected');

    // 2) Initialize repositories (instances, not just the module)
    const repoModule = require('./database/repositories');

    if (typeof repoModule.initializeRepositories === 'function') {
      repoModule.initializeRepositories();
    }

    const repositories = typeof repoModule.getRepositories === 'function'
      ? repoModule.getRepositories()
      : repoModule;

    logger.info('✓ Repositories loaded');

    // 3) Load services module (can be a function OR an object with .initializeServices)
    const servicesModule = require('./services');

    logger.info('Services module loaded', {
      type: typeof servicesModule,
      keys: servicesModule && typeof servicesModule === 'object'
        ? Object.keys(servicesModule)
        : null
    });

    let initFn = null;

    // Case A: module.exports = async function (…) { … }
    if (typeof servicesModule === 'function') {
      initFn = servicesModule;
    }
    // Case B: module.exports = { initializeServices: async (…) => { … }, … }
    else if (servicesModule && typeof servicesModule.initializeServices === 'function') {
      initFn = servicesModule.initializeServices;
    }

    if (!initFn) {
      throw new Error('services.initializeServices is not a function or default export');
    }

    // 4) Call the initializer
    services = await initFn(client, config, repositories);
    logger.info('✓ Services initialized');

    // Store on client so other modules (events, handlers) can use it
    client.services = services;

    // ✅ Wingman weekly scheduler (Sundays 5pm ET)
    try {
      const { startWingmanWeeklyScheduler } = require('./services/wingman/WingmanWeeklyScheduler');
      startWingmanWeeklyScheduler(client, services);
      logger.info('✓ WingmanWeeklyScheduler started');
    } catch (e) {
      logger.warn('WingmanWeeklyScheduler failed to start', { error: e?.message });
    }

    // ✅ Monthly calls reminders (Option A: General channel)
    try {

      logger.info('✓ MonthlyCallsScheduler started (General channel)');
    } catch (e) {
      logger.warn('MonthlyCallsScheduler failed to start', { error: e?.message });
    }

    return services;

  } catch (error) {
    logger.error('Failed to initialize services', { error: error.message });
    throw error;
  }
}

/**
 * Register event handlers
 */
function registerEventHandlers() {
  logger.info('Registering event handlers...');

  const events = require('./events');

  // ✅ helper: resolve general channel id once
  const resolveGeneralChannelId = () => {
    return (
      process.env.GENERAL_CHANNEL_ID ||
      process.env.CHANNEL_GENERAL_ID ||
      config.channels?.general ||
      config.channels?.generalId ||
      config.channels?.generalChannelId ||
      null
    );
  };

  // ✅ Single ready event (ONLY ONE)
  client.once('ready', async () => {
    try {
      logger.info(`Bot logged in as ${client.user.tag}`);

      // Initialize services (DB, repos, business services)
      await initializeServices();

      // ✅ FIX: Inject Discord client into UserService so level-up announcements can post
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

      // Register commands
      const { registerCommands } = require('./commands/commandRegistry');
      await registerCommands(client, config);
      logger.info('✓ Commands registered');

      // ✅ Resolve General channel ONCE
      const generalChannelId = resolveGeneralChannelId();

      if (!generalChannelId) {
        logger.warn('⚠️ GENERAL channel id not configured. Set GENERAL_CHANNEL_ID in .env');
      } else {
        logger.info('✓ General channel resolved', { generalChannelId });

        // ✅ Optional: ensure process.env has it so other modules read consistently
        if (!process.env.GENERAL_CHANNEL_ID) {
          process.env.GENERAL_CHANNEL_ID = String(generalChannelId);
        }
      }

      // ✅ Monthly Calls reminders (Jules/Saks) — post in General
      try {
        if (!generalChannelId) throw new Error('GENERAL channel id not set');

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

      // ✅ Nightly reminder at 10pm ET in General
      try {
        const { startNightlyStatsReminder } = require('./services/reminders/NightlyStatsReminder');

        if (!generalChannelId) throw new Error('GENERAL channel id not set');

        startNightlyStatsReminder(client, {
          channelId: generalChannelId,
        });

        logger.info('✓ NightlyStatsReminder started', { channelId: generalChannelId });
      } catch (e) {
        logger.warn('NightlyStatsReminder failed to start', { error: e?.message });
      }

      // ✅ Run static cards / persistent UI jobs (Barbie static menu, etc.)
      try {
        await JobScheduler.start(client);
        logger.info('✓ JobScheduler started');
      } catch (e) {
        logger.warn('JobScheduler.start failed', { error: e?.message });
      }

      // Start scheduled jobs (your existing internal intervals)
      startScheduledJobs();

      // Schedule health checks
      if (services?.healthCheck) {
        services.healthCheck.scheduleChecks(5); // Every 5 minutes
      }

      // Schedule auto-backups
      if (services?.backupManager) {
        services.backupManager.scheduleAutoBackup();
      }

      logger.info('✅ Bot is fully operational');
      logger.info(
        `Invite link: https://discord.com/api/oauth2/authorize?client_id=${config.discord.clientId}&permissions=8&scope=bot%20applications.commands`
      );

    } catch (error) {
      handleError(error, 'ReadyEvent');
      logger.error('Failed to start bot. Exiting...');
      process.exit(1);
    }
  });

  // Interaction create (commands, buttons, modals)
  client.on('interactionCreate', async (interaction) => {
    try {
      if (!services) {
        logger.warn('Interaction received before services initialized');
        return;
      }

      await events.handleInteractionCreate(interaction, services);
    } catch (error) {
      handleError(error, 'InteractionCreate');
    }
  });

  // Message create (CTJ monitoring, chat engagement, wins, moderation)
  client.on('messageCreate', async (message) => {
    try {
      if (!services) return;
      await events.handleMessageCreate(message, services);
    } catch (error) {
      handleError(error, 'MessageCreate');
    }
  });

  // Guild member add (welcome new members)
  client.on('guildMemberAdd', async (member) => {
    try {
      if (!services) return;
      await events.handleGuildMemberAdd(member, services);
    } catch (error) {
      handleError(error, 'GuildMemberAdd');
    }
  });

  logger.info('✓ Event handlers registered');
}


/**
 * Start scheduled background jobs
 */
function startScheduledJobs() {
  logger.info('Starting scheduled jobs...');

  // Announcement queue processor (every 30 seconds)
  setInterval(async () => {
    try {
      if (services?.announcementQueue && typeof services.announcementQueue.processQueue === 'function') {
        await services.announcementQueue.processQueue();
      }
    } catch (error) {
      logger.error('Announcement queue error', { error: error.message });
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
        logger.error('Reminder check failed', { error: error.message });
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
      logger.error('Double XP event processor error', { error: error.message });
    }
  }, 300000);

  // Duel finalization check (every 5 minutes)
  setInterval(async () => {
    try {
      if (services?.duelManager) {
        await services.duelManager.checkExpiredDuels(config.discord.announcementsChannelId);
      }
    } catch (error) {
      logger.error('Duel finalization error', { error: error.message });
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
      logger.error('Cooldown cleanup error', { error: error.message });
    }
  }, 1800000);

  // Clear expired timeouts (every 10 minutes)
  setInterval(async () => {
    try {
      if (services?.warningSystem) {
        await services.warningSystem.clearExpiredTimeouts();
      }
    } catch (error) {
      logger.error('Timeout cleanup error', { error: error.message });
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
        logger.error('Daily analytics failed', { error: error.message });
      }
    }
  };

  setInterval(runDailyAnalytics, 3600000); // Check every hour

  logger.info('✓ Scheduled jobs started');
}

/**
 * Graceful shutdown
 */
async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    // ✅ Stop main bot jobs
    try {
      await JobScheduler.stop();
      logger.info('✓ JobScheduler stopped');
    } catch (e) {
      logger.warn('JobScheduler.stop failed', { error: e?.message });
    }

    // Close database connection
    await closePool();
    logger.info('✓ Database closed');

    // Destroy Discord client
    client.destroy();
    logger.info('✓ Discord client destroyed');

    logger.info('✅ Shutdown complete');
    process.exit(0);

  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Unhandled errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
});

// Start bot
logger.info('Starting Embodied Dating Mastermind Bot v3...');
logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

registerEventHandlers();

client.login(config.discord.token)
  .then(() => logger.info('Bot login initiated...'))
  .catch((error) => {
    logger.error('Failed to login', { error: error.message });
    process.exit(1);
  });
