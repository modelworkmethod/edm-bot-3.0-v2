/**
 * Select Menu Handler
 * Handles string select menu interactions
 */

const { createLogger } = require('../../utils/logger');
const { handleError } = require('../../utils/errorHandler');
const { unknown } = require('../../utils/plainTextReplies');

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');

const logger = createLogger('SelectMenuHandler');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidYMD(dateStr) {
  return DATE_RE.test(dateStr) && !Number.isNaN(Date.parse(dateStr));
}

/**
 * Build modal for editing a single stat value (Admin UI)
 * customId: admin_stats_edit_modal:userId:YYYY-MM-DD:<encodedStatName>
 */
function buildAdminEditStatModal({ userId, dateStr, statName, currentValue }) {
  const encoded = encodeURIComponent(statName);

  const modal = new ModalBuilder()
    .setCustomId(`admin_stats_edit_modal:${userId}:${dateStr}:${encoded}`)
    .setTitle(`Edit Stat • ${dateStr}`.slice(0, 45));

  const input = new TextInputBuilder()
    .setCustomId('value')
    .setLabel(`New value: ${statName}`.slice(0, 45))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(`0 - 500 (current: ${currentValue ?? 0})`.slice(0, 100))
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

/**
 * Build the existing Past Stats modal (kept as-is behavior)
 * customId: submit-past-stats-modal:YYYY-MM-DD
 */
function buildPastStatsModal(dateStr) {
  const modal = new ModalBuilder()
    .setCustomId(`submit-past-stats-modal:${dateStr}`)
    .setTitle(`Submit Stats for ${dateStr}`.slice(0, 45));

  const approachesInput = new TextInputBuilder()
    .setCustomId('approaches')
    .setLabel('Approaches')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Number of approaches')
    .setRequired(false);

  const numbersInput = new TextInputBuilder()
    .setCustomId('numbers')
    .setLabel('Numbers')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Numbers collected')
    .setRequired(false);

  const datesInput = new TextInputBuilder()
    .setCustomId('dates_had')
    .setLabel('Dates Had')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Dates you had')
    .setRequired(false);

  const meditationInput = new TextInputBuilder()
    .setCustomId('meditation')
    .setLabel('SBMM (Sexy Bastard Morning Meditation)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('1 if completed')
    .setRequired(false);

  const stateInput = new TextInputBuilder()
    .setCustomId('state')
    .setLabel('Overall State (1-10)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Rate your state 1-10')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(approachesInput),
    new ActionRowBuilder().addComponents(numbersInput),
    new ActionRowBuilder().addComponents(datesInput),
    new ActionRowBuilder().addComponents(meditationInput),
    new ActionRowBuilder().addComponents(stateInput)
  );

  return modal;
}

async function handleSelectMenu(interaction, services) {
  if (!interaction.isStringSelectMenu()) return;

  const customId = interaction.customId;

  try {
    logger.debug('Select menu interaction', {
      customId,
      userId: interaction.user.id,
      values: interaction.values,
    });

/**
 * =====================================================
 * ✅ NEW: STATS-EDIT DATE PICKER (last 7 days)
 * customId: stats_edit_date_pick:<editorId>:<targetUserId>
 * value: YYYY-MM-DD
 * =====================================================
 */
if (customId.startsWith('stats_edit_date_pick:')) {
  const [, editorId, targetUserId] = customId.split(':');
  const picked = interaction.values?.[0];

  // lock to the user who opened the picker
  if (!editorId || interaction.user.id !== editorId) {
    await interaction.reply({
      content: '❌ This picker is not for you.',
      flags: 1 << 6,
    }).catch(() => {});
    return;
  }

  if (!targetUserId || !picked || !isValidYMD(picked)) {
    await interaction.reply({
      content: '❌ Invalid date selection. Please try again.',
      flags: 1 << 6,
    }).catch(() => {});
    return;
  }

  // ✅ Show "submit-stats style" card (but for editing a specific date/user)
  const embed = new EmbedBuilder()
    .setTitle('📊 Edit Stats')
    .setDescription(
      [
        `**User:** <@${targetUserId}>`,
        `**Date:** **${picked}**`,
        '',
        'Choose a category to edit stats for that day:',
      ].join('\n')
    )
    .setColor(0x5865f2)
    .addFields(
      {
        name: '🎯 Core Social Stats',
        value: 'Approaches, Numbers, Contact Response, Hellos, In Action Release',
        inline: true,
      },
      // ❌ Inner Work hidden (kept for future)
      // {
      //   name: '🧘 Inner Work',
      //   value: 'Courage Welcoming, SBMM, Grounding, Releasing',
      //   inline: true,
      // },
      {
        name: '❤️ Dating & Results',
        value: 'Dates Booked/Had, Instant Date, Got Laid, Same Night Pull',
        inline: true,
      },
      {
        name: '📚 Learning',
        value: 'Course Modules, Course Experiments, Attending Group Call',
        inline: true,
      },
      {
        name: '🎭 Daily State',
        value: 'Overall State (1-10), Semen Retention Streak',
        inline: true,
      }
    )
    .setFooter({ text: 'Edits apply to the selected date' });

  // Buttons carry editorId to lock usage + target user + date
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`edit_stats_category_core_social:${editorId}:${targetUserId}:${picked}`)
      .setLabel('Core Social Stats')
      .setEmoji('🎯')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`edit_stats_category_dating:${editorId}:${targetUserId}:${picked}`)
      .setLabel('Dating & Results')
      .setEmoji('❤️')
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`edit_stats_category_learning:${editorId}:${targetUserId}:${picked}`)
      .setLabel('Learning')
      .setEmoji('📚')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`edit_stats_category_daily_state:${editorId}:${targetUserId}:${picked}`)
      .setLabel('Daily State')
      .setEmoji('🎭')
      .setStyle(ButtonStyle.Primary)
  );

  // Replace the picker message with the card
  await interaction.update({
    content: '',
    embeds: [embed],
    components: [row1, row2],
  }).catch(async () => {
    await interaction.reply({
      embeds: [embed],
      components: [row1, row2],
      flags: 1 << 6,
    }).catch(() => {});
  });

  return;
}


    /**
     * =====================================================
     * ✅ ADMIN STATS UI: EDIT PICK
     * customId: admin_stats_edit_pick:<userId>:<YYYY-MM-DD>
     * value: encodeURIComponent(statName)
     * =====================================================
     */
      if (customId.startsWith('admin_stats_edit_pick:')) {
        const [, userId, dateStr] = customId.split(':');
        const picked = interaction.values?.[0];
        const statName = picked ? decodeURIComponent(picked) : null;

        if (!userId || !dateStr || !isValidYMD(dateStr) || !statName) {
          await interaction.reply({
            content: '❌ Invalid selection payload.',
            flags: 1 << 6,
          }).catch(() => {});
          return;
        }

        // ✅ IMPORTANT: open the modal immediately (no DB calls here),
        // otherwise Discord can expire the interaction and you get "Unknown interaction".
        const modal = buildAdminEditStatModal({
          userId,
          dateStr,
          statName,
          currentValue: null, // we skip reading DB here
        });

        await interaction.showModal(modal);
        return;
      }
      
    /**
     * =====================================================
     * ✅ ADMIN STATS UI: CLEAR PICK (confirm buttons)
     * customId: admin_stats_clear_pick:<userId>:<YYYY-MM-DD>
     * value: encodeURIComponent(statName)
     * =====================================================
     */
    if (customId.startsWith('admin_stats_clear_pick:')) {
      const [, userId, dateStr] = customId.split(':');
      const picked = interaction.values?.[0];
      const statName = picked ? decodeURIComponent(picked) : null;

      if (!userId || !dateStr || !isValidYMD(dateStr) || !statName) {
        await interaction.reply({
          content: '❌ Invalid selection payload.',
          flags: 1 << 6,
        }).catch(() => {});
        return;
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`admin_stats_clear_confirm:${userId}:${dateStr}:${encodeURIComponent(statName)}`)
          .setLabel('Confirm Clear (set to 0)')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('admin_stats_clear_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({
        content: `⚠️ Are you sure you want to clear **${statName}** on **${dateStr}**? (Sets it to 0)`,
        flags: 1 << 6,
        components: [row],
      }).catch(() => {});
      return;
    }

    /**
     * =====================================================
     * ✅ PAST STATS DATE PICKER
     * customId: past-stats-date-select
     * value: YYYY-MM-DD
     * =====================================================
     */
    if (customId === 'past-stats-date-select') {
      const picked = interaction.values?.[0];

      if (!picked || !isValidYMD(picked)) {
        await interaction.reply({
          content: '❌ Invalid date selection. Please try again.',
          flags: 1 << 6,
        }).catch(() => {});
        return;
      }

      const modal = buildPastStatsModal(picked);
      await interaction.showModal(modal);
      return;
    }

    const prefix = customId.split(':')[0] || 'unknown';

    logger.warn('Unknown select menu interaction', {
      customId,
      prefix,
      userId: interaction.user.id,
    });

    await interaction.reply({
      content: unknown('select-menu', prefix),
      flags: 1 << 6,
    }).catch(() => {});
  } catch (error) {
    handleError(error, 'SelectMenuHandler');

    const msg = error?.message || '';
    const code = error?.code;
    const isInteractionStateError =
      code === 10062 ||
      code === 40060 ||
      msg.includes('Unknown interaction') ||
      msg.includes('already been acknowledged');

    if (isInteractionStateError) {
      logger.warn('SelectMenuHandler: interaction no longer valid', {
        code,
        message: msg,
      });
      return;
    }

    try {
      await interaction.reply({
        content: '❌ An error occurred processing your selection.',
        flags: 1 << 6,
      });
    } catch {}
  }
}

module.exports = { handleSelectMenu };
