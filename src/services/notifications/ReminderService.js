/**
 * Reminder Service
 * Handles scheduled reminders (call reminders, nightly stats, etc.)
 */

const { createLogger } = require('../../utils/logger');
const config = require('../../config/settings');

const logger = createLogger('ReminderService');

class ReminderService {
  constructor(channelService) {
    this.channelService = channelService;
    this.scheduledReminders = new Map();
  }

  /**
   * Schedule call reminder
   * @param {Date} callTime - Time of the call
   * @param {string} channelId - Channel to send reminder to
   * @returns {void}
   */
  scheduleCallReminders(callTime, channelId) {
    try {
      const callTimestamp = callTime.getTime();
      const now = Date.now();

      // 6 hours before
      const sixHoursBefore = callTimestamp - (6 * 60 * 60 * 1000);
      if (sixHoursBefore > now) {
        this.scheduleReminder(sixHoursBefore, async () => {
          await this.channelService.sendToChannel(
            channelId,
            '⏰ **Call Reminder**: Group call in 6 hours!'
          );
        }, 'call-6h');
      }

      // 90 minutes before
      const ninetyMinsBefore = callTimestamp - (90 * 60 * 1000);
      if (ninetyMinsBefore > now) {
        this.scheduleReminder(ninetyMinsBefore, async () => {
          await this.channelService.sendToChannel(
            channelId,
            '⏰ **Call Reminder**: Group call in 90 minutes!'
          );
        }, 'call-90m');
      }

      // 15 minutes before
      const fifteenMinsBefore = callTimestamp - (15 * 60 * 1000);
      if (fifteenMinsBefore > now) {
        this.scheduleReminder(fifteenMinsBefore, async () => {
          await this.channelService.sendToChannel(
            channelId,
            '⏰ **Call Starting Soon**: Group call in 15 minutes!'
          );
        }, 'call-15m');
      }

      logger.info('Call reminders scheduled', {
        callTime: callTime.toISOString(),
        channelId
      });

    } catch (error) {
      logger.error('Failed to schedule call reminders', { error: error.message });
    }
  }

  /**
   * Schedule a reminder at specific time
   * @param {number} timestamp - Unix timestamp (ms)
   * @param {Function} callback - Callback to execute
   * @param {string} id - Reminder ID
   * @returns {void}
   */
  scheduleReminder(timestamp, callback, id) {
    const delay = timestamp - Date.now();

    if (delay <= 0) {
      logger.debug('Reminder time already passed', { id });
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        await callback();
        this.scheduledReminders.delete(id);
      } catch (error) {
        logger.error('Reminder callback failed', { id, error: error.message });
      }
    }, delay);

    this.scheduledReminders.set(id, timeoutId);
    logger.debug('Reminder scheduled', { id, delay: `${delay}ms` });
  }

  /**
   * Cancel reminder
   * @param {string} id - Reminder ID
   * @returns {void}
   */
  cancelReminder(id) {
    const timeoutId = this.scheduledReminders.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.scheduledReminders.delete(id);
      logger.debug('Reminder cancelled', { id });
    }
  }

  /**
   * Send nightly reminder
   * @param {string} channelId - Channel ID
   * @returns {Promise<void>}
   */
/*   async sendNightlyReminder(channelId) {
    try {
      await this.channelService.sendToChannel(
        channelId,
        {
          embeds: [{
            color: 0x00FF00,
            title: '🌙 Nightly Stats Reminder',
            description: 'Don\'t forget to log your daily stats! Use `/submit-stats` to record today\'s progress.\n\nMissed a day? No problem - use `/submit-past-stats` to catch up.\n\nKeep building your empire!',
            footer: { text: config.branding.name },
            timestamp: new Date().toISOString()
          }]
        }
      );

      logger.info('Nightly reminder sent', { channelId });

    } catch (error) {
      logger.error('Failed to send nightly reminder', { error: error.message });
    }
  } */

  /**
   * Clear all scheduled reminders
   * @returns {void}
   */
  clearAllReminders() {
    for (const timeoutId of this.scheduledReminders.values()) {
      clearTimeout(timeoutId);
    }
    this.scheduledReminders.clear();
    logger.info('All reminders cleared');
  }
}

module.exports = ReminderService;

