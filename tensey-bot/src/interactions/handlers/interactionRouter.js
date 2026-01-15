/**
 * Interaction Router (Tensey Bot)
 * Handles:
 * - /tenseylist (full checklist UI)
 * - /tenseyleaderboard (top 10)
 * - open-checklist (persistent button)
 * - refresh-tensey-checklist (refresh button)
 * - checklist_* buttons (toggle/nav/page/level/undo/info)
 * - tensey_open_lists (persistent button)  ✅
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/sqlite');
const logger = require('../../utils/logger');

// ✅ Full checklist UI builder (used by /tenseylist)
const ChecklistEmbedBuilder = require('../../embeds/ChecklistEmbedBuilder');

// ✅ Real progress service (SQLite)
const TenseyProgressService = require('../../services/TenseyProgressService');

// ✅ per-user memory (page for refresh/undo UX)
const LAST_PAGE = new Map(); // userId -> page

async function safeDeferEphemeral(interaction) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }
    return true;
  } catch (e) {
    logger.warn('safeDeferEphemeral failed (already acknowledged?)', {
      error: e?.message,
      code: e?.code,
      customId: interaction.customId,
    });
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Summary checklist (open-checklist) – existing embed
───────────────────────────────────────────────────────────────────────────── */

function buildChecklistEmbed(userId, stats) {
  const {
    completedChallenges = 0,
    completedCountSum = 0,
    totalRows = 0,
    progressPct = 0,
    xpEarned = 0,
  } = stats;

  const embed = new EmbedBuilder()
    .setTitle('🔥 Your Tensey Checklist')
    .setDescription('Your personal progress in the Social Freedom Exercises.')
    .setColor(0xff3b30)
    .setTimestamp();

  embed.addFields(
    { name: '✅ Challenges Completed', value: `**${completedChallenges.toLocaleString()}**`, inline: true },
    { name: '📦 Total Progress Entries', value: `**${totalRows.toLocaleString()}**`, inline: true },
    { name: '📈 Completion %', value: `**${progressPct}%**`, inline: true },
    { name: '⚡ XP Earned (Tensey)', value: `**${xpEarned.toLocaleString()} XP**`, inline: true },
    { name: '🧮 Completed Count Sum', value: `**${completedCountSum.toLocaleString()}**`, inline: true },
    {
      name: '\u200b',
      value:
        `Use \`/tenseyleaderboard\` to see who’s on top.\n` +
        `Use \`/tenseylist\` to browse the full checklist.`,
      inline: false,
    }
  );

  embed.setFooter({ text: `User: ${userId}` });
  return embed;
}

function buildChecklistButtons(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`refresh-tensey-checklist:${userId}`)
      .setLabel('🔄 Refresh')
      .setStyle(ButtonStyle.Primary)
  );
}

function queryUserChecklistStats(userId) {
  const stmt = db.get().prepare(`
    SELECT
      SUM(CASE WHEN completed_count > 0 THEN 1 ELSE 0 END) AS completed_challenges,
      COALESCE(SUM(completed_count), 0) AS completed_count_sum,
      COUNT(*) AS total_rows
    FROM user_progress
    WHERE user_id = ?
  `);

  const row = stmt.get(userId) || {};
  const completedChallenges = Number(row.completed_challenges || 0);
  const completedCountSum = Number(row.completed_count_sum || 0);
  const totalRows = Number(row.total_rows || 0);

  const TOTAL_CHALLENGES = 567;
  const progressPct = Math.max(0, Math.min(100, Math.round((completedChallenges / TOTAL_CHALLENGES) * 100)));

  const xpEarned = completedChallenges * 100;

  return { completedChallenges, completedCountSum, totalRows, progressPct, xpEarned };
}

async function renderChecklist(interaction, userId, useFollowUp = false) {
  const stats = queryUserChecklistStats(userId);
  const embed = buildChecklistEmbed(userId, stats);
  const row = buildChecklistButtons(userId);

  if (useFollowUp) {
    await interaction.followUp({ embeds: [embed], components: [row], ephemeral: true }).catch(() => {});
    return;
  }

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ embeds: [embed], components: [row] });
    return;
  }

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

