// src/events/interactionCreate/withServiceAliases.js
/**
 * Provide backward-compatible aliases and safe stubs for services
 * so legacy commands (expecting services.admin, services.channel, etc.)
 * don't crash with "Cannot read properties of undefined".
 */

const { createLogger } = require('../../utils/logger');
const logger = createLogger('ServiceAliases');

function createNoopNamespace(label) {
  return new Proxy(
    {},
    {
      get(_t, prop) {
        return (..._args) => {
          logger.debug(`NOOP ${label}.${String(prop)} called`);
          return undefined;
        };
      },
    }
  );
}

/**
 * Build admin alias with PermissionGuard
 */
function buildAdminAlias(services) {
  const perm = services.permissionGuard;
  const existing = services.admin || services.adminService || {};
  const admin = { ...existing };

  /**
   * isAdmin puede recibir:
   *  - Interaction (slash command)
   *  - userId (string)
   */
  admin.isAdmin = function isAdmin(target) {
    if (typeof existing.isAdmin === 'function') {
      try {
        if (existing.isAdmin(target)) return true;
      } catch (e) {
        logger.warn('Existing admin.isAdmin threw error', { error: e.message });
      }
    }

    if (!perm) return false;

    // Case: Interaction
    if (target && typeof target === 'object' && target.user && target.member) {
      if (typeof perm.isAdminInteraction === 'function') {
        return !!perm.isAdminInteraction(target);
      }

      // Fallback: use hasPermission with command "admin"
      try {
        return !!perm.hasPermission(target, 'admin');
      } catch (e) {
        logger.warn('isAdmin (interaction) fallback failed', { error: e.message });
        return false;
      }
    }

    // Cas3: userId 
    if (typeof target === 'string') {
      if (typeof perm.isAdminUserId === 'function') {
        return !!perm.isAdminUserId(target);
      }
      try {
        return perm.adminUserId ? perm.adminUserId === target : false;
      } catch (e) {
        logger.warn('isAdmin (userId) fallback failed', { error: e.message });
        return false;
      }
    }

    return false;
  };

  /**
   *
   * - If not admin → get "⛔ Admin only." (ephemeral) and give back false
   * - If admin → true
   */
  admin.ensureAdmin = async function ensureAdmin(interaction) {
    const ok = admin.isAdmin(interaction);
    if (ok) return true;

    try {
      const payload = { content: '⛔ Admin only.', flags: 1 << 6 }; // ephemeral
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload);
      } else if (interaction.isRepliable?.()) {
        await interaction.reply(payload);
      }
    } catch (e) {
      logger.error('Failed to send admin-only reply', { error: e.message });
    }
    return false;
  };


  admin.requireAdmin =
    existing.requireAdmin ||
    (async function requireAdmin(interaction) {
      const ok = await admin.ensureAdmin(interaction);
      if (!ok) {
        const err = new Error('AdminOnly');
        err.code = 'ADMIN_ONLY';
        throw err;
      }
    });

  return admin;
}

/**
 * Build an aliased, fault-tolerant services object.
 */
function withServiceAliases(input) {
  const s = input || {};
  const out = { ...s };

  // ----- Admin alias (principal problema de /faction-admin set) -------------
  out.admin = buildAdminAlias(s) || createNoopNamespace('admin');

  // ----- Channel alias -------------------------------------------------------
  out.channel = s.channel || s.channelService || createNoopNamespace('channel');

  // ----- Moderation alias ----------------------------------------------------
  out.moderation = s.moderation || s.contentModerator || createNoopNamespace('moderation');

  // ----- Wins / Engagement / CTJ --------------------------------------------
  out.wins = s.wins || s.winsMonitor || createNoopNamespace('wins');
  out.engagement = s.engagement || s.chatEngagementMonitor || createNoopNamespace('engagement');
  out.ctj = s.ctj || s.ctjMonitor || createNoopNamespace('ctj');

  // ----- Texting / Course / Factions ----------------------------------------
  out.texting = s.texting || s.textingService || createNoopNamespace('texting');
  out.course = s.course || s.courseService || createNoopNamespace('course');
  out.factions = s.factions || s.factionService || createNoopNamespace('factions');

  // ----- Nicknames / Role sync ----------------------------------------------
  out.nickname = s.nickname || s.nicknameService || createNoopNamespace('nickname');
  out.roleSync = s.roleSync || s.roleSyncService || createNoopNamespace('roleSync');

  // ----- Repositories --------------------------------------------------------
  out.repositories = s.repositories || s.repos || createNoopNamespace('repositories');

  return out;
}

module.exports = { withServiceAliases };
