/**
 * Auto Reminder Service
 * Sends automated DMs to inactive users
 */

const { EmbedBuilder } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const { getLocalDayString } = require('../../utils/timeUtils');
const config = require('../../config/settings');

const logger = createLogger('AutoReminderService');

class AutoReminderService {
  constructor(client) {
    this.client = client;
    this.bookingLink = process.env.EMERGENCY_CALL_BOOKING_LINK || 'https://calendly.com/your-link';
  }

  /**
   * Send reminder based on inactivity level
   */
  async sendInactivityReminder(userId, daysInactive) {
    try {
      const user = await this.client.users.fetch(userId);

      if (!user || user.bot) {
        return { success: false, reason: 'User not found or is bot' };
      }

      // Choose message based on inactivity duration
      let message;
      if (daysInactive >= 7) {
        message = this.getCriticalMessage();
      } else if (daysInactive >= 3) {
        message = this.getHighPriorityMessage();
      } else if (daysInactive >= 2) {
        message = this.getModeratePriorityMessage();
      } else {
        message = this.getLowPriorityMessage();
      }

      const embed = new EmbedBuilder()
        .setColor(daysInactive >= 7 ? 0xFF0000 : daysInactive >= 3 ? 0xFF6B6B : 0xFFA500)
        .setTitle(message.title)
        .setDescription(message.description)
        .addFields({
          name: '🤝 Need Support?',
          value: `If you're stuck or need guidance, I'm here to help.\n\n[Book a 15-min Emergency Brief Call](${this.bookingLink})\n\nNo judgment - we all hit roadblocks. Let's get you back on track.`
        })
        .setFooter({ text: config.branding.name })
        .setTimestamp();

      await user.send({ embeds: [embed] });

      logger.info('Reminder sent', { userId, daysInactive });
      return { success: true };

    } catch (error) {
      logger.error('Failed to send reminder', { userId, error: error.message });
      return { success: false, reason: error.message };
    }
  }

  /**
   * Message templates
   */
  getLowPriorityMessage() {
    return {
      title: '📅 Daily Stats Reminder',
      description: `Hey! I noticed you haven't logged your stats today.\n\nDon't break your streak! Use \`/submit-stats\` to keep your momentum going.\n\nEven small wins count.`
    };
  }

  getModeratePriorityMessage() {
    return {
      title: '⏰ Missing You!',
      description: `It's been 2 days since your last submission.\n\nLife gets busy - I get it. But momentum is built daily.\n\nWhat's one small action you can take today?\n• 1 approach?\n• 5 minutes of meditation?\n• Rate your state?\n\nLog it with \`/submit-stats\` and keep the fire burning.`
    };
  }

  getHighPriorityMessage() {
    return {
      title: '🚨 Checking In',
      description: `It's been 3+ days. I'm concerned.\n\n**Real talk:** This work requires consistency. Not perfection, but presence.\n\nWhat's stopping you right now?\n• Feeling stuck?\n• Lost motivation?\n• Unclear what to do?\n\nThese are normal. But ghosting yourself won't fix them.\n\nLet's talk about what's really going on.`
    };
  }

  getCriticalMessage() {
    return {
      title: '💔 We Need to Talk',
      description: `7+ days without a check-in.\n\n**This is a pattern.** And patterns reveal priorities.\n\nI'm not here to guilt trip you. But I am here to call you forward.\n\n**Two options:**\n1. Recommit right now. Log today's stats. Get back in the game.\n2. Book a call so we can figure out what's really going on.\n\nIgnoring this won't make it better.\n\nYour future self is watching what you do next.`
    };
  }

  /**
   * Send batch reminders
   */
  async sendBatchReminders(inactiveUsers) {
    const results = {
      sent: 0,
      failed: 0,
      errors: []
    };

    for (const user of inactiveUsers) {
      const result = await this.sendInactivityReminder(user.userId, user.daysInactive);
      
      if (result.success) {
        results.sent++;
      } else {
        results.failed++;
        results.errors.push({ userId: user.userId, reason: result.reason });
      }

      // Rate limit: 1 DM per second
      await this.sleep(1000);
    }

    return results;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AutoReminderService;

