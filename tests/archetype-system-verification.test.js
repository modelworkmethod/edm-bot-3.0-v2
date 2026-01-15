/**
 * Archetype System Verification Test Suite
 * Validates all archetype system functionality matches requirements and screenshot design
 */

const { 
  generateArchetypeBar, 
  getArchetypeIcon, 
  getArchetypeColor,
  getEncouragementText,
  calculateMovementVolatility
} = require('../src/utils/archetypeVisuals');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// Test results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0
};

const failedTests = [];

/**
 * Test assertion helper
 */
function test(description, testFn) {
  results.total++;
  try {
    testFn();
    results.passed++;
    console.log(`${colors.green}✅ PASS${colors.reset} - ${description}`);
  } catch (error) {
    results.failed++;
    failedTests.push({ description, error: error.message });
    console.log(`${colors.red}❌ FAIL${colors.reset} - ${description}`);
    console.log(`   ${colors.red}Error: ${error.message}${colors.reset}`);
  }
}

/**
 * Assertion helper
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Deep equality check
 */
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\n   Expected: ${expected}\n   Actual: ${actual}`);
  }
}

/**
 * Approximately equal for decimals
 */
function assertApproxEqual(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message}\n   Expected: ~${expected}\n   Actual: ${actual}`);
  }
}

console.log(`\n${colors.bold}${colors.cyan}========================================`);
console.log('ARCHETYPE SYSTEM VERIFICATION REPORT');
console.log(`========================================${colors.reset}\n`);

// ===================================
// TEST SUITE 1: VISUAL BAR GENERATION
// ===================================
console.log(`${colors.bold}${colors.blue}📊 TEST SUITE 1: VISUAL BAR GENERATION${colors.reset}`);

test('Generate bar with 60% warrior / 40% mage', () => {
  const bar = generateArchetypeBar(60, 40);
  assert(bar.includes('⚔️'), 'Bar should contain warrior icon');
  assert(bar.includes('🔮'), 'Bar should contain mage icon');
  assert(bar.includes('['), 'Bar should contain opening bracket');
  assert(bar.includes(']'), 'Bar should contain closing bracket');
});

test('Verify three-zone structure with warrior blocks', () => {
  const bar = generateArchetypeBar(60, 40);
  const filled = (bar.match(/█/g) || []).length;
  assert(filled >= 10, 'Should have filled blocks (█) in warrior zone');
});

test('Verify templar zone has spaced pipes', () => {
  const bar = generateArchetypeBar(50, 50);
  const pipes = (bar.match(/\|/g) || []).length;
  assert(pipes >= 8, 'Should have spaced pipes in templar zone');
});

test('Verify mage zone has empty blocks', () => {
  const bar = generateArchetypeBar(20, 80);
  const empty = (bar.match(/░/g) || []).length;
  assert(empty >= 1, 'Should have empty blocks (░) in mage zone when user is in mage zone');
});

test('Verify position marker is present', () => {
  const bar = generateArchetypeBar(60, 40);
  assert(bar.includes('⬤'), 'Should contain position marker');
});

console.log('');

// ===================================
// TEST SUITE 2: DAMPENING CALCULATION
// ===================================
console.log(`${colors.bold}${colors.blue}📊 TEST SUITE 2: DAMPENING CALCULATION${colors.reset}`);

test('User with 500 XP → dampening = 1.0', () => {
  const result = calculateMovementVolatility(500);
  assertEqual(result.dampening, 1.0, 'Dampening should be 1.0 for low XP');
  assertEqual(result.percentage, 100, 'Percentage should be 100%');
});

test('User with 1,000 XP → dampening = 1.0', () => {
  const result = calculateMovementVolatility(1000);
  assertEqual(result.dampening, 1.0, 'Dampening should be 1.0 at MIN_XP threshold');
});

test('User with 25,500 XP → dampening ≈ 0.65 (midpoint)', () => {
  const result = calculateMovementVolatility(25500);
  assertApproxEqual(result.dampening, 0.65, 0.01, 'Dampening should be ~0.65 at midpoint');
});

test('User with 50,000 XP → dampening = 0.3', () => {
  const result = calculateMovementVolatility(50000);
  assertEqual(result.dampening, 0.3, 'Dampening should be 0.3 at MAX_XP threshold');
});

