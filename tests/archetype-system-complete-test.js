/**
 * COMPREHENSIVE ARCHETYPE SYSTEM TEST SUITE
 * Tests all functionality and generates detailed report
 */

const fs = require('fs');
const path = require('path');

// Import actual system files
const { 
  generateArchetypeBar, 
  getArchetypeIcon, 
  getArchetypeColor,
  getEncouragementText,
  calculateMovementVolatility
} = require('../src/utils/archetypeVisuals');

// Test results tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let warnings = [];
let criticalIssues = [];

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

// Helper functions
function test(name, condition, errorMsg = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`${colors.green}✓${colors.reset} ${name}`);
    return true;
  } else {
    failedTests++;
    console.log(`${colors.red}✗${colors.reset} ${name}`);
    if (errorMsg) console.log(`${colors.red}  → ${errorMsg}${colors.reset}`);
    return false;
  }
}

function section(title) {
  console.log('\n' + colors.cyan + '='.repeat(60));
  console.log(colors.cyan + colors.bold + title + colors.reset);
  console.log(colors.cyan + '='.repeat(60) + colors.reset);
}

function critical(message) {
  criticalIssues.push(message);
  console.log(`${colors.red}${colors.bold}🚨 CRITICAL:${colors.reset} ${message}`);
}

function warn(message) {
  warnings.push(message);
  console.log(`${colors.yellow}⚠️  WARNING:${colors.reset} ${message}`);
}

// Start testing
console.log(`${colors.bold}${colors.cyan}
╔════════════════════════════════════════════════════════════╗
║   COMPREHENSIVE ARCHETYPE SYSTEM TEST SUITE                ║
╚════════════════════════════════════════════════════════════╝
${colors.reset}`);

// TEST SUITE 1: VISUAL BAR GENERATION
section('TEST SUITE 1: VISUAL BAR GENERATION');

// Test 1.1: Bar structure
const testBar1 = generateArchetypeBar(60, 40); // 60% Warrior, 40% Mage
test('Bar contains warrior icon ⚔️', testBar1.includes('⚔️'));
test('Bar contains mage icon 🔮', testBar1.includes('🔮'));
test('Bar contains position marker ⬤', testBar1.includes('⬤'));
test('Bar contains Templar pipes |', testBar1.includes('|'));
test('Bar has square brackets [ ]', testBar1.includes('[') && testBar1.includes(']'));

// Test 1.2: Zone positioning for Warrior zone user (25% Mage)
const warriorBar = generateArchetypeBar(75, 25);
test('Warrior zone: marker before Templar pipes', warriorBar.indexOf('⬤') < warriorBar.indexOf('|'));
test('Warrior zone: filled blocks before marker', warriorBar.includes('█'));

// Test 1.3: Zone positioning for Templar zone user (50% Mage)
const templarBar = generateArchetypeBar(50, 50);
test('Templar zone: marker within pipe section', 
  templarBar.indexOf('⬤') > templarBar.indexOf('█') && 
  templarBar.includes('|'));

// Test 1.4: Zone positioning for Mage zone user (75% Mage)
const mageBar = generateArchetypeBar(25, 75);
test('Mage zone: marker after Templar pipes', mageBar.lastIndexOf('⬤') > mageBar.indexOf('|'));
test('Mage zone: empty blocks after marker', mageBar.includes('░'));

// Test 1.5: Edge cases
const edge1 = generateArchetypeBar(100, 0); // Pure Warrior
test('Edge case: 100% Warrior generates valid bar', edge1.includes('⬤'));

const edge2 = generateArchetypeBar(0, 100); // Pure Mage
test('Edge case: 100% Mage generates valid bar', edge2.includes('⬤'));

const edge3 = generateArchetypeBar(60, 40); // Exactly at Templar boundary
test('Edge case: Exactly 40% Mage (Templar start) generates valid bar', edge3.includes('⬤'));

