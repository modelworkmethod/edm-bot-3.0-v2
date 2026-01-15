/**
 * Wingman Matcher Configuration
 * Weekly pairing system with private threads
 */

const { createLogger } = require('../utils/logger');

const logger = createLogger('WingmanConfig');

function getEnv(key, defaultValue, type = 'string') {
  const value = process.env[key];

  if (value === undefined || value === '') {
    return defaultValue;
  }

  if (type === 'boolean') {
    return value.toLowerCase() === 'true';
  }

  if (type === 'number') {
    return parseInt(value, 10);
  }

  return value;
}

const matchupsChannelId = getEnv('WINGMAN_MATCHUPS_CHANNEL_ID');
const enabled = !!matchupsChannelId;

if (!enabled) {
  logger.warn('⚠️  Wingman Matcher DISABLED: WINGMAN_MATCHUPS_CHANNEL_ID not set');
}

const config = {
  enabled,

  // Channel where threads are created AND weekly summary is posted
  matchupsChannelId,

  // ✅ Where the "general announcement" goes
  // Priority: WINGMAN_GENERAL_CHANNEL_ID -> CHANNEL_GENERAL_ID -> null
  generalChannelId: getEnv('WINGMAN_GENERAL_CHANNEL_ID', process.env.CHANNEL_GENERAL_ID),

  // Timezone for scheduling
  tz: getEnv('WINGMAN_TZ', 'America/New_York'),

  // ✅ Schedule: Sunday 5:00pm ET (client requirement)
  scheduleDay: getEnv('WINGMAN_SCHEDULE_DAY', 'SU'), // MO, TU, WE, TH, FR, SA, SU
  scheduleTime: getEnv('WINGMAN_SCHEDULE_TIME', '17:00'), // 24h HH:MM

  // History lookback to avoid repeats
  lookbackWeeks: getEnv('WINGMAN_LOOKBACK_WEEKS', 8, 'number'),

  // Eligibility filters (optional)
  // ✅ "certain role pool" => set this to the role of "active players"
  eligibleRoleId: getEnv('WINGMAN_ELIGIBLE_ROLE_ID'),

  minLevel: getEnv('WINGMAN_MIN_LEVEL', 0, 'number'),

  // Odd number handling
  oddMode: getEnv('WINGMAN_PAIR_ODD_MODE', 'triad'), // triad | carry | skip

  // Pairing preference
  preferCrossFaction: getEnv('WINGMAN_PREFER_CROSS_FACTION', false, 'boolean'),

  /**
   * Get current run key (ISO week: YYYY-[W]WW)
   * @param {Date} date - Date to get run key for (defaults to now)
   * @returns {string} Run key like '2025-W41'
   */
  currentRunKey(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  },

  /**
   * Calculate next scheduled run date
   * @returns {Date|null} Next run date or null if disabled
   */
  nextRunDate() {
    if (!this.enabled) return null;

    // ✅ TEST MODE: run in X minutes
    const testMinutes = process.env.WINGMAN_TEST_RUN_IN_MINUTES
      ? parseInt(process.env.WINGMAN_TEST_RUN_IN_MINUTES, 10)
      : null;

    if (testMinutes && !isNaN(testMinutes)) {
      const testDate = new Date();
      testDate.setMinutes(testDate.getMinutes() + testMinutes);

      logger.warn('⚠️ Wingman TEST MODE active', {
        runsInMinutes: testMinutes,
        runAt: testDate.toISOString(),
      });

      return testDate;
    }

    // -------- NORMAL SCHEDULE (SUNDAYS 5PM ET) --------

    const [hours, minutes] = this.scheduleTime.split(':').map(Number);

    const dayMap = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 0 };
    const targetDay = dayMap[this.scheduleDay];

    if (targetDay === undefined) {
      logger.error('Invalid WINGMAN_SCHEDULE_DAY', { day: this.scheduleDay });
      return null;
    }

    const now = new Date();
    const next = new Date(now);

    next.setHours(hours, minutes, 0, 0);

    const currentDay = now.getDay();
    let daysUntil = targetDay - currentDay;

    if (daysUntil < 0 || (daysUntil === 0 && now >= next)) {
      daysUntil += 7;
    }

    next.setDate(next.getDate() + daysUntil);
    return next;
  },

  toJSON() {
    return {
      enabled: this.enabled,
      matchupsChannelId: this.matchupsChannelId || 'NOT_SET',
      generalChannelId: this.generalChannelId || 'NOT_SET',
      tz: this.tz,
      schedule: `${this.scheduleDay} ${this.scheduleTime}`,
      lookbackWeeks: this.lookbackWeeks,
      eligibleRoleId: this.eligibleRoleId || 'ANY',
      minLevel: this.minLevel,
      oddMode: this.oddMode,
      preferCrossFaction: this.preferCrossFaction,
      nextRun: this.enabled ? this.nextRunDate()?.toISOString() : null,
    };
  }
};

logger.info('Wingman config loaded', config.toJSON());

module.exports = config;