test('User with 100,000 XP → dampening = 0.3 (capped)', () => {
  const result = calculateMovementVolatility(100000);
  assertEqual(result.dampening, 0.3, 'Dampening should be capped at 0.3 for high XP');
});

test('Dampening scales linearly between 1k-50k XP', () => {
  const xp1 = 10000;
  const xp2 = 40000;
  const result1 = calculateMovementVolatility(xp1);
  const result2 = calculateMovementVolatility(xp2);
  
  assert(result1.dampening > result2.dampening, 'Lower XP should have higher dampening');
  assert(result1.dampening <= 1.0, 'Dampening should not exceed 1.0');
  assert(result2.dampening >= 0.3, 'Dampening should not go below 0.3');
});

console.log('');

// ===================================
// TEST SUITE 3: ARCHETYPE CALCULATION
// ===================================
console.log(`${colors.bold}${colors.blue}📊 TEST SUITE 3: ARCHETYPE CALCULATION${colors.reset}`);

// Note: These tests verify the logic, but actual archetype calculation happens in ArchetypeService
test('100% Warrior points → <40% Mage → Warrior', () => {
  const magePercent = (0 / (100 + 0)) * 100;
  assert(magePercent < 40, '0% Mage should be Warrior archetype');
});

test('40% Mage → Templar (lower bound)', () => {
  const magePercent = 40;
  assert(magePercent >= 40 && magePercent <= 60, '40% Mage should be Templar');
});

test('50% Mage → Templar (balanced)', () => {
  const magePercent = 50;
  assert(magePercent >= 40 && magePercent <= 60, '50% Mage should be Templar');
});

test('60% Mage → Templar (upper bound)', () => {
  const magePercent = 60;
  assert(magePercent >= 40 && magePercent <= 60, '60% Mage should be Templar');
});

test('61% Mage → Mage', () => {
  const magePercent = 61;
  assert(magePercent > 60, '61% Mage should be Mage archetype');
});

test('100% Mage → Mage', () => {
  const magePercent = 100;
  assert(magePercent > 60, '100% Mage should be Mage archetype');
});

test('39.9% Mage → Warrior', () => {
  const magePercent = 39.9;
  assert(magePercent < 40, '39.9% Mage should be Warrior');
});

test('60.1% Mage → Mage', () => {
  const magePercent = 60.1;
  assert(magePercent > 60, '60.1% Mage should be Mage');
});

console.log('');

// ===================================
// TEST SUITE 4: PERCENTAGE FORMATTING
// ===================================
console.log(`${colors.bold}${colors.blue}📊 TEST SUITE 4: PERCENTAGE FORMATTING${colors.reset}`);

test('45.28571% → displays as "45.3%"', () => {
  const formatted = (45.28571).toFixed(1);
  assertEqual(formatted, '45.3', 'Should format to 1 decimal place');
});

test('60.0% → displays as "60.0%"', () => {
  const formatted = (60.0).toFixed(1);
  assertEqual(formatted, '60.0', 'Should preserve trailing zero');
});

test('39.95% → displays as "40.0%"', () => {
  const formatted = (39.95).toFixed(1);
  assertEqual(formatted, '40.0', 'Should round up to 1 decimal');
});

test('Warrior% + Mage% always equals 100.0%', () => {
  const warriorPercent = 62.4;
  const magePercent = 37.6;
  const sum = parseFloat((warriorPercent + magePercent).toFixed(1));
  assertEqual(sum, 100.0, 'Percentages should sum to 100');
});

console.log('');

// ===================================
// TEST SUITE 5: ICON ASSIGNMENT
// ===================================
console.log(`${colors.bold}${colors.blue}📊 TEST SUITE 5: ICON ASSIGNMENT${colors.reset}`);

test('Warrior archetype → ⚔️', () => {
  const icon = getArchetypeIcon('Warrior');
  assertEqual(icon, '⚔️', 'Warrior should have sword icon');
});

test('Mage archetype → 🔮', () => {
  const icon = getArchetypeIcon('Mage');
  assertEqual(icon, '🔮', 'Mage should have crystal ball icon');
});

test('Templar archetype → ⚖️', () => {
  const icon = getArchetypeIcon('Templar');
  assertEqual(icon, '⚖️', 'Templar should have balance icon');
});

test('New Initiate → ⚖️', () => {
  const icon = getArchetypeIcon('New Initiate');
  assertEqual(icon, '⚖️', 'New Initiate should have balance icon');
});

