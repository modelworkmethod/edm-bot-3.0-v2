/**
 * Cancel Double XP Command
 * Admin command to cancel the latest scheduled/active Double XP weekend
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const config = require('../../config/settings');

const logger = createLogger('CancelDoubleXPCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cancel-double-xp')
    .setDescription('Cancel the latest scheduled/active Double XP Weekend (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, services) {
    const isAdmin =
      interaction.user.id === config.admin.userId ||
      interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isAdmin) {
      await interaction.reply({ content: 'Admin only.', flags: 1 << 6 });
      return;
    }

    try {
      await interaction.deferReply({ flags: 1 << 6 });

      const DoubleXPManager = require('../../services/events/DoubleXPManager');
      const manager = new DoubleXPManager(services.channelService);

      // General channel (same logic you used elsewhere)
      const generalChannelId =
        (config.channels && (config.channels.general || config.channels.generalId)) ||
        config.channels?.generalChannelId ||
        config.generalChannelId ||
        interaction.channelId;

      const cancelled = await manager.cancelLatestEvent(generalChannelId, interaction.user.id);

      if (!cancelled) {
        await interaction.editReply('ℹ️ No scheduled/active Double XP event found to cancel.');
        return;
      }

      const startTs = Math.floor(new Date(cancelled.start_time).getTime() / 1000);
      const endTs = Math.floor(new Date(cancelled.end_time).getTime() / 1000);

      await interaction.editReply([
        `🛑 Cancelled Double XP event (#${cancelled.id}).`,
        `Was: <t:${startTs}:F> → <t:${endTs}:F>`,
        `A cancellation notice was posted in General.`
      ].join('\n'));

      logger.info('Cancelled double XP event', { eventId: cancelled.id, adminId: interaction.user.id });

    } catch (error) {
      logger.error('Failed to cancel Double XP event', { error: error?.message || String(error) });
      try {
        await interaction.editReply('Failed to cancel event. Check logs.');
      } catch {}
    }
  }
};
