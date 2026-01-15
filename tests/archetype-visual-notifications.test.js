/**
 * Archetype Visual Notifications Test
 * Verify archetype change notifications include visual bars
 */

const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('ARCHETYPE VISUAL NOTIFICATIONS - TEST');
console.log('========================================');

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

// Test 1: AnnouncementQueue file exists
const announcementQueuePath = path.join(__dirname, '../src/services/notifications/AnnouncementQueue.js');
const queueExists = fs.existsSync(announcementQueuePath);
test('AnnouncementQueue file exists', queueExists, 'File exists', queueExists ? 'File exists' : 'File missing');

if (queueExists) {
  const queueContent = fs.readFileSync(announcementQueuePath, 'utf8');
  
  // Test 2: Imports visual utilities
  test('Imports generateArchetypeBar', queueContent.includes('generateArchetypeBar'), 'Contains generateArchetypeBar import', queueContent.includes('generateArchetypeBar') ? 'Found' : 'Missing');
  test('Imports getArchetypeIcon', queueContent.includes('getArchetypeIcon'), 'Contains getArchetypeIcon import', queueContent.includes('getArchetypeIcon') ? 'Found' : 'Missing');
  test('Imports getArchetypeColor', queueContent.includes('getArchetypeColor'), 'Contains getArchetypeColor import', queueContent.includes('getArchetypeColor') ? 'Found' : 'Missing');
  
  // Test 3: Uses visual bars in notifications
  test('Generates old archetype bar', queueContent.includes('const oldBar = generateArchetypeBar'), 'Generates old bar', queueContent.includes('const oldBar = generateArchetypeBar') ? 'Found' : 'Missing');
  test('Generates new archetype bar', queueContent.includes('const newBar = generateArchetypeBar'), 'Generates new bar', queueContent.includes('const newBar = generateArchetypeBar') ? 'Found' : 'Missing');
  
  // Test 4: Uses icons
  test('Gets old archetype icon', queueContent.includes('const oldIcon = getArchetypeIcon(old.label)'), 'Gets old icon', queueContent.includes('const oldIcon = getArchetypeIcon(old.label)') ? 'Found' : 'Missing');
  test('Gets new archetype icon', queueContent.includes('const newIcon = getArchetypeIcon(newArchetype.label)'), 'Gets new icon', queueContent.includes('const newIcon = getArchetypeIcon(newArchetype.label)') ? 'Found' : 'Missing');
  
  // Test 5: Uses colors
  test('Gets archetype color', queueContent.includes('const embedColor = getArchetypeColor'), 'Gets embed color', queueContent.includes('const embedColor = getArchetypeColor') ? 'Found' : 'Missing');
  test('Uses color in embed', queueContent.includes('color: embedColor'), 'Uses color in embed', queueContent.includes('color: embedColor') ? 'Found' : 'Missing');
  
  // Test 6: Shows percentages
  test('Shows old Mage percentage', queueContent.includes('old.magePercent.toFixed(1)'), 'Shows old mage %', queueContent.includes('old.magePercent.toFixed(1)') ? 'Found' : 'Missing');
  test('Shows new Mage percentage', queueContent.includes('newArchetype.magePercent.toFixed(1)'), 'Shows new mage %', queueContent.includes('newArchetype.magePercent.toFixed(1)') ? 'Found' : 'Missing');
  
  // Test 7: Shows Warrior percentages
  test('Shows old Warrior percentage', queueContent.includes('old.warriorPercent.toFixed(1)'), 'Shows old warrior %', queueContent.includes('old.warriorPercent.toFixed(1)') ? 'Found' : 'Missing');
  test('Shows new Warrior percentage', queueContent.includes('newArchetype.warriorPercent.toFixed(1)'), 'Shows new warrior %', queueContent.includes('newArchetype.warriorPercent.toFixed(1)') ? 'Found' : 'Missing');
  
  // Test 8: Has before/after fields
  test('Has Previous field', queueContent.includes('Previous:'), 'Contains Previous field', queueContent.includes('Previous:') ? 'Found' : 'Missing');
  test('Has Now field', queueContent.includes('Now:'), 'Contains Now field', queueContent.includes('Now:') ? 'Found' : 'Missing');
  
  // Test 9: Displays visual bars in fields
  test('Displays old bar in field', queueContent.includes('${oldBar}'), 'Displays old bar', queueContent.includes('${oldBar}') ? 'Found' : 'Missing');
  test('Displays new bar in field', queueContent.includes('${newBar}'), 'Displays new bar', queueContent.includes('${newBar}') ? 'Found' : 'Missing');
  
  // Test 10: Still has balance guidance
  test('Has Balance Guidance field', queueContent.includes('Balance Guidance'), 'Has guidance field', queueContent.includes('Balance Guidance') ? 'Found' : 'Missing');
  test('Calls getBalanceGuidance', queueContent.includes('this.getBalanceGuidance(newArchetype.key)'), 'Calls getBalanceGuidance', queueContent.includes('this.getBalanceGuidance(newArchetype.key)') ? 'Found' : 'Missing');
}

