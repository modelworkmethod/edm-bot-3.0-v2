/**
 * Raid Status Command
 * Shows current raid progress (points, time remaining, factions, etc.)
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const RaidManager = require('../../services/raids/RaidManager');

const logger = createLogger('RaidStatusCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('raid-status')
    .setDescription('Show current raid status')
    .addIntegerOption(option =>
      option
        .setName('id')
        .setDescription('Specific raid ID (optional, defaults to active raid)')
        .setRequired(false)
    ),

  async execute(interaction, services) {
    let deferred = false;

    // ─────────────────────────────────────────────────────────────
    // 1) deferReply con manejo de Unknown interaction
    // ─────────────────────────────────────────────────────────────
    try {
      await interaction.deferReply({ flags: 1 << 6 }); // efímero
      deferred = true;
    } catch (err) {
      if (err.code === 10062 || /Unknown interaction/i.test(err.message || '')) {
        logger.warn('RaidStatusCommand: interaction invalid while deferring', {
          code: err.code,
          message: err.message
        });
        return;
      }

      logger.error('RaidStatusCommand: failed to defer reply', {
        error: err.message
      });
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 2) Lógica principal
    // ─────────────────────────────────────────────────────────────
    try {
      const raidManager =
        services?.raidManager ||
        new RaidManager(
          services?.channelService,
          services?.repositories,
          services?.announcementQueue
        );

      let raid;
      const raidIdOption = interaction.options.getInteger('id');

      if (raidIdOption) {
        raid = await raidManager.getRaid(raidIdOption);
        if (!raid) {
          await interaction.editReply('❌ Raid not found with that ID.');
          return;
        }
      } else {
        raid = await raidManager.getActiveRaid();
        if (!raid) {
          await interaction.editReply('❌ There is currently no active raid.');
          return;
        }
      }

      // Progreso (aquí es donde usamos tus nuevos campos, incluido factions)
      let progress = await raidManager.getRaidProgress(raid.id);

      const currentPoints = progress.currentPoints ?? 0;
      const targetPoints = progress.targetPoints ?? raid.target_points ?? 0;
      const progressPct =
        targetPoints > 0 ? Math.min(100, Math.round((currentPoints / targetPoints) * 100)) : 0;

      // Barrita visual simple (10 bloques)
      const filledBlocks = Math.round(progressPct / 10);
      const emptyBlocks = 10 - filledBlocks;
      const bar = '▰'.repeat(filledBlocks) + '▱'.repeat(emptyBlocks);

      // Factions (si no existen en progress, ponemos 0)
      const factions = progress.factions || {
        luminarchs: 0,
        noctivores: 0,
        unaligned: 0
      };

      const raidType = progress.raidType || raid.raid_type;
      const isWarrior = raidType === 'warrior';

      const color = isWarrior ? 0xff6b6b : 0x9b59b6;
      const title = isWarrior
        ? '⚔️ WARRIOR RAID IN PROGRESS'
        : '🔮 MAGE RAID IN PROGRESS';

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .addFields(
          {
            name: '📈 Progress',
            value: `${currentPoints.toLocaleString()} / ${targetPoints.toLocaleString()} points\n${bar} \`${progressPct}%\``,
            inline: false
          },
          {
            name: '⏱️ Time Remaining',
            value: progress.timeRemaining || 'Ended',
            inline: true
          },
          {
            name: '🎯 Target',
            value: `${targetPoints.toLocaleString()} pts`,
            inline: true
          },
          {
            name: '☀️ Factions',
            value: [
              `☀️ **Luminarchs:** ${factions.luminarchs.toLocaleString()} pts`,
              `🌙 **Noctivores:** ${factions.noctivores.toLocaleString()} pts`,
              `⚖️ **Unaligned:** ${factions.unaligned.toLocaleString()} pts`
            ].join('\n'),
            inline: false
          }
        )
        .setFooter({
          text: 'Embodied Dating Mastermind'
        })
        .setTimestamp();

      // Si el raid ya terminó, indicamos el estado
      if (progress.status && progress.status !== 'active') {
        embed.addFields({
          name: 'Status',
          value: progress.status.toUpperCase(),
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.error('RaidStatusCommand: Failed to show raid status', {
        error: error.message
      });

      if (!deferred) return;

      try {
        await interaction.editReply(
          '❌ Failed to load raid status. Please try again.'
        );
      } catch (err2) {
        if (err2.code === 10062 || /Unknown interaction/i.test(err2.message || '')) {
          logger.warn(
            'RaidStatusCommand: interaction invalid when sending error',
            {
              code: err2.code,
              message: err2.message
            }
          );
        }
      }
    }
  }
};