/* ─────────────────────────────────────────────────────────────────────────────
   Full checklist UI handlers (checklist_* from ChecklistEmbedBuilder)
───────────────────────────────────────────────────────────────────────────── */

function parseToggle(customId) {
  const m = String(customId).match(/^checklist_toggle_P(\d+)_C(\d+)$/);
  if (!m) return null;
  return { page: Number(m[1]), i: Number(m[2]) };
}

function parseNav(customId) {
  const prev = String(customId).match(/^checklist_nav_prev_(\d+)$/);
  if (prev) return { type: 'prev', page: Number(prev[1]) };

  const next = String(customId).match(/^checklist_nav_next_(\d+)$/);
  if (next) return { type: 'next', page: Number(next[1]) };

  const page = String(customId).match(/^checklist_page_(\d+)$/);
  if (page) return { type: 'page', page: Number(page[1]) };

  const level = String(customId).match(/^checklist_level_(\d+)$/);
  if (level) return { type: 'level', level: Number(level[1]) };

  return null;
}

function normalizeCompletedIndices(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v >= 0);
}

async function renderFullChecklist(interaction, userId, page) {
  const completed = await TenseyProgressService.getUserProgress(userId);
  const completedIndices = normalizeCompletedIndices(completed);

  const safePage = Number.isFinite(page) ? Math.max(0, Math.min(56, Number(page))) : 0;
  const { embed, components } = ChecklistEmbedBuilder.build(safePage, completedIndices);

  await interaction.editReply({
    embeds: [embed],
    components: components || [],
  });
}

async function handleSlashTenseyList(interaction) {
  await safeDeferEphemeral(interaction);

  const userId = interaction.user.id;

  const pageOpt =
    interaction.options?.getInteger?.('page') ??
    interaction.options?.getNumber?.('page') ??
    0;

  const page = Number(pageOpt) || 0;
  LAST_PAGE.set(userId, Math.max(0, Math.min(56, page)));

  await renderFullChecklist(interaction, userId, page);
}

