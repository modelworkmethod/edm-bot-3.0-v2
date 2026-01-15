/**
 * Wingman Admin Command
 * Admin-only wingman matcher control
 */

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, PermissionsBitField } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const wingmanConfig = require('../../config/wingmanConfig');
const { executeWingmanRun } = require('../../jobs/wingmanScheduler');
const { queryRows } = require('../../database/postgres');

const logger = createLogger('WingmanAdminCommand');

const EPHEMERAL = { flags: 1 << 6 };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wingman-admin')
    .setDescription('Admin: Manage wingman matcher')
    .addSubcommand(sub =>
      sub.setName('run')
        .setDescription('Execute wingman pairing (immediate or dry-run)')
        .addBooleanOption(opt =>
          opt.setName('dry')
            .setDescription('Dry run (preview only, no changes)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('history')
        .setDescription('View recent wingman runs')
        .addIntegerOption(opt =>
          opt.setName('limit')
            .setDescription('Number of runs to show')
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('config')
        .setDescription('View wingman configuration')
    ),

  async execute(interaction, services) {
    // ✅ Always ACK fast (prevents Unknown interaction)
    await safeDefer(interaction);

    try {
      // ──────────────────────────────
      // 🔐 PERMISSIONS: ADMIN OR OWNER
      // ──────────────────────────────
      const isGuildAdmin =
        !!interaction.memberPermissions &&
        interaction.memberPermissions.has(PermissionFlagsBits.Administrator);

      const isOwner =
        interaction.guild &&
        interaction.guild.ownerId === interaction.user.id;

      if (!isGuildAdmin && !isOwner) {
        await safeEdit(interaction, '🚫 This command is for server admins only.');
        return;
      }

      // Optional rate limit
      if (services?.rateLimiter &&
          services.rateLimiter.isRateLimited(interaction.user.id, 'wingman-admin')) {
        await safeEdit(interaction, '⏱️ Slow down. Try again shortly.');
        return;
      }

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'run') {
        await handleRun(interaction, services);
      } else if (subcommand === 'history') {
        await handleHistory(interaction);
      } else if (subcommand === 'config') {
        await handleConfig(interaction);
      } else {
        await safeEdit(interaction, '❌ Unknown subcommand.');
      }

    } catch (error) {
      logger.error('Failed to execute wingman-admin', { error: error.message });

      // Don't crash trying to reply after expiry
      await safeEdit(interaction, '❌ An error occurred. Please try again.');
    }
  }
};

//
// ───────────────────────────────────────────────
// helpers (safe interaction replies)
// ───────────────────────────────────────────────
//
async function safeDefer(interaction) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply(EPHEMERAL);
    }
  } catch (e) {
    const msg = e?.message || '';
    const code = e?.code;
    if (code === 10062 || msg.includes('Unknown interaction')) {
      logger.warn('WingmanAdmin: interaction invalid during defer', { code, message: msg });
      return;
    }
    logger.warn('WingmanAdmin: defer failed', { error: msg });
  }
}

