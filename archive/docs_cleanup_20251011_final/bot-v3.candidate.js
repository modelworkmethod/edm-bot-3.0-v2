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
const { createLogger } = require('./src/utils/logger');
const { handleError } = require('./src/utils/errorHandler');
const config = require('./src/config/settings');
const { initializePool, closePool } = require('./src/database/postgres');

const logger = createLogger('BotMain');

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
    // Initialize database
    await initializePool(config.database);
    logger.info('✓ Database connected');

    // Initialize repositories
    const repositories = require('./src/database/repositories');
    logger.info('✓ Repositories loaded');

    // Initialize core services
    const { initializeServices: initServices } = require('./src/services');
    services = await initServices(client, config, repositories);
    logger.info('✓ Services initialized');

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

  const events = require('./src/events');

  // Ready event
  client.once('ready', async () => {
    try {
      logger.info(`Bot logged in as ${client.user.tag}`);
      
      // Initialize services
      await initializeServices();

      // Register commands
      const { registerCommands } = require('./src/commands/commandRegistry');
      await registerCommands(client, config);
      logger.info('✓ Commands registered');

      // Start scheduled jobs
      startScheduledJobs();

      // Schedule health checks
      if (services.healthCheck) {
        services.healthCheck.scheduleChecks(5); // Every 5 minutes
      }

      // Schedule auto-backups
      if (services.backupManager) {
        services.backupManager.scheduleAutoBackup();
      }

      logger.info('✅ Bot is fully operational');
      logger.info(`Invite link: https://discord.com/api/oauth2/authorize?client_id=${config.discord.clientId}&permissions=8&scope=bot%20applications.commands`);

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
      if (services?.announcementQueue) {
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

