require('dotenv').config();

const path = require('path');
const { Client, GatewayIntentBits, Events } = require('discord.js');

// Logger (reuse main bot logger)
const { createLogger } = require('../src/utils/logger');
const logger = createLogger('TenseyBot');

// Postgres (si lo usas en tensey-bot)
const { initializePool, closePool } = require('../src/database/postgres');
const settings = require('../src/config/settings');

// Tensey config
const config = require('./src/config/environment');

// ✅ SQLite (tensey-bot local)
const sqlite = require('./src/database/sqlite');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// ✅ Router se carga DESPUÉS de init DBs
let tenseyRoute = null;

function loadTenseyRouter() {
  try {
    // eslint-disable-next-line global-require
    const mod = require('./src/interactions/handlers/interactionRouter');
    tenseyRoute = mod?.route || null;

    logger.info('✅ Tensey interactionRouter loaded', {
      hasTenseyRoute: typeof tenseyRoute === 'function',
    });

    return true;
  } catch (e) {
    tenseyRoute = null;
    logger.error('Failed to load Tensey interactionRouter', {
      error: e?.message || String(e),
      stack: e?.stack,
      pathTried: './src/interactions/handlers/interactionRouter',
    });
    return false;
  }
}

async function startup() {
  try {
    logger.info('Starting Tensey Bot...');

    // ✅ Token (soporta varias keys)
    const token =
      process.env.TENSEY_DISCORD_TOKEN ||
      process.env.TENSEY_BOT_TOKEN ||
      process.env.DISCORD_TOKEN;

    if (!token) {
      logger.error('Missing token. Set TENSEY_DISCORD_TOKEN (or TENSEY_BOT_TOKEN / DISCORD_TOKEN) in .env');
      process.exit(1);
    }

    // ✅ Init Postgres (si aplica)
    await initializePool(settings);
    logger.info('✅ PostgreSQL pool initialized (tensey-bot)');

    // ✅ Init SQLite (NECESARIO para checklist + leaderboard)
    const sqlitePath =
      process.env.TENSEY_SQLITE_PATH ||
      config.SQLITE_PATH ||
      path.join(__dirname, 'data', 'tensey.db');

    sqlite.init(sqlitePath);
    logger.info('✅ SQLite initialized (tensey-bot)', { sqlitePath });

    // ✅ Load router after DBs are ready
    loadTenseyRouter();

    await client.login(token);
    logger.info(`✅ Logged in as ${client.user.tag}`);
  } catch (err) {
    logger.error('Startup failed', { error: err?.message || String(err), stack: err?.stack });
    process.exit(1);
  }
}

client.once(Events.ClientReady, async () => {
  logger.info('Bot ready.', { hasTenseyRoute: typeof tenseyRoute === 'function' });

  // ✅ retry router load if needed
  if (typeof tenseyRoute !== 'function') {
    logger.warn('Router not loaded at ready; retrying load...');
    loadTenseyRouter();
  }

  // ✅ Ensure persistent buttons (OPEN MY TENSEY LIST)
  try {
    // ⚠️ Ajusta el nombre si tu archivo se llama distinto
    const EnsureButtonsJob = require('./src/jobs/ensureButtonJob');
    await EnsureButtonsJob.run(client);
    logger.info('✅ EnsureButtonsJob executed (tensey-bot)');
  } catch (e) {
    logger.error('EnsureButtonsJob failed (tensey-bot)', { error: e?.message, stack: e?.stack });
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (typeof tenseyRoute !== 'function') {
      if (
        interaction.isChatInputCommand() &&
        interaction.isRepliable() &&
        !interaction.replied &&
        !interaction.deferred
      ) {
        await interaction.reply({
          content: '❌ Tensey router not loaded. Check logs (interactionRouter require failed).',
          flags: 1 << 6,
        });
      }
      return;
    }

    const handled = await tenseyRoute(interaction);
    if (handled) return;

    if (
      interaction.isChatInputCommand() &&
      interaction.isRepliable() &&
      !interaction.replied &&
      !interaction.deferred
    ) {
      await interaction.reply({
        content: '❌ Command not handled by Tensey bot.',
        flags: 1 << 6,
      });
    }
  } catch (err) {
    logger.error('interactionCreate crashed (tensey)', {
      error: err?.message || String(err),
      stack: err?.stack,
    });

    try {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Something went wrong.', flags: 1 << 6 });
      }
    } catch {}
  }
});

// Graceful shutdown
async function shutdown(signal) {
  try {
    logger.info(`${signal} received, shutting down...`);

    try { await closePool(); } catch {}
    try { sqlite.close?.(); } catch {}

    client.destroy();
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startup();
