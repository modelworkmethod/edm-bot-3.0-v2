/**
 * Guild Member Add Event
 * Handles new members joining the server
 */

const { EmbedBuilder } = require('discord.js');
const { createLogger } = require('../utils/logger');
const config = require('../config/settings');

const logger = createLogger('GuildMemberAdd');

module.exports = {
  name: 'guildMemberAdd',

  /**
   * Execute guild member add event
   */
  async execute(member) {
    const services = member.client.services;

    if (!services) {
      return;
    }

    try {
      logger.info('New member joined', {
        userId: member.id,
        username: member.user.username
      });

      // Create user in database
      await services.userService.getOrCreateUser(member.id, member.user.username);

      // Auto-assign faction
      const factionCounts = await services.repositories.user.getFactionCounts();
      const assignedFaction = await services.roleService.autoAssignFaction(member, factionCounts);

      // Update database
      await services.userService.setUserFaction(member.id, assignedFaction);

      // Send welcome DM if enabled
      if (config.features.sendWelcomeDM) {
        await sendWelcomeDM(member, assignedFaction);
      }

      // Send welcome message in general channel if enabled
      if (config.features.sendWelcomeGeneral && config.channels.general) {
        await sendWelcomeMessage(member, assignedFaction, services);
      }

    } catch (error) {
      logger.error('Failed to handle new member', {
        userId: member.id,
        error: error.message
      });
    }
  }
};

/**
 * Send welcome DM to new member
 */
async function sendWelcomeDM(member, faction) {
  try {
    const factionEmoji = config.constants.FACTION_EMOJIS[faction] || '';
    
    await member.send({
      embeds: [{
        color: config.branding.colorHex,
        title: `Welcome to ${config.branding.name}!`,
        description: [
          `You've been assigned to **${factionEmoji} ${faction}**!`,
          '',
          'Get started:',
          '• Introduce yourself in the general channel',
          '• Use `/submit-stats` to track your daily progress',
          '• Check `/my-stats` to see your profile',
          '• View the leaderboard with `/leaderboard`',
          '',
          'Start building your empire today!'
        ].join('\n'),
        thumbnail: { url: config.branding.logoUrl },
        footer: { text: config.branding.name }
      }]
    });
  } catch (error) {
    logger.warn('Could not send welcome DM', {
      userId: member.id,
      error: error.message
    });
  }
}

/**
 * Send welcome message in general channel
 */
async function sendWelcomeMessage(member, faction, services) {
  try {
    const factionEmoji = config.constants.FACTION_EMOJIS[faction] || '';
    
    await services.channelService.sendToChannel(
      config.channels.general,
      `Welcome ${member} to **${factionEmoji} ${faction}**! Introduce yourself and start your journey.`
    );
  } catch (error) {
    logger.warn('Could not send welcome message', { error: error.message });
  }
}

