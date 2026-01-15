/**
 * Execute Wingmen Command
 * Admin-only command to run weekly wingman pairing immediately
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const config = require('../../config/settings');
const wingmanConfig = require('../../config/wingmanConfig');
const { queryRow } = require('../../database/postgres');
const WingmanMatcher = require('../../services/wingman/WingmanMatcher');

const logger = createLogger('ExecuteWingmenCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('execute-wingmen')
    .setDescription('Run wingman pairing now (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption(opt =>
      opt.setName('force')
        .setDescription('Run even if this week already ran')
        .setRequired(false)
    ),

  async execute(interaction, services) {
    // Must be enabled
    if (!wingmanConfig.enabled) {
      await interaction.reply({
        content: '⚠️ Wingman Matcher is disabled (WINGMAN_MATCHUPS_CHANNEL_ID not set).',
        flags: 1 << 6
      });
      return;
    }

    const isAdmin =
      interaction.user.id === config.admin.userId ||
      interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

    if (!isAdmin) {
      await interaction.reply({ content: '❌ Admin only.', flags: 1 << 6 });
      return;
    }

    if (!interaction.guild) {
      await interaction.reply({ content: '❌ This command must be used in a server.', flags: 1 << 6 });
      return;
    }

    const force = interaction.options.getBoolean('force') || false;

    try {
      await interaction.deferReply({ flags: 1 << 6 }); // ephemeral

      const runKey = wingmanConfig.currentRunKey();
      const scheduledAt = new Date();

      // Guard: avoid duplicate runs this week (unless force)
      const existingRun = await queryRow(
        `SELECT id, run_key, created_at
         FROM wingman_runs
         WHERE run_key = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [runKey]
      );

      if (existingRun && !force) {
        await interaction.editReply(
          `⚠️ Wingman pairing already ran for **${runKey}**.\n` +
          `Last run: ${new Date(existingRun.created_at).toISOString()}\n\n` +
          `Use \`/execute-wingmen force:true\` to run again (not recommended).`
        );
        return;
      }

      // Services required
      if (!services?.userService) {
        await interaction.editReply('❌ userService not available in services container.');
        return;
      }

      const matcher = new WingmanMatcher(services.userService);

      // Eligible + build pairs
      const members = await matcher.getEligibleMembers(interaction.guild);

      if (!members || members.length < 2) {
        await interaction.editReply(`ℹ️ Not enough eligible members to pair. Eligible count: **${members?.length || 0}**`);
        return;
      }

      const { pairs, unpaired } = await matcher.buildPairs(members);

      if (!pairs || pairs.length === 0) {
        await interaction.editReply(
          `ℹ️ No valid pairs could be created (repeat-avoidance may be too strict).\n` +
          `Eligible: ${members.length} • Unpaired: ${unpaired.length}\n\n` +
          `Tip: lower WINGMAN_LOOKBACK_WEEKS or use force if you really must rerun.`
        );
        return;
      }

      // Create run + persist pairs
      const run = await matcher.createRun(runKey, scheduledAt);
      await matcher.persistPairs(run.id, pairs);

      // Create threads (this is the most failure-prone step)
      const threadResults = await matcher.createPrivateThreads(interaction.guild, run.id, pairs);

      // Weekly summary in matchups channel
      const summaryMessage = await matcher.postWeeklySummary(interaction.guild, run.id, pairs, threadResults);

      // Announce in general (optional)
      await matcher.announceInGeneral(interaction.guild, run.id, pairs, summaryMessage);

      // DM participants (optional, kept ON by default)
      await matcher.dmParticipants(interaction.guild, pairs, threadResults);

      // Admin summary
      const okResults = threadResults.filter(r => r.success);
      const failResults = threadResults.filter(r => !r.success);

      const embed = new EmbedBuilder()
        .setColor(0x00D4AA)
        .setTitle(`🤝 Wingman pairing executed — ${runKey}`)
        .setDescription(
          [
            'Run completed.',
            summaryMessage?.url ? `Summary: ${summaryMessage.url}` : null
          ].filter(Boolean).join('\n')
        )
        .addFields(
          { name: 'Eligible Members', value: `${members.length}`, inline: true },
          { name: 'Pairs Created', value: `${pairs.length}`, inline: true },
          { name: 'Threads OK', value: `${okResults.length}`, inline: true },
          { name: 'Threads Failed', value: `${failResults.length}`, inline: true },
          { name: 'Unpaired', value: `${unpaired.length}`, inline: true }
        )
        .setFooter({ text: 'Wingman system' })
        .setTimestamp(new Date());

      // If there were failures, show first 3 errors to admin (helps debugging fast)
      if (failResults.length > 0) {
        const sample = failResults
          .slice(0, 3)
          .map(r => {
            const a = r.pair?.userA?.user?.username || 'A';
            const b = r.pair?.userB?.user?.username || 'B';
            return `• ${a} & ${b}: ${r.error || 'Unknown error'}`;
          })
          .join('\n');

        embed.addFields({
          name: '⚠️ Failure samples',
          value: sample,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

      logger.info('Wingmen pairing executed', {
        adminId: interaction.user.id,
        runKey,
        runId: run.id,
        eligible: members.length,
        pairs: pairs.length,
        okCount: okResults.length,
        failCount: failResults.length,
        unpaired: unpaired.length
      });

    } catch (error) {
      logger.error('ExecuteWingmenCommand failed', { error: error.message, stack: error.stack });
      try {
        await interaction.editReply('❌ Failed to execute wingman pairing. Check logs.');
      } catch {}
    }
  }
};