async function safeEdit(interaction, contentOrPayload) {
  try {
    const payload = typeof contentOrPayload === 'string'
      ? { content: contentOrPayload, ...EPHEMERAL }
      : { ...contentOrPayload, ...EPHEMERAL };

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (e) {
    const msg = e?.message || '';
    const code = e?.code;
    if (code === 10062 || msg.includes('Unknown interaction')) {
      logger.warn('WingmanAdmin: interaction invalid while editing reply', { code, message: msg });
      return;
    }
    if (msg.includes('Interaction has already been acknowledged')) {
      logger.warn('WingmanAdmin: double-ack prevented', { message: msg });
      return;
    }
    logger.error('WingmanAdmin: failed to send reply', { error: msg });
  }
}

function formatChannelCheck({ ok, lines }) {
  const head = ok ? '✅ Matchups channel ready' : '❌ Matchups channel issue';
  return `${head}\n${lines.join('\n')}`;
}

async function preflightMatchupsChannel(guild) {
  const lines = [];
  const channelId = wingmanConfig.matchupsChannelId;

  if (!channelId || channelId === 'NOT_SET') {
    return {
      ok: false,
      lines: [
        '• Matchups channel id is not set.',
        '• Set WINGMAN_MATCHUPS_CHANNEL_ID (or your wingmanConfig source) to a valid text channel.',
      ]
    };
  }

  const channel = guild.channels.cache.get(channelId) || null;

  if (!channel) {
    return {
      ok: false,
      lines: [
        `• Channel not found: ${channelId}`,
        `• Create a new channel (e.g. #matchups) and set its ID in WINGMAN_MATCHUPS_CHANNEL_ID.`,
      ]
    };
  }

  lines.push(`• Channel: <#${channelId}>`);

  // Must be a guild text channel (threads live here)
  if (channel.type !== ChannelType.GuildText) {
    lines.push(`• Type: ${channel.type} (needs GuildText)`);
    return { ok: false, lines };
  }

  // Permissions for the bot
  const me = await guild.members.fetchMe().catch(() => null);
  if (!me) {
    lines.push('• Could not fetch bot member (fetchMe failed).');
    return { ok: false, lines };
  }

  const perms = channel.permissionsFor(me);
  const needs = [
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.CreatePrivateThreads,
    PermissionsBitField.Flags.SendMessagesInThreads,
  ];

  const missing = needs.filter(p => !perms?.has(p));
  if (missing.length > 0) {
    lines.push('• Missing permissions:');
    missing.forEach(p => lines.push(`  - ${permissionName(p)}`));
    lines.push('• Fix: grant the bot role these permissions in the Matchups channel.');
    return { ok: false, lines };
  }

  // Recommended (helps adding members / managing)
  const rec = [
    PermissionsBitField.Flags.ManageThreads,
  ];
  const missingRec = rec.filter(p => !perms?.has(p));
  if (missingRec.length > 0) {
    lines.push('⚠️ Recommended permissions missing (may break adding users to private threads):');
    missingRec.forEach(p => lines.push(`  - ${permissionName(p)}`));
  }

  return { ok: true, lines };
}

function permissionName(flag) {
  const map = {
    [PermissionsBitField.Flags.ViewChannel]: 'ViewChannel',
    [PermissionsBitField.Flags.SendMessages]: 'SendMessages',
    [PermissionsBitField.Flags.CreatePrivateThreads]: 'CreatePrivateThreads',
    [PermissionsBitField.Flags.SendMessagesInThreads]: 'SendMessagesInThreads',
    [PermissionsBitField.Flags.ManageThreads]: 'ManageThreads',
  };
  return map[flag] || String(flag);
}

//
// ───────────────────────────────────────────────
//  /wingman-admin run
// ───────────────────────────────────────────────
//
async function handleRun(interaction, services) {
  try {
    if (!wingmanConfig.enabled) {
      await safeEdit(
        interaction,
        '⚠️ Wingman Matcher is **DISABLED**.\n\n' +
        'Set `WINGMAN_MATCHUPS_CHANNEL_ID` in your environment to enable.'
      );
      return;
    }

    const guild = interaction.guild;
    const isDry = interaction.options.getBoolean('dry') || false;

    if (!services?.wingmanMatcher) {
      await safeEdit(interaction, '❌ Wingman matcher service not available.');
      return;
    }

    // ✅ Preflight channel + permissions BEFORE doing expensive work
    const preflight = await preflightMatchupsChannel(guild);
    if (!preflight.ok && !isDry) {
      await safeEdit(interaction, formatChannelCheck(preflight));
      return;
    }

    // Eligible members
    const members = await services.wingmanMatcher.getEligibleMembers(guild);

    if (members.length < 2) {
      await safeEdit(
        interaction,
        `❌ Not enough eligible members: ${members.length}\n` +
        `Need at least 2 members to create pairs.`
      );
      return;
    }

    const { pairs, unpaired } = await services.wingmanMatcher.buildPairs(members);

    if (pairs.length === 0) {
      await safeEdit(
        interaction,
        `❌ Could not create any pairs.\n` +
        `Eligible members: ${members.length}\n` +
        `This may happen due to lookback of ${wingmanConfig.lookbackWeeks} weeks.`
      );
      return;
    }

    // DRY RUN
    if (isDry) {
      let reply = `**🤝 Wingman Matcher — Dry Run**\n\n`;
      reply += `**Eligible Members:** ${members.length}\n`;
      reply += `**Pairs to Create:** ${pairs.length}\n`;
      reply += `**Unpaired:** ${unpaired.length}\n\n`;

      // Show channel check even on dry
      const pf = preflight.ok ? preflight : await preflightMatchupsChannel(guild);
      reply += `**Channel Check:**\n${formatChannelCheck(pf)}\n\n`;

      reply += `**Preview of Pairs:**\n\n`;
      pairs.slice(0, 5).forEach((pair, i) => {
        if (pair.userC) {
          reply += `${i + 1}. ${pair.userA.user.username}, ${pair.userB.user.username}, ${pair.userC.user.username}\n`;
        } else {
          reply += `${i + 1}. ${pair.userA.user.username} & ${pair.userB.user.username}\n`;
        }
      });

      if (pairs.length > 5) {
        reply += `... and ${pairs.length - 5} more pairs.\n`;
      }

      await safeEdit(interaction, reply);

      logger.info('Wingman dry run executed', {
        adminId: interaction.user.id,
        pairs: pairs.length,
        unpaired: unpaired.length
      });

      return;
    }

    const runKey = wingmanConfig.currentRunKey();

    await safeEdit(
      interaction,
      `⏳ Starting wingman run for **${runKey}**...\n` +
      `Creating ${pairs.length} pairs...`
    );

    // ✅ This is where run_key duplicates used to crash (fixed in WingmanMatcher via UPSERT)
    await executeWingmanRun(interaction.client, services, runKey, new Date());

    const nextRun = wingmanConfig.nextRunDate();

    await safeEdit(
      interaction,
      `✅ **Wingman run completed!**\n\n` +
      `**Run:** ${runKey}\n` +
      `**Pairs Created:** ${pairs.length}\n` +
      `Threads created under <#${wingmanConfig.matchupsChannelId}>\n` +
      `**Next Scheduled:** ${nextRun ? `<t:${Math.floor(nextRun.getTime() / 1000)}:F>` : 'Not scheduled'}`
    );

  } catch (error) {
    logger.error('Failed to run wingman matcher', { error: error.message });
    await safeEdit(interaction, '❌ Failed to execute wingman run.');
  }
}

//
// ───────────────────────────────────────────────
//  /wingman-admin history
// ───────────────────────────────────────────────
//
async function handleHistory(interaction) {
  try {
    const limit = interaction.options.getInteger('limit') || 5;

    const runs = await queryRows(
      `SELECT * FROM wingman_runs
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    if (runs.length === 0) {
      await safeEdit(interaction, 'No wingman runs found in history.');
      return;
    }

    let reply = `**🤝 Wingman Run History** (last ${limit})\n\n`;

    for (const run of runs) {
      const stats = run.stats || {};
      const executedTime = run.executed_at
        ? `<t:${Math.floor(new Date(run.executed_at).getTime() / 1000)}:R>`
        : 'Not executed';

      reply += `**${run.run_key}**\n`;
      reply += `Executed: ${executedTime}\n`;
      reply += `Pairs: ${stats.pairs_count || 0} | `;
      reply += `Eligible: ${stats.eligible_count || 0} | `;
      reply += `Unpaired: ${stats.unpaired_count || 0}\n`;

      if (run.matchups_message_id) {
        reply += `Summary: https://discord.com/channels/${interaction.guildId}/${wingmanConfig.matchupsChannelId}/${run.matchups_message_id}\n`;
      }

      reply += `\n`;
    }

    await safeEdit(interaction, reply);

  } catch (error) {
    logger.error('Failed to get history', { error: error.message });
    await safeEdit(interaction, '❌ Failed to retrieve history.');
  }
}

