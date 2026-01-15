// ═══════════════════════════════════════════════════════════════════════════════
// TEMP STUB — DO NOT SHIP
// Leaderboard embed builder
// ═══════════════════════════════════════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const { BRAND } = require('../config/constants');

class LeaderboardEmbedBuilder {
  static buildLeaderboardEmbed(data) {
    const embed = new EmbedBuilder()
      .setColor(BRAND.accent)
      .setTitle('🏆 Tensey Challenge Leaderboard')
      .setTimestamp();
    
    // Top users
    if (data.topUsers && data.topUsers.length > 0) {
      const topUsersText = data.topUsers.slice(0, 10).map((user, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
        return `${medal} <@${user.user_id}> — ${user.tensey_count} completions`;
      }).join('\n');
      
      embed.addFields({ name: 'Top Users', value: topUsersText });
    }
    
    // Faction stats
    if (data.factionStats && data.factionStats.length > 0) {
      const factionText = data.factionStats.map(f => 
        `${f.faction}: ${f.total_completions} completions (${f.user_count} users)`
      ).join('\n');
      
      embed.addFields({ name: 'Faction Breakdown', value: factionText });
    }
    
    // Most completed challenges
    if (data.mostCompleted && data.mostCompleted.length > 0) {
      const mostCompletedText = data.mostCompleted.slice(0, 5).map((c, idx) => 
        `${idx + 1}. Challenge #${c.challenge_idx} — ${c.total_completions} completions`
      ).join('\n');
      
      embed.addFields({ name: 'Most Completed Challenges', value: mostCompletedText });
    }
    
    return embed;
  }
}

module.exports = LeaderboardEmbedBuilder;

