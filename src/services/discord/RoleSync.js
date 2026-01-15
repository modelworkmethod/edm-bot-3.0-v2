/**
 * Role Sync Service
 * Ensures faction roles exist with correct colors and syncs member roles
 */

const { createLogger } = require('../../utils/logger');
const { PermissionsBitField } = require('discord.js');
const factionConfig = require('../../config/factionConfig');

const logger = createLogger('RoleSync');

class RoleSync {
  /**
   * Sync member's faction role and color
   * @param {object} params - { guild, member, factionKey }
   * @returns {Promise<object>} { success, appliedRoleId, colorUpdated, error }
   */
  async syncMemberFaction({ guild, member, factionKey }) {
    try {
      // Get faction config
      const faction = factionConfig.getFactionByKey(factionKey);
      if (!faction) {
        return { success: false, error: `Invalid faction: ${factionKey}` };
      }

      // Check if role ID is configured
      if (faction.roleId === 'REPLACE_ME') {
        logger.warn('Faction role ID not configured', { faction: factionKey });
        return { 
          success: false, 
          error: `Role ID for ${factionKey} not configured (REPLACE_ME)` 
        };
      }

      // Check bot permissions
      if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        logger.warn('Bot lacks ManageRoles permission');
        return { success: false, error: 'Bot lacks ManageRoles permission' };
      }

      // Get or create the faction role
      let role = guild.roles.cache.get(faction.roleId);
      let colorUpdated = false;

      if (!role) {
        // Role not found - cannot create without valid ID
        logger.error('Faction role not found in guild', { 
          roleId: faction.roleId, 
          faction: factionKey 
        });
        return { 
          success: false, 
          error: `Role ${faction.roleId} not found in guild` 
        };
      }

      // Update color if needed
      if (role.color !== faction.colorInt) {
        try {
          await role.setColor(faction.colorInt);
          colorUpdated = true;
          logger.info('Updated faction role color', {
            faction: factionKey,
            oldColor: role.color,
            newColor: faction.colorInt
          });
        } catch (colorError) {
          logger.warn('Failed to update role color', { 
            error: colorError.message,
            faction: factionKey 
          });
          // Continue anyway - color update is not critical
        }
      }

      // Remove opposite faction role
      const allFactions = [
        factionConfig.factions.LUMINARCHS,
        factionConfig.factions.NOCTIVORES
      ];

      for (const otherFaction of allFactions) {
        if (otherFaction.key !== factionKey && 
            otherFaction.roleId !== 'REPLACE_ME' &&
            member.roles.cache.has(otherFaction.roleId)) {
          try {
            await member.roles.remove(otherFaction.roleId);
            logger.debug('Removed opposite faction role', {
              userId: member.id,
              removedFaction: otherFaction.key
            });
          } catch (removeError) {
            logger.warn('Failed to remove opposite faction role', {
              error: removeError.message
            });
          }
        }
      }

      // Add faction role if not present
      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role);
        logger.debug('Added faction role', {
          userId: member.id,
          faction: factionKey,
          roleId: role.id
        });
      }

      return {
        success: true,
        appliedRoleId: role.id,
        colorUpdated
      };

    } catch (error) {
      logger.error('Failed to sync member faction', { 
        error: error.message,
        factionKey,
        userId: member?.id 
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Ensure faction role colors are correct (call once at startup)
   * @param {Guild} guild - Discord guild
   * @returns {Promise<void>}
   */
  async ensureFactionRoleColors(guild) {
    try {
      const results = [];

      for (const [name, faction] of Object.entries(factionConfig.factions)) {
        if (faction.roleId === 'REPLACE_ME') {
          logger.warn(`⚠️  Faction role ID not configured: ${faction.key} (set env var)`, {
            faction: faction.key,
            envVar: `${name}_ROLE_ID`
          });
          results.push({ faction: faction.key, status: 'skipped_placeholder' });
          continue;
        }

        const role = guild.roles.cache.get(faction.roleId);
        
        if (!role) {
          logger.error(`Faction role not found in guild: ${faction.key}`, {
            roleId: faction.roleId,
            faction: faction.key
          });
          results.push({ faction: faction.key, status: 'not_found' });
          continue;
        }

        if (role.color !== faction.colorInt) {
          try {
            await role.setColor(faction.colorInt);
            logger.info(`✓ Updated ${faction.key} role color to ${faction.colorHex}`, {
              faction: faction.key,
              roleId: faction.roleId,
              color: faction.colorHex
            });
            results.push({ faction: faction.key, status: 'color_updated' });
          } catch (error) {
            logger.error(`Failed to update ${faction.key} role color`, {
              error: error.message,
              faction: faction.key
            });
            results.push({ faction: faction.key, status: 'color_update_failed' });
          }
        } else {
          logger.debug(`✓ ${faction.key} role color already correct`, {
            faction: faction.key,
            color: faction.colorHex
          });
          results.push({ faction: faction.key, status: 'color_ok' });
        }
      }

      logger.info('Faction role color sync complete', { results });

    } catch (error) {
      logger.error('Failed to ensure faction role colors', { 
        error: error.message 
      });
    }
  }

  /**
   * Remove all faction roles from member
   * @param {GuildMember} member - Discord member
   * @returns {Promise<void>}
   */
  async removeAllFactionRoles(member) {
    try {
      const allFactions = [
        factionConfig.factions.LUMINARCHS,
        factionConfig.factions.NOCTIVORES
      ];

      for (const faction of allFactions) {
        if (faction.roleId !== 'REPLACE_ME' && 
            member.roles.cache.has(faction.roleId)) {
          await member.roles.remove(faction.roleId);
          logger.debug('Removed faction role', {
            userId: member.id,
            faction: faction.key
          });
        }
      }
    } catch (error) {
      logger.error('Failed to remove faction roles', { 
        error: error.message,
        userId: member?.id 
      });
      throw error;
    }
  }
}

module.exports = RoleSync;


