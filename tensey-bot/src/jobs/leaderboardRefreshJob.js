// ═══════════════════════════════════════════════════════════════════════════════
// Leaderboard refresh job - updates the persistent leaderboard message
// ═══════════════════════════════════════════════════════════════════════════════

const config = require('../config/environment');
const LeaderboardService = require('../services/LeaderboardService');
const LeaderboardEmbedBuilder = require('../embeds/LeaderboardEmbedBuilder');
const ArtifactsRepository = require('../database/repositories/ArtifactsRepository');
const ChannelFinder = require('../utils/channelFinder');
const logger = require('../utils/logger');

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class LeaderboardRefreshJob {
  static async run(client) {
    try {
      const guild = await client.guilds.fetch(config.GUILD_ID);

      // Repo puede ser sync; lo tratamos como sync por seguridad
      const artifacts = ArtifactsRepository.getArtifacts(guild.id);

      // ✅ Soportar keys nuevas + legacy
      const channelId =
        artifacts?.open_lb_channel_id ||
        artifacts?.lb_channel_id ||
        artifacts?.openLeaderboardChannelId ||
        null;

      const messageId =
        artifacts?.open_lb_message_id ||
        artifacts?.lb_message_id ||
        artifacts?.openLeaderboardMessageId ||
        null;

      if (!channelId || !messageId) {
        logger.warn('LeaderboardRefreshJob: no persistent leaderboard artifact ids found', {
          guildId: guild.id,
          channelId,
          messageId,
        });
        return;
      }

      const channel = await ChannelFinder.findChannel(client, channelId);
      if (!channel) {
        logger.warn('LeaderboardRefreshJob: leaderboard channel not found', { channelId });
        return;
      }

      let message = null;
      try {
        message = await channel.messages.fetch(messageId);
      } catch (e) {
        logger.warn('LeaderboardRefreshJob: leaderboard message not found (maybe deleted)', {
          channelId,
          messageId,
          error: e?.message,
        });
        return;
      }

      if (!message) return;

      const topUsers = await LeaderboardService.getTopUsers(25);
      const factionStats = await LeaderboardService.getFactionStats();
      const mostCompleted = await LeaderboardService.getMostCompletedChallenges(10);

      const embed = LeaderboardEmbedBuilder.buildLeaderboardEmbed({
        topUsers,
        factionStats,
        mostCompleted,
      });

      // ✅ Mantener botones en el mensaje persistente
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('refresh-leaderboard')
          .setLabel('Refresh')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('view-my-scorecard')
          .setLabel('My Scorecard')
          .setStyle(ButtonStyle.Secondary)
      );

      await message.edit({ embeds: [embed], components: [row] });

      logger.debug('Leaderboard refreshed successfully');
    } catch (err) {
      logger.error('Failed to refresh leaderboard', { error: err?.message, stack: err?.stack });
    }
  }
}

module.exports = LeaderboardRefreshJob;
