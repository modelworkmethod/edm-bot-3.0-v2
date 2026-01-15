/**
 * Level Calculator
 * Handles level progression and XP curves
 */

const { LEVEL_THRESHOLDS } = require('../../config/constants');

/**
 * Compute level information from total XP
 * @param {number} totalXP - Total accumulated XP
 * @returns {object} Level info
 */
function computeLevelFromTotalXP(totalXP) {
  let level = 1;
  let xpForCurrentLevel = 0;
  let xpForNextLevel = LEVEL_THRESHOLDS[1].xp;

  // Find current level
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalXP >= LEVEL_THRESHOLDS[i].xp) {
      level = LEVEL_THRESHOLDS[i].level;
      xpForCurrentLevel = LEVEL_THRESHOLDS[i].xp;
      
      // Get next level threshold
      if (i + 1 < LEVEL_THRESHOLDS.length) {
        xpForNextLevel = LEVEL_THRESHOLDS[i + 1].xp;
      } else {
        xpForNextLevel = xpForCurrentLevel; // Max level
      }
    } else {
      break;
    }
  }

  const currentXP = totalXP - xpForCurrentLevel;
  const xpNeeded = xpForNextLevel - xpForCurrentLevel;
  const progress = xpNeeded > 0 ? currentXP / xpNeeded : 1;

  return {
    level,
    currentXP,
    xpForNext: xpNeeded,
    totalXP,
    progress,
    className: getClassName(level)
  };
}

/**
 * Get class name for level
 * @param {number} level - Player level
 * @returns {string} Class name
 */
function getClassName(level) {
  const threshold = LEVEL_THRESHOLDS.find(t => t.level === level);
  return threshold ? threshold.className : 'Unknown';
}

/**
 * Check if level increased
 * @param {number} oldXP - Previous XP
 * @param {number} newXP - New XP
 * @returns {object} {leveledUp: boolean, oldLevel: number, newLevel: number}
 */
function checkLevelUp(oldXP, newXP) {
  const oldInfo = computeLevelFromTotalXP(oldXP);
  const newInfo = computeLevelFromTotalXP(newXP);

  return {
    leveledUp: newInfo.level > oldInfo.level,
    oldLevel: oldInfo.level,
    newLevel: newInfo.level,
    oldClassName: oldInfo.className,
    newClassName: newInfo.className
  };
}

/**
 * Get XP needed for specific level
 * @param {number} targetLevel - Target level (1-50)
 * @returns {number} XP needed
 */
function getXPForLevel(targetLevel) {
  const threshold = LEVEL_THRESHOLDS.find(t => t.level === targetLevel);
  return threshold ? threshold.xp : 0;
}

class LevelCalculator {
  // Acepta config opcional por si la necesitas después
  constructor(_xpCfg = {}) {
    this.xpCfg = _xpCfg;
  }

  // Métodos OO que delegan en las funciones existentes
  compute(totalXP) {
    return computeLevelFromTotalXP(totalXP);
  }

  levelForXp(totalXP) {
    return computeLevelFromTotalXP(totalXP).level;
  }

  getClassName(level) {
    return getClassName(level);
  }

  checkLevelUp(oldXP, newXP) {
    return checkLevelUp(oldXP, newXP);
  }

  xpForLevel(level) {
    return getXPForLevel(level);
  }
}

module.exports = LevelCalculator;

module.exports.LevelCalculator = LevelCalculator;
module.exports.computeLevelFromTotalXP = computeLevelFromTotalXP;
module.exports.checkLevelUp = checkLevelUp;
module.exports.getXPForLevel = getXPForLevel;
module.exports.getClassName = getClassName;

