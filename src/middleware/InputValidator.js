/**
 * Input Validator
 * Sanitizes and validates all user input to prevent injection attacks
 */

const { createLogger } = require('../utils/logger');

const logger = createLogger('InputValidator');

class InputValidator {
  /**
   * Sanitize string input
   */
  static sanitizeString(input, maxLength = 500) {
    if (typeof input !== 'string') return '';
    
    // Remove null bytes, control characters
    let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Trim and limit length
    sanitized = sanitized.trim().slice(0, maxLength);
    
    return sanitized;
  }

  /**
   * Validate and sanitize integer
   */
  static validateInteger(input, min = 0, max = 1000000) {
    const num = parseInt(input);
    
    if (isNaN(num)) {
      throw new Error(`Invalid integer: ${input}`);
    }
    
    if (num < min || num > max) {
      throw new Error(`Integer out of range: ${num} (allowed: ${min}-${max})`);
    }
    
    return num;
  }

  /**
   * Validate Discord ID (snowflake)
   */
  static validateDiscordId(id) {
    if (!/^\d{17,19}$/.test(id)) {
      throw new Error(`Invalid Discord ID: ${id}`);
    }
    return id;
  }

  /**
   * Validate stats object
   */
  static validateStats(stats) {
    const validated = {};
    const STAT_WEIGHTS = require('../config/constants').STAT_WEIGHTS;

    for (const [key, value] of Object.entries(stats)) {
      // Check if stat exists
      if (!STAT_WEIGHTS[key]) {
        logger.warn('Unknown stat submitted', { stat: key });
        continue;
      }

      // Validate value
      try {
        const num = this.validateInteger(value, 0, 1000);
        validated[key] = num;
      } catch (error) {
        logger.warn('Invalid stat value', { stat: key, value, error: error.message });
      }
    }

    return validated;
  }

  /**
   * Detect SQL injection attempts
   */
  static containsSQLInjection(input) {
    const sqlPatterns = [
      /(\bUNION\b.*\bSELECT\b)/i,
      /(\bDROP\b.*\bTABLE\b)/i,
      /(\bINSERT\b.*\bINTO\b)/i,
      /(\bDELETE\b.*\bFROM\b)/i,
      /(\bUPDATE\b.*\bSET\b)/i,
      /(--|;|\/\*|\*\/)/,
      /(\bOR\b.*=.*)/i,
      /(\bAND\b.*=.*)/i
    ];

    return sqlPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Detect XSS attempts
   */
  static containsXSS(input) {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /on\w+\s*=\s*["'][^"']*["']/gi,
      /javascript:/gi,
      /<iframe/gi,
      /<embed/gi,
      /<object/gi
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Comprehensive validation for user input
   */
  static validateUserInput(input, context = 'general') {
    if (typeof input !== 'string') {
      throw new Error('Input must be a string');
    }

    // Check for injection attempts
    if (this.containsSQLInjection(input)) {
      logger.error('SQL injection attempt detected', { input: input.slice(0, 100), context });
      throw new Error('Invalid input detected');
    }

    if (this.containsXSS(input)) {
      logger.error('XSS attempt detected', { input: input.slice(0, 100), context });
      throw new Error('Invalid input detected');
    }

    // Sanitize
    return this.sanitizeString(input, context === 'journal' ? 2000 : 500);
  }

  /**
   * Validate modal submission data
   */
  static validateModalData(fields) {
    const validated = {};

    for (const [key, value] of Object.entries(fields)) {
      try {
        validated[key] = this.validateUserInput(value, key);
      } catch (error) {
        logger.error('Modal field validation failed', { field: key, error: error.message });
        throw error;
      }
    }

    return validated;
  }
}

module.exports = InputValidator;

