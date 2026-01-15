/**
 * Faction Admin Command
 * Admin-only faction management (set, clear, stats, sync)
 */

const { SlashCommandBuilder } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const factionConfig = require('../../config/factionConfig');
const AuditLogger = require('../../services/security/AuditLogger');

const logger = createLogger('FactionAdminCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('faction-admin')
    .setDescription('Admin: Manage user factions')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Assign a user to a faction')
        .addUserOption(opt => 
          opt.setName('user')
            .setDescription('User to assign')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('faction')
            .setDescription('Faction to assign')
            .addChoices(
              { name: 'Luminarchs (🦸 Gold)', value: 'Luminarchs' },
              { name: 'Noctivores (🥷 Purple)', value: 'Noctivores' }
            )
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('clear')
        .setDescription('Remove user from faction')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('User to clear')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('stats')
        .setDescription('View faction statistics')
    )
    .addSubcommand(sub =>
      sub.setName('sync')
        .setDescription('Reconcile DB ↔ roles ↔ colors for a user')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('User to sync')
            .setRequired(true)
        )
    ),

  async execute(interaction, services) {
    try {
      // --- Permission guard presente ---
      if (!services || !services.permissionGuard) {
        await interaction.reply({
          content: 'Permission system unavailable.',
          flags: 1 << 6,
        });
        return;
      }

      const pg = services.permissionGuard;
      let isAdmin = false;

      // Preferimos el helper específico
      if (typeof pg.isAdminInteraction === 'function') {
        isAdmin = pg.isAdminInteraction(interaction);
      } else if (typeof pg.isAdminUserId === 'function') {
        isAdmin = pg.isAdminUserId(interaction.user.id);
      } else if (typeof pg.hasPermission === 'function') {
        // Fallback: usar sistema general de permisos
        isAdmin = pg.hasPermission(interaction, 'faction-admin');
      }

      if (!isAdmin) {
        await interaction.reply({
          content: '🚫 Admin only.',
          flags: 1 << 6,
        });
        return;
      }

      // Rate limit check
      if (
        services.rateLimiter &&
        services.rateLimiter.isRateLimited(interaction.user.id, 'faction-admin')
      ) {
        const remaining =
          typeof services.rateLimiter.getRemainingTime === 'function'
            ? services.rateLimiter.getRemainingTime(interaction.user.id, 'faction-admin')
            : null;

        await interaction.reply({
          content: remaining
            ? `⏱️ Slow down. Try again in ${remaining}s.`
            : '⏱️ Slow down. Try again shortly.',
          flags: 1 << 6,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'set') {
        await handleSet(interaction, services);
      } else if (subcommand === 'clear') {
        await handleClear(interaction, services);
      } else if (subcommand === 'stats') {
        await handleStats(interaction, services);
      } else if (subcommand === 'sync') {
        await handleSync(interaction, services);
      }

    } catch (error) {
      logger.error('Failed to execute faction-admin', { error: error.message });

      try {
        const payload = {
          content: '❌ An error occurred. Please try again.',
          flags: 1 << 6,
        };

        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(payload);
        } else {
          await interaction.reply(payload);
        }
      } catch {
        // ignore
      }
    }
  }
};

/**
 * Handle /faction-admin set
 */
async function handleSet(interaction, services) {
  await interaction.deferReply({ flags: 1 << 6 });

  try {
    const targetUser = interaction.options.getUser('user');
    const factionKey = interaction.options.getString('faction');

    // Validate faction
    const faction = factionConfig.getFactionByKey(factionKey);
    if (!faction) {
      await interaction.editReply(`❌ Invalid faction: ${factionKey}`);
      return;
    }

    // Check role ID configuration
    if (faction.roleId === 'REPLACE_ME') {
      await interaction.editReply(
        `⚠️ Cannot assign ${faction.key}: Role ID not configured.\n` +
        `Set env var: ${faction.key.toUpperCase()}_ROLE_ID`
      );
      return;
    }

    // Get guild member
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      await interaction.editReply(`❌ User ${targetUser.tag} not found in server.`);
      return;
    }

    // Sync faction role
    const syncResult = await services.roleSync.syncMemberFaction({
      guild: interaction.guild,
      member,
      factionKey: faction.key
    });

    if (!syncResult.success) {
      await interaction.editReply(`❌ Failed to sync role: ${syncResult.error}`);
      return;
    }

    // Update database
    await services.userService.setUserFaction(targetUser.id, faction.key);

    // Audit log
    await AuditLogger.logAction(
      interaction.user.id,
      'faction_set',
      { faction: faction.key, colorUpdated: syncResult.colorUpdated },
      targetUser.id
    );

    // Response
    let reply = `✅ ${targetUser.tag} assigned to ${faction.emoji} **${faction.key}**.\n`;
    reply += `Discord role updated.`;
    if (syncResult.colorUpdated) {
      reply += `\nRole color synced to ${faction.colorHex}.`;
    }

    await interaction.editReply(reply);

    logger.info('Admin set faction', {
      adminId: interaction.user.id,
      targetUserId: targetUser.id,
      faction: faction.key
    });

  } catch (error) {
    logger.error('Failed to set faction', { error: error.message });
    await interaction.editReply('❌ Failed to set faction. Please try again.');
  }
}

