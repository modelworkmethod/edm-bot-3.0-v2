/**
 * Structured logging utility
 * Provides consistent log formatting and log levels
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

/**
 * Format log message with timestamp and context
 * @param {string} level - Log level
 * @param {string} module - Module name
 * @param {string} message - Log message
 * @param {object} data - Additional data
 * @returns {string} Formatted log message
 */
function formatLog(level, module, message, data = null) {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
  return `[${timestamp}] [${level}] [${module}] ${message}${dataStr}`;
}

/**
 * Logger class
 */
class Logger {
  constructor(moduleName) {
    this.moduleName = moduleName;
  }

  error(message, data = null) {
    if (CURRENT_LEVEL >= LOG_LEVELS.ERROR) {
      console.error(formatLog('ERROR', this.moduleName, message, data));
    }
  }

  warn(message, data = null) {
    if (CURRENT_LEVEL >= LOG_LEVELS.WARN) {
      console.warn(formatLog('WARN', this.moduleName, message, data));
    }
  }

  info(message, data = null) {
    if (CURRENT_LEVEL >= LOG_LEVELS.INFO) {
      console.log(formatLog('INFO', this.moduleName, message, data));
    }
  }

  debug(message, data = null) {
    if (CURRENT_LEVEL >= LOG_LEVELS.DEBUG) {
      console.log(formatLog('DEBUG', this.moduleName, message, data));
    }
  }
}

/**
 * Create a logger instance for a module
 * @param {string} moduleName - Name of the module
 * @returns {Logger} Logger instance
 */
function createLogger(moduleName) {
  return new Logger(moduleName);
}

module.exports = {
  createLogger,
  LOG_LEVELS
};

