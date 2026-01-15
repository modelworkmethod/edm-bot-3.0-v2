/**
 * Set Double XP Command
 * Admin command to schedule double XP weekend (Fri 10am ET -> Sun 9pm ET)
 *
 * ✅ Added TEST MODE:
 * - Optional: test_now:true will send reminders TODAY (quick verification)
 * - Does NOT alter the real weekend schedule saved in DB (still schedules Fri–Sun)
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const config = require('../../config/settings');

const logger = createLogger('SetDoubleXPCommand');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function sendToChannelSafe(interaction, services, channelId, payload) {
  // 1) channelService
  if (services?.channelService && typeof services.channelService.sendToChannel === 'function') {
    try {
      await services.channelService.sendToChannel(channelId, payload);
      return true;
    } catch (e) {
      logger.warn('channelService send failed, fallback to direct send', { error: e.message, channelId });
    }
  }

  // 2) direct fetch/send
  try {
    const ch = await interaction.client.channels.fetch(channelId);
    if (ch && typeof ch.send === 'function') {
      await ch.send(payload);
      return true;
    }
  } catch (e) {
    logger.error('direct send failed', { error: e.message, channelId });
  }

  return false;
}

// small helper: schedule a few reminders for test mode
function scheduleTestReminders({ interaction, services, channelId, multiplier }) {
  const safeSend = async (minsFromNow, label) => {
    const ms = minsFromNow * 60 * 1000;
    setTimeout(async () => {
      try {
        await sendToChannelSafe(interaction, services, channelId, {
          content: [
            `🧪 **TEST Double XP Reminder** (${label})`,
            `Multiplier: **${multiplier}x**`,
            `Use /submit-stats to earn boosted XP right now.`,
          ].join('\n'),
        });
      } catch (e) {
        logger.warn('Test reminder send failed', { error: e?.message, minsFromNow, channelId });
      }
    }, ms);
  };

  // 3 reminders today (you can tweak minutes)
  safeSend(1, '+1 min');
  safeSend(3, '+3 min');
  safeSend(6, '+6 min');

  logger.info('Test reminders scheduled (in-memory)', {
    channelId,
    minutes: [1, 3, 6],
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-double-xp')
    .setDescription('Schedule a Double XP weekend (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('preset')
        .setDescription('Use preset event')
        .addChoices(
          { name: 'Fri–Sun Weekend (Fri 10am ET → Sun 9pm ET)', value: 'fri_sun' }
        )
        .setRequired(true)
    )
    .addNumberOption(option =>
      option
        .setName('multiplier')
        .setDescription('XP multiplier (default: 2.0)')
        .setMinValue(1.5)
        .setMaxValue(5.0)
    )
    // ✅ NEW: quick test today
    .addBooleanOption(option =>
      option
        .setName('test_now')
        .setDescription('Send a few TEST reminders today (does not change weekend schedule)')
        .setRequired(false)
    ),

  async execute(interaction, services) {
    const isAdmin =
      interaction.user.id === config.admin.userId ||
      interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isAdmin) {
      await interaction.reply({ content: 'Admin only.', flags: 1 << 6 });
      return;
    }

    try {
      await interaction.deferReply({ flags: 1 << 6 });

      const preset = interaction.options.getString('preset');
      const multiplier = interaction.options.getNumber('multiplier') || 2.0;
      const testNow = interaction.options.getBoolean('test_now') || false;

      const DoubleXPManager = require('../../services/events/DoubleXPManager');
      const manager = new DoubleXPManager(services.channelService);

      let event;

      if (preset === 'fri_sun') {
        event = await manager.createFriToSunWeekendEvent(interaction.user.id, multiplier);
      } else {
        // fallback
        event = await manager.createFriToSunWeekendEvent(interaction.user.id, multiplier);
      }

      const startTime = Math.floor(new Date(event.start_time).getTime() / 1000);
      const endTime = Math.floor(new Date(event.end_time).getTime() / 1000);

      // Admin confirmation (ephemeral)
      await interaction.editReply({
        content: [
          `✅ Double XP Weekend scheduled!`,
          '',
          `**Multiplier:** ${multiplier}x`,
          `**Starts:** <t:${startTime}:F> (Fri 10:00 AM ET)`,
          `**Ends:** <t:${endTime}:F> (Sun 9:00 PM ET)`,
          '',
          `Auto-posts in #general at start + every 4 hours, and an end message Sunday 9pm ET.`,
          testNow ? '' : null,
          testNow ? '🧪 **TEST MODE:** I will also send a few reminders today to confirm output.' : null,
        ].filter(Boolean).join('\n')
      });

      // Determine general channel
      const generalChannelId =
        process.env.GENERAL_CHANNEL_ID ||
        (config.channels && (config.channels.general || config.channels.generalId)) ||
        config.channels?.generalChannelId ||
        config.generalChannelId ||
        interaction.channelId;

      // Announce scheduling in general
      const announcePayload = {
          content: [
            `📣 **DOUBLE XP WEEKEND SCHEDULED** 📣`,
            '',
            `**Multiplier:** **${multiplier}x**`,
            `**Starts:** <t:${startTime}:F>`,
            `**Ends:** <t:${endTime}:F>`,
            '',
            `You’ll get reminders every **4 hours** during the weekend.`,
            '',
            `Admins: use the button below to cancel this event if needed.`
          ].join('\n'),
          components: [cancelRow],
        };


      const sent = await sendToChannelSafe(interaction, services, generalChannelId, announcePayload);

      // ✅ TEST MODE: send reminders today (quick verification)
      if (testNow) {
        // send an immediate test ping
        await sendToChannelSafe(interaction, services, generalChannelId, {
          content: [
            `🧪 **TEST: Double XP reminders (today only)**`,
            `Multiplier: **${multiplier}x**`,
            '',
            `In the next minutes you'll see 3 reminders to confirm the bot posts correctly.`
          ].join('\n')
        });

        const cancelCustomId = `doublexp_cancel:${event.id}`;
        const cancelRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(cancelCustomId)
            .setLabel('Cancel Double XP')
            .setStyle(ButtonStyle.Danger)
        );

        scheduleTestReminders({
          interaction,
          services,
          channelId: generalChannelId,
          multiplier,
        });
      }

      logger.info('Double XP weekend scheduled', {
        adminId: interaction.user.id,
        eventId: event.id,
        multiplier,
        announced: sent,
        generalChannelId,
        testNow
      });
    } catch (error) {
      logger.error('Failed to schedule Double XP event', { error: error.message });
      try {
        await interaction.editReply('Failed to schedule event. Check logs.');
      } catch {}
    }
  }
};
