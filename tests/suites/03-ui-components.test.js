/**
 * UI Components Test Suite
 * Tests modals, embeds, buttons, and interactive components
 */

const fs = require('fs');
const path = require('path');
const TestFramework = require('../test-framework');

const test = new TestFramework('UI Components');

test.start();

// ============================================
// MODAL HANDLERS
// ============================================
test.category('MODAL HANDLERS');

const modalHandlerPath = 'src/events/interactionCreate/modalHandler.js';
if (test.testFileExists('Modal handler exists', modalHandlerPath, fs, path)) {
  test.testFileContains('Has handleModalSubmit', modalHandlerPath, 'handleModalSubmit', fs, path);
  test.testFileContains('Has createCoreSocialModal', modalHandlerPath, 'createCoreSocialModal', fs, path);
  test.testFileContains('Has createDatingModal', modalHandlerPath, 'createDatingModal', fs, path);
  test.testFileContains('Has createInnerWorkModal', modalHandlerPath, 'createInnerWorkModal', fs, path);
  test.testFileContains('Has createLearningModal', modalHandlerPath, 'createLearningModal', fs, path);
  test.testFileContains('Has createDailyStateModal', modalHandlerPath, 'createDailyStateModal', fs, path);
  test.testFileContains('Has formatStatWithWeights helper', modalHandlerPath, 'formatStatWithWeights', fs, path);
  
  // Test modal contents
  test.testFileContains('Core Social has Approaches', modalHandlerPath, 'Approaches', fs, path);
  test.testFileContains('Core Social has In Action Release', modalHandlerPath, 'In Action Release', fs, path);
  test.testFileContains('Dating has Dates Had', modalHandlerPath, 'Dates Had', fs, path);
  test.testFileContains('Inner Work has SBMM Meditation', modalHandlerPath, 'SBMM Meditation', fs, path);
  test.testFileContains('Daily State has retention', modalHandlerPath, 'Retention Streak', fs, path);
}

// ============================================
// BUTTON HANDLERS
// ============================================
test.category('BUTTON HANDLERS');

const buttonHandlerPath = 'src/events/interactionCreate/buttonHandler.js';
if (test.testFileExists('Button handler exists', buttonHandlerPath, fs, path)) {
  test.testFileContains('Handles stats_category_core_social', buttonHandlerPath, 'stats_category_core_social', fs, path);
  test.testFileContains('Handles stats_category_dating', buttonHandlerPath, 'stats_category_dating', fs, path);
  test.testFileContains('Handles stats_category_inner_work', buttonHandlerPath, 'stats_category_inner_work', fs, path);
  test.testFileContains('Handles stats_category_learning', buttonHandlerPath, 'stats_category_learning', fs, path);
  test.testFileContains('Handles stats_category_daily_state', buttonHandlerPath, 'stats_category_daily_state', fs, path);
  test.testFileContains('Handles stats_help', buttonHandlerPath, 'stats_help', fs, path);
  test.testFileContains('Handles group_call_yes', buttonHandlerPath, 'group_call_yes', fs, path);
  test.testFileContains('Handles group_call_no', buttonHandlerPath, 'group_call_no', fs, path);
  test.testFileContains('Has handleGroupCallYes function', buttonHandlerPath, 'handleGroupCallYes', fs, path);
  test.testFileContains('Has handleGroupCallNo function', buttonHandlerPath, 'handleGroupCallNo', fs, path);
}

// ============================================
// SELECT MENU HANDLERS
// ============================================
test.category('SELECT MENU HANDLERS');

const selectMenuPath = 'src/events/interactionCreate/selectMenuHandler.js';
test.testFileExists('Select menu handler exists', selectMenuPath, fs, path);

// ============================================
// INTERACTION ROUTER
// ============================================
test.category('INTERACTION ROUTER');

const interactionIndexPath = 'src/events/interactionCreate/index.js';
if (test.testFileExists('Interaction index exists', interactionIndexPath, fs, path)) {
  test.testFileContains('Routes buttons', interactionIndexPath, 'isButton', fs, path);
  test.testFileContains('Routes modals', interactionIndexPath, 'isModalSubmit', fs, path);
}

// ============================================
// SUBMIT STATS UI
// ============================================
test.category('SUBMIT STATS UI');

