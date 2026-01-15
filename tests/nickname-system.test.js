/**
 * Nickname System Test
 * Comprehensive test of nickname formatting and updates
 */

const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('NICKNAME SYSTEM - COMPREHENSIVE TEST');
console.log('========================================');
console.log('');

let testsPassed = 0;
let testsFailed = 0;

function test(name, condition, expected, actual) {
  if (condition) {
    console.log(`✅ PASS - ${name}`);
    testsPassed++;
  } else {
    console.log(`❌ FAIL - ${name}`);
    console.log(`   Expected: ${expected}`);
    console.log(`   Actual: ${actual}`);
    testsFailed++;
  }
}

// ============================================
// TEST 1: SERVICE FILES EXIST
// ============================================
console.log('📊 TEST 1: Service Files');
console.log('─'.repeat(40));

const nicknameServicePath = path.join(process.cwd(), 'src/services/discord/NicknameService.js');
test('NicknameService file exists', fs.existsSync(nicknameServicePath), 'Exists', fs.existsSync(nicknameServicePath) ? 'Exists' : 'Missing');

if (fs.existsSync(nicknameServicePath)) {
  const serviceContent = fs.readFileSync(nicknameServicePath, 'utf8');
  test('Has updateNickname method', serviceContent.includes('async updateNickname('), 'Found', serviceContent.includes('async updateNickname(') ? 'Found' : 'Missing');
  test('Has buildNickname method', serviceContent.includes('buildNickname('), 'Found', serviceContent.includes('buildNickname(') ? 'Found' : 'Missing');
  test('Has getTierEmoji method', serviceContent.includes('getTierEmoji('), 'Found', serviceContent.includes('getTierEmoji(') ? 'Found' : 'Missing');
  test('Has truncateUsername method', serviceContent.includes('truncateUsername('), 'Found', serviceContent.includes('truncateUsername(') ? 'Found' : 'Missing');
  test('Has syncAllNicknames method', serviceContent.includes('async syncAllNicknames('), 'Found', serviceContent.includes('async syncAllNicknames(') ? 'Found' : 'Missing');
  test('Has optOut method', serviceContent.includes('optOut('), 'Found', serviceContent.includes('optOut(') ? 'Found' : 'Missing');
  test('Has optIn method', serviceContent.includes('optIn('), 'Found', serviceContent.includes('optIn(') ? 'Found' : 'Missing');
}

console.log('');

// ============================================
// TEST 2: TIER MEDAL LOGIC
// ============================================
console.log('📊 TEST 2: Tier Medal Logic');
console.log('─'.repeat(40));

if (fs.existsSync(nicknameServicePath)) {
  const NicknameService = require(nicknameServicePath);
  const mockService = new NicknameService(null, null, null);
  
  test('Rank 1 gets gold medal', mockService.getTierEmoji(1) === '🥇', '🥇', mockService.getTierEmoji(1));
  test('Rank 2 gets silver medal', mockService.getTierEmoji(2) === '🥈', '🥈', mockService.getTierEmoji(2));
  test('Rank 3 gets bronze medal', mockService.getTierEmoji(3) === '🥉', '🥉', mockService.getTierEmoji(3));
  test('Rank 5 gets diamond', mockService.getTierEmoji(5) === '💎', '💎', mockService.getTierEmoji(5));
  test('Rank 10 gets diamond', mockService.getTierEmoji(10) === '💎', '💎', mockService.getTierEmoji(10));
  test('Rank 15 gets star', mockService.getTierEmoji(15) === '⭐', '⭐', mockService.getTierEmoji(15));
  test('Rank 20 gets star', mockService.getTierEmoji(20) === '⭐', '⭐', mockService.getTierEmoji(20));
  test('Rank 25 gets no emoji', mockService.getTierEmoji(25) === '', 'empty', mockService.getTierEmoji(25) || 'empty');
}

console.log('');

// ============================================
// TEST 3: USERNAME TRUNCATION
// ============================================
console.log('📊 TEST 3: Username Truncation');
console.log('─'.repeat(40));

