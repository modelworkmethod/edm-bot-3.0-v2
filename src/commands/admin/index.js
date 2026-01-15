/**
 * Admin Commands Export
 */

const { generateCommands } = require('./dynamic-commands');

// Static admin commands
const staticCommands = {
  'admin': require('./admin'),
  'adjust-xp': require('./adjust-xp'),
  'reset-stats': require('./reset-stats'),
  'coaching-dashboard': require('./coaching-dashboard'),
  'start-raid': require('./start-raid'),
  'set-double-xp': require('./set-double-xp'),
  'course-admin': require('./course-admin'),
  'coaching-insights': require('./coaching-insights'),
  'security': require('./security'),
  'trigger-archetype-check': require('./trigger-archetype-check'),
  'sync-nicknames': require('./sync-nicknames')
};

// Generate dynamic commands from templates
const dynamicCommands = generateCommands();

// Merge static and dynamic
const allCommands = { ...staticCommands };

for (const cmd of dynamicCommands) {
  allCommands[cmd.data.name] = cmd;
}

module.exports = allCommands;

