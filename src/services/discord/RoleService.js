/**
 * Role Service
 * Handles Discord role assignment and management
 */

const { PermissionsBitField } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const { handleDiscordError } = require('../../utils/errorHandler');
const config = require('../../config/settings');

const logger = createLogger('RoleService');

class RoleService {
  constructor(client) {
    this.client = client;
  }

  /**
   * Assign tier role based on class name
   * @param {GuildMember} member - Guild member
   * @param {string} className - Class name
   * @returns {Promise<void>}
   */
  async assignTierRole(member, className) {
    try {
      const guild = member.guild;

      // Check bot permissions
      if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        logger.warn('Bot lacks ManageRoles permission');
        return;
      }

      if (!member.manageable) {
        logger.debug('Member not manageable', { userId: member.id });
        return;
      }

      // Get role ID for this class
      const roleId = config.roles.tiers[className];
      if (!roleId) {
        logger.debug('No role configured for class', { className });
        return;
      }

      const desiredRole = guild.roles.cache.get(roleId);
      if (!desiredRole) {
        logger.warn('Role not found', { roleId, className });
        return;
      }

      // Remove all other tier roles
      const tierRoleIds = Object.values(config.roles.tiers).filter(Boolean);
      const rolesToRemove = member.roles.cache.filter(
        r => tierRoleIds.includes(r.id) && r.id !== roleId
      );

      if (rolesToRemove.size > 0) {
        await member.roles.remove(rolesToRemove);
        logger.debug('Removed old tier roles', { userId: member.id });
      }

      // Add new role if not already present
      if (!member.roles.cache.has(roleId)) {
        await member.roles.add(desiredRole);
        logger.debug('Assigned tier role', { userId: member.id, className });
      }

    } catch (error) {
      if (error.code) {
        handleDiscordError(error, 'RoleService.assignTierRole');
      }
      // Don't throw - role assignment is non-critical
      logger.warn('Failed to assign tier role', { error: error.message });
    }
  }

  /**
   * Assign faction role
   * @param {GuildMember} member - Guild member
   * @param {string} faction - Faction name (Luminarchs/Noctivores)
   * @returns {Promise<void>}
   */
  async assignFactionRole(member, faction) {
    try {
      const guild = member.guild;

      if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        logger.warn('Bot lacks ManageRoles permission');
        return;
      }

      const roleId = config.roles.factions[faction];
      if (!roleId) {
        logger.warn('No role configured for faction', { faction });
        return;
      }

      const role = guild.roles.cache.get(roleId);
      if (!role) {
        logger.warn('Faction role not found', { roleId, faction });
        return;
      }

      // Remove other faction role
      const otherFaction = faction === 'Luminarchs' ? 'Noctivores' : 'Luminarchs';
      const otherRoleId = config.roles.factions[otherFaction];
      if (otherRoleId && member.roles.cache.has(otherRoleId)) {
        await member.roles.remove(otherRoleId);
      }

      // Add faction role
      if (!member.roles.cache.has(roleId)) {
        await member.roles.add(role);
        logger.debug('Assigned faction role', { userId: member.id, faction });
      }

    } catch (error) {
      if (error.code) {
        handleDiscordError(error, 'RoleService.assignFactionRole');
      }
      logger.warn('Failed to assign faction role', { error: error.message });
    }
  }

  /**
   * Assign rank color role
   * @param {GuildMember} member - Guild member
   * @param {number} rank - User rank (1, 2-3, 4-10, etc.)
   * @returns {Promise<void>}
   */
  async assignRankColorRole(member, rank) {
    try {
      const guild = member.guild;

      if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return;
      }

      // Remove all rank color roles first
      const rankRoleIds = Object.values(config.roles.rankColors).filter(Boolean);
      const toRemove = member.roles.cache.filter(r => rankRoleIds.includes(r.id));
      
      if (toRemove.size > 0) {
        await member.roles.remove(toRemove);
      }

      // Assign appropriate rank color
      let targetRoleId = null;
      if (rank === 1 && config.roles.rankColors.top1) {
        targetRoleId = config.roles.rankColors.top1;
      } else if (rank <= 3 && config.roles.rankColors.top3) {
        targetRoleId = config.roles.rankColors.top3;
      } else if (rank <= 10 && config.roles.rankColors.top10) {
        targetRoleId = config.roles.rankColors.top10;
      }

      if (targetRoleId) {
        await member.roles.add(targetRoleId);
        logger.debug('Assigned rank color role', { userId: member.id, rank });
      }

    } catch (error) {
      if (error.code) {
        handleDiscordError(error, 'RoleService.assignRankColorRole');
      }
      logger.warn('Failed to assign rank color role', { error: error.message });
    }
  }

  /**
   * Auto-assign faction for new member (balance factions)
   * @param {GuildMember} member - Guild member
   * @param {object} factionCounts - Current faction counts
   * @returns {Promise<string>} Assigned faction name
   */
  async autoAssignFaction(member, factionCounts) {
    try {
      const { Luminarchs, Noctivores } = factionCounts;

      // Assign to smaller faction
      const assignedFaction = Luminarchs <= Noctivores ? 'Luminarchs' : 'Noctivores';

      await this.assignFactionRole(member, assignedFaction);

      logger.info('Auto-assigned faction', {
        userId: member.id,
        faction: assignedFaction,
        counts: factionCounts
      });

      return assignedFaction;

    } catch (error) {
      logger.error('Failed to auto-assign faction', { error: error.message });
      throw error;
    }
  }
}

module.exports = RoleService;

