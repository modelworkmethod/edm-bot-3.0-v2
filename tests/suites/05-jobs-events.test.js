/**
 * Jobs and Events Test Suite
 * Tests scheduled jobs, background jobs, and event handlers
 */

const fs = require('fs');
const path = require('path');
const TestFramework = require('../test-framework');

const test = new TestFramework('Jobs & Events');

test.start();

// ============================================
// SCHEDULED JOBS
// ============================================
test.category('SCHEDULED JOBS');

const jobs = [
  { file: 'src/jobs/duelsFinalizer.js', name: 'Duels Finalizer', critical: true },
  { file: 'src/jobs/wingmanScheduler.js', name: 'Wingman Scheduler', critical: false },
  { file: 'src/jobs/groupCallTracker.js', name: 'Group Call Tracker', critical: true }
];

for (const job of jobs) {
  const exists = test.testFileExists(`${job.name} exists`, job.file, fs, path);
  if (exists) {
    const content = fs.readFileSync(path.join(process.cwd(), job.file), 'utf8');
    
    if (job.name === 'Group Call Tracker') {
      test.testFileContains(`${job.name} has cron scheduling`, job.file, 'cron.schedule', fs, path);
      test.testFileContains(`${job.name} has Sunday schedule`, job.file, "'0 23 * * SUN'", fs, path);
      test.testFileContains(`${job.name} has Wednesday schedule`, job.file, "'30 21 * * WED'", fs, path);
      test.testFileContains(`${job.name} has Saturday schedule`, job.file, "'0 19 * * SAT'", fs, path);
      test.testFileContains(`${job.name} posts check-in`, job.file, 'postGroupCallCheckIn', fs, path);
    }
  }
}

// ============================================
// EVENT HANDLERS
// ============================================
test.category('EVENT HANDLERS');

test.testFileExists('Events index exists', 'src/events/index.js', fs, path);
test.testFileExists('Ready event exists', 'src/events/ready.js', fs, path);
test.testFileExists('MessageCreate event exists', 'src/events/messageCreate.js', fs, path);
test.testFileExists('GuildMemberAdd event exists', 'src/events/guildMemberAdd.js', fs, path);

// Test ready event
const readyPath = 'src/events/ready.js';
if (fs.existsSync(path.join(process.cwd(), readyPath))) {
  test.testFileContains('Ready initializes repositories', readyPath, 'initializeRepositories', fs, path);
  test.testFileContains('Ready initializes services', readyPath, 'initializeServices', fs, path);
  test.testFileContains('Ready registers commands', readyPath, 'registerCommands', fs, path);
  test.testFileContains('Ready starts duels finalizer', readyPath, 'scheduleDuelsFinalizer', fs, path);
  test.testFileContains('Ready starts wingman scheduler', readyPath, 'scheduleWingmanMatcher', fs, path);
  test.testFileContains('Ready starts group call tracker', readyPath, 'GroupCallTracker', fs, path);
}

// Test messageCreate event
const messageCreatePath = 'src/events/messageCreate.js';
if (fs.existsSync(path.join(process.cwd(), messageCreatePath))) {
  test.testFileContains('MessageCreate handles CTJ', messageCreatePath, 'ctjMonitor', fs, path);
  test.testFileContains('MessageCreate handles chat engagement', messageCreatePath, 'chatEngagementMonitor', fs, path);
  test.testFileContains('MessageCreate handles wins', messageCreatePath, 'winsMonitor', fs, path);
}

// ============================================
// INTERACTION HANDLERS
// ============================================
test.category('INTERACTION HANDLERS');

test.testFileExists('InteractionCreate index exists', 'src/events/interactionCreate/index.js', fs, path);
test.testFileExists('Button handler exists', 'src/events/interactionCreate/buttonHandler.js', fs, path);
test.testFileExists('Modal handler exists', 'src/events/interactionCreate/modalHandler.js', fs, path);
test.testFileExists('Select menu handler exists', 'src/events/interactionCreate/selectMenuHandler.js', fs, path);

// ============================================
// AUTO-AWARD SYSTEMS
// ============================================
test.category('AUTO-AWARD SYSTEMS');

const autoAwardSystems = [
  { file: 'src/services/ctj/CTJMonitor.js', name: 'CTJ Monitor' },
  { file: 'src/services/engagement/ChatEngagementMonitor.js', name: 'Chat Engagement Monitor' },
  { file: 'src/services/engagement/WinsMonitor.js', name: 'Wins Monitor' }
];

for (const system of autoAwardSystems) {
  test.testFileExists(`${system.name} exists`, system.file, fs, path);
}

const results = test.end();

// Exit with error code if tests failed
if (!test.allPassed()) {
  process.exit(1);
}

module.exports = results;
