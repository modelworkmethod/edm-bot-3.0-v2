/**
 * Centralized error handling
 * Provides consistent error handling and logging across the application
 */

const { createLogger } = require('./logger');
const logger = createLogger('ErrorHandler');

/**
 * Error types for categorization
 */
const ErrorTypes = {
  DATABASE: 'DATABASE_ERROR',
  DISCORD_API: 'DISCORD_API_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND_ERROR',
  PERMISSION: 'PERMISSION_ERROR',
  RATE_LIMIT: 'RATE_LIMIT_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
};

/**
 * Custom application error class
 */
class AppError extends Error {
  constructor(message, type = ErrorTypes.UNKNOWN, details = null) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Handle errors and log appropriately
 * @param {Error} error - Error object
 * @param {string} context - Context where error occurred
 * @returns {object} Error details for response
 */
function handleError(error, context = 'Unknown') {
  const errorInfo = {
    message: error.message,
    type: error.type || ErrorTypes.UNKNOWN,
    context,
    timestamp: new Date().toISOString()
  };

  // Log with appropriate level
  if (error.type === ErrorTypes.VALIDATION) {
    logger.warn('Validation error', errorInfo);
  } else if (error.type === ErrorTypes.NOT_FOUND) {
    logger.info('Not found', errorInfo);
  } else {
    logger.error('Error occurred', {
      ...errorInfo,
      stack: error.stack
    });
  }

  return errorInfo;
}

/**
 * Wrap async functions with error handling
 * @param {Function} fn - Async function to wrap
 * @param {string} context - Context name
 * @returns {Function} Wrapped function
 */
function asyncErrorHandler(fn, context) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, context);
      throw error;
    }
  };
}

/**
 * Handle Discord API errors specifically
 * @param {Error} error - Discord.js error
 * @param {string} context - Context
 * @returns {object} Error details
 */
function handleDiscordError(error, context) {
  // Discord.js specific error handling
  if (error.code === 50013) {
    return handleError(
      new AppError('Missing permissions', ErrorTypes.PERMISSION, { code: error.code }),
      context
    );
  }
  
  if (error.code === 50001) {
    return handleError(
      new AppError('Missing access', ErrorTypes.PERMISSION, { code: error.code }),
      context
    );
  }

  if (error.code === 10008) {
    return handleError(
      new AppError('Unknown message', ErrorTypes.NOT_FOUND, { code: error.code }),
      context
    );
  }

  return handleError(
    new AppError(error.message, ErrorTypes.DISCORD_API, { code: error.code }),
    context
  );
}

module.exports = {
  AppError,
  ErrorTypes,
  handleError,
  asyncErrorHandler,
  handleDiscordError
};

