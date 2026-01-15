/**
 * Command Handler
 * Handles slash command interactions
 */

const { createLogger } = require('../../utils/logger');
const { handleError, handleDiscordError, ErrorTypes } = require('../../utils/errorHandler');
const AuditLogger = require('../../services/security/AuditLogger');

const logger = createLogger('CommandHandler');

// Admin commands that require audit logging
const ADMIN_COMMANDS = new Set([
  'admin',
  'security',
  'course-admin',
  'coaching-dashboard',
  'coaching-insights',
]);

/**
 * Handle command interaction
 * @param {Interaction} interaction - Discord interaction
 * @param {object} services - Service instances
 */
async function handleCommand(interaction, services) {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    logger.warn('Unknown command', { commandName: interaction.commandName });
    return;
  }

  try {
    // Phase 11: Rate limit check
    if (services.rateLimiter?.isRateLimited(interaction.user.id, interaction.commandName)) {
      const remaining = services.rateLimiter.getRemainingTime(
        interaction.user.id,
        interaction.commandName
      );
      await interaction.reply({
        content: `⏳ Rate limited. Try again in ${remaining}s.`,
        flags: 1 << 6, // ephemeral
      });
      return;
    }

    // Phase 11: Permission check
    if (!services.permissionGuard?.hasPermission(interaction, interaction.commandName)) {
      await interaction.reply({
        content: '❌ You do not have permission to use this command.',
        flags: 1 << 6, // ephemeral
      });
      return;
    }

    logger.debug('Executing command', {
      commandName: interaction.commandName,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    // ──────────────────────────────────────────────
    // Subcommand "seguro" para logging/audit
    // ──────────────────────────────────────────────
    let subcommandForAudit = null;
    if (interaction.options?.getSubcommand) {
      try {
        // En discord.js v14, getSubcommand(required = true)
        // Pasar false evita lanzar si no hay subcommand
        subcommandForAudit = interaction.options.getSubcommand(false);
      } catch (e) {
        // Comandos sin subcomandos caerán aquí, y está OK
        subcommandForAudit = null;
      }
    }

    await command.execute(interaction, services);

    logger.debug('Command executed successfully', {
      commandName: interaction.commandName,
    });

    // Phase 11: Audit log admin commands
    if (
      ADMIN_COMMANDS.has(interaction.commandName) ||
      interaction.commandName.startsWith('admin-')
    ) {
      await AuditLogger.logAction(
        interaction.user.id,
        interaction.commandName,
        {
          subcommand: subcommandForAudit,
          options: interaction.options?.data ?? [],
        },
        interaction.options?.getUser?.('user')?.id ?? null
      );
    }
  } catch (error) {
    // Use Discord-specific error handling if it's a Discord API error
    if (error.code && typeof error.code === 'number') {
      handleDiscordError(error, `CommandHandler.${interaction.commandName}`);
    } else {
      handleError(error, `CommandHandler.${interaction.commandName}`);
    }
    
    const msg = error?.message || '';
    const code = error?.code;

    // Discord API errors that we should ignore (already handled)
    const isAlreadyAckError =
      code === 40060 ||
      code === 10062 || // Unknown interaction
      msg.includes('Unknown interaction') ||
      msg.includes('Interaction has already been acknowledged');

    if (isAlreadyAckError) {
      logger.warn('Skipping error reply: interaction already acknowledged or unknown', {
        commandName: interaction.commandName,
        code,
        message: msg,
      });
      return;
    }

    // User-friendly error message
    let errorMessage = 'There was an error executing this command. Please try again.';
    
    // Provide more specific messages for common errors
    if (code === 50013) {
      errorMessage = '❌ I don\'t have permission to perform this action.';
    } else if (code === 50001) {
      errorMessage = '❌ I don\'t have access to perform this action.';
    } else if (code === 10008) {
      errorMessage = '❌ The requested resource was not found.';
    }

    try {
      const payload = {
        content: errorMessage,
        flags: 1 << 6, // ephemeral
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload);
      } else if (interaction.isRepliable?.()) {
        await interaction.reply(payload);
      }
    } catch (replyError) {
      // Use handleError for reply errors too
      handleError(replyError, `CommandHandler.${interaction.commandName}.reply`);
    }
  }
}

module.exports = { handleCommand };
