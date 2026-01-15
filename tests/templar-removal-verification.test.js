/**
 * Templar Points Removal Verification
 * Verify that Templar points are no longer awarded from stats
 */

const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('TEMPLAR REMOVAL VERIFICATION');
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
// TEST 1: AFFINITY_WEIGHTS NO LONGER HAS 't' PROPERTY
// ============================================
console.log('📊 TEST 1: AFFINITY_WEIGHTS Structure');
console.log('─'.repeat(40));

const constants = require(path.join(process.cwd(), 'src/config/constants.js'));
const weights = constants.AFFINITY_WEIGHTS;

// Check a few stats to ensure 't' is removed
test('Approaches has no t property', weights['Approaches'].t === undefined, 'undefined', weights['Approaches'].t);
test('In Action Release has no t property', weights['In Action Release'].t === undefined, 'undefined', weights['In Action Release'].t);
test('SBMM Meditation has no t property', weights['SBMM Meditation'].t === undefined, 'undefined', weights['SBMM Meditation'].t);
test('Courage Welcoming has no t property', weights['Courage Welcoming'].t === undefined, 'undefined', weights['Courage Welcoming'].t);
test('Chat Engagement has no t property', weights['Chat Engagement'].t === undefined, 'undefined', weights['Chat Engagement'].t);

// Check that w and m still exist
test('Approaches still has w property', weights['Approaches'].w !== undefined, 'defined', weights['Approaches'].w);
test('Approaches still has m property', weights['Approaches'].m !== undefined, 'defined', weights['Approaches'].m);
test('SBMM Meditation has m=9', weights['SBMM Meditation'].m === 9, '9', weights['SBMM Meditation'].m);

console.log('');

// ============================================
// TEST 2: ARCHETYPE SERVICE DOESN'T AWARD TEMPLAR POINTS
// ============================================
console.log('📊 TEST 2: ArchetypeService Logic');
console.log('─'.repeat(40));

const ArchetypeService = require(path.join(process.cwd(), 'src/services/user/ArchetypeService.js'));
const archetypeService = new ArchetypeService();

// Test affinity calculation
const testStats = {
  'Approaches': 5,
  'SBMM Meditation': 1,
  'Courage Welcoming': 2
};

const affinities = archetypeService.calculateAffinityFromStats(testStats);

test('Affinity calculation returns object', affinities !== undefined, 'object', typeof affinities);
test('Warrior points calculated', affinities.warrior > 0, 'greater than 0', affinities.warrior);
test('Mage points calculated', affinities.mage > 0, 'greater than 0', affinities.mage);
test('Templar points are 0', affinities.templar === 0, '0', affinities.templar);

console.log(`\n   Calculated affinities: W=${affinities.warrior}, M=${affinities.mage}, T=${affinities.templar}`);
console.log('');

// ============================================
// TEST 3: ARCHETYPE DETERMINATION STILL WORKS
// ============================================
console.log('📊 TEST 3: Archetype Determination');
console.log('─'.repeat(40));

// Test that archetype determination still works without templar points
const warriorArchetype = archetypeService.getDominantArchetype(100, 30, 0);
test('Warrior archetype works', warriorArchetype.key === 'warrior', 'warrior', warriorArchetype.key);

const mageArchetype = archetypeService.getDominantArchetype(30, 100, 0);
test('Mage archetype works', mageArchetype.key === 'mage', 'mage', mageArchetype.key);

const templarArchetype = archetypeService.getDominantArchetype(50, 50, 0);
test('Templar archetype works', templarArchetype.key === 'templar', 'templar', templarArchetype.key);

test('Warrior has correct icon', warriorArchetype.icon === '⚔️', '⚔️', warriorArchetype.icon);
test('Mage has correct icon', mageArchetype.icon === '🔮', '🔮', mageArchetype.icon);
test('Templar has correct icon', templarArchetype.icon === '⚖️', '⚖️', templarArchetype.icon);

console.log('');

// ============================================
// TEST 4: VERIFY ALL WEIGHTS HAVE ONLY W AND M
// ============================================
console.log('📊 TEST 4: All Weights Clean');
console.log('─'.repeat(40));

let allClean = true;
let statsWithTemplarPoints = [];

for (const [statName, weight] of Object.entries(weights)) {
  if (weight.t !== undefined) {
    allClean = false;
    statsWithTemplarPoints.push(statName);
  }
}

test('No stats have t property', allClean, 'all clean', allClean ? 'all clean' : `${statsWithTemplarPoints.length} stats still have t`);

if (statsWithTemplarPoints.length > 0) {
  console.log('   ⚠️  Stats still with t property:', statsWithTemplarPoints.join(', '));
}

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
  console.log('✅ Templar points successfully removed from AFFINITY_WEIGHTS');
  console.log('✅ ArchetypeService no longer awards templar points');
  console.log('✅ Archetype determination still works correctly');
  console.log('✅ Templar is now purely a balance zone (40-60% Mage)');
  console.log('');
  console.log('📊 HOW IT WORKS NOW:');
  console.log('─'.repeat(40));
  console.log('• Stats award Warrior (w) and Mage (m) points only');
  console.log('• Templar archetype = achieved when 40-60% Mage');
  console.log('• Templar is calculated, not earned directly');
  console.log('• Users move to Templar by balancing W/M activities');
  console.log('');
} else {
  console.log('❌ Some tests failed. Review above.');
  process.exit(1);
}
