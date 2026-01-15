// ═══════════════════════════════════════════════════════════════════════════════
// TEMP STUB — DO NOT SHIP
// Error handling utilities for Tensey Bot
// ═══════════════════════════════════════════════════════════════════════════════

const logger = require('./logger');

class ErrorHandler {
  static async handle(error, context = {}) {
    logger.error('Error occurred', {
      message: error.message,
      stack: error.stack,
      ...context
    });
  }
}

module.exports = ErrorHandler;