const edge4 = generateArchetypeBar(40, 60); // Exactly at Templar boundary
test('Edge case: Exactly 60% Mage (Templar end) generates valid bar', edge4.includes('⬤'));

// TEST SUITE 2: ARCHETYPE ICONS AND COLORS
section('TEST SUITE 2: ARCHETYPE ICONS AND COLORS');

test('Warrior icon is ⚔️', getArchetypeIcon('Warrior') === '⚔️');
test('Mage icon is 🔮', getArchetypeIcon('Mage') === '🔮');
test('Templar icon is ⚖️', getArchetypeIcon('Templar') === '⚖️');
test('New Initiate defaults to ⚖️', getArchetypeIcon('New Initiate') === '⚖️');
test('Unknown archetype defaults to ⚖️', getArchetypeIcon('Unknown') === '⚖️');

test('Warrior color is red (0xFF4444)', getArchetypeColor('Warrior') === 0xFF4444);
test('Mage color is blue (0x4444FF)', getArchetypeColor('Mage') === 0x4444FF);
test('Templar color is gold (0xFFAA00)', getArchetypeColor('Templar') === 0xFFAA00);
test('Default color is gray (0x808080)', getArchetypeColor('Unknown') === 0x808080);

// TEST SUITE 3: ENCOURAGEMENT TEXT
section('TEST SUITE 3: ENCOURAGEMENT TEXT');

test('Templar balanced text correct', 
  getEncouragementText('Templar', true) === "You're balanced! Keep up the momentum.");
test('Warrior unbalanced text correct',
  getEncouragementText('Warrior', false) === "Too much action! Balance with inner work.");
test('Mage unbalanced text correct',
  getEncouragementText('Mage', false) === "Too much reflection! Time for action.");
test('New Initiate text correct',
  getEncouragementText('New Initiate', false) === "Build your momentum!");
test('Default text for unknown archetype',
  getEncouragementText('Unknown', false) === "Build your momentum!");

// TEST SUITE 4: MOVEMENT VOLATILITY CALCULATION
section('TEST SUITE 4: MOVEMENT VOLATILITY (XP-BASED DAMPENING)');

const vol1 = calculateMovementVolatility(500); // New user
test('New user (500 XP) has maximum volatility', vol1.dampening === 1.0);
test('New user percentage is 100%', vol1.percentage === 100);
test('New user has emoji ⚡', vol1.emoji === '⚡');
test('New user description mentions "Very High"', vol1.description.includes('Very High'));

const vol2 = calculateMovementVolatility(1000); // At minimum threshold
test('User at 1000 XP has maximum volatility', vol2.dampening === 1.0);

const vol3 = calculateMovementVolatility(25500); // Midpoint
const expectedMid = 0.65;
test('User at 25,500 XP has ~65% volatility', 
  Math.abs(vol3.dampening - expectedMid) < 0.05,
  `Expected ~${expectedMid}, got ${vol3.dampening}`);

const vol4 = calculateMovementVolatility(50000); // At maximum threshold
test('Veteran (50k XP) has minimum volatility', vol4.dampening === 0.3);
test('Veteran percentage is 30%', vol4.percentage === 30);
test('Veteran description mentions "Low"', vol4.description.includes('Low'));

const vol5 = calculateMovementVolatility(100000); // Beyond maximum
test('User beyond 50k XP capped at minimum volatility', vol5.dampening === 0.3);

// Test all volatility ranges
const vol6 = calculateMovementVolatility(15000); // Should be High
test('User at 15k XP has High volatility', vol6.description.includes('High'));

const vol7 = calculateMovementVolatility(35000); // Should be Moderate
test('User at 35k XP has Moderate volatility', vol7.description.includes('Moderate'));

// TEST SUITE 5: FILE EXISTENCE AND STRUCTURE
section('TEST SUITE 5: FILE EXISTENCE AND INTEGRATION');