/**
 * Handle /faction-admin clear
 */
async function handleClear(interaction, services) {
  await interaction.deferReply({ flags: 1 << 6 });

  try {
    const targetUser = interaction.options.getUser('user');

    // Get guild member
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      await interaction.editReply(`❌ User ${targetUser.tag} not found in server.`);
      return;
    }

    // Remove all faction roles
    await services.roleSync.removeAllFactionRoles(member);

    // Clear database faction
    await services.userService.setUserFaction(targetUser.id, null);

    // Audit log
    await AuditLogger.logAction(
      interaction.user.id,
      'faction_clear',
      {},
      targetUser.id
    );

    await interaction.editReply(
      `✅ Faction cleared for ${targetUser.tag}.\nDiscord roles removed.`
    );

    logger.info('Admin cleared faction', {
      adminId: interaction.user.id,
      targetUserId: targetUser.id
    });

  } catch (error) {
    logger.error('Failed to clear faction', { error: error.message });
    await interaction.editReply('❌ Failed to clear faction. Please try again.');
  }
}

/**
 * Handle /faction-admin stats
 */
async function handleStats(interaction, services) {
  await interaction.deferReply({ flags: 1 << 6 });

  try {
    // Get active faction counts
    const counts = await services.factionBalancer.getActiveFactionCounts();
    
    const luminarchCount = counts.Luminarchs || 0;
    const noctivoreCount = counts.Noctivores || 0;
    const diff = Math.abs(luminarchCount - noctivoreCount);
    const threshold = factionConfig.threshold;

    let reply = `**📊 Faction Statistics**\n\n`;
    reply += `🦸 **Luminarchs:** ${luminarchCount} active members\n`;
    reply += `🥷 **Noctivores:** ${noctivoreCount} active members\n`;
    reply += `\n`;
    reply += `**Difference:** ${diff}\n`;
    reply += `**Balance Threshold:** ${threshold}\n`;
    reply += `\n`;

    if (diff >= threshold) {
      const smaller = luminarchCount < noctivoreCount ? 'Luminarchs' : 'Noctivores';
      reply += `⚖️ **Status:** Imbalanced (diff ≥ ${threshold})\n`;
      reply += `Next member → **${smaller}** (balance mode)`;
    } else {
      reply += `✓ **Status:** Balanced (diff < ${threshold})\n`;
      reply += `Next member → **Alternate** (timestamp parity)`;
    }

    // Check role ID configuration
    const roleIdStatus = factionConfig.hasValidRoleIds();
    reply += `\n\n**Role IDs:** ${roleIdStatus ? '✅ Configured' : '⚠️ Missing (REPLACE_ME)'}`;

    await interaction.editReply(reply);

  } catch (error) {
    logger.error('Failed to get faction stats', { error: error.message });
    await interaction.editReply('❌ Failed to retrieve stats. Please try again.');
  }
}

/**
 * Handle /faction-admin sync
 */
async function handleSync(interaction, services) {
  await interaction.deferReply({ flags: 1 << 6 });

  try {
    const targetUser = interaction.options.getUser('user');

    // Get user's current faction from DB
    const userProfile = await services.userService.getUserProfile(targetUser.id);
    if (!userProfile || !userProfile.user) {
      await interaction.editReply(`❌ User ${targetUser.tag} not found in database.`);
      return;
    }

    const dbFaction = userProfile.user.faction;

    // Get guild member
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      await interaction.editReply(`❌ User ${targetUser.tag} not found in server.`);
      return;
    }

    if (!dbFaction) {
      // No faction in DB - remove all faction roles
      await services.roleSync.removeAllFactionRoles(member);
      await interaction.editReply(
        `✅ Synced ${targetUser.tag}.\nDB faction: None → Removed all faction roles.`
      );
      return;
    }

    // Sync faction role
    const syncResult = await services.roleSync.syncMemberFaction({
      guild: interaction.guild,
      member,
      factionKey: dbFaction
    });

    if (!syncResult.success) {
      await interaction.editReply(`❌ Failed to sync: ${syncResult.error}`);
      return;
    }

    // Audit log
    await AuditLogger.logAction(
      interaction.user.id,
      'faction_sync',
      { faction: dbFaction, colorUpdated: syncResult.colorUpdated },
      targetUser.id
    );

    const faction = factionConfig.getFactionByKey(dbFaction);
    let reply = `✅ Synced ${targetUser.tag}.\n`;
    reply += `DB faction: ${faction.emoji} **${dbFaction}**\n`;
    reply += `Discord role: Updated`;
    if (syncResult.colorUpdated) {
      reply += `\nRole color: Synced to ${faction.colorHex}`;
    }

    await interaction.editReply(reply);

    logger.info('Admin synced faction', {
      adminId: interaction.user.id,
      targetUserId: targetUser.id,
      faction: dbFaction
    });

  } catch (error) {
    logger.error('Failed to sync faction', { error: error.message });
    await interaction.editReply('❌ Failed to sync faction. Please try again.');
  }
}
