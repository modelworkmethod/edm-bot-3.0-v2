/**
 * Sync Nicknames Command
 * Admin command to force update all user nicknames
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const config = require('../../config/settings');

const logger = createLogger('SyncNicknamesCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sync-nicknames')
    .setDescription('Force update all user nicknames (ADMIN ONLY)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option =>
      option
        .setName('limit')
        .setDescription('Max users to update (default: 50)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  async execute(interaction, services) {
    const guild = interaction.guild;

    // ─────────────────────────────────────────────
    // 1) Checar permisos de admin (sin usar permissionGuard.isAdmin)
    // ─────────────────────────────────────────────
    const isAdmin =
      interaction.user.id === config.admin.userId ||
      interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

    if (!isAdmin) {
      try {
        await interaction.reply({
          content: '❌ This command is only available to administrators.',
          flags: 1 << 6 // ephemeral
        });
      } catch (err) {
        logger.warn('SyncNicknamesCommand: failed to send no-permission reply', {
          error: err.message
        });
      }
      return;
    }

    if (!guild) {
      try {
        await interaction.reply({
          content: '❌ This command can only be used inside a server.',
          flags: 1 << 6
        });
      } catch (err) {
        logger.warn('SyncNicknamesCommand: failed to send no-guild reply', {
          error: err.message
        });
      }
      return;
    }

    // ─────────────────────────────────────────────
    // 2) Verificar si nicknameService está disponible y habilitado
    // ─────────────────────────────────────────────
    if (!services?.nicknameService || !services.nicknameService.enabled) {
      try {
        await interaction.reply({
          content:
            '❌ Nickname sync is currently disabled.\n\nEnable it in your `.env` file:\n```bash\nENABLE_NICKNAME_SYNC=true\n```',
          flags: 1 << 6
        });
      } catch (err) {
        logger.warn('SyncNicknamesCommand: failed to send disabled reply', {
          error: err.message
        });
      }
      return;
    }

    let deferred = false;

    // ─────────────────────────────────────────────
    // 3) Defer reply con manejo de Unknown interaction
    // ─────────────────────────────────────────────
    try {
      await interaction.deferReply({ flags: 1 << 6 }); // efímero sin warning
      deferred = true;
    } catch (err) {
      const msg = err?.message || '';
      const code = err?.code;

      logger.error('SyncNicknamesCommand: Failed to defer reply', {
        error: msg
      });

      if (
        code === 10062 || // Unknown interaction
        code === 40060 || // Interaction already acknowledged
        msg.includes('Unknown interaction') ||
        msg.includes('already been acknowledged')
      ) {
        logger.warn(
          'SyncNicknamesCommand: interaction no longer valid right after trigger, aborting.',
          { code, message: msg }
        );
        return;
      }
      // If is other error, we can't proceed
      return;
    }

    // ─────────────────────────────────────────────
    // 4) logic to sync nicknames
    // ─────────────────────────────────────────────
    try {
      const limit = interaction.options.getInteger('limit') || 50;

      const result = await services.nicknameService.syncAllNicknames(
        guild,
        limit
      );

      if (result?.success) {
        const content = [
          '✅ **Nickname sync complete!**',
          '',
          '📊 **Results:**',
          `• Updated: ${result.updated} users`,
          `• Skipped: ${result.skipped} users`,
          `• Failed: ${result.failed} users`,
          `• Total: ${result.total} members`,
          '',
          '⏰ Nicknames update automatically:',
          '• On level-up',
          '• On archetype change',
          '• Daily at midnight (for rank updates)'
        ].join('\n');

        if (deferred) {
          await interaction.editReply({ content });
        } else {
          await interaction.reply({
            content,
            flags: 1 << 6
          });
        }

        logger.info('Nickname sync executed via admin command', {
          adminId: interaction.user.id,
          result
        });
      } else {
        const errorText = result?.error || 'Unknown error';

        if (deferred) {
          await interaction.editReply({
            content: `❌ Nickname sync failed: ${errorText}`
          });
        } else {
          await interaction.reply({
            content: `❌ Nickname sync failed: ${errorText}`,
            flags: 1 << 6
          });
        }

        logger.error('Nickname sync failed (result.success = false)', {
          adminId: interaction.user.id,
          error: errorText
        });
      }
    } catch (error) {
      logger.error('Failed to execute sync nicknames command', {
        userId: interaction.user.id,
        error: error.message
      });

      const errorMessage =
        '❌ An error occurred while syncing nicknames. Check logs for details.';

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: errorMessage });
        } else {
          await interaction.reply({
            content: errorMessage,
            flags: 1 << 6
          });
        }
      } catch (replyError) {
        logger.error('SyncNicknamesCommand: failed to send error reply', {
          error: replyError.message
        });
      }
    }
  }
};
