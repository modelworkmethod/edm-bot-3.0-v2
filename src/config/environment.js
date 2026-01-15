/**
 * Environment variable validation and loading
 * Fails fast if required variables are missing
 */

const fs = require('fs');
const path = require('path');

// Required environment variables (bot cannot start without these)
const REQUIRED_VARS = [
  'DISCORD_TOKEN',
  'DISCORD_CLIENT_ID',
  'DISCORD_GUILD_ID',
  'DATABASE_URL',
  'CHANNEL_GENERAL_ID',
  'ADMIN_USER_ID'
];

// Optional but recommended
const RECOMMENDED_VARS = [
  'CHANNEL_INPUT_ID',
  'CHANNEL_LEADERBOARD_ID',
  'CHANNEL_SCORECARD_ID',
  'JOURNAL_CHANNEL_ID',

  // ✅ NEW (recommended): call schedule channels for clickable mentions
  'CALL_SCHEDULE_EPIC_CHANNEL_ID',
  'CALL_SCHEDULE_29_CLUB_CHANNEL_ID'
];

/**
 * Validate that all required environment variables are set
 * @throws {Error} If any required variables are missing
 */
function validateEnvironment() {
  const missing = REQUIRED_VARS.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    missing.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nCheck your .env file and ensure all required variables are set.');
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Warn about missing recommended vars
  const missingRecommended = RECOMMENDED_VARS.filter(key => !process.env[key]);
  if (missingRecommended.length > 0) {
    console.warn('Missing recommended environment variables:');
    missingRecommended.forEach(varName => console.warn(`   - ${varName}`));
  }

  // Validate database SSL certificate if required
  if (process.env.DATABASE_SSL === 'true' && process.env.CA_CERT_PATH) {
    const certPath = path.resolve(process.env.CA_CERT_PATH);
    if (!fs.existsSync(certPath)) {
      console.warn(`CA certificate not found at: ${certPath}`);
      console.warn('Database connection may fail if SSL is required');
    }
  }

  console.log('Environment validation passed');
}

/**
 * Get environment variable with type casting and default value
 * @param {string} key - Environment variable key
 * @param {*} defaultValue - Default value if not set
 * @param {string} type - Type to cast to ('string', 'number', 'boolean')
 * @returns {*} Environment variable value
 */
function getEnv(key, defaultValue = null, type = 'string') {
  const value = process.env[key];

  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  switch (type) {
    case 'number':
      const num = Number(value);
      return isNaN(num) ? defaultValue : num;

    case 'boolean':
      return value === 'true' || value === '1';

    case 'json':
      try {
        return JSON.parse(value);
      } catch {
        console.warn(`Failed to parse JSON for ${key}, using default`);
        return defaultValue;
      }

    default:
      return value;
  }
}

/**
 * Get all channel IDs as an object
 * @returns {object} Channel ID mappings
 */
function getChannelIds() {
  return {
    input: getEnv('CHANNEL_INPUT_ID'),
    leaderboard: getEnv('CHANNEL_LEADERBOARD_ID'),
    general: getEnv('CHANNEL_GENERAL_ID'),
    scorecard: getEnv('CHANNEL_SCORECARD_ID'),
    journal: getEnv('JOURNAL_CHANNEL_ID'),
    tenseyList: getEnv('TENSEYLIST_CHANNEL_ID'),
    tenseyLeaderboard: getEnv('TENSEY_LEADERBOARD_CHANNEL_ID'),
    factionLuminarchs: getEnv('FACTION_CHANNEL_LUMINARCHS'),
    factionNoctivores: getEnv('FACTION_CHANNEL_NOCTIVORES'),
    freeEventAnnounce: getEnv('FREE_EVENT_ANNOUNCE_CHANNEL_ID'),

    // ✅ NEW: call schedule channels (clickable in embed text)
    callScheduleEpic: getEnv('CALL_SCHEDULE_EPIC_CHANNEL_ID'),
    callSchedule29Club: getEnv('CALL_SCHEDULE_29_CLUB_CHANNEL_ID')
  };
}

/**
 * Get all role IDs as an object
 * @returns {object} Role ID mappings
 */
function getRoleIds() {
  return {
    tiers: {
      'Awkward Initiate': getEnv('ROLE_AWKWARD_INITIATE'),
      'Social Squire': getEnv('ROLE_SOCIAL_SQUIRE'),
      'Bold Explorer': getEnv('ROLE_BOLD_EXPLORER'),
      'Magnetic Challenger': getEnv('ROLE_MAGNETIC_CHALLENGER'),
      'Audacious Knight': getEnv('ROLE_AUDACIOUS_KNIGHT'),
      'Charisma Vanguard': getEnv('ROLE_CHARISMA_VANGUARD'),
      'Seduction Sage': getEnv('ROLE_SEDUCTION_SAGE'),
      'Embodiment Warlord': getEnv('ROLE_EMBODIMENT_WARLORD'),
      'Flirtation Overlord': getEnv('ROLE_FLIRTATION_OVERLORD'),
      'Reality Architect': getEnv('ROLE_REALITY_ARCHITECT'),
      'Galactic Sexy Bastard God-King': getEnv('ROLE_GALACTIC_SEXY_BASTARD')
    },
    factions: {
      Luminarchs: getEnv('ROLE_FACTION_LUMINARCHS'),
      Noctivores: getEnv('ROLE_FACTION_NOCTIVORES')
    },
    rankColors: {
      top1: getEnv('ROLE_RANK_TOP1_COLOR'),
      top3: getEnv('ROLE_RANK_TOP3_COLOR'),
      top10: getEnv('ROLE_RANK_TOP10_COLOR')
    }
  };
}

module.exports = {
  validateEnvironment,
  getEnv,
  getChannelIds,
  getRoleIds
};