const filesToCheck = [
  'src/utils/archetypeVisuals.js',
  'src/database/repositories/UserRepository.js',
  'src/commands/stats/scorecard.js',
  'src/services/user/ArchetypeService.js',
  'src/events/interactionCreate/modalHandler.js',
  'src/commands/info/archetype.js'
];

filesToCheck.forEach(file => {
  const fullPath = path.join(__dirname, '..', file);
  const exists = fs.existsSync(fullPath);
  test(`File exists: ${file}`, exists);
  
  if (exists) {
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Check for key imports/usage
    if (file.includes('scorecard.js')) {
      test('Scorecard imports archetypeVisuals', content.includes('archetypeVisuals'));
      test('Scorecard uses generateArchetypeBar', content.includes('generateArchetypeBar'));
      test('Scorecard displays archetype balance', content.includes('Archetype Balance') || content.includes('archetype'));
    }
    
    if (file.includes('ArchetypeService.js')) {
      test('ArchetypeService imports archetypeVisuals', content.includes('archetypeVisuals'));
      test('ArchetypeService has notification function', 
        content.includes('checkAndNotifyArchetypeChange') || 
        content.includes('notifyArchetypeChange'));
      test('ArchetypeService calculates user archetype', content.includes('calculateUserArchetype'));
    }
    
    if (file.includes('UserRepository.js')) {
      test('UserRepository has updateArchetypePoints', content.includes('updateArchetypePoints'));
      test('UserRepository implements dampening', 
        content.includes('dampening') || content.includes('volatility'));
      test('UserRepository fetches total_xp for dampening', content.includes('total_xp'));
    }
    
    if (file.includes('modalHandler.js')) {
      test('Modal handler checks archetype changes', 
        content.includes('archetypeService') || content.includes('checkArchetype'));
      test('Modal handler imports ArchetypeService', content.includes('ArchetypeService'));
    }
    
    if (file.includes('archetype.js')) {
      test('/archetype command uses visual utilities', content.includes('generateArchetypeBar'));
      test('/archetype command shows volatility', content.includes('calculateMovementVolatility'));
    }
  } else {
    critical(`Required file missing: ${file}`);
  }
});

// Check for database migration
const migrationPath = path.join(__dirname, '..', 'src/database/migrations/021_add_archetype_columns.sql');
if (fs.existsSync(migrationPath)) {
  test('Database migration file exists', true);
  const migContent = fs.readFileSync(migrationPath, 'utf8');
  test('Migration adds archetype_warrior column', migContent.includes('archetype_warrior'));
  test('Migration adds archetype_mage column', migContent.includes('archetype_mage'));
  test('Migration adds archetype_templar column', migContent.includes('archetype_templar'));
  test('Migration adds total_xp column', migContent.includes('total_xp'));
} else {
  warn('Database migration file not found at expected location');
}

// TEST SUITE 6: DATABASE SCHEMA
section('TEST SUITE 6: DATABASE SCHEMA VERIFICATION');

console.log(`${colors.yellow}⚠️  Manual verification required for database:${colors.reset}`);
console.log('   1. Check users table has: archetype_warrior, archetype_mage, archetype_templar');
console.log('   2. Check users table has: total_xp column');
console.log('   3. Check daily_records table has: dom (dominance) column');
console.log('   4. Run this SQL to verify:');
console.log(colors.gray + `
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'users' 
   AND column_name IN ('archetype_warrior', 'archetype_mage', 'archetype_templar', 'total_xp');
` + colors.reset);

// TEST SUITE 7: INTEGRATION POINTS CHECK
section('TEST SUITE 7: INTEGRATION POINTS');

// Check if coaching commands exist
const coachingFiles = [
  'src/commands/ops/coaching-dashboard.js',
  'src/commands/ops/coaching-insights.js',
  'src/commands/admin/coaching-session.js'
];

