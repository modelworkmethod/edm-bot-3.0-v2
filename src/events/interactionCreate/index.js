/**
 * Interaction Create Event
 * Routes different interaction types to appropriate handlers
 */

const { createLogger } = require('../../utils/logger');
const { handleCommand } = require('./commandHandler');
const { handleButton } = require('./buttonHandler');
const { handleModal } = require('./modalHandler');
const { handleSelectMenu } = require('./selectMenuHandler');
const { withServiceAliases } = require('./withServiceAliases');

const path = require('path');
const settings = require('../../config/settings');

let tenseyRoute = null;
try {
  // __dirname => /.../src/events/interactionCreate
  const tenseyRouterPath = path.join(__dirname, '../../../tensey-bot/src/interactions/handlers/interactionsRouter.js');
({ route: tenseyRoute } = require(tenseyRouterPath));
} catch (e) {
  tenseyRoute = null;
}


const logger = createLogger('InteractionCreate');

// Lazy-initialize services
async function ensureServices(client) {
  if (client.services) return client.services;

  logger.warn('Services not initialized on client');

  // ✅ Ensure DB pool exists BEFORE repositories/services hydrate
  try {
    const settings = require('../../config/settings');
    const { getPool, initializePool, setInitConfig } = require('../../database/postgres');

    try {
      getPool(); // already initialized
    } catch {
      setInitConfig(settings);
      await initializePool(settings);
      logger.info('✅ PostgreSQL pool initialized (lazy)');
    }
  } catch (e) {
    logger.warn('DB init in ensureServices failed (continuing)', { error: e?.message || String(e) });
  }

  const { initializeRepositories } = require('../../database/repositories');
  const { initializeServices } = require('../../services');

  initializeRepositories(settings); // si tu initializeRepositories acepta config, te digo abajo cómo
  const services = initializeServices(client, settings);
  client.services = services;

  logger.info('Services hydrated lazily');
  return services;
}


async function safeDefer(interaction, ephemeral = true) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral });
    }
  } catch (e) {
    
  }
}

module.exports = {
  name: 'interactionCreate',

  async execute(interaction) {
    try {
      let services = await ensureServices(interaction.client);

      // Normalize aliases so legacy command modules don’t explode
      services = withServiceAliases(services);

      // ✅ Tensey router first (consumes its own buttons)
      if (typeof tenseyRoute === 'function') {
        try {
          const handled = await tenseyRoute(interaction);
          if (handled) return;
        } catch (e) {
          logger.warn('Tensey route failed', { error: e?.message });
        }
      }
      
      // ✅ Route interaction types
      if (interaction.isChatInputCommand()) {
        await handleCommand(interaction, services);
      } else if (interaction.isButton()) {
        await handleButton(interaction, services);
      } else if (interaction.isModalSubmit()) {
        await handleModal(interaction, services);
      } else if (interaction.isStringSelectMenu()) {
        await handleSelectMenu(interaction, services);
      }
    } catch (error) {
      logger.error('Interaction handler failed', {
        error: error?.message || String(error),
        stack: error?.stack
      });

      // Try to tell the user something without throwing
      if (interaction && !interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({ content: '❌ Something went wrong handling the interaction.', flags: 1 << 6 });
        } catch {}
      }
    }
  }
};

