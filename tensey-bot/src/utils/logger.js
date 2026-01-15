// ═══════════════════════════════════════════════════════════════════════════════
// TEMP STUB — DO NOT SHIP
// This file provides basic logging until full winston logger is implemented
// ═══════════════════════════════════════════════════════════════════════════════

const winston = require('winston');
const config = require('../config/environment');

const logger = winston.createLogger({
  level: config.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

module.exports = logger;