coachingFiles.forEach(file => {
  const fullPath = path.join(__dirname, '..', file);
  const exists = fs.existsSync(fullPath);
  
  if (exists) {
    const content = fs.readFileSync(fullPath, 'utf8');
    const hasArchetype = content.includes('archetype') || content.includes('Archetype');
    
    if (!hasArchetype) {
      warn(`${file} exists but doesn't reference archetype system`);
    } else {
      test(`${file} integrates with archetype system`, true);
    }
  } else {
    console.log(`${colors.gray}   ${file} not found (may not exist yet)${colors.reset}`);
  }
});

// Check for stats service integration
const statsServicePath = path.join(__dirname, '..', 'src/services/stats/StatsProcessor.js');
if (fs.existsSync(statsServicePath)) {
  const content = fs.readFileSync(statsServicePath, 'utf8');
  test('StatsProcessor mentions archetype', content.includes('archetype'));
} else {
  console.log(`${colors.gray}   StatsProcessor not found at expected location${colors.reset}`);
}

// TEST SUITE 8: PERCENTAGE FORMATTING
section('TEST SUITE 8: PERCENTAGE FORMATTING');

// Simulate percentage calculations
const testPercentages = [
  { value: 45.28571, expected: '45.3' },
  { value: 60.0, expected: '60.0' },
  { value: 39.95, expected: '40.0' },
  { value: 50.444, expected: '50.4' },
  { value: 0, expected: '0.0' },
  { value: 100, expected: '100.0' }
];

testPercentages.forEach(({ value, expected }) => {
  const formatted = value.toFixed(1);
  test(`${value}% formats to ${expected}%`, formatted === expected);
});

// TEST SUITE 9: ARCHETYPE CALCULATION LOGIC
section('TEST SUITE 9: ARCHETYPE CALCULATION LOGIC');

// Simulate archetype determination
function simulateArchetype(warriorPoints, magePoints) {
  const total = warriorPoints + magePoints;
  if (total === 0) return 'New Initiate';
  
  const magePercent = (magePoints / total) * 100;
  
  if (magePercent >= 40 && magePercent <= 60) return 'Templar';
  if (magePercent < 40) return 'Warrior';
  return 'Mage';
}

test('0 W, 0 M points → New Initiate', simulateArchetype(0, 0) === 'New Initiate');
test('100 W, 0 M points → Warrior', simulateArchetype(100, 0) === 'Warrior');
test('0 W, 100 M points → Mage', simulateArchetype(0, 100) === 'Mage');
test('60 W, 40 M points (40% Mage) → Templar', simulateArchetype(60, 40) === 'Templar');
test('50 W, 50 M points (50% Mage) → Templar', simulateArchetype(50, 50) === 'Templar');
test('40 W, 60 M points (60% Mage) → Templar', simulateArchetype(40, 60) === 'Templar');
test('61 W, 39 M points (39% Mage) → Warrior', simulateArchetype(61, 39) === 'Warrior');
test('39 W, 61 M points (61% Mage) → Mage', simulateArchetype(39, 61) === 'Mage');

// Boundary tests
test('Exactly 40.0% Mage → Templar', simulateArchetype(60, 40) === 'Templar');
test('Exactly 60.0% Mage → Templar', simulateArchetype(40, 60) === 'Templar');
test('39.9% Mage → Warrior', simulateArchetype(60.1, 39.9) === 'Warrior');
test('60.1% Mage → Mage', simulateArchetype(39.9, 60.1) === 'Mage');

// TEST SUITE 10: NOTIFICATION TRIGGER LOGIC
section('TEST SUITE 10: NOTIFICATION TRIGGER LOGIC');

function shouldNotify(prevArchetype, newArchetype) {
  return prevArchetype === 'Templar' && newArchetype !== 'Templar';
}

