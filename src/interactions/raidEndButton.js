// ═══════════════════════════════════════════════════════════════════════════════
// Raid End Button - Ends a raid manually via button
// customId: raid-end:<raidId>
// - Cancels raid (status cancelled)
// - Always announces in General channel
// - Shows NYC time (DST auto) in the updated message
// - Disables the button on the original message
// ═══════════════════════════════════════════════════════════════════════════════

const {
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
} = require('discord.js');

const { createLogger } = require('../utils/logger');
const config = require('../config/settings');
const RaidManager = require('../services/raids/RaidManager');

const logger = createLogger('RaidEndButton');

function getGeneralChannelId(interaction) {
  return (
    (config.channels && (config.channels.general || config.channels.generalId)) ||
    interaction.channelId
  );
}

// NYC time (DST auto) — shows "EST"/"EDT" automatically
function formatNYCTimestamp(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
  return fmt.format(date);
}

function disableMessageButtons(message) {
  const rows = message?.components || [];
  return rows.map((row) => {
    const newRow = new ActionRowBuilder();

    for (const c of row.components) {
      // Rebuild button preserving label/emoji/style/customId
      const btn = ButtonBuilder.from(c).setDisabled(true);
      newRow.addComponents(btn);
    }

    return newRow;
  });
}

module.exports = {
  idPrefix: 'raid-end:',

  async execute(interaction, services) {
    const customId = interaction.customId || interaction.custom_id;

    try {
      // Admin-only
      const isAdmin =
        interaction.user.id === config.admin.userId ||
        interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

      if (!isAdmin) {
        await interaction.reply({
          content: '❌ Only admins can end a raid.',
          flags: 1 << 6,
        });
        return;
      }

      const [, raidIdStr] = String(customId).split(':');
      const raidId = parseInt(raidIdStr, 10);

      if (!raidId || Number.isNaN(raidId)) {
        await interaction.reply({
          content: '❌ Invalid raid ID on button.',
          flags: 1 << 6,
        });
        return;
      }

      const raidManager =
        services?.raidManager ||
        new RaidManager(
          services?.channelService,
          services?.repositories,
          services?.announcementQueue
        );

      const generalChannelId = getGeneralChannelId(interaction);

      // 1) Cancel raid (announce cancel embed in GENERAL)
      //    (This uses your RaidManager.cancelRaid(raidId, channelId, cancelledBy))
      await raidManager.cancelRaid(raidId, generalChannelId, interaction.user.id);

      // 2) Disable button on the original message + show NYC time
      const nycTime = formatNYCTimestamp(new Date());

      const disabledComponents = disableMessageButtons(interaction.message);

      // interaction.update() is the acknowledgement for button interactions
      await interaction.update({
        content: `⛔ Raid **#${raidId}** ended by <@${interaction.user.id}> • **NYC:** ${nycTime}`,
        embeds: interaction.message.embeds,
        components: disabledComponents,
      });

      logger.info('Raid ended via button', {
        raidId,
        userId: interaction.user.id,
        generalChannelId,
      });
    } catch (error) {
      const msg = error?.message || '';
      const code = error?.code;

      logger.error('RaidEndButton: failed to end raid via button', {
        code,
        error: msg,
        customId,
      });

      // Avoid "already acknowledged" / unknown interaction spam
      const isInteractionStateError =
        code === 10062 ||
        code === 40060 ||
        /Unknown interaction/i.test(msg) ||
        /already been acknowledged/i.test(msg);

      if (isInteractionStateError) return;

      try {
        await interaction.reply({
          content: '❌ Failed to end raid. Please try again.',
          flags: 1 << 6,
        });
      } catch {}
    }
  },
};
