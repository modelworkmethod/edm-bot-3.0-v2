/**
 * Input validation utilities
 * Validates user input for stats, XP, levels, etc.
 */

const { STAT_WEIGHTS, STAT_ALIASES } = require('../config/constants');

/**
 * Validation error class
 */
class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Validate stat name
 * @param {string} statName - Stat name to validate
 * @returns {string} Normalized stat name
 * @throws {ValidationError} If stat name is invalid
 */
function validateStatName(statName) {
  const normalized = STAT_ALIASES[statName.toLowerCase()] || statName;
  
  if (!STAT_WEIGHTS[normalized]) {
    throw new ValidationError(`Invalid stat name: ${statName}`, 'statName');
  }
  
  return normalized;
}

/**
 * Validate stat value
 * @param {string} statName - Stat name
 * @param {number} value - Stat value
 * @returns {number} Validated value
 * @throws {ValidationError} If value is invalid
 */
function validateStatValue(statName, value) {
  const numValue = Number(value);
  
  if (isNaN(numValue)) {
    throw new ValidationError(`Value must be a number for ${statName}`, statName);
  }
  
  if (numValue < 0) {
    throw new ValidationError(`Value cannot be negative for ${statName}`, statName);
  }
  
  // Special validation for Overall State
  if (statName === 'Overall State Today (1-10)') {
    if (numValue < 1 || numValue > 10) {
      throw new ValidationError('Overall State must be between 1 and 10', statName);
    }
  }
  
  // Reasonable upper limits to prevent abuse
  const maxValues = {
    'Approaches': 1000,
    'Numbers': 500,
    'Dates Had': 50,
    'Same Night Pull': 10
  };
  
  if (maxValues[statName] && numValue > maxValues[statName]) {
    throw new ValidationError(
      `Value ${numValue} exceeds maximum ${maxValues[statName]} for ${statName}`,
      statName
    );
  }
  
  return numValue;
}

/**
 * Validate Discord user ID (snowflake)
 * @param {string} userId - User ID to validate
 * @returns {string} Validated user ID
 * @throws {ValidationError} If user ID is invalid
 */
function validateUserId(userId) {
  const userIdStr = String(userId);
  
  if (!/^\d{17,19}$/.test(userIdStr)) {
    throw new ValidationError('Invalid Discord user ID format', 'userId');
  }
  
  return userIdStr;
}

/**
 * Validate Discord channel ID (snowflake)
 * @param {string} channelId - Channel ID to validate
 * @returns {string} Validated channel ID
 * @throws {ValidationError} If channel ID is invalid
 */
function validateChannelId(channelId) {
  const channelIdStr = String(channelId);
  
  if (!/^\d{17,19}$/.test(channelIdStr)) {
    throw new ValidationError('Invalid Discord channel ID format', 'channelId');
  }
  
  return channelIdStr;
}

/**
 * Validate level value
 * @param {number} level - Level to validate
 * @returns {number} Validated level
 * @throws {ValidationError} If level is invalid
 */
function validateLevel(level) {
  const numLevel = Number(level);
  
  if (isNaN(numLevel) || !Number.isInteger(numLevel)) {
    throw new ValidationError('Level must be an integer', 'level');
  }
  
  if (numLevel < 1 || numLevel > 99) {
    throw new ValidationError('Level must be between 1 and 99', 'level');
  }
  
  return numLevel;
}

/**
 * Validate XP value
 * @param {number} xp - XP to validate
 * @returns {number} Validated XP
 * @throws {ValidationError} If XP is invalid
 */
function validateXP(xp) {
  const numXP = Number(xp);
  
  if (isNaN(numXP)) {
    throw new ValidationError('XP must be a number', 'xp');
  }
  
  if (numXP < 0) {
    throw new ValidationError('XP cannot be negative', 'xp');
  }
  
  return numXP;
}

/**
 * Validate stats object (multiple stats at once)
 * @param {object} stats - Stats object to validate
 * @returns {object} Validated and normalized stats
 * @throws {ValidationError} If any stat is invalid
 */
function validateStatsObject(stats) {
  const validated = {};
  
  for (const [statName, value] of Object.entries(stats)) {
    if (value === null || value === undefined || value === '') continue;
    
    try {
      const normalizedName = validateStatName(statName);
      const validatedValue = validateStatValue(normalizedName, value);
      validated[normalizedName] = validatedValue;
    } catch (error) {
      // Re-throw with original stat name for better error messages
      throw new ValidationError(
        `${statName}: ${error.message}`,
        statName
      );
    }
  }
  
  return validated;
}

module.exports = {
  ValidationError,
  validateStatName,
  validateStatValue,
  validateUserId,
  validateChannelId,
  validateLevel,
  validateXP,
  validateStatsObject
};

