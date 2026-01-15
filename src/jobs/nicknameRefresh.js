/**
 * Nickname Refresh Job
 * Daily job to update all user nicknames with current ranks
 */

const cron = require('node-cron');
const { createLogger } = require('../utils/logger');
const config = require('../config/settings');

const logger = createLogger('NicknameRefresh');

/**
 * Schedule daily nickname refresh
 * Updates all user nicknames at midnight to reflect rank changes
 * @param {Client} client - Discord client
 * @param {object} services - Service instances
 */
function scheduleNicknameRefresh(client, services) {
  if (!config.features.nicknameSync) {
    logger.info('Nickname sync disabled - skipping scheduler');
    return;
  }

  const timezone = config.advanced?.timezone || 'America/New_York';
  
  // Run daily at midnight (00:00)
  cron.schedule('0 0 * * *', async () => {
    await runNicknameRefresh(client, services);
  }, {
    timezone
  });

  logger.info('Nickname refresh scheduled', {
    schedule: '00:00 daily',
    timezone
  });
}

/**
 * Execute nickname refresh for all users
 * @param {Client} client - Discord client
 * @param {object} services - Service instances
 */
async function runNicknameRefresh(client, services) {
  logger.info('Starting daily nickname refresh...');

  try {
    const guild = client.guilds.cache.get(config.discord.guildId);
    if (!guild) {
      logger.error('Guild not found', { guildId: config.discord.guildId });
      return;
    }

    // Sync all nicknames (limited to 50 users per run to avoid rate limits)
    const result = await services.nicknameService.syncAllNicknames(guild, 50);

    logger.info('Daily nickname refresh complete', {
      updated: result.updated,
      skipped: result.skipped,
      failed: result.failed
    });

  } catch (error) {
    logger.error('Daily nickname refresh failed', {
      error: error.message
    });
  }
}

module.exports = {
  scheduleNicknameRefresh,
  runNicknameRefresh
};
