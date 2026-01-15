/**
 * Permission Guard
 * Hierarchical permission system for commands
 */

const { createLogger } = require('../utils/logger');
const { PermissionFlagsBits } = require('discord.js');

const logger = createLogger('PermissionGuard');

class PermissionGuard {
  constructor(config) {
    this.adminUserId = config.admin?.userId || null;
    
    // Permission levels (higher = more access)
    this.LEVELS = {
      USER: 0,
      MODERATOR: 1,
      ADMIN: 2,
      OWNER: 3
    };

    // Command permission requirements
    this.commandPermissions = {
      // Admin commands
      admin: this.LEVELS.ADMIN,
      'coaching-dashboard': this.LEVELS.ADMIN,
      'set-double-xp': this.LEVELS.ADMIN,
      'course-admin': this.LEVELS.ADMIN,

      // Faction / admin style commands
      'faction-admin': this.LEVELS.ADMIN,
      'faction-admin-set': this.LEVELS.ADMIN,
      'faction-admin-stats': this.LEVELS.ADMIN,
      
      // Moderator commands
      'timeout-user': this.LEVELS.MODERATOR,
      'warn-user': this.LEVELS.MODERATOR,
      
      // Default
      default: this.LEVELS.USER
    };
  }

  /**
   * Get user's permission level
   */
  getUserLevel(interaction) {
    const userId = interaction?.user?.id;
    const member = interaction?.member;

    // Owner (bot admin via ENV)
    if (userId && this.adminUserId && userId === this.adminUserId) {
      return this.LEVELS.OWNER;
    }

    // Discord server admin
    if (member?.permissions?.has?.(PermissionFlagsBits.Administrator)) {
      return this.LEVELS.ADMIN;
    }

    // Discord moderator (manage messages + kick/ban)
    if (
      member?.permissions?.has?.(PermissionFlagsBits.ModerateMembers) ||
      member?.permissions?.has?.(PermissionFlagsBits.ManageMessages)
    ) {
      return this.LEVELS.MODERATOR;
    }

    return this.LEVELS.USER;
  }

  /**
   * Helper: is this interaction from an admin?
   */
  isAdminInteraction(interaction) {
    const level = this.getUserLevel(interaction);
    return level >= this.LEVELS.ADMIN;
  }

  /**
   * Helper: is this userId the configured owner/admin?
   */
  isAdminUserId(userId) {
    if (!userId || !this.adminUserId) return false;
    return userId === this.adminUserId;
  }

  /**
   * Check if user has permission for command
   */
  hasPermission(interaction, commandName) {
    const userLevel = this.getUserLevel(interaction);
    const requiredLevel = this.commandPermissions[commandName] ?? this.commandPermissions.default;

    const hasAccess = userLevel >= requiredLevel;

    if (!hasAccess) {
      logger.warn('Permission denied', {
        userId: interaction?.user?.id,
        command: commandName,
        userLevel,
        requiredLevel
      });
    }

    return hasAccess;
  }

  /**
   * Middleware to check permissions
   */
  async checkPermission(interaction, commandName) {
    if (!this.hasPermission(interaction, commandName)) {
      await interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true
      });
      return false;
    }
    return true;
  }

  /**
   * Check if user can manage another user (for moderation)
   */
  canModerateUser(moderatorInteraction, targetUserId) {
    const modLevel = this.getUserLevel(moderatorInteraction);
    
    // Owner can moderate anyone
    if (modLevel === this.LEVELS.OWNER) return true;
    
    // Can't moderate the configured owner/admin
    if (this.adminUserId && targetUserId === this.adminUserId) return false;
    
    // Admins can moderate moderators and users
    if (modLevel === this.LEVELS.ADMIN) return true;
    
    // Moderators can moderate users only
    return modLevel === this.LEVELS.MODERATOR;
  }
}

module.exports = PermissionGuard;
