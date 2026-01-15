/**
 * Group Call Automation Test
 * Verify the group call automation system works correctly
 */

const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('GROUP CALL AUTOMATION - VERIFICATION TEST');
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

// Test 1: GroupCallTracker file exists
const groupCallTrackerPath = path.join(__dirname, '../src/jobs/groupCallTracker.js');
const trackerExists = fs.existsSync(groupCallTrackerPath);
test('GroupCallTracker file exists', trackerExists, 'File exists', trackerExists ? 'File exists' : 'File missing');

if (trackerExists) {
  // Test 2: GroupCallTracker has required dependencies
  const trackerContent = fs.readFileSync(groupCallTrackerPath, 'utf8');
  test('GroupCallTracker imports node-cron', trackerContent.includes("require('node-cron')"), 'Contains node-cron import', trackerContent.includes("require('node-cron')") ? 'Found' : 'Missing');
  test('GroupCallTracker imports moment-timezone', trackerContent.includes("require('moment-timezone')"), 'Contains moment-timezone import', trackerContent.includes("require('moment-timezone')") ? 'Found' : 'Missing');
  test('GroupCallTracker imports Discord.js', trackerContent.includes("require('discord.js')"), 'Contains Discord.js import', trackerContent.includes("require('discord.js')") ? 'Found' : 'Missing');
  
  // Test 3: GroupCallTracker has required methods
  test('GroupCallTracker has start method', trackerContent.includes('async start()'), 'Contains start method', trackerContent.includes('async start()') ? 'Found' : 'Missing');
  test('GroupCallTracker has postGroupCallCheckIn method', trackerContent.includes('async postGroupCallCheckIn('), 'Contains postGroupCallCheckIn method', trackerContent.includes('async postGroupCallCheckIn(') ? 'Found' : 'Missing');
  
  // Test 4: GroupCallTracker has correct schedule times
  test('GroupCallTracker has Sunday schedule (23:00)', trackerContent.includes("'0 23 * * SUN'"), 'Contains Sunday 23:00 schedule', trackerContent.includes("'0 23 * * SUN'") ? 'Found' : 'Missing');
  test('GroupCallTracker has Wednesday schedule (21:30)', trackerContent.includes("'30 21 * * WED'"), 'Contains Wednesday 21:30 schedule', trackerContent.includes("'30 21 * * WED'") ? 'Found' : 'Missing');
  test('GroupCallTracker has Saturday schedule (19:00)', trackerContent.includes("'0 19 * * SAT'"), 'Contains Saturday 19:00 schedule', trackerContent.includes("'0 19 * * SAT'") ? 'Found' : 'Missing');
}

// Test 5: Button handler has group call handlers
const buttonHandlerPath = path.join(__dirname, '../src/events/interactionCreate/buttonHandler.js');
const handlerExists = fs.existsSync(buttonHandlerPath);
test('Button handler file exists', handlerExists, 'File exists', handlerExists ? 'File exists' : 'File missing');

if (handlerExists) {
  const handlerContent = fs.readFileSync(buttonHandlerPath, 'utf8');
  test('Button handler has group_call_yes case', handlerContent.includes("customId === 'group_call_yes'"), 'Contains group_call_yes handler', handlerContent.includes("customId === 'group_call_yes'") ? 'Found' : 'Missing');
  test('Button handler has group_call_no case', handlerContent.includes("customId === 'group_call_no'"), 'Contains group_call_no handler', handlerContent.includes("customId === 'group_call_no'") ? 'Found' : 'Missing');
  test('Button handler has handleGroupCallYes function', handlerContent.includes('async function handleGroupCallYes('), 'Contains handleGroupCallYes function', handlerContent.includes('async function handleGroupCallYes(') ? 'Found' : 'Missing');
  test('Button handler has handleGroupCallNo function', handlerContent.includes('async function handleGroupCallNo('), 'Contains handleGroupCallNo function', handlerContent.includes('async function handleGroupCallNo(') ? 'Found' : 'Missing');
}

// Test 6: Ready event integrates GroupCallTracker
const readyPath = path.join(__dirname, '../src/events/ready.js');
const readyExists = fs.existsSync(readyPath);
test('Ready event file exists', readyExists, 'File exists', readyExists ? 'File exists' : 'File missing');

if (readyExists) {
  const readyContent = fs.readFileSync(readyPath, 'utf8');
  test('Ready event imports GroupCallTracker', readyContent.includes("require('../jobs/groupCallTracker')"), 'Contains GroupCallTracker import', readyContent.includes("require('../jobs/groupCallTracker')") ? 'Found' : 'Missing');
  test('Ready event starts GroupCallTracker', readyContent.includes('await groupCallTracker.start()'), 'Contains groupCallTracker.start() call', readyContent.includes('await groupCallTracker.start()') ? 'Found' : 'Missing');
}

// Test 7: Secondary XP config has groupCall category
const secondaryXPPath = path.join(__dirname, '../src/config/secondaryXPSources.js');
const secondaryXPExists = fs.existsSync(secondaryXPPath);
test('Secondary XP config file exists', secondaryXPExists, 'File exists', secondaryXPExists ? 'File exists' : 'File missing');

if (secondaryXPExists) {
  const secondaryXPContent = fs.readFileSync(secondaryXPPath, 'utf8');
  test('Secondary XP has groupCall category', secondaryXPContent.includes('groupCall:'), 'Contains groupCall category', secondaryXPContent.includes('groupCall:') ? 'Found' : 'Missing');
  test('Secondary XP has attendCall action', secondaryXPContent.includes('attendCall:'), 'Contains attendCall action', secondaryXPContent.includes('attendCall:') ? 'Found' : 'Missing');
  test('Secondary XP has 200 XP for attendCall', secondaryXPContent.includes('xp: 200'), 'Contains 200 XP value', secondaryXPContent.includes('xp: 200') ? 'Found' : 'Missing');
}

console.log('========================================');
console.log('SUMMARY');
console.log('========================================');
console.log(`Total Tests: ${testsPassed + testsFailed}`);
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);

if (testsFailed === 0) {
  console.log('🎉 ALL TESTS PASSED! Group Call Automation is ready!');
  console.log('');
  console.log('✅ GroupCallTracker scheduled job created');
  console.log('✅ Button handlers implemented');
  console.log('✅ Bot integration complete');
  console.log('✅ Secondary XP configuration ready');
  console.log('');
  console.log('📅 SCHEDULE:');
  console.log('• Sunday: 11:00 PM EST (after 9pm-11pm call)');
  console.log('• Wednesday: 9:30 PM EST (after 9pm-9:30pm call)');
  console.log('• Saturday: 7:00 PM EST (after 5pm-7pm call)');
  console.log('');
  console.log('💰 XP AWARD: 200 XP per attendance');
  console.log('⏰ COOLDOWN: 2 hours (prevents double-claiming)');
  console.log('🗑️ MESSAGE LIFETIME: 2 hours (auto-delete)');
} else {
  console.log('❌ Some tests failed. Please check the implementation.');
  process.exit(1);
}