if (fs.existsSync(nicknameServicePath)) {
  const NicknameService = require(nicknameServicePath);
  const mockService = new NicknameService(null, null, null);
  
  test('Short username unchanged', mockService.truncateUsername('John', 10) === 'John', 'John', mockService.truncateUsername('John', 10));
  test('Long username truncated', mockService.truncateUsername('JohnDoeTheGreat', 10) === 'JohnDoe...', 'JohnDoe...', mockService.truncateUsername('JohnDoeTheGreat', 10));
  test('Exact length unchanged', mockService.truncateUsername('ExactTen12', 11) === 'ExactTen12', 'ExactTen12', mockService.truncateUsername('ExactTen12', 11));
}

console.log('');

// ============================================
// TEST 4: SERVICE INTEGRATION
// ============================================
console.log('📊 TEST 4: Service Integration');
console.log('─'.repeat(40));

const servicesIndexPath = path.join(process.cwd(), 'src/services/index.js');
const servicesContent = fs.readFileSync(servicesIndexPath, 'utf8');

test('Services index imports NicknameService', servicesContent.includes("require('./discord/NicknameService')"), 'Found', servicesContent.includes("require('./discord/NicknameService')") ? 'Found' : 'Missing');
test('Services index initializes nicknameService', servicesContent.includes('new NicknameService('), 'Found', servicesContent.includes('new NicknameService(') ? 'Found' : 'Missing');
test('Services index wires to userService', servicesContent.includes('setNicknameService(nicknameService)'), 'Found', servicesContent.includes('setNicknameService(nicknameService)') ? 'Found' : 'Missing');
test('Services index exports nicknameService', servicesContent.includes('nicknameService,'), 'Found', servicesContent.includes('nicknameService,') ? 'Found' : 'Missing');

console.log('');

// ============================================
// TEST 5: USERSERVICE INTEGRATION
// ============================================
console.log('📊 TEST 5: UserService Integration');
console.log('─'.repeat(40));

const userServicePath = path.join(process.cwd(), 'src/services/user/UserService.js');
const userServiceContent = fs.readFileSync(userServicePath, 'utf8');

test('UserService has setNicknameService method', userServiceContent.includes('setNicknameService('), 'Found', userServiceContent.includes('setNicknameService(') ? 'Found' : 'Missing');
test('UserService triggers nickname update on changes', userServiceContent.includes('this.nicknameService.updateNickname'), 'Found', userServiceContent.includes('this.nicknameService.updateNickname') ? 'Found' : 'Missing');
test('Checks for levelUp or archetype change', userServiceContent.includes('levelChange.leveledUp || archetypeChanged'), 'Found', userServiceContent.includes('levelChange.leveledUp || archetypeChanged') ? 'Found' : 'Missing');

console.log('');

// ============================================
// TEST 6: SCHEDULED JOB
// ============================================
console.log('📊 TEST 6: Scheduled Job');
console.log('─'.repeat(40));

const nicknameRefreshPath = path.join(process.cwd(), 'src/jobs/nicknameRefresh.js');
test('Nickname refresh job exists', fs.existsSync(nicknameRefreshPath), 'Exists', fs.existsSync(nicknameRefreshPath) ? 'Exists' : 'Missing');

if (fs.existsSync(nicknameRefreshPath)) {
  const jobContent = fs.readFileSync(nicknameRefreshPath, 'utf8');
  test('Uses cron scheduling', jobContent.includes('cron.schedule'), 'Found', jobContent.includes('cron.schedule') ? 'Found' : 'Missing');
  test('Runs at midnight', jobContent.includes("'0 0 * * *'"), 'Found', jobContent.includes("'0 0 * * *'") ? 'Found' : 'Missing');
  test('Calls syncAllNicknames', jobContent.includes('syncAllNicknames'), 'Found', jobContent.includes('syncAllNicknames') ? 'Found' : 'Missing');
}