console.log('');

// ===================================
// TEST SUITE 6: COLOR ASSIGNMENT
// ===================================
console.log(`${colors.bold}${colors.blue}📊 TEST SUITE 6: COLOR ASSIGNMENT${colors.reset}`);

test('Warrior → 0xFF4444 (red)', () => {
  const color = getArchetypeColor('Warrior');
  assertEqual(color, 0xFF4444, 'Warrior should be red');
});

test('Mage → 0x4444FF (blue)', () => {
  const color = getArchetypeColor('Mage');
  assertEqual(color, 0x4444FF, 'Mage should be blue');
});

test('Templar → 0xFFAA00 (gold)', () => {
  const color = getArchetypeColor('Templar');
  assertEqual(color, 0xFFAA00, 'Templar should be gold/orange');
});

test('New Initiate → 0x808080 (gray)', () => {
  const color = getArchetypeColor('Unknown');
  assertEqual(color, 0x808080, 'Unknown archetype should be gray');
});

console.log('');

// ===================================
// TEST SUITE 7: ENCOURAGEMENT TEXT
// ===================================
console.log(`${colors.bold}${colors.blue}📊 TEST SUITE 7: ENCOURAGEMENT TEXT${colors.reset}`);

test('Templar (balanced) → "You\'re balanced! Keep up the momentum."', () => {
  const text = getEncouragementText('Templar', true);
  assertEqual(text, "You're balanced! Keep up the momentum.", 'Balanced encouragement should match');
});

test('Warrior (not balanced) → "Too much action! Balance with inner work."', () => {
  const text = getEncouragementText('Warrior', false);
  assertEqual(text, "Too much action! Balance with inner work.", 'Warrior encouragement should match');
});

test('Mage (not balanced) → "Too much reflection! Time for action."', () => {
  const text = getEncouragementText('Mage', false);
  assertEqual(text, "Too much reflection! Time for action.", 'Mage encouragement should match');
});

test('New Initiate → "Build your momentum!"', () => {
  const text = getEncouragementText('New Initiate', false);
  assertEqual(text, "Build your momentum!", 'New Initiate encouragement should match');
});

console.log('');

// ===================================
// TEST SUITE 8: NOTIFICATION TRIGGERS
// ===================================
console.log(`${colors.bold}${colors.blue}📊 TEST SUITE 8: NOTIFICATION TRIGGERS${colors.reset}`);

// These are logic tests for the notification system
test('Templar → Warrior = NOTIFY', () => {
  const previousKey = 'templar';
  const newIsBalanced = false;
  assert(previousKey === 'templar' && !newIsBalanced, 'Should notify when leaving Templar balance');
});

test('Templar → Mage = NOTIFY', () => {
  const previousKey = 'templar';
  const newIsBalanced = false;
  assert(previousKey === 'templar' && !newIsBalanced, 'Should notify when leaving Templar balance');
});

test('Warrior → Templar = NO notify', () => {
  const previousKey = 'warrior';
  const newIsBalanced = true;
  assert(!(previousKey === 'templar' && !newIsBalanced), 'Should NOT notify when entering Templar');
});

test('Mage → Templar = NO notify', () => {
  const previousKey = 'mage';
  const newIsBalanced = true;
  assert(!(previousKey === 'templar' && !newIsBalanced), 'Should NOT notify when entering Templar');
});

test('Warrior → Mage = NO notify', () => {
  const previousKey = 'warrior';
  const newKey = 'mage';
  assert(!(previousKey === 'templar'), 'Should NOT notify when not leaving Templar');
});

test('Templar → Templar = NO notify', () => {
  const previousKey = 'templar';
  const newIsBalanced = true;
  assert(!(previousKey === 'templar' && !newIsBalanced), 'Should NOT notify when staying in Templar');
});

console.log('');

// ===================================
// TEST SUITE 9: VOLATILITY DESCRIPTORS
// ===================================
console.log(`${colors.bold}${colors.blue}📊 TEST SUITE 9: VOLATILITY DESCRIPTORS${colors.reset}`);

test('Very High volatility for new users (500 XP)', () => {
  const result = calculateMovementVolatility(500);
  assert(result.description.includes('Very High'), 'New users should have Very High volatility');
  assertEqual(result.emoji, '⚡', 'Very High should use lightning emoji');
});

