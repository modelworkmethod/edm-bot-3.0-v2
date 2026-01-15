/**
 * Stats Days Command
 * List recent days with stats
 */

const { SlashCommandBuilder } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const { adminOnly, serviceUnavailable } = require('../../utils/plainTextReplies');

const logger = createLogger('StatsDaysCommand');

async function safeReply(interaction, options) {
  try {
    if (interaction.replied || interaction.deferred) {
      return interaction.editReply(options);
    }
    return interaction.reply(options);
  } catch (err) {
    logger.warn('StatsDaysCommand: safeReply failed', {
      error: err.message,
      code: err.code
    });
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats-days')
    .setDescription('List recent days with stat submissions')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to view (admin-only)')
        .setRequired(false)
    )
    .addIntegerOption(opt =>
      opt.setName('limit')
        .setDescription('Number of days to show')
        .setMinValue(1)
        .setMaxValue(30)
        .setRequired(false)
    ),

  async execute(interaction, services) {
    try {
      // Rate limit
      if (services.rateLimiter?.isRateLimited(interaction.user.id, 'stats-days')) {
        await safeReply(interaction, {
          content: '⏱️ Slow down a bit and try again shortly.',
          ephemeral: true
        });
        return;
      }

      const targetUser = interaction.options.getUser('user');
      const limit = interaction.options.getInteger('limit') || 7;

      // Si quiere ver a otro usuario, requiere admin
      if (targetUser && targetUser.id !== interaction.user.id) {
        if (!services.permissionGuard?.isAdmin(interaction.user.id)) {
          await safeReply(interaction, {
            content: adminOnly(),
            ephemeral: true
          });
          return;
        }
      }

      const userId = targetUser?.id || interaction.user.id;

      // Vamos directo a la BD usando los repos
      const repo =
        services.repositories?.stats ||
        services.repositories?.user ||
        services.repositories?.daily;

      if (!repo || typeof repo.raw !== 'function') {
        await safeReply(interaction, {
          content: serviceUnavailable('Stats'),
          ephemeral: true
        });
        return;
      }

      // Leemos de user_daily + user_stats
      const sql = `
        SELECT
          d.day::date AS date,
          COUNT(*) AS stat_count,
          COALESCE(SUM(s.total), 0) AS total_actions
        FROM user_daily d
        LEFT JOIN user_stats s
          ON s.user_id = d.user_id
        WHERE d.user_id = $1
        GROUP BY d.day
        ORDER BY d.day DESC
        LIMIT $2
      `;

      const result = await repo.raw(sql, [userId, limit]);
      const days = result?.rows || [];

      if (!days.length) {
        await safeReply(interaction, {
          content: `No stat submissions found${targetUser ? ` for ${targetUser.tag}` : ''}.`,
          ephemeral: true
        });
        return;
      }

      const userDisplay = targetUser ? ` for ${targetUser.tag}` : '';
      let reply = `**📊 Recent Days With Stats${userDisplay}**\n\n`;

      days.forEach((day, i) => {
        const dateStr = new Date(day.date).toLocaleDateString();
        const statCount = Number(day.stat_count || 0);
        const totalActions = Number(day.total_actions || 0);

        reply += `${i + 1}. **${dateStr}** - ${statCount} stat${
          statCount === 1 ? '' : 's'
        }, ${totalActions} total actions\n`;
      });

      reply += `\nShowing last ${days.length} day${
        days.length === 1 ? '' : 's'
      }.`;
      reply += `\nUse \`/stats-edit date:YYYY-MM-DD\` to edit.`;

      await safeReply(interaction, {
        content: reply,
        ephemeral: !interaction.guild
      });

      logger.info('Stats days listed', {
        userId: interaction.user.id,
        targetUserId: userId,
        dayCount: days.length
      });
    } catch (error) {
      logger.error('Failed to list stats days', { error: error.message });

      await safeReply(interaction, {
        content: '❌ Failed to list days. Please try again.',
        ephemeral: true
      });
    }
  }
};
