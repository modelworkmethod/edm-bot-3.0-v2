/**
 * Events Index
 * Central export and registration for all event handlers
 */

const ready = require('./ready');
const interactionCreate = require('./interactionCreate');
const messageCreate = require('./messageCreate');
const guildMemberAdd = require('./guildMemberAdd');
const { createLogger } = require('../utils/logger');

const logger = createLogger('EventsIndex');

/**
 * Get all event handlers
 * @returns {Array} Event handler modules
 */
function getEvents() {
  return [ready, interactionCreate, messageCreate, guildMemberAdd].filter(Boolean);
}

/**
 * Register all events on the client
 * @param {import('discord.js').Client} client
 */
function registerEvents(client) {
  const events = getEvents();

  for (const event of events) {
    if (!event || typeof event.name !== 'string' || typeof event.execute !== 'function') {
      logger.warn('[Events] Skipping invalid event module:', event && event.name);
      continue;
    }

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }

  logger.info('All events registered successfully');
}

/**
 * Convenience wrappers (if algo externo las usa)
 */
function handleReady(client) {
  return ready?.execute ? ready.execute(client) : undefined;
}

function handleInteractionCreate(interaction) {
  return interactionCreate?.execute ? interactionCreate.execute(interaction) : undefined;
}

function handleMessageCreate(message) {
  return messageCreate?.execute ? messageCreate.execute(message) : undefined;
}

function handleGuildMemberAdd(member) {
  return guildMemberAdd?.execute ? guildMemberAdd.execute(member) : undefined;
}

module.exports = {
  getEvents,
  registerEvents,
  registerEventHandlers: registerEvents,
  handleReady,
  handleInteractionCreate,
  handleMessageCreate,
  handleGuildMemberAdd,
};
