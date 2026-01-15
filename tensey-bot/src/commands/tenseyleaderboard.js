// ═══════════════════════════════════════════════════════════════════════════════
// /tenseyleaderboard command - Display top users by completions
// ═══════════════════════════════════════════════════════════════════════════════

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/sqlite');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tenseyleaderboard')
    .setDescription('View top users by Tensey challenge completions'),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      // Query top 10 users by completion count
      const stmt = db.get().prepare(`
        SELECT 
          user_id,
          COUNT(*) as completions
        FROM user_progress
        WHERE completed_count > 0
        GROUP BY user_id
        ORDER BY completions DESC
        LIMIT 10
      `);
      
      const topUsers = stmt.all();

      // Build leaderboard embed
      const embed = new EmbedBuilder()
        .setTitle('🏆 Tensey Challenge Leaderboard')
        .setDescription('Top users by challenges completed')
        .setColor(0xFFD700)
        .setTimestamp();

      if (topUsers.length === 0) {
        embed.setDescription('No completions yet! Be the first to complete a Tensey challenge.\n\nUse `/tenseylist` to get started! 🚀');
      } else {
        const leaderboardText = topUsers.map((user, index) => {
          const rank = index + 1;
          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
          const percentage = Math.round((user.completions / 567) * 100);
          const xpEarned = user.completions * 100;
          return `${medal} <@${user.user_id}>\n   **${user.completions}/567** (${percentage}%) • ${xpEarned.toLocaleString()} XP`;
        }).join('\n\n');

        embed.setDescription(leaderboardText);
        embed.addFields({
          name: '📊 Total Challenges Available',
          value: '**567 Social Freedom Exercises** across 7 levels\n💰 56,700 total XP available',
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('tenseyleaderboard command error:', error);
      await interaction.editReply({
        content: '❌ Failed to load leaderboard. Please try again.'
      });
    }
  }
};
