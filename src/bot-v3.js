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

// JobScheduler is still needed for shutdown, but initialization is in ready.js
const JobScheduler = require('./jobs/JobScheduler');


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

// Service instances (initialized in ready event via ready.js)
// No longer initialized here - moved to src/events/ready.js to avoid duplication

/**
 * Register event handlers
 */
function registerEventHandlers() {
  logger.info('Registering event handlers...');

  const events = require('./events');
  
  // Register ready event handler (handles all initialization)
  // This is the single source of truth for initialization
  const ready = require('./events/ready');
  if (ready && ready.once && ready.execute) {
    client.once(ready.name, (...args) => ready.execute(...args));
    logger.info('✓ Ready event registered');
  }

  // Interaction create (commands, buttons, modals) - wrapped with service check
  client.on('interactionCreate', async (interaction) => {
    try {
      // Services may not be initialized yet if ready event hasn't fired
      if (!client.services) {
        logger.warn('Interaction received before services initialized');
        return;
      }

      await events.handleInteractionCreate(interaction, client.services);
    } catch (error) {
      handleError(error, 'InteractionCreate');
    }
  });

  // Message create (CTJ monitoring, chat engagement, wins, moderation)
  client.on('messageCreate', async (message) => {
    try {
      if (!client.services) return;
      await events.handleMessageCreate(message, client.services);
    } catch (error) {
      handleError(error, 'MessageCreate');
    }
  });

  // Guild member add (welcome new members)
  client.on('guildMemberAdd', async (member) => {
    try {
      if (!client.services) return;
      await events.handleGuildMemberAdd(member, client.services);
    } catch (error) {
      handleError(error, 'GuildMemberAdd');
    }
  });

  logger.info('✓ Event handlers registered');
}


// startScheduledJobs function moved to src/events/ready.js to avoid duplication

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
