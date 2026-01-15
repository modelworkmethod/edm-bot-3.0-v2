/**
 * Stats Edit Command
 * Edit past stats with audit logging
 *
 * Modes:
 * 1) Patch mode (legacy): /stats-edit date:YYYY-MM-DD patch:"Approaches=5"
 * 2) UI mode (new):      /stats-edit date:YYYY-MM-DD (no patch) -> shows embed + select menus
 * 3) ✅ Date picker mode: /stats-edit (no date, no patch) -> shows select with last 7 days
 */

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const { createLogger } = require('../../utils/logger');
const { adminOnly, serviceUnavailable, ok, fail } = require('../../utils/plainTextReplies');

const logger = createLogger('StatsEditCommand');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * ✅ Safe admin checker (does NOT assume permissionGuard.isAdmin is a function)
 */
function isAdminUser(interaction, services) {
  const envAdminId = process.env.ADMIN_USER_ID;
  if (envAdminId && interaction.user?.id === envAdminId) return true;

  const pg = services?.permissionGuard;

  if (typeof pg?.isAdmin === 'function') {
    try { return !!pg.isAdmin(interaction.user.id); } catch {}
  }
  if (typeof pg?.isAdminUser === 'function') {
    try { return !!pg.isAdminUser(interaction.user.id); } catch {}
  }
  if (typeof pg?.hasAdminAccess === 'function') {
    try { return !!pg.hasAdminAccess(interaction.user.id); } catch {}
  }

  if (typeof pg?.isAdmin === 'boolean') return pg.isAdmin;

  if (Array.isArray(pg?.adminIds)) return pg.adminIds.includes(interaction.user.id);
  if (pg?.adminIds && typeof pg.adminIds.has === 'function') return pg.adminIds.has(interaction.user.id);

  try {
    return !!interaction.member?.permissions?.has?.('Administrator');
  } catch {
    return false;
  }
}

/**
 * ✅ Last N days as YYYY-MM-DD (UTC-based; consistent with ISO storage)
 */
