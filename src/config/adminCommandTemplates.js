/**
 * Admin Command Templates
 * Define reusable command patterns for admin operations
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createLogger } = require('../utils/logger');

const logger = createLogger('AdminTemplates');

/**
 * Get admin command templates
 * @returns {Array} Array of command templates
 */
function getAdminCommandTemplates() {
  return [
    // Add more admin command templates as needed
    // For now, return empty array - static commands handle everything
  ];
}

module.exports = {
  getAdminCommandTemplates
};

