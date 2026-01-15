/**
 * Nickname Settings Command
 * Allow users to opt in/out of automatic nickname sync
 */

const { SlashCommandBuilder } = require('discord.js');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('NicknameSettingsCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nickname-settings')
    .setDescription('Manage your nickname display settings')
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Enable or disable automatic nickname updates')
        .setRequired(true)
        .addChoices(
          { name: 'Enable (show rank, level, archetype)', value: 'enable' },
          { name: 'Disable (keep original username)', value: 'disable' },
          { name: 'Check current setting', value: 'status' }
        )
    ),

  async execute(interaction, services) {
    try {
      const action = interaction.options.getString('action');
      const userId = interaction.user.id;

      if (!services.nicknameService) {
        await interaction.reply({
          content: '❌ Nickname service is not available.',
          ephemeral: true
        });
        return;
      }

      if (action === 'status') {
        const isOptedOut = services.nicknameService.isOptedOut(userId);
        const status = isOptedOut ? 'DISABLED' : 'ENABLED';
        const emoji = isOptedOut ? '❌' : '✅';

        await interaction.reply({
          content: [
            `${emoji} **Nickname Auto-Update: ${status}**`,
            '',
            isOptedOut
              ? '📝 Your nickname stays as your original username.'
              : '🏷️ Your nickname shows: `#Rank | Level | Archetype | Name`',
            '',
            'Change this setting with `/nickname-settings`'
          ].join('\n'),
          ephemeral: true
        });

      } else if (action === 'enable') {
        services.nicknameService.optIn(userId);

        await interaction.reply({
          content: [
            '✅ **Nickname auto-update ENABLED!**',
            '',
            '🏷️ Your nickname will show:',
            '• Leaderboard rank (#12)',
            '• Current level (L25)',
            '• Archetype icon (⚔️ Warrior, 🔮 Mage, ⚖️ Templar)',
            '',
            '📊 Example: `#12 | L25 | ⚔️ | YourName`',
            '',
            '⚡ **Updates automatically when:**',
            '• You level up',
            '• Your archetype changes',
            '• Your rank changes (daily at midnight)',
            '',
            '🎯 Top 3 get medals: 🥇🥈🥉',
            '💎 Top 10 get diamonds',
            '⭐ Top 20 get stars',
            '',
            'Use `/nickname-settings disable` to turn off anytime.'
          ].join('\n'),
          ephemeral: true
        });

        // Trigger immediate update
        services.nicknameService.updateNickname(userId).catch(err => {
          logger.warn('Failed immediate nickname update', { userId, error: err.message });
        });

        logger.info('User enabled nickname sync', { userId });

      } else if (action === 'disable') {
        services.nicknameService.optOut(userId);

        // Reset nickname to original username
        await services.nicknameService.resetNickname(userId);

        await interaction.reply({
          content: [
            '❌ **Nickname auto-update DISABLED**',
            '',
            '✅ Your nickname has been reset to your original username.',
            '',
            '💡 **What this means:**',
            '• Your rank/level/archetype won\'t show in your nickname',
            '• You keep your privacy',
            '• You can still see others\' stats in their nicknames',
            '',
            'Use `/nickname-settings enable` to turn it back on anytime.'
          ].join('\n'),
          ephemeral: true
        });

        logger.info('User disabled nickname sync', { userId });
      }

    } catch (error) {
      logger.error('Failed to update nickname settings', {
        userId: interaction.user.id,
        error: error.message
      });

      await interaction.reply({
        content: '❌ Failed to update nickname settings. Please try again.',
        ephemeral: true
      });
    }
  }
};
