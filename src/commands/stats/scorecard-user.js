/**
 * Scorecard User Command
 * Lets anyone view another user's scorecard
 * Uses existing scorecard builder logic (no refresh button/components)
 */

const { SlashCommandBuilder } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const { getLocalDayString } = require('../../utils/timeUtils');

const logger = createLogger('ScorecardUserCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scorecard-user')
    .setDescription("View another user's scorecard")
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to view')
        .setRequired(true)
    ),

  async execute(interaction, services) {
    const viewerId = interaction.user.id;
    const targetUser = interaction.options.getUser('user');
    const targetUserId = targetUser?.id;

    try {
      // Defer (avoid Unknown interaction)
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply(); // visible (no ephemeral)
      }

      if (!targetUserId) {
        await interaction.editReply({ content: 'Could not read the selected user.' });
        return;
      }

      // Reuse existing scorecard logic
      const scorecardCmd = require('./scorecard'); // <- assumes your scorecard command file is in same folder and named scorecard.js
      const today = getLocalDayString();

      if (!scorecardCmd || typeof scorecardCmd._buildSoloPayload !== 'function') {
        logger.error('scorecard.js missing _buildSoloPayload');
        await interaction.editReply({ content: 'Scorecard system is not available right now.' });
        return;
      }

      const { embed } = await scorecardCmd._buildSoloPayload(interaction, services, targetUserId, today);

      await interaction.editReply({
        embeds: [embed],
        components: [] // ensure NO buttons
      });

      logger.info('scorecard-user served', { viewerId, targetUserId });
    } catch (error) {
      logger.error('Failed scorecard-user', { viewerId, targetUserId, error: error?.message });

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: 'Failed to load that scorecard. Try again.' });
        } else {
          await interaction.reply({ content: 'Failed to load that scorecard. Try again.', flags: 1 << 6 });
        }
      } catch {}
    }
  },
};
