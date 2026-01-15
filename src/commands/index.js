/**
 * Commands Index
 * Central export for all commands
 */

const { Collection } = require('discord.js');
const statsCommands = require('./stats');
const leaderboardCommands = require('./leaderboard');
const adminCommands = require('./admin');
const barbieCommands = require('./barbie');
const courseCommands = require('./course');
const helpCommands = require('./help');
const raidsCommands = require('./raids');
const duelsCommands = require('./duels');
const ctjCommands = require('./ctj');
const textingCommands = require('./texting');
const factionsCommands = require('./factions');
const wingmanCommands = require('./wingman');
const opsCommands = require('./ops');

function addGroup(commands, groupName, groupObj) {
  for (const [name, command] of Object.entries(groupObj)) {
    if (commands.has(name)) {
      const existing = commands.get(name);
      const existingFile = existing?.__file || existing?.data?.name || 'unknown';
      const incomingFile = command?.__file || command?.data?.name || 'unknown';

      console.warn(
        `[CommandsIndex] Duplicate command key "${name}" from group "${groupName}". ` +
        `Keeping existing, skipping incoming. Existing=${existingFile} Incoming=${incomingFile}`
      );
      continue;
    }

    commands.set(name, command);
  }
}

/**
 * Get all commands as a Collection
 */
function getCommands() {
  const commands = new Collection();

  addGroup(commands, 'stats', statsCommands);
  addGroup(commands, 'leaderboard', leaderboardCommands);
  addGroup(commands, 'admin', adminCommands);
  addGroup(commands, 'barbie', barbieCommands);
  addGroup(commands, 'course', courseCommands);
  addGroup(commands, 'help', helpCommands);
  addGroup(commands, 'raids', raidsCommands);
  addGroup(commands, 'duels', duelsCommands);
  addGroup(commands, 'ctj', ctjCommands);
  addGroup(commands, 'texting', textingCommands);
  addGroup(commands, 'factions', factionsCommands);
  addGroup(commands, 'wingman', wingmanCommands);
  addGroup(commands, 'ops', opsCommands);

  return commands;
}

module.exports = {
  getCommands,
  statsCommands,
  leaderboardCommands,
  adminCommands,
  barbieCommands,
  courseCommands,
  helpCommands,
  raidsCommands,
  duelsCommands,
  ctjCommands,
  textingCommands,
  factionsCommands,
  wingmanCommands,
  opsCommands
};
