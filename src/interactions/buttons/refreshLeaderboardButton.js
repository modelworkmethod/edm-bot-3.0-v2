/**
 * Refresh Leaderboard Button
 * - Re-render using the SAME UI as /leaderboard (v2-style fields)
 * - Supports customIds:
 *   1) "refresh-leaderboard" (legacy -> infer from embed if possible)
 *   2) "refresh-leaderboard:<range>:<page>:<stat>:<limit>" (old)
 *   3) "refresh-leaderboard:range=all:stat=xp:page=1:limit=25" (current)
 */

const { createLogger } = require('../../utils/logger');
const { fail } = require('../../utils/plainTextReplies');

// Import the command execute so UI stays identical
const leaderboardCommand = require('../../commands/leaderboard/leaderboard');

const logger = createLogger('RefreshLeaderboardButton');

function clampInt(n, min, max, fallback) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

function inferFromEmbed(interaction) {
  const currentEmbed = interaction.message?.embeds?.[0];
  const desc = String(currentEmbed?.description || '');

  let range = 'all';
  if (/Range:\s*\*\*This Week\*\*/i.test(desc)) range = 'week';
  else if (/Range:\s*\*\*This Month\*\*/i.test(desc)) range = 'month';

  let page = 1;
  const pageMatch = desc.match(/Page:\s*\*\*(\d+)\*\*/i);
  if (pageMatch) page = clampInt(pageMatch[1], 1, 999, 1);

  let stat = null;
  const statMatch = desc.match(/Stat:\s*\*\*(.+?)\*\*/i);
  if (statMatch) {
    const s = String(statMatch[1] || '').trim();
    if (s && s.toLowerCase() !== 'xp') stat = s;
  }

  // Si no sabemos el limit real, usamos 25 (el default del comando)
  const limit = 25;

  return { range, page, stat, limit };
}

function parseRefreshCustomId(customId, interaction) {
  const id = String(customId || '');
  const parts = id.split(':');

  // 3) current style: refresh-leaderboard:range=all:stat=xp:page=1:limit=25
  if (parts[0] === 'refresh-leaderboard' && parts.some(p => p.includes('='))) {
    const kv = {};
    for (const p of parts.slice(1)) {
      const [k, ...rest] = p.split('=');
      if (!k) continue;
      kv[k.trim()] = rest.join('=').trim();
    }

    const range = kv.range || 'all';
    const page = clampInt(kv.page, 1, 999, 1);
    const limit = clampInt(kv.limit, 5, 25, 25);

    const statRaw = kv.stat || 'xp';
    const stat = (statRaw && statRaw !== 'xp') ? decodeURIComponent(statRaw) : null;

    return { range, page, stat, limit };
  }

  // 2) old style: refresh-leaderboard:<range>:<page>:<stat>:<limit>
  if (parts.length >= 5 && parts[0] === 'refresh-leaderboard') {
    const range = parts[1] || 'all';
    const page = clampInt(parts[2], 1, 999, 1);
    const statRaw = parts[3] || 'xp';
    const limit = clampInt(parts[4], 5, 25, 25);

    const stat = (statRaw && statRaw !== 'xp') ? decodeURIComponent(statRaw) : null;
    return { range, page, stat, limit };
  }

  // 1) legacy: "refresh-leaderboard"
  if (parts[0] === 'refresh-leaderboard') {
    // intenta inferir del embed actual para mantener el mismo range/page/stat
    return inferFromEmbed(interaction);
  }

  // fallback ultra seguro
  return { range: 'all', page: 1, stat: null, limit: 25 };
}

module.exports = {
  async execute(interaction, services) {
    try {
      // For buttons, best UX is deferUpdate to keep same message
      try {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferUpdate();
        }
      } catch {}

      const parsed = parseRefreshCustomId(interaction.customId, interaction);

      // Build a minimal "options-like" shim so we can reuse /leaderboard execute()
      const originalOptions = interaction.options;

      interaction.options = {
        getString: (name) => {
          if (name === 'range') return parsed.range;
          if (name === 'stat') return parsed.stat;
          return null;
        },
        getInteger: (name) => {
          if (name === 'page') return parsed.page;
          if (name === 'limit') return parsed.limit;
          return null;
        },
      };

      // Reuse the same command renderer (same UI)
      await leaderboardCommand.execute(interaction, services);

      // restore
      interaction.options = originalOptions;
    } catch (err) {
      logger.error('Refresh leaderboard failed', { error: err?.message || String(err) });

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({
            content: fail('Failed to refresh leaderboard.'),
            embeds: [],
            components: [],
          }).catch(() => {});
        } else {
          await interaction.reply({
            content: fail('Failed to refresh leaderboard.'),
            flags: 1 << 6,
          }).catch(() => {});
        }
      } catch {}
    }
  }
};