async function handleSlashTenseyLeaderboard(interaction) {
  await safeDeferEphemeral(interaction);

  const stmt = db.get().prepare(`
    SELECT
      user_id,
      SUM(CASE WHEN completed_count > 0 THEN 1 ELSE 0 END) AS completed
    FROM user_progress
    GROUP BY user_id
    ORDER BY completed DESC
    LIMIT 10
  `);

  const rows = stmt.all() || [];

  const lines = rows.length
    ? rows.map((r, idx) => `**${idx + 1}.** <@${r.user_id}> — **${Number(r.completed || 0)}** ✅`).join('\n')
    : 'No data yet. Start completing challenges with **/tenseylist**.';

  const embed = new EmbedBuilder()
    .setTitle('🏆 Tensey Leaderboard')
    .setDescription(lines)
    .setColor(0xff3b30)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

/**
 * ✅ Return true when handled, false when not
 */
async function route(interaction) {
  try {
    // ─────────────────────────────────────────────────────────────────────────
    // ✅ SLASH COMMANDS
    // ─────────────────────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand && interaction.isChatInputCommand()) {
      const name = interaction.commandName;

      if (name === 'tenseylist' || name === 'tensey-list') {
        await handleSlashTenseyList(interaction);
        return true;
      }

      if (name === 'tenseyleaderboard' || name === 'tensey-leaderboard') {
        await handleSlashTenseyLeaderboard(interaction);
        return true;
      }

      return false;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ✅ tensey_open_lists (persistent button)  ✅ FIXED (was outside route)
    // ─────────────────────────────────────────────────────────────────────────
    if (interaction.isButton && interaction.isButton() && interaction.customId === 'tensey_open_lists') {
      const ok = await safeDeferEphemeral(interaction);
      if (!ok) return true;

      const userId = interaction.user.id;

      // Abre la UI completa (página 0)
      LAST_PAGE.set(userId, 0);
      await renderFullChecklist(interaction, userId, 0);

      return true;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ✅ checklist_* buttons
    // ─────────────────────────────────────────────────────────────────────────
    if (interaction.isButton() && String(interaction.customId || '').startsWith('checklist_')) {
      try {
        await interaction.deferUpdate();
      } catch {}

      const userId = interaction.user.id;
      const id = String(interaction.customId || '');

      // TOGGLE -> markComplete
      const toggle = parseToggle(id);
      if (toggle) {
        const page = toggle.page;
        const globalIdx = (page * 10) + toggle.i; // 0-based
        LAST_PAGE.set(userId, page);

        const ok = await TenseyProgressService.markComplete(userId, globalIdx);
        if (!ok) {
          await interaction.followUp({
            content: '❌ Could not mark challenge complete (check logs).',
            ephemeral: true,
          }).catch(() => {});
          return true;
        }

        await renderFullChecklist(interaction, userId, page);
        return true;
      }

      // UNDO last completion
      if (id === 'checklist_undo') {
        const undone = await TenseyProgressService.undoLastCompletion(userId);

        if (!undone) {
          await interaction.followUp({ content: 'ℹ️ Nothing to undo yet.', ephemeral: true }).catch(() => {});
          return true;
        }

        const page = LAST_PAGE.get(userId) ?? 0;
        await renderFullChecklist(interaction, userId, page);

        await interaction.followUp({
          content: `↩️ Undid completion for challenge #${Number(undone.challengeIdx) + 1}.`,
          ephemeral: true,
        }).catch(() => {});
        return true;
      }

      // INFO
      if (id.startsWith('checklist_info_L')) {
        await interaction.followUp({
          content:
            'ℹ️ **How it works**\n' +
            '• Click numbers to complete a challenge\n' +
            '• Completed buttons lock (use UNDO)\n' +
            '• Use Prev/Next to navigate\n' +
            '• Jump levels with L buttons',
          ephemeral: true,
        }).catch(() => {});
        return true;
      }

      // NAV / PAGE / LEVEL
      const nav = parseNav(id);
      if (nav) {
        let page = 0;

        if (nav.type === 'prev') page = Math.max(0, nav.page - 1);
        else if (nav.type === 'next') page = Math.min(56, nav.page + 1);
        else if (nav.type === 'page') page = Math.max(0, Math.min(56, nav.page));
        else if (nav.type === 'level') {
          const ranges = { 1: 0, 2: 5, 3: 12, 4: 20, 5: 30, 6: 40, 7: 50 };
          page = ranges[nav.level] ?? 0;
        }

        LAST_PAGE.set(userId, page);
        await renderFullChecklist(interaction, userId, page);
        return true;
      }

      return true;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // open-checklist (summary)
    // ─────────────────────────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId === 'open-checklist') {
      const ok = await safeDeferEphemeral(interaction);

      if (!ok) {
        await renderChecklist(interaction, interaction.user.id, true);
        return true;
      }

      await renderChecklist(interaction, interaction.user.id, false);
      return true;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // refresh summary checklist
    // ─────────────────────────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('refresh-tensey-checklist:')) {
      try {
        await interaction.deferUpdate();
      } catch {}

      const parts = interaction.customId.split(':');
      const targetUserId = parts[1];

      if (targetUserId && targetUserId !== interaction.user.id) {
        await interaction.followUp({ content: '❌ This checklist is not yours.', ephemeral: true }).catch(() => {});
        return true;
      }

      const userId = interaction.user.id;
      const stats = queryUserChecklistStats(userId);
      const embed = buildChecklistEmbed(userId, stats);
      const row = buildChecklistButtons(userId);

      try {
        await interaction.editReply({ embeds: [embed], components: [row] });
      } catch {
        await interaction.followUp({ embeds: [embed], components: [row], ephemeral: true }).catch(() => {});
      }

      return true;
    }

    return false;
  } catch (err) {
    logger.error('InteractionRouter.route failed', { error: err?.message, stack: err?.stack });

    try {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Error processing interaction.', ephemeral: true });
      } else {
        await interaction.followUp({ content: '❌ Error processing interaction.', ephemeral: true }).catch(() => {});
      }
    } catch {}

    return true;
  }
}

module.exports = { route };
