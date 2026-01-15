const cron = require('node-cron');
const { DateTime } = require('luxon');

const { createLogger } = require('../../utils/logger');
const { queryRow } = require('../../database/postgres');

const WingmanMatcher = require('./WingmanMatcher');
const wingmanConfig = require('../../config/wingmanConfig');
const settings = require('../../config/settings');

const logger = createLogger('WingmanScheduler');

function startWingmanScheduler(client, services) {
  if (!wingmanConfig.enabled) {
    logger.warn('WingmanScheduler NOT started (wingmanConfig disabled)');
    return;
  }

  // Every Sunday at 17:00 ET
  cron.schedule('0 17 * * 0', async () => {
    const nowEt = DateTime.now().setZone(wingmanConfig.tz);

    try {
      const guildId = settings?.discord?.guildId || process.env.GUILD_ID;
      if (!guildId) {
        logger.warn('WingmanScheduler: missing guildId (settings.discord.guildId or GUILD_ID)');
        return;
      }

      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        logger.warn('WingmanScheduler: guild not found/fetch failed', { guildId });
        return;
      }

      await guild.members.fetch().catch(() => null);

      const runKey = wingmanConfig.currentRunKey(nowEt.toJSDate());

      // Guard: avoid duplicate runs this week
      const existingRun = await queryRow(
        `SELECT id, run_key, created_at
         FROM wingman_runs
         WHERE run_key = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [runKey]
      );

      if (existingRun) {
        logger.info('WingmanScheduler: already ran for this week, skipping', {
          runKey,
          lastRun: existingRun.created_at
        });
        return;
      }

      if (!services?.userService) {
        logger.warn('WingmanScheduler: userService missing, cannot run');
        return;
      }

      const matcher = new WingmanMatcher(services.userService);

      const members = await matcher.getEligibleMembers(guild);
      if (!members || members.length < 2) {
        logger.info('WingmanScheduler: not enough eligible members', { eligible: members?.length || 0 });
        return;
      }

      const { pairs, unpaired } = await matcher.buildPairs(members);
      if (!pairs || pairs.length === 0) {
        logger.info('WingmanScheduler: no pairs created', { eligible: members.length, unpaired: unpaired.length });
        return;
      }

      const scheduledAt = nowEt.toJSDate();
      const run = await matcher.createRun(runKey, scheduledAt);
      await matcher.persistPairs(run.id, pairs);

      const threadResults = await matcher.createPrivateThreads(guild, run.id, pairs);
      const summaryMessage = await matcher.postWeeklySummary(guild, run.id, pairs, threadResults);

      await matcher.announceInGeneral(guild, run.id, pairs, summaryMessage);
      await matcher.dmParticipants(guild, pairs, threadResults);

      logger.info('WingmanScheduler: run completed', {
        runKey,
        runId: run.id,
        eligible: members.length,
        pairs: pairs.length
      });

    } catch (e) {
      logger.error('WingmanScheduler tick failed', { error: e?.message || String(e) });
    }
  }, { timezone: wingmanConfig.tz });

  logger.info('WingmanScheduler started', {
    tz: wingmanConfig.tz,
    schedule: `SU ${wingmanConfig.scheduleTime}`,
    matchupsChannelId: wingmanConfig.matchupsChannelId,
    generalChannelId: wingmanConfig.generalChannelId || null,
    eligibleRoleId: wingmanConfig.eligibleRoleId || null
  });
}

module.exports = { startWingmanScheduler };