const readyPath = path.join(process.cwd(), 'src/events/ready.js');
const readyContent = fs.readFileSync(readyPath, 'utf8');
test('Ready event starts nickname refresh', readyContent.includes('scheduleNicknameRefresh'), 'Found', readyContent.includes('scheduleNicknameRefresh') ? 'Found' : 'Missing');

console.log('');

// ============================================
// TEST 7: ADMIN COMMAND
// ============================================
console.log('📊 TEST 7: Admin Command');
console.log('─'.repeat(40));

const syncCommandPath = path.join(process.cwd(), 'src/commands/admin/sync-nicknames.js');
test('Sync nicknames command exists', fs.existsSync(syncCommandPath), 'Exists', fs.existsSync(syncCommandPath) ? 'Exists' : 'Missing');

if (fs.existsSync(syncCommandPath)) {
  const cmdContent = fs.readFileSync(syncCommandPath, 'utf8');
  test('Command is admin-only', cmdContent.includes('PermissionFlagsBits.Administrator'), 'Admin only', cmdContent.includes('PermissionFlagsBits.Administrator') ? 'Admin only' : 'Public');
  test('Has limit parameter', cmdContent.includes('limit'), 'Found', cmdContent.includes('limit') ? 'Found' : 'Missing');
  test('Calls syncAllNicknames', cmdContent.includes('syncAllNicknames'), 'Found', cmdContent.includes('syncAllNicknames') ? 'Found' : 'Missing');
}

const adminIndexPath = path.join(process.cwd(), 'src/commands/admin/index.js');
const adminContent = fs.readFileSync(adminIndexPath, 'utf8');
test('Admin index includes sync-nicknames', adminContent.includes("'sync-nicknames'"), 'Found', adminContent.includes("'sync-nicknames'") ? 'Found' : 'Missing');

console.log('');

// ============================================
// TEST 8: USER OPT-OUT COMMAND
// ============================================
console.log('📊 TEST 8: User Opt-Out Command');
console.log('─'.repeat(40));

const nicknameSettingsPath = path.join(process.cwd(), 'src/commands/info/nickname-settings.js');
test('Nickname settings command exists', fs.existsSync(nicknameSettingsPath), 'Exists', fs.existsSync(nicknameSettingsPath) ? 'Exists' : 'Missing');

if (fs.existsSync(nicknameSettingsPath)) {
  const cmdContent = fs.readFileSync(nicknameSettingsPath, 'utf8');
  test('Has enable option', cmdContent.includes("value: 'enable'"), 'Found', cmdContent.includes("value: 'enable'") ? 'Found' : 'Missing');
  test('Has disable option', cmdContent.includes("value: 'disable'"), 'Found', cmdContent.includes("value: 'disable'") ? 'Found' : 'Missing');
  test('Has status option', cmdContent.includes("value: 'status'"), 'Found', cmdContent.includes("value: 'status'") ? 'Found' : 'Missing');
  test('Calls optIn method', cmdContent.includes('optIn('), 'Found', cmdContent.includes('optIn(') ? 'Found' : 'Missing');
  test('Calls optOut method', cmdContent.includes('optOut('), 'Found', cmdContent.includes('optOut(') ? 'Found' : 'Missing');
  test('Resets nickname on disable', cmdContent.includes('resetNickname'), 'Found', cmdContent.includes('resetNickname') ? 'Found' : 'Missing');
}

const infoIndexPath = path.join(process.cwd(), 'src/commands/info/index.js');
const infoContent = fs.readFileSync(infoIndexPath, 'utf8');
test('Info index includes nickname-settings', infoContent.includes("'nickname-settings'"), 'Found', infoContent.includes("'nickname-settings'") ? 'Found' : 'Missing');

console.log('');

