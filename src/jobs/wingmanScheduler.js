/**
 * Wingman Scheduler
 * Runs weekly pairing on configured schedule
 */

const { createLogger } = require('../utils/logger');
const { handleError } = require('../utils/errorHandler');
const wingmanConfig = require('../config/wingmanConfig');
const { query } = require('../database/postgres');

const logger = createLogger('WingmanScheduler');

let schedulerInterval = null;
let lastCheckKey = null;

/**
 * Schedule wingman matcher to run weekly
 */
async function scheduleWingmanMatcher(client, services) {
  if (!wingmanConfig.enabled) {
    logger.info('Wingman Matcher disabled (WINGMAN_MATCHUPS_CHANNEL_ID not set)');
    return;
  }

  logger.info('Wingman Matcher scheduler started', {
    schedule: `${wingmanConfig.scheduleDay} ${wingmanConfig.scheduleTime} ${wingmanConfig.tz}`,
    matchupsChannel: wingmanConfig.matchupsChannelId
  });

  // Check every minute for scheduled time
  schedulerInterval = setInterval(async () => {
    try {
      const now = new Date();
      const runKey = wingmanConfig.currentRunKey(now);

      // Prevent duplicate runs for same week
      if (lastCheckKey === runKey) {
        return;
      }

      // Check if we've crossed the scheduled time
      const nextRun = wingmanConfig.nextRunDate();
      
      if (!nextRun) {
        logger.error('Failed to calculate next run date');
        return;
      }

      // If next run is in the future, we haven't hit the schedule yet
      if (nextRun > now) {
        return;
      }

      // Check if already executed this week
      const existing = await query(
        'SELECT * FROM wingman_runs WHERE run_key = $1 AND executed_at IS NOT NULL',
        [runKey]
      );

      if (existing.rows.length > 0) {
        lastCheckKey = runKey;
        return;
      }

      // Execute the run
      logger.info('Triggering scheduled wingman run', { runKey });
      lastCheckKey = runKey;

      await executeWingmanRun(client, services, runKey, now);

    } catch (error) {
      handleError(error, 'WingmanScheduler.IntervalCheck');
    }
  }, 60000); // Check every minute
}

/**
 * Execute wingman run
 */
async function executeWingmanRun(client, services, runKey, scheduledAt) {
  try {
    // Get guild (use first guild or configured guild)
    const guild = client.guilds.cache.first();

    if (!guild) {
      logger.error('No guild available for wingman run');
      return;
    }

    const wingmanMatcher = services.wingmanMatcher;

    if (!wingmanMatcher) {
      logger.error('WingmanMatcher service not available');
      return;
    }

    logger.info('Starting wingman run', { runKey, guildId: guild.id });

    // Create run record
    const run = await wingmanMatcher.createRun(runKey, scheduledAt);

    // Get eligible members
    const members = await wingmanMatcher.getEligibleMembers(guild);

    if (members.length < 2) {
      logger.warn('Not enough eligible members for pairing', { count: members.length });
      
      await query(
        `UPDATE wingman_runs 
         SET executed_at = NOW(), stats = $1 
         WHERE id = $2`,
        [JSON.stringify({ eligible_count: members.length, error: 'insufficient_members' }), run.id]
      );
      
      return;
    }

    // Build pairs
    const { pairs, unpaired } = await wingmanMatcher.buildPairs(members);

    logger.info('Pairs built', { 
      pairCount: pairs.length, 
      unpairedCount: unpaired.length 
    });

    if (pairs.length === 0) {
      logger.warn('No pairs could be created');
      
      await query(
        `UPDATE wingman_runs 
         SET executed_at = NOW(), stats = $1 
         WHERE id = $2`,
        [JSON.stringify({ eligible_count: members.length, pairs_count: 0, error: 'no_pairs_created' }), run.id]
      );
      
      return;
    }

    // Persist pairs
    await wingmanMatcher.persistPairs(run.id, pairs);

    // Create private threads
    const threadResults = await wingmanMatcher.createPrivateThreads(guild, run.id, pairs);

    // Post weekly summary in matchups channel
    const summaryMessage = await wingmanMatcher.postWeeklySummary(guild, run.id, pairs, threadResults);

    // Announce in general
    await wingmanMatcher.announceInGeneral(guild, run.id, pairs, summaryMessage);

    // DM participants
    await wingmanMatcher.dmParticipants(guild, pairs, threadResults);

    // Update run with completion
    const stats = {
      eligible_count: members.length,
      pairs_count: pairs.length,
      unpaired_count: unpaired.length,
      threads_created: threadResults.filter(r => r.success).length,
      threads_failed: threadResults.filter(r => !r.success).length
    };

    await query(
      `UPDATE wingman_runs 
       SET executed_at = NOW(), stats = $1 
       WHERE id = $2`,
      [JSON.stringify(stats), run.id]
    );

    logger.info('Wingman run completed successfully', { runKey, stats });

  } catch (error) {
    handleError(error, 'WingmanScheduler.executeWingmanRun', { runKey });
  }
}

/**
 * Stop wingman scheduler
 */
function stopWingmanMatcher() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('Wingman Matcher scheduler stopped');
  }
}

module.exports = {
  scheduleWingmanMatcher,
  stopWingmanMatcher,
  executeWingmanRun // Export for manual/admin runs
};


