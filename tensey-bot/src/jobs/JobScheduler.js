// tensey-bot/src/jobs/JobScheduler.js

const logger = require('../utils/logger');
const pendingAwardsProcessor = require('./pendingAwardsProcessor');
const ensureButtonsJob = require('./ensureButtonsJob'); // 👈 asegúrate que el archivo exista con este nombre
const leaderboardRefreshJob = require('./leaderboardRefreshJob');

function msUntilNextNYCMorning(hour = 8, minute = 0) {
  const now = new Date();

  // “now” convertido a la hora local NYC (DST-aware)
  const nycNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  const next = new Date(nycNow);
  next.setHours(hour, minute, 0, 0);

  // si ya pasó hoy, programar mañana
  if (nycNow >= next) {
    next.setDate(next.getDate() + 1);
  }

  return next.getTime() - nycNow.getTime();
}

class JobScheduler {
  static intervals = [];
  static timeouts = [];

  // ✅ simple in-memory lock para evitar doble ejecución en arranque
  static _startupButtonsEnsured = false;

  static async start(client) {
    try {
      // Pending awards processor (cada 10 segundos) ✅
      this.intervals.push(setInterval(() => pendingAwardsProcessor.run(), 10_000));
      logger.info('✓ Pending awards processor started');

      // Leaderboard refresh (cada 5 min) ✅
      this.intervals.push(setInterval(() => leaderboardRefreshJob.run(client), 5 * 60 * 1000));
      logger.info('✓ Leaderboard refresh started');

      // ✅ (NEW) Ensure buttons ON STARTUP
      // Safe because ensureButtonsJob already tries to EDIT existing message using artifacts.
      if (!this._startupButtonsEnsured) {
        this._startupButtonsEnsured = true;
        try {
          await ensureButtonsJob.run(client);
          logger.info('✓ Button ensurer ran (startup)');
        } catch (err) {
          logger.error('EnsureButtonsJob failed (startup)', { error: err.message, stack: err.stack });
        }
      }

      // ✅ Ensure buttons: 1 vez al día a las 8:00 AM NYC (DST-aware)
      const scheduleDailyButtons = async () => {
        try {
          await ensureButtonsJob.run(client);
          logger.info('✓ Button ensurer ran (daily NYC)');
        } catch (err) {
          logger.error('EnsureButtonsJob failed (daily NYC)', { error: err.message, stack: err.stack });
        }

        // reprogramar en 24h
        this.timeouts.push(setTimeout(scheduleDailyButtons, 24 * 60 * 60 * 1000));
      };

      const delay = msUntilNextNYCMorning(8, 0);
      logger.info(`✓ Button ensurer scheduled in ~${Math.round(delay / 60000)} minutes (next NYC morning)`);

      this.timeouts.push(setTimeout(scheduleDailyButtons, delay));

    } catch (err) {
      logger.error('Failed to start jobs', { error: err.message, stack: err.stack });
    }
  }

  static async stop() {
    this.intervals.forEach((i) => clearInterval(i));
    this.intervals = [];

    this.timeouts.forEach((t) => clearTimeout(t));
    this.timeouts = [];

    logger.info('All jobs stopped');
  }

  static async onGuildJoin(guild) {
    // cuando entra a un guild nuevo sí tiene sentido crear el mensaje una vez
    try {
     // await ensureButtonsJob.run(guild.client);
      logger.info('✓ Button ensurer ran (guild join)');
    } catch (err) {
      logger.error('EnsureButtonsJob failed (guild join)', { error: err.message, stack: err.stack });
    }
  }
}

module.exports = JobScheduler;
