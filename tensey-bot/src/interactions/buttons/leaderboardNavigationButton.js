// ═══════════════════════════════════════════════════════════════════════════════
// TEMP STUB — DO NOT SHIP
// Leaderboard navigation button handler
// ═══════════════════════════════════════════════════════════════════════════════

const LeaderboardService = require('../../services/LeaderboardService');
const LeaderboardEmbedBuilder = require('../../embeds/LeaderboardEmbedBuilder');

module.exports = {
  async execute(interaction, params) {
    const [direction] = params;
    
    // TODO: Implement pagination for leaderboard
    const topUsers = await LeaderboardService.getTopUsers(25);
    const factionStats = await LeaderboardService.getFactionStats();
    const mostCompleted = LeaderboardService.getMostCompletedChallenges(10);
    
    const embed = LeaderboardEmbedBuilder.buildLeaderboardEmbed({
      topUsers,
      factionStats,
      mostCompleted
    });
    
    await interaction.update({ embeds: [embed] });
  }
};

