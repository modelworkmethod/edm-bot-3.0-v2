/**
 * Core Systems Test Suite
 * Tests XP, Leveling, Stats Processing, and Archetype systems
 */

const fs = require('fs');
const path = require('path');
const TestFramework = require('../test-framework');

const test = new TestFramework('Core Systems');

test.start();

// ============================================
// XP SYSTEM TESTS
// ============================================
test.category('XP SYSTEM');

// Test constants file exists
const constantsPath = 'src/config/constants.js';
if (test.testFileExists('Constants file exists', constantsPath, fs, path)) {
  const constants = require(path.join(process.cwd(), constantsPath));
  
  // Test STAT_WEIGHTS (current hybrid approach values)
  test.test('STAT_WEIGHTS exists', () => constants.STAT_WEIGHTS !== undefined);
  test.test('STAT_WEIGHTS has Approaches', () => constants.STAT_WEIGHTS['Approaches'] === 100);
  test.test('STAT_WEIGHTS has Numbers', () => constants.STAT_WEIGHTS['Numbers'] === 100);
  test.test('STAT_WEIGHTS has Dates Had', () => constants.STAT_WEIGHTS['Dates Had'] === 250);
  test.test('STAT_WEIGHTS has Got Laid', () => constants.STAT_WEIGHTS['Got Laid'] === 250);
  test.test('STAT_WEIGHTS has In Action Release', () => constants.STAT_WEIGHTS['In Action Release'] === 50);
  
  // Test AFFINITY_WEIGHTS
  test.test('AFFINITY_WEIGHTS exists', () => constants.AFFINITY_WEIGHTS !== undefined);
  test.test('AFFINITY_WEIGHTS has Approaches', () => {
    const weights = constants.AFFINITY_WEIGHTS['Approaches'];
    return weights && weights.w === 3 && weights.m === 0 && weights.t === 1;
  });
  test.test('AFFINITY_WEIGHTS has In Action Release (90% Mage)', () => {
    const weights = constants.AFFINITY_WEIGHTS['In Action Release'];
    return weights && weights.w === 0 && weights.m === 3 && weights.t === 1;
  });
  test.test('AFFINITY_WEIGHTS has SBMM Meditation', () => {
    const weights = constants.AFFINITY_WEIGHTS['SBMM Meditation'];
    return weights && weights.m === 9;
  });
  
  // Test LEVEL_THRESHOLDS (currently 50 levels)
  test.test('LEVEL_THRESHOLDS exists', () => constants.LEVEL_THRESHOLDS !== undefined);
  test.test('LEVEL_THRESHOLDS has levels', () => constants.LEVEL_THRESHOLDS.length >= 50);
  test.test('Level 1 starts at 0 XP', () => constants.LEVEL_THRESHOLDS[0].xp === 0);
  test.test('Level thresholds are ascending', () => {
    for (let i = 1; i < constants.LEVEL_THRESHOLDS.length; i++) {
      if (constants.LEVEL_THRESHOLDS[i].xp <= constants.LEVEL_THRESHOLDS[i - 1].xp) {
        return { warning: false, message: `Level ${i + 1} not > Level ${i}` };
      }
    }
    return true;
  });
  
  // Test LEVEL_CLASSES
  test.test('LEVEL_CLASSES exists', () => constants.LEVEL_CLASSES !== undefined);
  test.test('LEVEL_CLASSES has classes', () => constants.LEVEL_CLASSES.length > 0);
  test.test('Level classes have valid structure', () => {
    const firstClass = constants.LEVEL_CLASSES[0];
    return firstClass && firstClass.min !== undefined && firstClass.max !== undefined;
  });
  test.test('Level classes have no gaps', () => {
    for (let i = 1; i < constants.LEVEL_CLASSES.length; i++) {
      if (constants.LEVEL_CLASSES[i].min !== constants.LEVEL_CLASSES[i - 1].max + 1) {
        return { warning: false, message: 'Gap found in level classes' };
      }
    }
    return true;
  });
  
  // Test STAT_ALIASES
  test.test('STAT_ALIASES exists', () => constants.STAT_ALIASES !== undefined);
  test.test('STAT_ALIASES has in_action_release', () => constants.STAT_ALIASES['in_action_release'] === 'In Action Release');
  test.test('STAT_ALIASES has approaches', () => constants.STAT_ALIASES['approaches'] !== undefined);
}

// ============================================
// SECONDARY XP SOURCES
// ============================================
test.category('SECONDARY XP SOURCES');

