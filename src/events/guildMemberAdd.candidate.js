/**
 * Guild Member Add Event
 * Handles new members joining the server
 * 
 * CANDIDATE VERSION - Uses FactionBalancer + RoleSync
 */

const { EmbedBuilder } = require('discord.js');
const { createLogger } = require('../utils/logger');
const config = require('../config/settings');
const factionConfig = require('../config/factionConfig');
const AuditLogger = require('../services/security/AuditLogger');

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

      // Check if faction role IDs are configured
      if (!factionConfig.hasValidRoleIds()) {
        logger.warn('⚠️  Faction role IDs not configured - skipping auto-assignment', {
          userId: member.id,
          message: 'Set LUMINARCH_ROLE_ID and NOCTIVORE_ROLE_ID env vars'
        });
        
        // Send welcome without faction
        if (config.features.sendWelcomeDM) {
          await sendWelcomeDM(member, null);
        }
        return;
      }

      // Auto-assign faction using enhanced balancer
      const { factionKey, reason, counts } = await services.factionBalancer.pickFactionForNewMember(member.guild);

      // Sync faction role (with color enforcement)
      const syncResult = await services.roleSync.syncMemberFaction({
        guild: member.guild,
        member,
        factionKey
      });

      if (!syncResult.success) {
        logger.error('Failed to sync faction role for new member', {
          userId: member.id,
          faction: factionKey,
          error: syncResult.error
        });
        // Continue anyway - user created in DB, just no faction
        return;
      }

      // Update database
      await services.userService.setUserFaction(member.id, factionKey);

      // Audit log
      await AuditLogger.logAction(
        'system',
        'faction_auto_assign',
        { faction: factionKey, reason, counts },
        member.id
      );

      logger.info('Auto-assigned faction to new member', {
        userId: member.id,
        faction: factionKey,
        reason,
        counts
      });

      // Send welcome DM if enabled
      if (config.features.sendWelcomeDM) {
        await sendWelcomeDM(member, factionKey);
      }

      // Send welcome message in general channel if enabled
      if (config.features.sendWelcomeGeneral && config.channels.general) {
        await sendWelcomeMessage(member, factionKey, services);
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
    const factionInfo = faction ? factionConfig.getFactionByKey(faction) : null;
    const factionEmoji = factionInfo ? factionInfo.emoji : '';
    
    const description = [
      faction ? `You've been assigned to **${factionEmoji} ${faction}**!` : 'Welcome!',
      '',
      'Get started:',
      '• Introduce yourself in the general channel',
      '• Use `/submit-stats` to track your daily progress',
      '• Check `/scorecard` to see your profile',
      '• View the leaderboard with `/leaderboard`',
      '',
      'Start building your empire today!'
    ].join('\n');

    await member.send({
      embeds: [{
        color: config.branding.colorHex,
        title: `Welcome to ${config.branding.name}!`,
        description,
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
    const factionInfo = faction ? factionConfig.getFactionByKey(faction) : null;
    const factionEmoji = factionInfo ? factionInfo.emoji : '';
    
    const message = faction 
      ? `Welcome ${member} to **${factionEmoji} ${faction}**! Introduce yourself and start your journey.`
      : `Welcome ${member}! Introduce yourself and start your journey.`;
    
    await services.channelService.sendToChannel(
      config.channels.general,
      message
    );
  } catch (error) {
    logger.warn('Could not send welcome message', { error: error.message });
  }
}