const submitStatsPath = 'src/commands/stats/submit-stats.js';
if (test.testFileExists('Submit stats command exists', submitStatsPath, fs, path)) {
  test.testFileContains('Has category embed', submitStatsPath, 'Stats Submission', fs, path);
  test.testFileContains('Has Core Social button', submitStatsPath, 'Core Social Stats', fs, path);
  test.testFileContains('Has Dating button', submitStatsPath, 'Dating & Results', fs, path);
  test.testFileContains('Has Inner Work button', submitStatsPath, 'Inner Work', fs, path);
  test.testFileContains('Has Learning button', submitStatsPath, 'Learning', fs, path);
  test.testFileContains('Has Daily State button', submitStatsPath, 'Daily State', fs, path);
  test.testFileContains('Has Help button', submitStatsPath, 'Help', fs, path);
}

// ============================================
// SCORECARD UI
// ============================================
test.category('SCORECARD UI');

const scorecardPath = 'src/commands/stats/scorecard.js';
if (test.testFileExists('Scorecard command exists', scorecardPath, fs, path)) {
  test.testFileContains('Uses generateArchetypeBar', scorecardPath, 'generateArchetypeBar', fs, path);
  test.testFileContains('Uses getArchetypeIcon', scorecardPath, 'getArchetypeIcon', fs, path);
  test.testFileContains('Uses getEncouragementText', scorecardPath, 'getEncouragementText', fs, path);
  test.testFileContains('Shows archetype balance', scorecardPath, 'Archetype Balance', fs, path);
  test.testFileContains('Shows level info', scorecardPath, 'Core Stats', fs, path);
  test.testFileContains('Shows streak', scorecardPath, 'Streak', fs, path);
  test.testFileContains('Has comparison mode', scorecardPath, 'handleComparison', fs, path);
}

// ============================================
// LEADERBOARD UI
// ============================================
test.category('LEADERBOARD UI');

const leaderboardPath = 'src/commands/leaderboard/leaderboard.js';
if (test.testFileExists('Leaderboard command exists', leaderboardPath, fs, path)) {
  test.testFileContains('Shows rankings', leaderboardPath, 'rank', fs, path);
}

// ============================================
// ANNOUNCEMENT EMBEDS
// ============================================
test.category('ANNOUNCEMENT EMBEDS');

const announcementQueuePath = 'src/services/notifications/AnnouncementQueue.js';
if (test.testFileExists('AnnouncementQueue exists', announcementQueuePath, fs, path)) {
  test.testFileContains('Has level-up announcements', announcementQueuePath, 'queueLevelUp', fs, path);
  test.testFileContains('Has archetype announcements', announcementQueuePath, 'queueArchetypeChange', fs, path);
  test.testFileContains('Uses generateArchetypeBar', announcementQueuePath, 'generateArchetypeBar', fs, path);
  test.testFileContains('Shows before/after bars', announcementQueuePath, 'Previous:', fs, path);
  test.testFileContains('Shows percentages', announcementQueuePath, 'toFixed(1)', fs, path);
  test.testFileContains('Has balance guidance', announcementQueuePath, 'getBalanceGuidance', fs, path);
}

// ============================================
// GROUP CALL UI
// ============================================
test.category('GROUP CALL UI');

const groupCallTrackerPath = 'src/jobs/groupCallTracker.js';
if (test.testFileExists('GroupCallTracker exists', groupCallTrackerPath, fs, path)) {
  test.testFileContains('Creates embed', groupCallTrackerPath, 'EmbedBuilder', fs, path);
  test.testFileContains('Has Yes button', groupCallTrackerPath, 'group_call_yes', fs, path);
  test.testFileContains('Has No button', groupCallTrackerPath, 'group_call_no', fs, path);
  test.testFileContains('Auto-deletes message', groupCallTrackerPath, 'delete()', fs, path);
}

// ============================================
// UI UTILITIES
// ============================================
test.category('UI UTILITIES');

test.testFileExists('Plain text replies exist', 'src/utils/plainTextReplies.js', fs, path);

const results = test.end();

// Exit with error code if tests failed
if (!test.allPassed()) {
  process.exit(1);
}

module.exports = results;
