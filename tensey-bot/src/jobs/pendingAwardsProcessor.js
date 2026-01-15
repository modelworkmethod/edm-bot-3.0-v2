// ═══════════════════════════════════════════════════════════════════════════════
// TEMP STUB — DO NOT SHIP
// Pending awards processor job
// ═══════════════════════════════════════════════════════════════════════════════

const XPAwardService = require('../services/XPAwardService');
const logger = require('../utils/logger');

class PendingAwardsProcessor {
  static async run() {
    try {
      const result = await XPAwardService.processPendingAwards();
      
      if (result.processed > 0 || result.failed > 0) {
        logger.info('Pending awards processed', result);
      }
      
    } catch (err) {
      logger.error('Pending awards processor error', err);
    }
  }
}

module.exports = PendingAwardsProcessor;

