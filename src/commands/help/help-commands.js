/**
 * Help Commands Command
 * Self-updating command list based on live registry (client.commands)
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('HelpCommandsCommand');

function chunkLines(lines, maxLen) {
  const chunks = [];
  let current = [];

  for (const line of lines) {
    const lineLen = line.length + 1; 
    const currentLen = current.reduce((sum, l) => sum + l.length + 1, 0);

    if (currentLen + lineLen > maxLen) {
      if (current.length > 0) {
        chunks.push(current.join('\n'));
        current = [];
      }
    }
    current.push(line);
  }

  if (current.length > 0) {
    chunks.push(current.join('\n'));
  }

  return chunks;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help-commands')
    .setDescription('View all available bot commands'),

  async execute(interaction, services) {
    const inGuild = !!interaction.guild;
    const ephemeral = !inGuild;
    let deferred = false;

    // 1) Defer rápido para evitar "Unknown interaction" por timeout
    try {
      await interaction.deferReply({ ephemeral });
      deferred = true;
    } catch (err) {
      const msg = err?.message || '';
      const code = err?.code;

      const isInteractionStateError =
        code === 10062 || // Unknown interaction
        code === 40060 || // Interaction already acknowledged
        msg.includes('Unknown interaction') ||
        msg.includes('already been acknowledged');

      if (isInteractionStateError) {
        logger.warn('HelpCommands: interaction invalid while deferring', {
          code,
          message: msg,
        });
        return;
      }

      logger.error('HelpCommands: failed to defer reply', {
        error: msg,
      });
      return;
    }

    try {
      // 2) Determinar si es admin
      let isAdmin = false;

      const guard = services?.permissionGuard;
      if (guard && typeof guard.isAdmin === 'function') {
        try {
          isAdmin = !!guard.isAdmin(interaction.user.id);
        } catch {
          // ignoramos errores del guard
        }
      }

      if (!isAdmin && interaction.member?.permissions) {
        try {
          isAdmin = interaction.member.permissions.has(
            PermissionFlagsBits.Administrator
          );
        } catch {
          // ignoramos
        }
      }

      // 3) Usar el registro interno de comandos del bot
      const registry = interaction.client.commands;

      if (!registry || registry.size === 0) {
        logger.warn('HelpCommands: no commands found in client.commands');
        if (deferred && (interaction.deferred || interaction.replied)) {
          await interaction.editReply('No commands are currently registered.');
        }
        return;
      }

      const publicCommands = [];
      const adminCommands = [];

      for (const [name, cmd] of registry.entries()) {
        const description =
          cmd?.data?.description ||
          cmd?.description ||
          'No description';

        const isAdminCmd =
          name.includes('-admin') ||
          name === 'admin' ||
          name === 'adjust-xp' ||
          name === 'reset-stats' ||
          name === 'coaching-dashboard' ||
          name === 'coaching-insights' ||
          name === 'security' ||
          name === 'set-double-xp' ||
          name === 'start-raid' ||
          name === 'course-admin' ||
          name === 'wingman-admin' ||
          name === 'faction-admin' ||
          name === 'preflight' ||
          name === 'status';

        const cmdInfo = { name, description };

        if (isAdminCmd) {
          adminCommands.push(cmdInfo);
        } else {
          publicCommands.push(cmdInfo);
        }
      }

      // Ordenar alfabéticamente
      publicCommands.sort((a, b) => a.name.localeCompare(b.name));
      adminCommands.sort((a, b) => a.name.localeCompare(b.name));

      // 4) Construir líneas de texto
      const publicLines = publicCommands.map(
        (cmd) => `\`/${cmd.name}\` – ${cmd.description}`
      );
      const adminLines = adminCommands.map(
        (cmd) => `\`/${cmd.name}\` – ${cmd.description}`
      );

      // Trocear para que cada field tenga <= 1024 caracteres
      const publicChunks = chunkLines(publicLines, 1024);
      const adminChunks = chunkLines(adminLines, 1024);

      const embed = new EmbedBuilder()
        .setTitle('📚 Available Commands')
        .setDescription(
          `Total: **${publicCommands.length + adminCommands.length}** commands.\n` +
          `Use \`/help <command>\` for detailed info on a specific command.`
        );

      // Añadir campos de Public
      if (publicChunks.length > 0) {
        publicChunks.forEach((chunk, idx) => {
          embed.addFields({
            name:
              publicChunks.length === 1
                ? `Public Commands (${publicCommands.length})`
                : `Public Commands (${publicCommands.length}) [${idx + 1}/${publicChunks.length}]`,
            value: chunk,
            inline: false,
          });
        });
      }

      // Añadir campos de Admin solo si es admin
      if (isAdmin && adminChunks.length > 0) {
        adminChunks.forEach((chunk, idx) => {
          embed.addFields({
            name:
              adminChunks.length === 1
                ? `Admin-Only Commands (${adminCommands.length})`
                : `Admin-Only Commands (${adminCommands.length}) [${idx + 1}/${adminChunks.length}]`,
            value: chunk,
            inline: false,
          });
        });
      }

      if (deferred && (interaction.deferred || interaction.replied)) {
        await interaction.editReply({ embeds: [embed] });
      }

      logger.info('HelpCommands: help displayed', {
        userId: interaction.user.id,
        isAdmin,
        totalCommands: registry.size,
      });
    } catch (error) {
      logger.error('Failed to show help', { error: error.message });

      try {
        if (deferred && (interaction.deferred || interaction.replied)) {
          await interaction.editReply(
            'Failed to load help. Please try again.'
          );
        }
      } catch {
        // ignoramos si la interacción ya no es válida
      }
    }
  },
};
