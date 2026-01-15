// Open leaderboard button handler

const LeaderboardService = require('../../services/LeaderboardService');
const LeaderboardEmbedBuilder = require('../../embeds/LeaderboardEmbedBuilder');
const { createLogger } = require('../../utils/logger'); // si existe en tu bot
const logger = createLogger ? createLogger('OpenLeaderboardButton') : console;

module.exports = {
  async execute(interaction) {
    try {
      // ✅ ACK seguro (evita "already been acknowledged")
      if (!interaction.deferred && !interaction.replied) {
        // En botones prefiero flags para evitar warnings en tu codebase
        await interaction.deferReply({ flags: 1 << 6 }).catch(() => {});
      }

      const topUsers = await LeaderboardService.getTopUsers(25);
      const factionStats = await LeaderboardService.getFactionStats();

      // ✅ FIX: si es async, hay que await
      const mostCompleted = await LeaderboardService.getMostCompletedChallenges(10);

      const embed = LeaderboardEmbedBuilder.buildLeaderboardEmbed({
        topUsers,
        factionStats,
        mostCompleted
      });

      // ✅ responder
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed] }).catch(() => {});
      } else {
        await interaction.reply({ embeds: [embed], flags: 1 << 6 }).catch(() => {});
      }
    } catch (err) {
      logger?.error?.('Open leaderboard button failed', { error: err?.message });

      // fallback para que NO quede “interaction failed”
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: '❌ Error opening leaderboard. Check logs.' }).catch(() => {});
        } else {
          await interaction.reply({ content: '❌ Error opening leaderboard. Check logs.', flags: 1 << 6 }).catch(() => {});
        }
      } catch {}
    }
  }
};
