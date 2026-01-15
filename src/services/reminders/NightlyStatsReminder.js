const cron = require('node-cron');
const { DateTime } = require('luxon');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('NightlyStatsReminder');

const TZ = 'America/New_York';

// dedup diario en memoria (si el bot reinicia, puede mandar otra vez ese día; luego lo persistimos si quieres)
let lastSentDay = null;

// ✅ Prevent duplicate cron schedules
let started = false;
let scheduledTask = null;

function startNightlyStatsReminder(client, {
  channelId,
  timezone = TZ,
} = {}) {
  if (!channelId) {
    logger.warn('Nightly stats reminder NOT started (missing channelId)');
    return;
  }

  // ✅ If called twice, stop previous task (extra safe) and do not double schedule
  if (started) {
    try {
      if (scheduledTask && typeof scheduledTask.stop === 'function') {
        scheduledTask.stop();
      }
      scheduledTask = null;
      started = false;
      logger.warn('NightlyStatsReminder was already started; previous task stopped and will be rescheduled', {
        channelId,
        timezone,
      });
    } catch (e) {
      logger.warn('NightlyStatsReminder: failed stopping previous task (continuing)', { error: e?.message });
    }
  }

  // 10:00 PM ET todos los días
  scheduledTask = cron.schedule('0 22 * * *', async () => {
    try {
      const nowEt = DateTime.now().setZone(timezone);
      const dayKey = nowEt.toFormat('yyyy-LL-dd');

      if (lastSentDay === dayKey) return;
      lastSentDay = dayKey;

      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased?.()) {
        logger.warn('Nightly reminder channel invalid/not text based', { channelId });
        return;
      }

      await channel.send({
        content: [
          '🌙 **Nightly reminder**',
          '',
          'Don’t forget to submit your stats today:',
          '➡️ Use **/submit-stats**',
          '',
          'This helps your streak + XP + scorecard stay updated. 💪'
        ].join('\n')
      });

      logger.info('Nightly stats reminder sent', { channelId, dayKey });
    } catch (e) {
      logger.error('Nightly stats reminder tick failed', { error: e?.message || String(e) });
    }
  }, { timezone });

  started = true;

  logger.info('Nightly stats reminder started', { channelId, timezone });
}

// ✅ Optional: allow manual stop (handy in hot reloads / tests)
function stopNightlyStatsReminder() {
  try {
    if (scheduledTask && typeof scheduledTask.stop === 'function') {
      scheduledTask.stop();
    }
  } catch (e) {
    logger.warn('NightlyStatsReminder: stop failed', { error: e?.message });
  } finally {
    scheduledTask = null;
    started = false;
  }
}

module.exports = { startNightlyStatsReminder, stopNightlyStatsReminder };
