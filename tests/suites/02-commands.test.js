/**
 * Commands Test Suite
 * Tests all 18+ bot commands for existence and structure
 */

const fs = require('fs');
const path = require('path');
const TestFramework = require('../test-framework');

const test = new TestFramework('Commands');

test.start();

// Define all commands that should exist
const COMMANDS = {
  stats: [
    { file: 'src/commands/stats/submit-stats.js', name: '/submit-stats', critical: true },
    { file: 'src/commands/stats/scorecard.js', name: '/scorecard', critical: true },
    { file: 'src/commands/stats/submit-past-stats.js', name: '/submit-past-stats', critical: true },
    { file: 'src/commands/stats/stats-edit.js', name: '/stats-edit', critical: true },
    { file: 'src/commands/stats/stats-delete.js', name: '/stats-delete', critical: true },
    { file: 'src/commands/stats/stats-days.js', name: '/stats-days', critical: true }
  ],
  leaderboard: [
    { file: 'src/commands/leaderboard/leaderboard.js', name: '/leaderboard', critical: true },
    { file: 'src/commands/leaderboard/faction-stats.js', name: '/faction-stats', critical: true }
  ],
  admin: [
    { file: 'src/commands/admin/admin.js', name: '/admin', critical: true },
    { file: 'src/commands/admin/adjust-xp.js', name: '/adjust-xp', critical: true },
    { file: 'src/commands/admin/reset-stats.js', name: '/reset-stats', critical: true },
    { file: 'src/commands/admin/coaching-dashboard.js', name: '/coaching-dashboard', critical: true },
    { file: 'src/commands/admin/set-double-xp.js', name: '/set-double-xp', critical: true },
    { file: 'src/commands/admin/course-admin.js', name: '/course-admin', critical: true },
    { file: 'src/commands/admin/coaching-insights.js', name: '/coaching-insights', critical: true },
    { file: 'src/commands/admin/security.js', name: '/security', critical: true },
    { file: 'src/commands/admin/trigger-archetype-check.js', name: '/trigger-archetype-check', critical: true },
    { file: 'src/commands/admin/start-raid.js', name: '/start-raid', critical: true }
  ],
  help: [
    { file: 'src/commands/help/help.js', name: '/help', critical: true },
    { file: 'src/commands/help/help-commands.js', name: '/help-commands', critical: true }
  ],
  barbie: [
    { file: 'src/commands/barbie/barbie.js', name: '/barbie', critical: true }
  ],
  course: [
    { file: 'src/commands/course/course.js', name: '/course', critical: true }
  ],
  raids: [
    { file: 'src/commands/raids/raid-status.js', name: '/raid-status', critical: true }
  ],
  ctj: [
    { file: 'src/commands/ctj/journal.js', name: '/journal', critical: true },
    { file: 'src/commands/ctj/breakthroughs.js', name: '/breakthroughs', critical: true }
  ],
  duels: [
    { file: 'src/commands/duels/duel.js', name: '/duel', critical: true }
  ],
  factions: [
    { file: 'src/commands/factions/faction-admin.js', name: '/faction-admin', critical: true }
  ],
  ops: [
    { file: 'src/commands/ops/preflight.js', name: '/preflight', critical: true },
    { file: 'src/commands/ops/status.js', name: '/status', critical: true }
  ],
  texting: [
    { file: 'src/commands/texting/texting-practice.js', name: '/texting-practice', critical: false }
  ],
  wingman: [
    { file: 'src/commands/wingman/wingman-admin.js', name: '/wingman-admin', critical: false }
  ],
  info: [
    { file: 'src/commands/info/archetype.js', name: '/archetype', critical: false }
  ]
};

// Test each command category
for (const [category, commands] of Object.entries(COMMANDS)) {
  test.category(`${category.toUpperCase()} COMMANDS`);
  
  for (const cmd of commands) {
    // Test file exists
    const exists = test.testFileExists(`${cmd.name} file exists`, cmd.file, fs, path);
    
    if (exists) {
      // Test file has required exports
      try {
        const module = require(path.join(process.cwd(), cmd.file));
        test.test(`${cmd.name} exports module`, () => module !== undefined);
        test.test(`${cmd.name} has data property`, () => module.data !== undefined);
        test.test(`${cmd.name} has execute method`, () => typeof module.execute === 'function');
        
        // Check if it's a SlashCommandBuilder
        if (module.data) {
          test.test(`${cmd.name} has valid command name`, () => {
            return module.data.name !== undefined && module.data.name.length > 0;
          });
          test.test(`${cmd.name} has description`, () => {
            return module.data.description !== undefined && module.data.description.length > 0;
          });
        }
      } catch (error) {
        test.test(`${cmd.name} loads without error`, () => ({ warning: false, message: error.message }));
      }
    }
  }
}

// ============================================
// COMMAND REGISTRY
// ============================================
test.category('COMMAND REGISTRY');

test.testFileExists('Command registry exists', 'src/commands/commandRegistry.js', fs, path);
test.testFileExists('Commands index exists', 'src/commands/index.js', fs, path);

// Test command index exports
const commandIndexPath = 'src/commands/index.js';
if (fs.existsSync(path.join(process.cwd(), commandIndexPath))) {
  try {
    const commandIndex = require(path.join(process.cwd(), commandIndexPath));
    test.test('Commands index exports getCommands', () => typeof commandIndex.getCommands === 'function');
  } catch (error) {
    test.test('Commands index loads', () => ({ warning: false, message: error.message }));
  }
}

// ============================================
// COMMAND SUMMARY
// ============================================
test.category('COMMAND SUMMARY');

let totalCommands = 0;
let criticalCommands = 0;
let optionalCommands = 0;

for (const commands of Object.values(COMMANDS)) {
  totalCommands += commands.length;
  criticalCommands += commands.filter(c => c.critical).length;
  optionalCommands += commands.filter(c => !c.critical).length;
}

console.log('');
console.log(`Total Commands: ${totalCommands}`);
console.log(`Critical Commands: ${criticalCommands}`);
console.log(`Optional Commands: ${optionalCommands}`);
console.log('');

const results = test.end();

// Exit with error code if critical tests failed
if (!test.allPassed()) {
  process.exit(1);
}

module.exports = results;
