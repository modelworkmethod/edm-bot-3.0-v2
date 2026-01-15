/**
 * Stats Delete Command
 * Delete past stats with audit logging
 */

const { SlashCommandBuilder } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const { adminOnly, serviceUnavailable, ok, fail } = require('../../utils/plainTextReplies');

const logger = createLogger('StatsDeleteCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats-delete')
    .setDescription('Delete past stats (within 7 days unless admin)')
    .addStringOption(opt =>
      opt.setName('date')
        .setDescription('Date to delete (YYYY-MM-DD)')
        .setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to delete for (admin-only)')
        .setRequired(false)
    ),

  async execute(interaction, services) {
    try {
      // Rate limit
      if (services.rateLimiter?.isRateLimited(interaction.user.id, 'stats-delete')) {
        await interaction.reply({ 
          content: '⏱️ Slow down a bit and try again shortly.', 
          ephemeral: true 
        });
        return;
      }

      await interaction.deferReply({ ephemeral: !interaction.guild });

      const dateInput = interaction.options.getString('date');
      const targetUser = interaction.options.getUser('user');

      // Check admin permission if deleting for another user
      if (targetUser && targetUser.id !== interaction.user.id) {
        if (!services.permissionGuard?.isAdmin(interaction.user.id)) {
          await interaction.editReply(adminOnly());
          return;
        }
      }

      const userId = targetUser?.id || interaction.user.id;

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateInput)) {
        await interaction.editReply(fail('Invalid date format. Use YYYY-MM-DD'));
        return;
      }

      const date = new Date(dateInput);
      if (isNaN(date.getTime())) {
        await interaction.editReply(fail('Invalid date'));
        return;
      }

      // Get stats edit service
      if (!services.statsEditService) {
        await interaction.editReply(serviceUnavailable('StatsEdit'));
        return;
      }

      // Execute delete
      const result = await services.statsEditService.deleteDay(
        userId,
        dateInput,
        interaction.user.id
      );

      if (!result.success) {
        await interaction.editReply(fail(result.error));
        return;
      }

      // Format response
      const userDisplay = targetUser ? ` for ${targetUser.tag}` : '';
      let reply = ok(`Stats deleted${userDisplay}`) + `\n\n`;
      reply += `**Date:** ${dateInput}\n\n`;
      reply += `**Deleted Stats:**\n`;

      for (const [stat, count] of Object.entries(result.deletedStats)) {
        reply += `• ${stat}: ${count}\n`;
      }

      reply += `\n${result.message}`;

      await interaction.editReply(reply);

      logger.info('Stats deleted via command', {
        editorId: interaction.user.id,
        targetUserId: userId,
        date: dateInput,
        statCount: Object.keys(result.deletedStats).length
      });

    } catch (error) {
      logger.error('Failed to delete stats', { error: error.message });
      await interaction.editReply(fail('Failed to delete stats. Please try again.'));
    }
  }
};


