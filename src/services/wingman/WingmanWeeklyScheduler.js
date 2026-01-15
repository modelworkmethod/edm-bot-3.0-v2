const cron = require('node-cron');
const { DateTime } = require('luxon');
const { createLogger } = require('../../utils/logger');
const wingmanConfig = require('../../config/wingmanConfig');
const { queryRow } = require('../../database/postgres');
const WingmanMatcher = require('./WingmanMatcher');

const logger = createLogger('WingmanWeeklyScheduler');

function isoDayToCron(isoDay) {
  // cron DOW: 0=Sunday ... 6=Saturday
  const map = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  return map[isoDay] ?? 0;
}

/**
 * Runs the same flow as /execute-wingmen:
 * - eligible members via role pool
 * - build pairs avoiding repeats
 * - persist run + pairs
 * - create private threads
 * - post weekly summary
 * - announce in general (if configured)
 * - DM participants
 */
function startWingmanWeeklyScheduler(client, services) {
  if (!wingmanConfig.enabled) {
    logger.warn('Wingman weekly scheduler NOT started (wingman disabled)');
    return;
  }

  if (!services?.userService) {
    logger.warn('Wingman weekly scheduler NOT started (missing services.userService)');
    return;
  }

  const tz = wingmanConfig.tz || 'America/New_York';
  const [hh, mm] = String(wingmanConfig.scheduleTime || '17:00').split(':').map(n => parseInt(n, 10));
  const cronDow = isoDayToCron(wingmanConfig.scheduleDay || 'SU');

  // cron format: "m h * * dow"
  const expr = `${mm} ${hh} * * ${cronDow}`;

  cron.schedule(expr, async () => {
    try {
      const nowEt = DateTime.now().setZone(tz);
      logger.info('Wingman weekly tick', { nowEt: nowEt.toISO(), tz, expr });

      const guildId = process.env.GUILD_ID || client?.guilds?.cache?.first()?.id;
      if (!guildId) {
        logger.warn('Wingman weekly run aborted (no guildId)');
        return;
      }

      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        logger.warn('Wingman weekly run aborted (guild not found)', { guildId });
        return;
      }

      const runKey = wingmanConfig.currentRunKey(new Date());
      const scheduledAt = new Date();

      // Guard: avoid duplicate runs
      const existingRun = await queryRow(
        `SELECT id, run_key, created_at
         FROM wingman_runs
         WHERE run_key = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [runKey]
      );

      if (existingRun) {
        logger.info('Wingman weekly run skipped (already ran this week)', {
          runKey,
          lastRun: new Date(existingRun.created_at).toISOString()
        });
        return;
      }

      const matcher = new WingmanMatcher(services.userService);

      const members = await matcher.getEligibleMembers(guild);
      if (!members || members.length < 2) {
        logger.info('Wingman weekly run skipped (not enough eligible members)', { eligibleCount: members?.length || 0 });
        return;
      }

      const { pairs, unpaired } = await matcher.buildPairs(members);
      if (!pairs || pairs.length === 0) {
        logger.info('Wingman weekly run: no pairs created', { eligible: members.length, unpaired: unpaired.length });
        return;
      }

      const run = await matcher.createRun(runKey, scheduledAt);
      await matcher.persistPairs(run.id, pairs);

      const threadResults = await matcher.createPrivateThreads(guild, run.id, pairs);
      const summaryMessage = await matcher.postWeeklySummary(guild, run.id, pairs, threadResults);

      await matcher.announceInGeneral(guild, run.id, pairs, summaryMessage);
      await matcher.dmParticipants(guild, pairs, threadResults);

      logger.info('Wingman weekly run complete', {
        runKey,
        runId: run.id,
        eligible: members.length,
        pairs: pairs.length
      });

    } catch (e) {
      logger.error('Wingman weekly scheduler run failed', { error: e?.message, stack: e?.stack });
    }
  }, { timezone: tz });

  logger.info('Wingman weekly scheduler started', { expr, tz });
}

module.exports = { startWingmanWeeklyScheduler };