//
// ───────────────────────────────────────────────
//  /wingman-admin config
// ───────────────────────────────────────────────
//
async function handleConfig(interaction) {
  try {
    const cfg = wingmanConfig.toJSON();
    const nextRun = wingmanConfig.nextRunDate();

    let reply = `**🤝 Wingman Matcher Configuration**\n\n`;
    reply += `**Status:** ${cfg.enabled ? '✅ Enabled' : '❌ Disabled'}\n`;
    reply += `**Matchups Channel:** ${
      cfg.matchupsChannelId !== 'NOT_SET'
        ? `<#${cfg.matchupsChannelId}>`
        : 'NOT_SET'
    }\n\n`;

    reply += `**Schedule:**\n`;
    reply += `Day: ${cfg.schedule}\n`;
    reply += `Timezone: ${cfg.tz}\n`;
    reply += `Next Run: ${
      nextRun ? `<t:${Math.floor(nextRun.getTime() / 1000)}:F>` : 'Not scheduled'
    }\n\n`;

    reply += `**Pairing Rules:**\n`;
    reply += `Lookback: ${cfg.lookbackWeeks} weeks\n`;
    reply += `Odd Mode: ${cfg.oddMode}\n`;
    reply += `Cross-Faction: ${cfg.preferCrossFaction ? 'Yes' : 'No'}\n\n`;

    reply += `**Eligibility:**\n`;
    reply += `Role Filter: ${
      cfg.eligibleRoleId !== 'ANY' ? `<@&${cfg.eligibleRoleId}>` : 'Any member'
    }\n`;
    reply += `Min Level: ${cfg.minLevel}\n`;

    await safeEdit(interaction, reply);

  } catch (error) {
    logger.error('Failed to show config', { error: error.message });
    await safeEdit(interaction, '❌ Failed to retrieve config.');
  }
}
