/**
 * Duels Finalizer Job
 * Checks for expired duels and completes them automatically
 */

const { createLogger } = require('../utils/logger');
const config = require('../config/settings');

const logger = createLogger('DuelsFinalizer');

let intervalId = null;

/**
 * Schedule duel finalizer to run every 10 minutes
 * @param {Client} client - Discord client
 * @param {object} services - Initialized services
 */
function scheduleDuelsFinalizer(client, services) {
  // Don't start if no duel manager
  if (!services || !services.duelManager) {
    logger.warn('DuelManager not available, duels finalizer will not run');
    return;
  }

  // Don't start multiple intervals
  if (intervalId) {
    logger.warn('Duels finalizer already running');
    return;
  }

  const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

  // Determine channel for announcements
  const announcementChannelId = process.env.CHANNEL_DUELS_ID || 
                                 process.env.CHANNEL_GENERAL_ID || 
                                 config.discord.channelGeneral;

  logger.info('Starting duels finalizer job', { 
    interval: '10 minutes',
    channelId: announcementChannelId 
  });

  // Run immediately on start
  checkExpiredDuels(services, announcementChannelId).catch(err => {
    logger.error('Initial duel check failed', { error: err.message });
  });

  // Then run every 10 minutes
  intervalId = setInterval(async () => {
    try {
      await checkExpiredDuels(services, announcementChannelId);
    } catch (error) {
      logger.error('Duel finalizer check failed', { error: error.message });
    }
  }, CHECK_INTERVAL_MS);

  logger.info('Duels finalizer job scheduled successfully');
}

/**
 * Check and complete expired duels
 * @param {object} services - Services object
 * @param {string} channelId - Channel ID for announcements
 */
async function checkExpiredDuels(services, channelId) {
  try {
    logger.debug('Checking for expired duels...');

    const result = await services.duelManager.checkExpiredDuels(channelId);

    if (result && result.completed > 0) {
      logger.info('Expired duels completed', { count: result.completed });
    }

  } catch (error) {
    logger.error('Failed to check expired duels', { error: error.message });
    throw error;
  }
}

/**
 * Stop the duels finalizer job
 */
function stopDuelsFinalizer() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Duels finalizer job stopped');
  }
}

module.exports = {
  scheduleDuelsFinalizer,
  stopDuelsFinalizer
};


