/**
 * Faction Stats Command
 * Shows the faction war leaderboard
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const config = require('../../config/settings');

const logger = createLogger('FactionStatsCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('faction-stats')
    .setDescription('View the Faction War leaderboard'),

  async execute(interaction, services) {
    try {
      await interaction.deferReply();

      // Get faction stats (you already have this function)
      const factionStats = await getFactionStats(services);

      const { Luminarchs, Noctivores } = factionStats;

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(config.branding.colorHex)
        .setTitle('⚔️ FACTION WAR')
        .setThumbnail(config.branding.logoUrl)
        .setFooter({ text: config.branding.name })
        .setTimestamp();

      if (Luminarchs.count === 0 && Noctivores.count === 0) {
        embed.setDescription('No faction members yet. Join a faction to start the war!');
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Luminarchs section
      if (Luminarchs.count > 0) {
        embed.addFields({
          name: '🦸 LUMINARCHS',
          value: [
            `**Members:** ${Luminarchs.count}`,
            `**Total XP:** ${Luminarchs.totalXP.toLocaleString()}`,
            `**Avg XP:** ${Math.floor(Luminarchs.avgXP).toLocaleString()}`
          ].join('\n'),
          inline: true
        });
      }

      // Noctivores section
      if (Noctivores.count > 0) {
        embed.addFields({
          name: '🥷 NOCTIVORES',
          value: [
            `**Members:** ${Noctivores.count}`,
            `**Total XP:** ${Noctivores.totalXP.toLocaleString()}`,
            `**Avg XP:** ${Math.floor(Noctivores.avgXP).toLocaleString()}`
          ].join('\n'),
          inline: true
        });
      }

      // Determine winner
      if (Luminarchs.count > 0 && Noctivores.count > 0) {
        const leader = Luminarchs.totalXP > Noctivores.totalXP ? 'LUMINARCHS' : 'NOCTIVORES';
        const leaderEmoji = leader === 'LUMINARCHS' ? '🦸' : '🥷';
        const xpLead = Math.abs(Luminarchs.totalXP - Noctivores.totalXP);

        embed.addFields({
          name: '👑 Current Leader',
          value: `${leaderEmoji} **${leader}** are winning by **${xpLead.toLocaleString()} XP**!`,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.error('Failed to show faction stats', { error: error.message });
      await interaction.editReply('Failed to load faction stats. Please try again.');
    }
  }
};

/**
 * Get faction statistics
 */
async function getFactionStats(services) {
  const rows = await services.repositories.user.raw(
    `SELECT 
       faction,
       COUNT(*) as count,
       SUM(xp) as total_xp,
       AVG(xp) as avg_xp
     FROM users 
     WHERE faction IS NOT NULL
     GROUP BY faction`
  );

  const stats = {
    Luminarchs: { count: 0, totalXP: 0, avgXP: 0 },
    Noctivores: { count: 0, totalXP: 0, avgXP: 0 }
  };

  for (const row of rows.rows) {
    if (row.faction === 'Luminarchs' || row.faction === 'Noctivores') {
      stats[row.faction] = {
        count: parseInt(row.count),
        totalXP: parseInt(row.total_xp || 0),
        avgXP: parseFloat(row.avg_xp || 0)
      };
    }
  }

  return stats;
}

