// tensey-bot/src/config/environment.js
const path = require('path');

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name, defaultValue = null) {
  const value = process.env[name];
  return value !== undefined ? value : defaultValue;
}

/**
 * Parse DATABASE_URL if exist, took host, port,
 * user, password and DB name. 
 */
function parseDatabaseFromUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) return {};

  try {
    const u = new URL(url);
    return {
      host: u.hostname || undefined,
      port: u.port || undefined,
      name: (u.pathname || '').replace(/^\//, '') || undefined,
      user: u.username || undefined,
      password: u.password || undefined,
    };
  } catch {
    return {};
  }
}

const dbFromUrl = parseDatabaseFromUrl();

function requiredDbField(envKey, parsedKey) {
  const fromEnv = process.env[envKey];
  if (fromEnv) return fromEnv;

  const fromUrl = dbFromUrl[parsedKey];
  if (fromUrl) return fromUrl;

  throw new Error(`Missing required database field: ${envKey} or DATABASE_URL`);
}

const DB_HOST = requiredDbField('DATABASE_HOST', 'host');
const DB_PORT = parseInt(
  optional('DATABASE_PORT', dbFromUrl.port || '5432'),
  10
);
const DB_NAME = requiredDbField('DATABASE_NAME', 'name');
const DB_USER = requiredDbField('DATABASE_USER', 'user');
const DB_PASSWORD = requiredDbField('DATABASE_PASSWORD', 'password');

// Export config
module.exports = {
  // Discord (Tensey bot)
  DISCORD_TOKEN: required('TENSEY_DISCORD_TOKEN'),
  CLIENT_ID: required('TENSEY_CLIENT_ID'),
  GUILD_ID: required('TENSEY_GUILD_ID'),
  
  // Channels
  // Usamos tus variables existentes del .env
  TENSEYLIST_CHANNEL_ID: optional('TENSEYLIST_CHANNEL_ID'),
  LEADERBOARD_CHANNEL_ID:
    optional('TENSEY_LEADERBOARD_CHANNEL_ID') || optional('LEADERBOARD_CHANNEL_ID'),
  GENERAL_CHANNEL_ID:
    optional('GENERAL_CHANNEL_ID') || optional('CHANNEL_GENERAL_ID'),
  
  // PostgreSQL (Main Bot Database)
  DB_HOST,
  DB_PORT,
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  
  // Behavior
  ANNOUNCE_ENABLED: optional('TENSEY_ANNOUNCE_ENABLED', '1') === '1',
  PIN_TENSEY_BUTTON: optional('PIN_TENSEY_BUTTON', 'true') === 'true',
  PIN_LEADERBOARD_BUTTON: optional('PIN_LEADERBOARD_BUTTON', 'true') === 'true',
  XP_AWARD_DELAY_MS: parseInt(optional('XP_AWARD_DELAY_SECONDS', '60'), 10) * 1000,
  
  // Banners
  BANNER_URL_OPEN_BUTTON: optional('BANNER_URL_OPEN_BUTTON'),
  BANNER_URL_CHECKLIST: optional('BANNER_URL_CHECKLIST'),
  BANNER_URL_LEADERBOARD: optional('BANNER_URL_LEADERBOARD'),
  
  // Logging
  LOG_LEVEL: optional('LOG_LEVEL', 'info'),
  
  // Paths
  SQLITE_PATH: path.join(__dirname, '../../data/tensey.db'),
};
