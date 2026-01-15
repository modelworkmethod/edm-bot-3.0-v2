const logger = require('../utils/logger');
const PendingAwardsRepository = require('../database/repositories/PendingAwardsRepository');
const MainBotRepository = require('../database/repositories/MainBotRepository');
const config = require('../config/environment');

class XPAwardService {
  /**
   * Schedule XP award for completed challenge
   * Awards happen 60 seconds after completion
   */
  async scheduleAward(userId, challengeIdx) {
    try {
      // Check for duplicate pending award
      const existing = PendingAwardsRepository.findPending(userId, challengeIdx);
      if (existing) {
        logger.warn('Award already pending', { userId, challengeIdx });
        return { success: false, reason: 'already_pending' };
      }
      
      // Calculate award time
      const awardScheduledAt = new Date(Date.now() + config.XP_AWARD_DELAY_MS);
      
      // Insert pending award
      PendingAwardsRepository.create({
        userId,
        challengeIdx,
        completedAt: new Date(),
        awardScheduledAt,
      });
      
      logger.info('XP award scheduled', { 
        userId, 
        challengeIdx, 
        awardAt: awardScheduledAt.toISOString() 
      });
      
      return { success: true };
      
    } catch (err) {
      logger.error('Failed to schedule award', { err, userId, challengeIdx });
      return { success: false, reason: 'database_error' };
    }
  }
  
  /**
   * Process all pending awards that are due
   * Called by background job every 10 seconds
   */
  async processPendingAwards() {
    try {
      const dueAwards = PendingAwardsRepository.findDue();
      
      if (dueAwards.length === 0) {
        return { processed: 0, failed: 0 };
      }
      
      logger.info(`Processing ${dueAwards.length} pending XP awards`);
      
      let processed = 0;
      let failed = 0;
      
      for (const award of dueAwards) {
        const success = await this._processAward(award);
        if (success) {
          processed++;
        } else {
          failed++;
        }
      }
      
      logger.info('Award batch complete', { processed, failed });
      return { processed, failed };
      
    } catch (err) {
      logger.error('Failed to process pending awards', err);
      return { processed: 0, failed: 0 };
    }
  }
  
  /**
   * Process single award
   * @private
   */
  async _processAward(award) {
    try {
      // Award XP by writing directly to main bot's PostgreSQL database
      const success = await MainBotRepository.awardTenseyXP(
        award.user_id,
        award.challenge_idx
      );
      
      if (success) {
        // Mark as awarded in local SQLite
        PendingAwardsRepository.markAwarded(award.id);
        logger.info('XP awarded successfully', { 
          userId: award.user_id, 
          challengeIdx: award.challenge_idx 
        });
        return true;
      } else {
        // Increment retry count
        PendingAwardsRepository.incrementRetries(award.id);
        logger.warn('XP award failed, will retry', { awardId: award.id });
        return false;
      }
      
    } catch (err) {
      logger.error('Award processing error', { err, awardId: award.id });
      PendingAwardsRepository.incrementRetries(award.id);
      return false;
    }
  }
  
  /**
   * Cancel pending award (for undo)
   */
  async cancelPendingAward(userId, challengeIdx) {
    try {
      const deleted = PendingAwardsRepository.deletePending(userId, challengeIdx);
      if (deleted) {
        logger.info('Pending award cancelled', { userId, challengeIdx });
      }
      return deleted;
    } catch (err) {
      logger.error('Failed to cancel award', { err, userId, challengeIdx });
      return false;
    }
  }
  
  /**
   * Get pending award count
   */
  getPendingCount() {
    return PendingAwardsRepository.countPending();
  }
}

module.exports = new XPAwardService();