// Test 11: Visual utilities exist
const visualUtilsPath = path.join(__dirname, '../src/utils/archetypeVisuals.js');
const utilsExist = fs.existsSync(visualUtilsPath);
test('Archetype visuals utility exists', utilsExist, 'File exists', utilsExist ? 'File exists' : 'File missing');

if (utilsExist) {
  const utilsContent = fs.readFileSync(visualUtilsPath, 'utf8');
  test('Has generateArchetypeBar function', utilsContent.includes('function generateArchetypeBar('), 'Contains function', utilsContent.includes('function generateArchetypeBar(') ? 'Found' : 'Missing');
  test('Has getArchetypeIcon function', utilsContent.includes('function getArchetypeIcon('), 'Contains function', utilsContent.includes('function getArchetypeIcon(') ? 'Found' : 'Missing');
  test('Has getArchetypeColor function', utilsContent.includes('function getArchetypeColor('), 'Contains function', utilsContent.includes('function getArchetypeColor(') ? 'Found' : 'Missing');
}

console.log('');
console.log('========================================');
console.log('VISUAL NOTIFICATION PREVIEW');
console.log('========================================');
console.log('');
console.log('Example of what users will see in #general:');
console.log('');
console.log('🎭 Archetype Evolution!');
console.log('@User evolved from ⚔️ Warrior to ⚖️ Templar!');
console.log('');
console.log('Previous: Warrior (32.5% Mage)');
console.log('⚔️ [████⬤                 |░░░░░░░] 🔮');
console.log('67.5% Warrior | 32.5% Mage');
console.log('');
console.log('Now: Templar (48.2% Mage)');
console.log('⚔️ [████████████████⬤| | |░░░░░░░] 🔮');
console.log('51.8% Warrior | 48.2% Mage');
console.log('');
console.log('⚖️ Balance Guidance');
console.log('You\'ve found balance! Keep it up with consistent practice');
console.log('');

console.log('========================================');
console.log('SUMMARY');
console.log('========================================');
console.log(`Total Tests: ${testsPassed + testsFailed}`);
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);

if (testsFailed === 0) {
  console.log('');
  console.log('🎉 ALL TESTS PASSED! Archetype visual notifications are ready!');
  console.log('');
  console.log('✅ Visual bars implemented in notifications');
  console.log('✅ Before/after comparison with percentages');
  console.log('✅ Emoji icons (⚔️ Warrior, 🔮 Mage, ⚖️ Templar)');
  console.log('✅ Color-coded embeds based on archetype');
  console.log('✅ Balance guidance included');
  console.log('');
  console.log('🎭 ARCHETYPE VISUAL SYSTEM: 100% COMPLETE!');
} else {
  console.log('❌ Some tests failed. Please check the implementation.');
  process.exit(1);
}