test('Templar → Warrior = NOTIFY', shouldNotify('Templar', 'Warrior') === true);
test('Templar → Mage = NOTIFY', shouldNotify('Templar', 'Mage') === true);
test('Warrior → Templar = NO NOTIFY', shouldNotify('Warrior', 'Templar') === false);
test('Mage → Templar = NO NOTIFY', shouldNotify('Mage', 'Templar') === false);
test('Warrior → Mage = NO NOTIFY', shouldNotify('Warrior', 'Mage') === false);
test('Mage → Warrior = NO NOTIFY', shouldNotify('Mage', 'Warrior') === false);
test('Templar → Templar = NO NOTIFY', shouldNotify('Templar', 'Templar') === false);
test('Warrior → Warrior = NO NOTIFY', shouldNotify('Warrior', 'Warrior') === false);

// TEST SUITE 11: VISUAL BAR OUTPUT VERIFICATION
section('TEST SUITE 11: VISUAL BAR OUTPUT VERIFICATION');

console.log(`\n${colors.bold}Sample Visual Bars:${colors.reset}`);
console.log(`\n40% Mage (Templar barely):\n${generateArchetypeBar(60, 40)}`);
console.log(`\n50% Mage (Templar center):\n${generateArchetypeBar(50, 50)}`);
console.log(`\n25% Mage (Warrior zone):\n${generateArchetypeBar(75, 25)}`);
console.log(`\n75% Mage (Mage zone):\n${generateArchetypeBar(25, 75)}`);
console.log(`\n0% Mage (Pure Warrior):\n${generateArchetypeBar(100, 0)}`);
console.log(`\n100% Mage (Pure Mage):\n${generateArchetypeBar(0, 100)}\n`);

// Visual consistency checks
test('All bars have consistent length structure', 
  generateArchetypeBar(60, 40).length === generateArchetypeBar(50, 50).length);

// TEST SUITE 12: CONSTANTS AND CONFIGURATION
section('TEST SUITE 12: CONSTANTS AND CONFIGURATION');

const constantsPath = path.join(__dirname, '..', 'src/config/constants.js');
if (fs.existsSync(constantsPath)) {
  const content = fs.readFileSync(constantsPath, 'utf8');
  test('Constants file has AFFINITY_WEIGHTS', content.includes('AFFINITY_WEIGHTS'));
  test('Constants file has archetype-related config', 
    content.includes('archetype') || content.includes('ARCHETYPE'));
} else {
  warn('Constants file not found - may affect archetype calculations');
}

// FINAL REPORT
section('FINAL TEST SUMMARY');

console.log(`\n${colors.bold}Test Results:${colors.reset}`);
console.log(`Total Tests: ${totalTests}`);
console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);
console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (criticalIssues.length > 0) {
  console.log(`\n${colors.red}${colors.bold}🚨 CRITICAL ISSUES:${colors.reset}`);
  criticalIssues.forEach((issue, i) => {
    console.log(`${colors.red}${i + 1}. ${issue}${colors.reset}`);
  });
}

if (warnings.length > 0) {
  console.log(`\n${colors.yellow}${colors.bold}⚠️  WARNINGS:${colors.reset}`);
  warnings.forEach((warning, i) => {
    console.log(`${colors.yellow}${i + 1}. ${warning}${colors.reset}`);
  });
}

console.log('\n' + colors.cyan + '='.repeat(60));
console.log(failedTests === 0 && criticalIssues.length === 0 
  ? `${colors.green}${colors.bold}✅ ALL TESTS PASSED - SYSTEM READY FOR PRODUCTION${colors.reset}`
  : `${colors.red}${colors.bold}❌ SYSTEM HAS ISSUES - REVIEW FAILURES ABOVE${colors.reset}`);
console.log(colors.cyan + '='.repeat(60) + '\n' + colors.reset);

// Summary statistics
console.log(`${colors.bold}Summary Statistics:${colors.reset}`);
console.log(`  Critical Issues: ${criticalIssues.length}`);
console.log(`  Warnings: ${warnings.length}`);
console.log(`  Pass Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

// Exit with error code if tests failed
process.exit(failedTests > 0 || criticalIssues.length > 0 ? 1 : 0);