const secondaryXPPath = 'src/config/secondaryXPSources.js';
if (test.testFileExists('Secondary XP config exists', secondaryXPPath, fs, path)) {
  const secondaryXP = require(path.join(process.cwd(), secondaryXPPath));
  
  test.test('SECONDARY_XP_SOURCES exists', () => secondaryXP.SECONDARY_XP_SOURCES !== undefined);
  test.test('Has wins category', () => secondaryXP.SECONDARY_XP_SOURCES.wins !== undefined);
  test.test('Wins shareWin XP exists', () => secondaryXP.SECONDARY_XP_SOURCES.wins.actions.shareWin.xp > 0);
  test.test('Has groupCall category', () => secondaryXP.SECONDARY_XP_SOURCES.groupCall !== undefined);
  test.test('Group call attendCall is 200 XP', () => secondaryXP.SECONDARY_XP_SOURCES.groupCall.actions.attendCall.xp === 200);
  test.test('Group call has 2-hour cooldown', () => secondaryXP.SECONDARY_XP_SOURCES.groupCall.actions.attendCall.cooldown === 7200);
  test.test('Has journal category', () => secondaryXP.SECONDARY_XP_SOURCES.journal !== undefined);
  test.test('Journal entry is 75 XP', () => secondaryXP.SECONDARY_XP_SOURCES.journal.actions.submitEntry.xp === 75);
  test.test('Journal breakthrough is 200 XP', () => secondaryXP.SECONDARY_XP_SOURCES.journal.actions.breakthrough.xp === 200);
}

// ============================================
// LEVELING SYSTEM
// ============================================
test.category('LEVELING SYSTEM');

const levelCalcPath = 'src/services/xp/LevelCalculator.js';
if (test.testFileExists('LevelCalculator exists', levelCalcPath, fs, path)) {
  const LevelCalculator = require(path.join(process.cwd(), levelCalcPath));
  
  test.test('LevelCalculator exports', () => LevelCalculator !== undefined);
  test.test('LevelCalculator.checkLevelUp exists', () => typeof LevelCalculator.checkLevelUp === 'function');
}

// ============================================
// ARCHETYPE SYSTEM
// ============================================
test.category('ARCHETYPE SYSTEM');

const archetypeServicePath = 'src/services/user/ArchetypeService.js';
if (test.testFileExists('ArchetypeService exists', archetypeServicePath, fs, path)) {
  const ArchetypeService = require(path.join(process.cwd(), archetypeServicePath));
  const service = new ArchetypeService();
  
  test.test('ArchetypeService instantiates', () => service !== undefined);
  test.test('Has getDominantArchetype method', () => typeof service.getDominantArchetype === 'function');
  test.test('Has calculateAffinityFromStats method', () => typeof service.calculateAffinityFromStats === 'function');
  
  // Test archetype determination
  test.test('Warrior archetype (<40% Mage)', () => {
    const result = service.getDominantArchetype(100, 30, 0);
    return result.key === 'warrior' && result.label === 'Warrior';
  });
  test.test('Mage archetype (>60% Mage)', () => {
    const result = service.getDominantArchetype(30, 100, 0);
    return result.key === 'mage' && result.label === 'Mage';
  });
  test.test('Templar archetype (40-60% Mage)', () => {
    const result = service.getDominantArchetype(50, 50, 0);
    return result.key === 'templar' && result.label === 'Templar';
  });
}

// Test archetype visual utilities
const archetypeVisualsPath = 'src/utils/archetypeVisuals.js';
if (test.testFileExists('Archetype visuals exist', archetypeVisualsPath, fs, path)) {
  const visuals = require(path.join(process.cwd(), archetypeVisualsPath));
  
  test.test('generateArchetypeBar exists', () => typeof visuals.generateArchetypeBar === 'function');
  test.test('getArchetypeIcon exists', () => typeof visuals.getArchetypeIcon === 'function');
  test.test('getArchetypeColor exists', () => typeof visuals.getArchetypeColor === 'function');
  test.test('Warrior icon is ⚔️', () => visuals.getArchetypeIcon('Warrior') === '⚔️');
  test.test('Mage icon is 🔮', () => visuals.getArchetypeIcon('Mage') === '🔮');
  test.test('Templar icon is ⚖️', () => visuals.getArchetypeIcon('Templar') === '⚖️');
  test.test('Archetype bar generates', () => {
    const bar = visuals.generateArchetypeBar(50, 50);
    return bar && bar.includes('⚔️') && bar.includes('🔮');
  });
}

// ============================================
// STATS PROCESSOR
// ============================================
test.category('STATS PROCESSOR');

const statsProcessorPath = 'src/services/stats/StatsProcessor.js';
test.testFileExists('StatsProcessor exists', statsProcessorPath, fs, path);

// ============================================
// XP CALCULATOR
// ============================================
test.category('XP CALCULATOR');

const xpCalculatorPath = 'src/services/xp/XPCalculator.js';
if (test.testFileExists('XPCalculator exists', xpCalculatorPath, fs, path)) {
  const { XPCalculator } = require(path.join(process.cwd(), xpCalculatorPath));
  
  test.test('XPCalculator exports', () => XPCalculator !== undefined);
}

const results = test.end();

// Exit with error code if tests failed
if (!test.allPassed()) {
  process.exit(1);
}

module.exports = results;
