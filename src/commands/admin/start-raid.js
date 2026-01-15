/**
 * Start Raid Command
 * Admin command to start Warrior or Mage raid
 * + Buttons: End Raid / Add Points
 * + Always announces in #general
 * + NYC time (DST aware) shown in embed
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const config = require('../../config/settings');
const RaidManager = require('../../services/raids/RaidManager');

const logger = createLogger('StartRaidCommand');

// Simple progress bar helper
function buildProgressBar(percent) {
  const totalBlocks = 20;
  const filled = Math.round((percent / 100) * totalBlocks);
  const empty = totalBlocks - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// NYC time helper (DST-aware)
function formatNYCTime(date = new Date()) {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return fmt.format(date) + ' NYC';
  } catch {
    return date.toISOString();
  }
}

async function sendToChannelSafe(interaction, services, channelId, payload) {
  // 1) channelService si existe
  if (services?.channelService && typeof services.channelService.sendToChannel === 'function') {
    try {
      await services.channelService.sendToChannel(channelId, payload);
      return true;
    } catch (e) {
      logger.warn('StartRaidCommand: channelService send failed, will fallback', { error: e.message });
    }
  }

  // 2) fallback: client.channels.fetch().send()
  try {
    const ch = await interaction.client.channels.fetch(channelId);
    if (ch && typeof ch.send === 'function') {
      await ch.send(payload);
      return true;
    }
  } catch (e) {
    logger.error('StartRaidCommand: direct send fallback failed', { error: e.message, channelId });
  }

  return false;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('start-raid')
    .setDescription('Start a Warrior or Mage raid event (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Raid type')
        .setRequired(true)
        .addChoices(
          { name: '⚔️ Warrior Raid (Outer Action)', value: 'warrior' },
          { name: '🔮 Mage Raid (Inner Work)', value: 'mage' }
        )
    )
    .addIntegerOption(option =>
      option
        .setName('duration')
        .setDescription('Duration in minutes (default: 60)')
        .setMinValue(15)
        .setMaxValue(240)
    )
    .addIntegerOption(option =>
      option
        .setName('target')
        .setDescription('Target points (default: 1000)')
        .setMinValue(100)
        .setMaxValue(10000)
    ),

  async execute(interaction, services) {
    const isAdmin =
      interaction.user.id === config.admin.userId ||
      interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isAdmin) {
      try {
        await interaction.reply({
          content: 'Admin only.',
          flags: 1 << 6
        });
      } catch (err) {
        logger.warn('StartRaidCommand: failed to reply (no admin)', {
          code: err.code,
          message: err.message
        });
      }
      return;
    }

    const raidManager =
      services?.raidManager ||
      new RaidManager(
        services?.channelService,
        services?.repositories,
        services?.announcementQueue
      );

    let deferred = false;

    try {
      await interaction.deferReply({ flags: 1 << 6 });
      deferred = true;
    } catch (err) {
      if (err.code === 10062 || /Unknown interaction/i.test(err.message || '')) {
        logger.warn('StartRaidCommand: interaction invalid while deferring', {
          code: err.code,
          message: err.message
        });
        return;
      }
      logger.error('StartRaidCommand: failed to defer reply', { error: err.message });
      return;
    }

    try {
      const raidType = interaction.options.getString('type'); // warrior | mage
      const duration = interaction.options.getInteger('duration') || 60;
      const target = interaction.options.getInteger('target') || 1000;

      const raid = await raidManager.createRaid(raidType, duration, target);
      await raidManager.startRaid(raid.id, interaction.channelId);

      let progress = null;
      let factions = { luminarchs: 0, noctivores: 0, unaligned: 0 };

      try {
        progress = await raidManager.getRaidProgress(raid.id);
      } catch (err) {
        logger.warn('StartRaidCommand: getRaidProgress failed, continuing', { error: err.message });
      }

      try {
        if (typeof raidManager.getFactionTotals === 'function') {
          const factionTotals = await raidManager.getFactionTotals(raid.id);
          factions = {
            luminarchs: factionTotals.luminarchs || 0,
            noctivores: factionTotals.noctivores || 0,
            unaligned: factionTotals.unaligned || 0
          };
        }
      } catch (err) {
        logger.warn('StartRaidCommand: getFactionTotals failed, continuing', { error: err.message });
      }

      const currentPoints = progress?.currentPoints ?? 0;
      const targetPoints = progress?.targetPoints ?? target;
      const percent = progress ? Math.round(progress.progress) : 0;
      const timeRemaining = progress?.timeRemaining || `${duration}m remaining`;

      const bar = buildProgressBar(percent);

      // Admin ephemeral confirmation
      const lines = [
        `✅ Raid **#${raid.id}** started!`,
        raidType === 'warrior'
          ? 'Type: **⚔️ WARRIOR (Outer Action)**'
          : 'Type: **🔮 MAGE (Inner Work)**',
        `Duration: **${duration} minutes**`,
        `Target: **${targetPoints.toLocaleString()} points**`,
        '',
        '**Factions:**',
        `☀️ **Luminarchs:** ${factions.luminarchs.toLocaleString()} pts`,
        `🌙 **Noctivores:** ${factions.noctivores.toLocaleString()} pts`,
        `⚖️ **Unaligned:** ${factions.unaligned.toLocaleString()} pts`,
        '',
        'Buttons were posted in #general.'
      ];
      await interaction.editReply({ content: lines.join('\n') });

      // Announce in General (ALWAYS)
      const generalChannelId =
        (config.channels && (config.channels.general || config.channels.generalId)) ||
        interaction.channelId;

      const nycNow = formatNYCTime(new Date());

      const embed = {
        color: raidType === 'warrior' ? 0xFF6B6B : 0x9B59B6,
        title:
          raidType === 'warrior'
            ? `⚔️ WARRIOR RAID #${raid.id} STARTED!`
            : `🔮 MAGE RAID #${raid.id} STARTED!`,
        description: [
          raidType === 'warrior'
            ? '**Outer Action Raid: Push your social courage!**'
            : '**Inner Work Raid: Deep dive into grounding & releasing.**',
          '',
          `🕒 **Started:** ${nycNow}`,
          `🎯 **Target:** ${targetPoints.toLocaleString()} pts`,
          `📈 **Current:** ${currentPoints.toLocaleString()} pts (${percent}%)`,
          `⏱️ **Time Remaining:** ${timeRemaining}`,
          '',
          `**Progress:**`,
          `\`${bar}\``,
          '',
          '**Factions:**',
          `☀️ **Luminarchs:** ${factions.luminarchs.toLocaleString()} pts`,
          `🌙 **Noctivores:** ${factions.noctivores.toLocaleString()} pts`,
          `⚖️ **Unaligned:** ${factions.unaligned.toLocaleString()} pts`,
          '',
          'Submit your stats with `/submit-stats` to contribute to the raid!',
          '',
          '_Admins: use the buttons below if you started the wrong raid or need to add points._'
        ].join('\n'),
        footer: { text: 'NYC time shown (DST aware)' },
        timestamp: new Date().toISOString()
      };

      // Buttons row (End + Add Points)
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`raid-end:${raid.id}`)
          .setLabel('🛑 End Raid')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`raid-add-points:${raid.id}`)
          .setLabel('➕ Add Points')
          .setStyle(ButtonStyle.Primary)
      );

      const sent = await sendToChannelSafe(interaction, services, generalChannelId, {
        embeds: [embed],
        components: [row]
      });

      if (!sent) {
        logger.error('StartRaidCommand: could not announce in general (all methods failed)', {
          generalChannelId
        });
      }

      logger.info('Raid started by admin', {
        adminId: interaction.user.id,
        raidId: raid.id,
        raidType,
        duration,
        target
      });

    } catch (error) {
      logger.error('Failed to start raid', { error: error.message });

      if (!deferred) return;

      try {
        await interaction.editReply('❌ Failed to start raid. Please try again.');
      } catch (err2) {
        if (err2.code === 10062 || /Unknown interaction/i.test(err2.message || '')) {
          logger.warn('StartRaidCommand: interaction invalid when sending error', {
            code: err2.code,
            message: err2.message
          });
        }
      }
    }
  }
};
