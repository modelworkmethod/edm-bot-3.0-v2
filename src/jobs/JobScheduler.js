// src/jobs/JobScheduler.js
/**
 * JobScheduler (Main Bot)
 * - Simple scheduler for jobs that must run on startup and optionally on intervals.
 */

const { createLogger } = require('../utils/logger');

const logger = createLogger('JobScheduler');

// Keep interval refs so we can stop cleanly
let intervals = [];

async function start(client) {
  logger.info('Starting jobs...');

  // 1) Barbie static menu card
  try {
    const EnsureBarbieMenuJob = require('./ensureBarbieMenuJob');
    await EnsureBarbieMenuJob.run(client);
    logger.info('✓ EnsureBarbieMenuJob ran');
  } catch (e) {
    logger.warn('EnsureBarbieMenuJob failed', { error: e?.message });
  }

  // 2) ✅ Weekly Call Daily Reminders (9am / 3pm / 8pm ET)
  try {
    const { startWeeklyCallDailyReminders } = require('./weeklyCallDailyReminders');

    const channelId =
      process.env.CALL_REMINDERS_CHANNEL_ID ||
      process.env.GENERAL_CHANNEL_ID ||
      null;

    if (!channelId) {
      logger.warn(
        'WeeklyCallDailyReminders NOT started (missing channelId). Set CALL_REMINDERS_CHANNEL_ID or GENERAL_CHANNEL_ID.'
      );
    } else {
      startWeeklyCallDailyReminders(client, {
        channelId,
        legendsCallSchedChannelId: process.env.LEGENDS_CALL_SCHED_CHANNEL_ID || null,
      });

      logger.info('✓ WeeklyCallDailyReminders started', {
        channelId,
        legendsCallSchedChannelId: process.env.LEGENDS_CALL_SCHED_CHANNEL_ID || null,
      });
    }
  } catch (e) {
    logger.warn('WeeklyCallDailyReminders failed to start', {
      error: e?.message,
      stack: e?.stack,
    });
  }

  // 3) ✅ Group Call Hype Scheduler (optional)
  // Enable with: CALL_HYPE_ENABLED=true
  try {
    const hypeEnabled = String(process.env.CALL_HYPE_ENABLED || '').toLowerCase() === 'true';
    if (hypeEnabled) {
      const { startGroupCallHypeScheduler, previewGroupCallHype } = require('./groupCallHypeScheduler');

      const hypeChannelId =
        process.env.CALL_REMINDERS_CHANNEL_ID ||
        process.env.GENERAL_CHANNEL_ID ||
        null;

      if (!hypeChannelId) {
        logger.warn(
          'GroupCallHypeScheduler NOT started (missing hypeChannelId). Set CALL_REMINDERS_CHANNEL_ID or GENERAL_CHANNEL_ID.'
        );
      } else {
        startGroupCallHypeScheduler(client, { channelId: hypeChannelId });
        logger.info('✓ GroupCallHypeScheduler started', { channelId: hypeChannelId });

        // Optional: preview on boot for client demo
        if (String(process.env.GROUPCALL_HYPE_PREVIEW || '').toLowerCase() === 'true') {
          setTimeout(async () => {
            try {
              await previewGroupCallHype(client, {
                channelId: hypeChannelId,
                legendsCallSchedChannelId: process.env.LEGENDS_CALL_SCHED_CHANNEL_ID || null,
              });
              logger.info('✓ GroupCallHypeScheduler preview sent', { channelId: hypeChannelId });
            } catch (err) {
              logger.warn('GroupCallHypeScheduler preview failed', { error: err?.message });
            }
          }, 4000);
        }
      }
    } else {
      logger.info('GroupCallHypeScheduler disabled (set CALL_HYPE_ENABLED=true to enable)');
    }
  } catch (e) {
    logger.warn('GroupCallHypeScheduler failed to start', {
      error: e?.message,
      stack: e?.stack,
    });
  }

  // OPTIONAL: run again every X minutes (if you want it to self-heal)
  // Default OFF. Enable with env.
  const mins = Number(process.env.JOBS_REFRESH_MINUTES || 0);
  if (mins > 0) {
    const ms = mins * 60 * 1000;
    const id = setInterval(async () => {
      try {
        const EnsureBarbieMenuJob = require('./ensureBarbieMenuJob');
        await EnsureBarbieMenuJob.run(client);
      } catch {}
    }, ms);
    intervals.push(id);
    logger.info(`✓ Jobs refresh scheduled every ${mins} minutes`);
  }

  logger.info('Jobs started');
}

async function stop() {
  for (const id of intervals) clearInterval(id);
  intervals = [];
  logger.info('Jobs stopped');
}

module.exports = { start, stop };
