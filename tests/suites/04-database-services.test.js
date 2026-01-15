/**
 * Database and Services Test Suite
 * Tests database layer, repositories, and service implementations
 */

const fs = require('fs');
const path = require('path');
const TestFramework = require('../test-framework');

const test = new TestFramework('Database & Services');

test.start();

// ============================================
// DATABASE LAYER
// ============================================
test.category('DATABASE LAYER');

test.testFileExists('PostgreSQL connection exists', 'src/database/postgres.js', fs, path);
test.testFileExists('Migrations runner exists', 'src/database/runMigrations.js', fs, path);
test.testFileExists('Repositories index exists', 'src/database/repositories/index.js', fs, path);

// ============================================
// REPOSITORIES
// ============================================
test.category('REPOSITORIES');

const repositories = [
  { file: 'src/database/repositories/UserRepository.js', name: 'UserRepository' },
  { file: 'src/database/repositories/StatsRepository.js', name: 'StatsRepository' }
];

for (const repo of repositories) {
  const exists = test.testFileExists(`${repo.name} exists`, repo.file, fs, path);
  if (exists) {
    try {
      const RepoClass = require(path.join(process.cwd(), repo.file));
      test.test(`${repo.name} is a class`, () => typeof RepoClass === 'function');
    } catch (error) {
      test.test(`${repo.name} loads`, () => ({ warning: false, message: error.message }));
    }
  }
}

// ============================================
// MIGRATIONS
// ============================================
test.category('MIGRATIONS');

const migrationsDir = 'src/database/migrations';
if (fs.existsSync(path.join(process.cwd(), migrationsDir))) {
  const migrationFiles = fs.readdirSync(path.join(process.cwd(), migrationsDir))
    .filter(f => f.endsWith('.sql'));
  
  test.test(`Found ${migrationFiles.length} migration files`, () => migrationFiles.length > 0);
  test.test('Has initial schema migration', () => migrationFiles.some(f => f.includes('001_')));
  test.test('Has CTJ migration', () => migrationFiles.some(f => f.includes('ctj') || f.includes('019_')));
  test.test('Has wingman migration', () => migrationFiles.some(f => f.includes('wingman') || f.includes('020_')));
  
  console.log(`\n   Total migrations: ${migrationFiles.length}`);
}

// ============================================
// CORE SERVICES
// ============================================
test.category('CORE SERVICES');

const coreServices = [
  { file: 'src/services/user/UserService.js', name: 'UserService' },
  { file: 'src/services/user/ArchetypeService.js', name: 'ArchetypeService' },
  { file: 'src/services/xp/XPCalculator.js', name: 'XPCalculator' },
  { file: 'src/services/xp/LevelCalculator.js', name: 'LevelCalculator' },
  { file: 'src/services/xp/MultiplierService.js', name: 'MultiplierService' },
  { file: 'src/services/xp/SecondaryXPProcessor.js', name: 'SecondaryXPProcessor' },
  { file: 'src/services/stats/StatsProcessor.js', name: 'StatsProcessor' },
  { file: 'src/services/stats/StatsEditService.js', name: 'StatsEditService' }
];

for (const service of coreServices) {
  const exists = test.testFileExists(`${service.name} exists`, service.file, fs, path);
  if (exists) {
    try {
      const ServiceClass = require(path.join(process.cwd(), service.file));
      test.test(`${service.name} exports`, () => ServiceClass !== undefined);
    } catch (error) {
      test.test(`${service.name} loads`, () => ({ warning: false, message: error.message }));
    }
  }
}

// ============================================
// DISCORD SERVICES
// ============================================
test.category('DISCORD SERVICES');

const discordServices = [
  { file: 'src/services/discord/ChannelService.js', name: 'ChannelService' },
  { file: 'src/services/discord/MessageService.js', name: 'MessageService' },
  { file: 'src/services/discord/RoleService.js', name: 'RoleService' },
  { file: 'src/services/discord/RoleSync.js', name: 'RoleSync' }
];

for (const service of discordServices) {
  test.testFileExists(`${service.name} exists`, service.file, fs, path);
}

// ============================================
// FEATURE SERVICES
// ============================================
test.category('FEATURE SERVICES');

const featureServices = [
  { file: 'src/services/barbie/BarbieListManager.js', name: 'BarbieListManager' },
  { file: 'src/services/raids/RaidManager.js', name: 'RaidManager' },
  { file: 'src/services/duels/DuelManager.js', name: 'DuelManager' },
  { file: 'src/services/ctj/CTJService.js', name: 'CTJService' },
  { file: 'src/services/texting/TextingService.js', name: 'TextingService' },
  { file: 'src/services/texting/TextingSimulator.js', name: 'TextingSimulator' },
  { file: 'src/services/factions/FactionService.js', name: 'FactionService' },
  { file: 'src/services/factions/FactionBalancer.js', name: 'FactionBalancer' },
  { file: 'src/services/wingman/WingmanMatcher.js', name: 'WingmanMatcher' },
  { file: 'src/services/tensey/TenseyManager.js', name: 'TenseyManager' },
  { file: 'src/services/leaderboard/LeaderboardService.js', name: 'LeaderboardService' }
];

for (const service of featureServices) {
  test.testFileExists(`${service.name} exists`, service.file, fs, path);
}

// ============================================
// NOTIFICATION SERVICES
// ============================================
test.category('NOTIFICATION SERVICES');

const notificationServices = [
  { file: 'src/services/notifications/AnnouncementQueue.js', name: 'AnnouncementQueue' },
  { file: 'src/services/notifications/ReminderService.js', name: 'ReminderService' }
];

for (const service of notificationServices) {
  test.testFileExists(`${service.name} exists`, service.file, fs, path);
}

// ============================================
// ANALYTICS SERVICES
// ============================================
test.category('ANALYTICS SERVICES');

const analyticsServices = [
  { file: 'src/services/analytics/RiskScorer.js', name: 'RiskScorer' },
  { file: 'src/services/analytics/PatternDetector.js', name: 'PatternDetector' },
  { file: 'src/services/analytics/InterventionGenerator.js', name: 'InterventionGenerator' }
];

for (const service of analyticsServices) {
  test.testFileExists(`${service.name} exists`, service.file, fs, path);
}

// ============================================
// SECURITY SERVICES
// ============================================
test.category('SECURITY SERVICES');

const securityServices = [
  { file: 'src/services/security/WarningSystem.js', name: 'WarningSystem' },
  { file: 'src/services/security/ContentModerator.js', name: 'ContentModerator' }
];

for (const service of securityServices) {
  test.testFileExists(`${service.name} exists`, service.file, fs, path);
}

// ============================================
// MIDDLEWARE
// ============================================
test.category('MIDDLEWARE');

test.testFileExists('RateLimiter exists', 'src/middleware/RateLimiter.js', fs, path);
test.testFileExists('PermissionGuard exists', 'src/middleware/PermissionGuard.js', fs, path);

// ============================================
// SERVICE INITIALIZATION
// ============================================
test.category('SERVICE INITIALIZATION');

const servicesIndexPath = 'src/services/index.js';
if (test.testFileExists('Services index exists', servicesIndexPath, fs, path)) {
  test.testFileContains('Has initializeServices', servicesIndexPath, 'initializeServices', fs, path);
  test.testFileContains('Exports initializeServices', servicesIndexPath, 'module.exports', fs, path);
}

const results = test.end();

// Exit with error code if tests failed
if (!test.allPassed()) {
  process.exit(1);
}

module.exports = results;