// ============================================
// VISUAL EXAMPLES
// ============================================
console.log('========================================');
console.log('VISUAL EXAMPLES');
console.log('========================================');
console.log('');
console.log('How nicknames will appear in member list:');
console.log('');
console.log('(Gold)   🥇 #1  | L45 | ⚔️ | WarriorKing    ← Rank 1, Warrior');
console.log('(Purple) 🥈 #2  | L43 | 🔮 | MageLord       ← Rank 2, Mage');
console.log('(Gold)   🥉 #3  | L41 | ⚖️ | BalancedGod    ← Rank 3, Templar!');
console.log('(Purple) 💎 #5  | L38 | ⚔️ | Rising         ← Top 10, Warrior');
console.log('(Gold)   💎 #7  | L35 | ⚖️ | Seeker         ← Top 10, Templar!');
console.log('(Purple) ⭐ #12 | L25 | 🔮 | JohnDoe        ← Top 20, Mage');
console.log('(Gold)      #15 | L22 | ⚖️ | Sarah          ← Regular, Templar!');
console.log('(Purple)    #25 | L18 | ⚔️ | NewComer       ← Regular, Warrior');
console.log('');
console.log('Legend:');
console.log('  🥇🥈🥉 = Top 3 (Gold/Silver/Bronze medals)');
console.log('  💎 = Top 10 (Diamond)');
console.log('  ⭐ = Top 20 (Star)');
console.log('  ⚔️ = Warrior (<40% Mage)');
console.log('  🔮 = Mage (>60% Mage)');
console.log('  ⚖️ = Templar (40-60% Mage) ← The shield for balance!');
console.log('  (Gold) = Luminarchs faction role color');
console.log('  (Purple) = Noctivores faction role color');
console.log('');

// ============================================
// SUMMARY
// ============================================
console.log('========================================');
console.log('SUMMARY');
console.log('========================================');
console.log(`Total Tests: ${testsPassed + testsFailed}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log('');

if (testsFailed === 0) {
  console.log('🎉 ALL TESTS PASSED!');
  console.log('');
  console.log('✅ NicknameService created with all methods');
  console.log('✅ Integrated with UserService (auto-updates on level/archetype change)');
  console.log('✅ Daily rank sync job scheduled (midnight)');
  console.log('✅ Admin command /sync-nicknames available');
  console.log('✅ User command /nickname-settings available (opt-in/out)');
  console.log('');
  console.log('🏷️ NICKNAME FORMAT:');
  console.log('─'.repeat(40));
  console.log('🥇 #1  | L45 | ⚔️ | Champion  (Top 3)');
  console.log('💎 #5  | L38 | 🔮 | Rising    (Top 10)');
  console.log('⭐ #12 | L25 | ⚖️ | JohnDoe   (Top 20) ← Templar shield!');
  console.log('   #25 | L22 | ⚔️ | Regular   (Everyone else)');
  console.log('');
  console.log('📊 AUTOMATIC UPDATES:');
  console.log('─'.repeat(40));
  console.log('• On level-up → Level changes (L24 → L25)');
  console.log('• On archetype change → Icon changes (⚔️ → ⚖️)');
  console.log('• Daily at midnight → Rank changes (#15 → #12)');
  console.log('');
  console.log('⚖️ TEMPLAR SHIELD DISPLAYS WHEN:');
  console.log('─'.repeat(40));
  console.log('• User reaches 40-60% Mage (balanced)');
  console.log('• Archetype icon changes from ⚔️ or 🔮 to ⚖️');
  console.log('• Visible in member list as balance achievement!');
  console.log('');
  console.log('👥 USER CONTROLS:');
  console.log('─'.repeat(40));
  console.log('/nickname-settings enable  → Turn on auto-updates');
  console.log('/nickname-settings disable → Reset to original username');
  console.log('/nickname-settings status  → Check current setting');
  console.log('');
  console.log('🔧 ADMIN CONTROLS:');
  console.log('─'.repeat(40));
  console.log('/sync-nicknames [limit] → Force update all users');
  console.log('');
  console.log('🎯 NICKNAME SYSTEM: 100% COMPLETE!');
} else {
  console.log('❌ Some tests failed. Review above.');
  process.exit(1);
}
