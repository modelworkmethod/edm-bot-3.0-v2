/**
 * Submit Past Stats Command
 * Backfill stats for previous days (date -> category -> modal)
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
} = require('discord.js');
const { createLogger } = require('../../utils/logger');
const { getLocalDayString, addDays } = require('../../utils/timeUtils');

const logger = createLogger('SubmitPastStatsCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('submit-past-stats')
    .setDescription('Submit stats for a previous day')
    .addStringOption(option =>
      option
        .setName('date')
        .setDescription('Date in YYYY-MM-DD format (e.g., 2025-10-01)')
        .setRequired(true)
    ),

  async execute(interaction, services) {
    try {
      const dateStr = interaction.options.getString('date');

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        await interaction.reply({
          content: '❌ Invalid date format. Use YYYY-MM-DD (e.g., 2025-10-01)',
          flags: 1 << 6,
        });
        return;
      }

      // Validate date is not in the future
      const today = getLocalDayString();
      if (dateStr > today) {
        await interaction.reply({
          content: '❌ You cannot submit stats for future dates.',
          flags: 1 << 6,
        });
        return;
      }

      // Validate date is not too old (max 30 days back)
      const thirtyDaysAgo = addDays(today, -30);
      if (dateStr < thirtyDaysAgo) {
        await interaction.reply({
          content: '❌ You can only backfill stats up to 30 days in the past.',
          flags: 1 << 6,
        });
        return;
      }

      // Check if user already submitted for this day
      const existing = await services.repositories.stats.getDailyRecord(
        interaction.user.id,
        dateStr
      );

      if (existing && existing.active === 1) {
        await interaction.reply({
          content: `⚠️ You already submitted stats for ${dateStr}. Use \`/admin\` if you need to reset that day.`,
          flags: 1 << 6,
        });
        return;
      }

      // Show category picker (same UI style as /submit-stats, but for a fixed date)
      const embed = new EmbedBuilder()
        .setTitle('📅 Past Stats Submission')
        .setDescription(
          `Choose a category to submit your stats for:\n**${dateStr}**\n\nEach category has individual fields to prevent mistakes.`
        )
        .setColor(0x5865f2)
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
            value: 'Dates Booked/Had, Instant Date, Got Laid, Same Night Pull',
            inline: true,
          },
          {
            name: '📚 Learning',
            value: 'Course Modules, Course Experiments',
            inline: true,
          },
          {
            name: '🎭 Daily State',
            value: 'Overall State (1-10), Semen Retention Streak',
            inline: true,
          }
        )
        .setFooter({ text: 'Pick a category to open the form for that day' })
        .setTimestamp();

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`past_stats_category_core_social:${dateStr}`)
          .setLabel('Core Social Stats')
          .setEmoji('🎯')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`past_stats_category_inner_work:${dateStr}`)
          .setLabel('Inner Work')
          .setEmoji('🧘')
          .setStyle(ButtonStyle.Success)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`past_stats_category_dating:${dateStr}`)
          .setLabel('Dating & Results')
          .setEmoji('❤️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`past_stats_category_learning:${dateStr}`)
          .setLabel('Learning')
          .setEmoji('📚')
          .setStyle(ButtonStyle.Primary)
      );

      const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`past_stats_category_daily_state:${dateStr}`)
          .setLabel('Daily State')
          .setEmoji('🎭')
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.reply({
        embeds: [embed],
        components: [row1, row2, row3],
        flags: 1 << 6,
      });
    } catch (error) {
      logger.error('Failed to show past stats selector', { error: error.message });

      // Evitar Unknown interaction
      if (error?.code === 10062 || /Unknown interaction/i.test(error?.message || '')) return;

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Failed to open past stats. Please try again.',
            flags: 1 << 6,
          });
        }
      } catch {}
    }
  },
};