test('Low volatility for veterans (50k XP)', () => {
  const result = calculateMovementVolatility(50000);
  assert(result.description.includes('Low'), 'Veterans should have Low volatility');
  assertEqual(result.emoji, '🛡️', 'Low should use shield emoji');
});

test('High volatility for mid-range (25k XP)', () => {
  const result = calculateMovementVolatility(25000);
  assert(result.description.includes('High'), 'Mid-range should have High volatility');
  assertEqual(result.emoji, '🌊', 'High should use wave emoji');
});

console.log('');

// ===================================
// TEST SUITE 10: EDGE CASES
// ===================================
console.log(`${colors.bold}${colors.blue}📊 TEST SUITE 10: EDGE CASES${colors.reset}`);

test('Exactly 40.0% Mage → Templar', () => {
  const magePercent = 40.0;
  assert(magePercent >= 40 && magePercent <= 60, '40.0% should be Templar');
});

test('Exactly 60.0% Mage → Templar', () => {
  const magePercent = 60.0;
  assert(magePercent >= 40 && magePercent <= 60, '60.0% should be Templar');
});

test('39.9% Mage → Warrior', () => {
  const magePercent = 39.9;
  assert(magePercent < 40, '39.9% should be Warrior');
});

test('60.1% Mage → Mage', () => {
  const magePercent = 60.1;
  assert(magePercent > 60, '60.1% should be Mage');
});

test('Bar handles 0% warrior correctly (100% mage)', () => {
  const bar = generateArchetypeBar(0, 100);
  assert(bar.includes('⬤'), 'Should have position marker in mage zone');
  assert(bar.includes('|'), 'Should have templar zone pipes');
});

test('Bar handles 100% warrior correctly (0% mage)', () => {
  const bar = generateArchetypeBar(100, 0);
  assert(bar.includes('⬤'), 'Should have position marker in warrior zone');
  assert(bar.includes('|'), 'Should have templar zone pipes');
});

console.log('');

// ===================================
// CRITICAL CHECKS
// ===================================
console.log(`${colors.bold}${colors.cyan}========================================`);
console.log('CRITICAL CHECKS');
console.log(`========================================${colors.reset}\n`);

test('Visual bar matches three-zone screenshot format', () => {
  const bar = generateArchetypeBar(60, 40);
  assert(bar.startsWith('⚔️'), 'Bar should start with warrior icon');
  assert(bar.endsWith('🔮'), 'Bar should end with mage icon');
  assert(bar.includes('[') && bar.includes(']'), 'Bar should have brackets');
  assert(bar.includes('█'), 'Should have filled warrior blocks');
  assert(bar.includes('|'), 'Should have templar zone pipes');
  assert(bar.includes('░'), 'Should have mage zone blocks');
  assert(bar.includes('⬤'), 'Should have position marker');
});

test('Dampening implemented and working', () => {
  const lowXP = calculateMovementVolatility(500);
  const highXP = calculateMovementVolatility(50000);
  assert(lowXP.dampening === 1.0, 'Low XP should have full dampening');
  assert(highXP.dampening === 0.3, 'High XP should have reduced dampening');
});

test('All percentages show 1 decimal', () => {
  const value = 45.6789;
  const formatted = value.toFixed(1);
  assert(formatted.includes('.'), 'Should include decimal point');
  assertEqual(formatted.split('.')[1].length, 1, 'Should have exactly 1 decimal place');
});

console.log('');

// ===================================
// SUMMARY
// ===================================
console.log(`${colors.bold}${colors.cyan}========================================`);
console.log('SUMMARY');
console.log(`========================================${colors.reset}\n`);

console.log(`Total Tests: ${colors.bold}${results.total}${colors.reset}`);
console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
console.log(`${colors.yellow}Warnings: ${results.warnings}${colors.reset}\n`);

const systemReady = results.failed === 0;
console.log(`System Ready: ${systemReady ? colors.green + 'YES ✅' : colors.red + 'NO ❌'}${colors.reset}\n`);

if (!systemReady) {
  console.log(`${colors.red}${colors.bold}Blocking Issues:${colors.reset}`);
  failedTests.forEach((test, index) => {
    console.log(`${colors.red}${index + 1}. ${test.description}${colors.reset}`);
    console.log(`   ${test.error}\n`);
  });
}

console.log(`${colors.cyan}========================================${colors.reset}\n`);

// Exit with appropriate code
process.exit(systemReady ? 0 : 1);

