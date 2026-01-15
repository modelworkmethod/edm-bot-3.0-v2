/**
 * Unified settings export
 * Combines environment variables and constants into a single configuration object
 */

require('dotenv').config();

const { getEnv, getChannelIds, getRoleIds } = require('./environment');
const constants = require('./constants');

/**
 * Main configuration object
 */
const settings = {
  // Discord credentials
  discord: {
    token: getEnv('DISCORD_TOKEN'),
    clientId: getEnv('DISCORD_CLIENT_ID'),
    guildId: getEnv('DISCORD_GUILD_ID')
  },

  // Tensey bot (separate token)
  tensey: {
    token: getEnv('TENSEY_DISCORD_TOKEN'),
    clientId: getEnv('TENSEY_CLIENT_ID'),
    announceEnabled: getEnv('TENSEY_ANNOUNCE_ENABLED', true, 'boolean'),
    announceXP: getEnv('TENSEY_ANNOUNCE_XP', false, 'boolean'),
    announceThrottle: getEnv('TENSEY_ANNOUNCE_THROTTLE_MS', 3000, 'number'),
    pinButton: getEnv('PIN_TENSEY_BUTTON', false, 'boolean'),
    pinLeaderboard: getEnv('PIN_LEADERBOARD_BUTTON', false, 'boolean')
  },

  // Database configuration
  database: {
    url: getEnv('DATABASE_URL'),
    host: getEnv('DATABASE_HOST'),
    port: getEnv('DATABASE_PORT', 25060, 'number'),
    name: getEnv('DATABASE_NAME', 'defaultdb'),
    user: getEnv('DATABASE_USER'),
    password: getEnv('DATABASE_PASSWORD'),
    ssl: getEnv('DATABASE_SSL', true, 'boolean'),
    caCertPath: getEnv('CA_CERT_PATH')
  },

  // Channel IDs
  channels: getChannelIds(),

  // Role IDs
  roles: getRoleIds(),

  // Admin users
  admin: {
    userId: getEnv('ADMIN_USER_ID')
  },

  // XP system
  xp: {
    baseAmount: getEnv('XP_BASE_AMOUNT', 300, 'number'),
    perLevel: getEnv('XP_PER_LEVEL', 50, 'number')
  },

  // Multipliers
  multipliers: {
    maxStreakBonus: getEnv('MAX_STREAK_BONUS', 0.25, 'number'),
    stateGoodBonus: getEnv('STATE_GOOD_BONUS', 0.05, 'number'),
    templarDayBonus: getEnv('TEMPLAR_DAY_BONUS', 0.30, 'number'),
    catchupMaxBonus: getEnv('CATCHUP_MAX_BONUS', 0.50, 'number')
  },

  // Features
  features: {
    nicknameSync: getEnv('ENABLE_NICKNAME_SYNC', true, 'boolean'),
    nicknameMaxLength: getEnv('NICKNAME_MAX_LENGTH', 32, 'number'),
    sendWelcomeDM: getEnv('SEND_WELCOME_DM', true, 'boolean'),
    sendWelcomeGeneral: getEnv('SEND_WELCOME_IN_GENERAL', true, 'boolean')
  },

  // Announcements
  announcements: {
    nightlyReminderEnabled: getEnv('NIGHTLY_REMINDER_ENABLED', true, 'boolean'),
    nightlyReminderHour: getEnv('NIGHTLY_REMINDER_HOUR_ET', 21, 'number'),
    factionEnabled: getEnv('FACTION_ANNOUNCEMENTS_ENABLED', true, 'boolean'),
    archetypeEnabled: getEnv('ARCHETYPE_ANNOUNCEMENTS_ENABLED', true, 'boolean'),
    levelUpEnabled: getEnv('LEVEL_UP_ANNOUNCEMENTS_ENABLED', true, 'boolean')
  },

  // Branding
  branding: {
    name: 'Embodied Dating Mastermind',
    colorHex: parseInt(getEnv('BRAND_COLOR_HEX', 'FF1E27'), 16),
    logoUrl: getEnv('BRAND_LOGO_URL'),
    bannerUrl: getEnv('FREE_EVENT_BANNER_URL')
  },

  // Advanced
  advanced: {
    timezone: getEnv('TIMEZONE', 'America/New_York'),
    rankSampleSize: getEnv('RANK_SAMPLE_SIZE', 60, 'number'),
    freeEventLevel: getEnv('FREE_EVENT_LEVEL', 60, 'number'),
    bossStartHour: getEnv('BOSS_START_HOUR', 20, 'number'),
    bossDuration: getEnv('BOSS_DURATION_MINUTES', 120, 'number')
  },

  // Import all game constants
  constants
  // Factions Roles (Luminarchs and Noctivores)
  , factions: {
    luminarchRoleId: getEnv('LUMINARCH_ROLE_ID'),
    noctivoreRoleId: getEnv('NOCTIVORE_ROLE_ID')
  } 
};

/**
 * Derived pg config for node-postgres (Pool)
 * - Uses DATABASE_URL if present 
 * - Else builds from discrete keys.
 * - On DO or sslmode/flags, SSL is enabled (rejectUnauthorized:false).
 * - If CA_CERTH_PATH exists, switch to strict validation.
 */
(() => {
  const fs = require('fs'); 

  const urlStr = settings.database.url || '';
  const urlHost = settings.database.host || '';
  const urlPort = settings.database.port || 5432;

  try {
    if (urlStr){
      const u = new URL(urlStr);
      urlHost = u.hostname || urlHost;
      urlPort = Number(u.port) || urlPort;
    }
  }catch { /* ignore parse errors */ }

  const urlWantsSSl = /\bsslmode=(require|verify-ca|verify-full|no-verify)\b/i.test(urlStr);
  const looksLikeDO = /ondigitalocean\.com$/i.test(urlHost) || urlPort === 25060;
  const wantsSSL = !!settings.database.ssl || urlWantsSSl || looksLikeDO || !!process.env.PGSSLMODE;

  
  let ssl = wantsSSL ? { rejectUnauthorized: false } : false;

  // Adjuntar CA opcional si definiste CA_CERT_PATH
  if (ssl && settings.database.caCertPath) {
    try {
      const fs = require('fs');
      const ca = fs.readFileSync(settings.database.caCertPath, 'utf8');
      if (ca && ca.trim().length > 0) { 
       ssl = { ca, rejectUnauthorized: true  };
      }
    } catch {
      // if A file missing, fall back to relaxed SSL
      ssl = { rejectUnauthorized: false };
    }
  }

  if (urlStr) {
    settings.database.pg = {
      connectionString: urlStr,
      ssl: ssl || { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    };
  }else {
    settings.database.pg = {
      host: urlHost || 'localhost',
      port: Number(urlPort || 5432),
      user: settings.database.user,
      password: settings.database.password,
      database: settings.database.name,
      ssl: ssl || false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    };
  }

})();


module.exports = settings;
