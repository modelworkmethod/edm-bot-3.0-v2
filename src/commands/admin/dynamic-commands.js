/**
 * Dynamic Command Generator
 * Generates admin commands from templates
 */

const { createLogger } = require('../../utils/logger');
const { getAdminCommandTemplates } = require('../../config/adminCommandTemplates');

const logger = createLogger('DynamicCommands');

/**
 * Generate commands from templates
 * @returns {Array} Array of command modules
 */
function generateCommands() {
  const templates = getAdminCommandTemplates();
  const commands = [];

  for (const template of templates) {
    if (!template.enabled) continue;

    commands.push({
      data: template.builder,
      async execute(interaction, services) {
        // Execute template handler
        await template.handler(interaction, services);
      }
    });

    logger.debug('Generated dynamic command', { name: template.name });
  }

  return commands;
}

module.exports = { generateCommands };

