/**
 * Discord client configuration
 * Sets up intents, partials, and client options
 */

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { getEnv } = require('./environment');

/**
 * Get Discord intents based on feature flags
 * @returns {Array<GatewayIntentBits>} Array of intent flags
 */
function getDiscordIntents() {
  const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ];

  // Add presence intent if game activity announcements enabled
  if (getEnv('PRESENCE_INTENT', false, 'boolean')) {
    intents.push(GatewayIntentBits.GuildPresences);
  }

  return intents;
}

/**
 * Get Discord client options
 * @returns {object} Client configuration object
 */
function getDiscordClientOptions() {
  return {
    intents: getDiscordIntents(),
    partials: [Partials.Channel, Partials.Message],
    // Optimize cache for performance
    makeCache: (manager) => {
      // Cache guilds, channels, roles - don't cache messages
      if (manager.name === 'MessageManager') return null;
      return manager.constructor.defaultMakeCache();
    },
    // Sweep settings for memory management
    sweepers: {
      messages: {
        interval: 3600, // Every hour
        lifetime: 1800  // Remove messages older than 30 min
      }
    }
  };
}

/**
 * Create Discord client instance
 * @returns {Client} Configured Discord client
 */
function createDiscordClient() {
  const client = new Client(getDiscordClientOptions());
  
  // Set up basic error handler
  client.on('error', (error) => {
    console.error('Discord client error:', error);
  });

  return client;
}

module.exports = {
  getDiscordIntents,
  getDiscordClientOptions,
  createDiscordClient
};

