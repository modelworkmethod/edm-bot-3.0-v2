/**
 * Adjust XP Command
 * Admin command to manually adjust user XP
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const config = require('../../config/settings');

const logger = createLogger('AdjustXPCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('adjust-xp')
    .setDescription('Adjust user XP (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to adjust XP for')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('XP amount (can be negative)')
        .setRequired(true)
    ),

  /**
   * Execute command
   */
  async execute(interaction, services) {
    let interactionValid = true;

    try {
      // 1) Intentar deferReply, pero no abortar si la interacción ya no es válida
      try {
        await interaction.deferReply({ ephemeral: true });
      } catch (err) {
        const code = err.code || err.message;
        if (code === 10062 || code === 'Unknown interaction') {
          interactionValid = false;
          logger.error('AdjustXPCommand: Failed to defer reply for adjust-xp', {
            error: err.message
          });
          // NO hacemos return: seguimos para ajustar XP en base de datos
        } else {
          throw err;
        }
      }

      // 2) Checar permisos de admin (config, permisos de Discord o permissionGuard)
      const byConfig =
        config?.admin?.userId && interaction.user.id === config.admin.userId;

      const byPerms =
        interaction.member &&
        interaction.member.permissions &&
        interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      const byGuard =
        services &&
        services.permissionGuard &&
        typeof services.permissionGuard.isAdmin === 'function' &&
        services.permissionGuard.isAdmin(interaction.user.id);

      const isAdmin = Boolean(byConfig || byPerms || byGuard);

      if (!isAdmin) {
        if (interactionValid) {
          try {
            const { adminOnly } = require('../../utils/plainTextReplies');
            await interaction.editReply(adminOnly());
          } catch {
            await interaction.editReply('❌ Admin only command.');
          }
        }
        return;
      }

      // 3) Leer opciones del comando
      const targetUser = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');

      if (!targetUser || amount === null) {
        if (interactionValid) {
          await interaction.editReply('❌ Missing user or amount.');
        }
        return;
      }

      if (!services || !services.userService || !services.userService.updateUserStats) {
        if (interactionValid) {
          await interaction.editReply('❌ XP service unavailable.');
        }
        return;
      }

      // 4) Actualizar XP usando el servicio principal
      const result = await services.userService.updateUserStats(
        targetUser.id,
        amount,
        { warrior: 0, mage: 0, templar: 0 },
        'admin_adjustment'
      );

      logger.info('Admin adjusted XP', {
        adminId: interaction.user.id,
        targetUserId: targetUser.id,
        amount
      });

      let response = `✅ Adjusted ${targetUser.username}'s XP by ${amount >= 0 ? '+' : ''}${amount}`;

      if (result && result.levelChange && result.levelChange.leveledUp) {
        response += `\n\n🎉 Level up! ${result.levelChange.oldLevel} → ${result.levelChange.newLevel}`;
      }

      if (interactionValid) {
        await interaction.editReply(response);
      } else {
        logger.info('AdjustXPCommand: XP adjusted but interaction was no longer valid, skipping reply');
      }

    } catch (error) {
      logger.error('Failed to adjust XP', { error: error.message });

      if (!interactionValid) {
        
        return;
      }

      try {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.reply({
            content: '❌ Failed to adjust XP. Check logs for details.',
            ephemeral: true
          });
        } else {
          await interaction.editReply('❌ Failed to adjust XP. Check logs for details.');
        }
      } catch (replyErr) {
        const code = replyErr.code || replyErr.message;
        if (code === 10062 || code === 'Unknown interaction') {
          logger.error(
            'AdjustXPCommand: interaction no longer valid when sending error',
            { error: replyErr.message }
          );
        } else {
          logger.error(
            'AdjustXPCommand: failed to send error message',
            { error: replyErr.message }
          );
        }
      }
    }
  }
};
