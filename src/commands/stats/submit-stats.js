/**
 * Submit Stats Command (Accessible + Modals preserved)
 * - Static, readable embed
 * - Keeps buttons for modal access
 * - No business logic here
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
} = require('discord.js');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('SubmitStatsCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('submit-stats')
    .setDescription('Submit your daily stats'),

  async execute(interaction, services) {
    try {
      if (services?.rateLimiter?.isRateLimited(interaction.user.id, 'submit-stats')) {
        const remaining = services.rateLimiter.getRemainingTime(interaction.user.id, 'submit-stats');
        await interaction.reply({
          content: `⏳ Slow down a bit and try again in ${remaining}s.`,
          flags: 1 << 6,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('📊 Submit Your Daily Stats')
        .setColor(0x5865f2)
        .setDescription(
          [
            '**Use the buttons below to submit your stats via guided forms.**',
            'Each category opens a focused modal to avoid mistakes.',
            '',
            '🧠 *Tip:* If you didn’t perform a stat today, simply leave it empty or set it to 0.',
          ].join('\n')
        )
        .addFields(
          {
            name: '🎯 Core Social Stats',
            value: 'Approaches, Numbers, Contact Response, Hellos, In Action Release',
            inline: true,
          },
          {
            name: '🧘 Inner Work',
            value: 'Courage Welcoming, SBMM, Grounding, Releasing',
            inline: true,
          },
          {
            name: '❤️ Dating & Results',
            value: 'Dates Booked, Dates Had, Instant Date, Got Laid, Same Night Pull',
            inline: true,
          },
          {
            name: '📚 Learning',
            value: 'Course Modules, Course Experiments, Attended Group Calls',
            inline: true,
          },
          {
            name: '🎭 Daily State',
            value: 'Overall State (1–10), Semen Retention Streak',
            inline: true,
          }
        )
        .setFooter({
          text: 'Accessibility-first • Clear categories • Guided input',
        })
        .setTimestamp();

      // ─────────────────────────
      // Buttons (modal access)
      // ─────────────────────────
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('stats_category_core_social')
          .setLabel('Core Social')
          .setEmoji('🎯')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('stats_category_inner_work')
          .setLabel('Inner Work')
          .setEmoji('🧘')
          .setStyle(ButtonStyle.Success)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('stats_category_dating')
          .setLabel('Dating & Results')
          .setEmoji('❤️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('stats_category_learning')
          .setLabel('Learning')
          .setEmoji('📚')
          .setStyle(ButtonStyle.Primary)
      );

      const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('stats_category_daily_state')
          .setLabel('Daily State')
          .setEmoji('🎭')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('stats_help')
          .setLabel('Help')
          .setEmoji('❓')
          .setStyle(ButtonStyle.Secondary)
      );

      const payload = {
        embeds: [embed],
        components: [row1, row2, row3],
        flags: 1 << 6, // ephemeral
      };

      if (interaction.deferred) {
        await interaction.editReply(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch (error) {
      logger.error('Failed to open submit-stats card', { error: error.message });

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Failed to open stats submission. Please try again.',
          flags: 1 << 6,
        });
      }
    }
  },
};
