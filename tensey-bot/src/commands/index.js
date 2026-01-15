// ═══════════════════════════════════════════════════════════════════════════════
// TEMP STUB — DO NOT SHIP
// Command registry for Tensey Bot
// ═══════════════════════════════════════════════════════════════════════════════

const { REST, Routes } = require('discord.js');
const config = require('../config/environment');
const logger = require('../utils/logger');

// Import commands
const tenseylistCommand = require('./tenseylist');
const tenseyleaderboardCommand = require('./tenseyleaderboard');

const commands = [
  tenseylistCommand,
  tenseyleaderboardCommand
];

class CommandRegistry {
  static async register(clientId, guildId) {
    try {
      const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);
      
      const commandData = commands.map(cmd => cmd.data.toJSON());
      
      logger.info(`Registering ${commandData.length} commands...`);
      
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commandData }
      );
      
      logger.info('Commands registered successfully');
      
    } catch (err) {
      logger.error('Failed to register commands', err);
      throw err;
    }
  }
  
  static getCommands() {
    return commands;
  }
}

module.exports = CommandRegistry;