function getLastNDaysYMD(n = 7) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats-edit')
    .setDescription('Edit past stats (within 7 days unless admin)')
    // ✅ NOW OPTIONAL (date picker mode if omitted)
    .addStringOption(opt =>
      opt.setName('date')
        .setDescription('Date to edit (YYYY-MM-DD)')
        .setRequired(false)
    )
    // ✅ NOW OPTIONAL (UI mode if omitted)
    .addStringOption(opt =>
      opt.setName('patch')
        .setDescription('Changes (e.g., "Approaches=5, Numbers=2")')
        .setRequired(false)
    )
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to edit (admin-only)')
        .setRequired(false)
    ),

  async execute(interaction, services) {
    try {
      // Rate limit
      if (services.rateLimiter?.isRateLimited(interaction.user.id, 'stats-edit')) {
        await interaction.reply({
          content: '⏱️ Slow down a bit and try again shortly.',
          ephemeral: true
        });
        return;
      }

      await interaction.deferReply({ flags: 1 << 6 });
      await interaction.reply({ content: '...', flags: 1 << 6 });


      const dateInput = interaction.options.getString('date');   // may be null
      const patchInput = interaction.options.getString('patch'); // may be null
      const targetUser = interaction.options.getUser('user');

      // services guard
      if (!services.statsEditService) {
        await interaction.editReply(serviceUnavailable('StatsEdit'));
        return;
      }

      // Permission: editing other user (UI or patch)
      if (targetUser && targetUser.id !== interaction.user.id) {
        if (!isAdminUser(interaction, services)) {
          await interaction.editReply(adminOnly());
          return;
        }
      }

      const userId = targetUser?.id || interaction.user.id;

      // =========================
      // MODE A: PATCH (legacy)
      // =========================
      if (patchInput && patchInput.trim()) {
        // Patch requires date
        if (!dateInput || !dateInput.trim()) {
          await interaction.editReply(fail('Patch mode requires a date. Use: /stats-edit date:YYYY-MM-DD patch:"..."'));
          return;
        }

        if (!DATE_RE.test(dateInput) || Number.isNaN(Date.parse(dateInput))) {
          await interaction.editReply(fail('Invalid date format. Use YYYY-MM-DD'));
          return;
        }

        const parsedPatch = services.statsEditService.parsePatch(patchInput);
        if (!parsedPatch.success) {
          await interaction.editReply(fail(parsedPatch.error));
          return;
        }

        const result = await services.statsEditService.editDay(
          userId,
          dateInput,
          parsedPatch.patch,
          interaction.user.id
        );

        if (!result.success) {
          await interaction.editReply(fail(result.error));
          return;
        }

        const userDisplay = targetUser ? ` for ${targetUser.tag}` : '';
        let reply = ok(`Stats edited${userDisplay}`) + `\n\n`;
        reply += `**Date:** ${dateInput}\n\n`;
        reply += `**Changes:**\n`;

        result.changes.forEach(c => {
          reply += `• ${c.stat}: ${c.before} → ${c.after} (${c.delta >= 0 ? '+' : ''}${c.delta})\n`;
        });

        reply += `\n${result.message}`;

        await interaction.editReply(reply);

        logger.info('Stats edited via command (patch)', {
          editorId: interaction.user.id,
          targetUserId: userId,
          date: dateInput,
          changeCount: result.changes.length
        });

        return;
      }

      // =========================
      // MODE C: DATE PICKER (new)
      // =========================
      if (!dateInput || !dateInput.trim()) {
        const last7 = getLastNDaysYMD(7);

        const embed = new EmbedBuilder()
          .setTitle('📅 Select a date to edit')
          .setDescription(
            [
              targetUser ? `**User:** ${targetUser.tag}` : `**User:** ${interaction.user.tag}`,
              '',
              'Pick a date from the last 7 days:',
            ].join('\n')
          )
          .setColor(0x2b90ff);

        const dateMenu = new StringSelectMenuBuilder()
          // ✅ editorId first to lock who can use it, then target userId
          .setCustomId(`stats_edit_date_pick:${interaction.user.id}:${userId}`)
          .setPlaceholder('Select date (last 7 days)…')
          .addOptions(
            last7.map(d => ({
              label: d,
              value: d,
              description: 'Open edit panel',
            }))
          );

        await interaction.editReply({
          embeds: [embed],
          components: [new ActionRowBuilder().addComponents(dateMenu)],
        });

        logger.info('Stats edit date picker shown', {
          editorId: interaction.user.id,
          targetUserId: userId,
          days: last7.length,
        });

        return;
      }

      // =========================
      // MODE B: UI (existing)
      // =========================
      if (!DATE_RE.test(dateInput) || Number.isNaN(Date.parse(dateInput))) {
        await interaction.editReply(fail('Invalid date format. Use YYYY-MM-DD'));
        return;
      }

      const day = await services.statsEditService.getDay(userId, dateInput);
      if (!day.success) {
        await interaction.editReply(fail(day.error || 'Failed to load day stats'));
        return;
      }

      const stats = day.stats || {};
      const statEntries = Object.entries(stats);

      if (statEntries.length === 0) {
        await interaction.editReply(
          `ℹ️ No stats found for **${dateInput}**${targetUser ? ` for ${targetUser.tag}` : ''}.`
        );
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🛠️ Edit/Delete Stats')
        .setDescription(
          [
            `**Date:** ${dateInput}`,
            targetUser ? `**User:** ${targetUser.tag}` : `**User:** ${interaction.user.tag}`,
            '',
            'Use the menus below:',
            '• **Edit Stat** opens a modal to set a new value.',
            '• **Clear Stat** sets the stat to **0** (with confirmation).',
          ].join('\n')
        )
        .setColor(0x2b90ff);

      for (const [name, value] of statEntries.slice(0, 25)) {
        embed.addFields({ name, value: String(value), inline: true });
      }
      if (statEntries.length > 25) {
        embed.addFields({
          name: '…more',
          value: `Showing first 25 stats. Total: ${statEntries.length}`,
          inline: false
        });
      }

      const options = statEntries
        .slice(0, 25)
        .map(([statName, value]) => ({
          label: statName.length > 100 ? statName.slice(0, 97) + '…' : statName,
          description: `Current: ${value}`,
          value: encodeURIComponent(statName),
        }));

      const editMenu = new StringSelectMenuBuilder()
        .setCustomId(`admin_stats_edit_pick:${userId}:${dateInput}`)
        .setPlaceholder('✏️ Edit stat…')
        .addOptions(options);

      const deleteMenu = new StringSelectMenuBuilder()
        .setCustomId(`admin_stats_clear_pick:${userId}:${dateInput}`)
        .setPlaceholder('🗑️ Clear stat (set to 0)…')
        .addOptions(options);

      const row1 = new ActionRowBuilder().addComponents(editMenu);
      const row2 = new ActionRowBuilder().addComponents(deleteMenu);

      await interaction.editReply({
        embeds: [embed],
        components: [row1, row2],
      });

      logger.info('Stats edit UI shown', {
        editorId: interaction.user.id,
        targetUserId: userId,
        date: dateInput,
        statCount: statEntries.length
      });

    } catch (error) {
      logger.error('Failed to edit stats', { error: error.message });
      try {
        await interaction.editReply(fail('Failed to edit stats. Please try again.'));
      } catch {}
    }
  }
};
