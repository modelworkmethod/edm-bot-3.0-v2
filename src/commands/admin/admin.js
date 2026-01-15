/**
 * Admin Command
 * Main admin control panel
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const config = require('../../config/settings');

const logger = createLogger('AdminCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Admin commands (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  /**
   * Execute command
   */
  async execute(interaction, services) {
    // Check if user is admin
    const isAdmin = interaction.user.id === config.admin.userId ||
                    interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isAdmin) {
      await interaction.reply({
        content: '❌ This command requires administrator permissions.',
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content: [
        '⚙️ **Admin Commands Available:**',
        '',
        '**User Management:**',
        '• `/adjust-xp <user> <amount>` - Adjust user XP',
        '• `/reset-stats <user>` - Reset user stats',
        '• `/set-faction <user> <faction>` - Set user faction',
        '',
        '**System:**',
        '• Check logs for errors',
        '• Monitor database performance'
      ].join('\n'),
      ephemeral: true
    });
  }
};

