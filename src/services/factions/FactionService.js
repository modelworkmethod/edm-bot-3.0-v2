// ═══════════════════════════════════════════════════════════════════════════════
// TEMP STUB — DO NOT SHIP
// FactionService placeholder to prevent startup crash
// User must implement faction management logic
// ═══════════════════════════════════════════════════════════════════════════════

// src/services/factions/FactionService.js

const { createLogger } = require('../../utils/logger');
const settings = require('../../config/settings');

const logger = createLogger('FactionService');

class FactionService {
  constructor(repositories, channelService, roleService) {
    this.repositories = repositories;
    this.channelService = channelService;
    this.roleService = roleService; 
  }

  async setUserFaction(guild, userId, faction) {
    // Save faction in database
    await this.repositories.user.setFaction(userId, faction);

    // If roleService is available, sync roles
    if (!this.roleService || !guild) {
      logger.warn('FactionService: roleService or guild missing, skipping role sync', {
        userId,
        faction,
      });
      return;
    }

    try {
      const member = await guild.members.fetch(userId);

      const luminarchId = settings.factions?.luminarchRoleId;
      const noctivoreId = settings.factions?.noctivoreRoleId;

      const rolesToRemove = [];
      if (luminarchId && member.roles.cache.has(luminarchId)) {
        rolesToRemove.push(luminarchId);
      }
      if (noctivoreId && member.roles.cache.has(noctivoreId)) {
        rolesToRemove.push(noctivoreId);
      }

      // Delete old faction roles
      if (rolesToRemove.length > 0) {
        await member.roles.remove(rolesToRemove);
      }

      // Add new faction role
      let roleToAdd = null;
      if (faction === 'Luminarchs' && luminarchId) {
        roleToAdd = luminarchId;
      } else if (faction === 'Noctivores' && noctivoreId) {
        roleToAdd = noctivoreId;
      }

      if (roleToAdd) {
        await member.roles.add(roleToAdd);
      }

      logger.info('FactionService: synced Discord roles for faction', {
        userId,
        faction,
      });
    } catch (err) {
      logger.error('FactionService: failed to sync faction roles', {
        userId,
        faction,
        error: err.message,
      });
    }
  }
}

module.exports = FactionService;

