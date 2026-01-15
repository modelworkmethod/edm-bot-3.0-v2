/**
 * refreshLeaderboardButton (V2 UI)
 * CustomId: refresh-leaderboard
 * Rebuilds the leaderboard using the SAME V2-style embed layout.
 */

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const { createLogger } = require('../../utils/logger');
const LeaderboardService = require('../../services/leaderboard/LeaderboardService');

const logger = createLogger('RefreshLeaderboardButton');

const COLOR = 0xFF1E27;         // v2 red
const USERS_PER_PAGE = 20;      // stable v2 layout
const MAX_FIELDS = 25;

// One shared instance (has internal cache)
const leaderboardService = new LeaderboardService();

module.exports = {
  async execute(interaction) {
    try {
      // ✅ Button should ACK by updating same message
      try { await interaction.deferUpdate(); } catch {}

      const currentEmbed = interaction?.message?.embeds?.[0];
      const { range, page, statKey } = parseParamsFromEmbed(currentEmbed);

      const limit = USERS_PER_PAGE; // keep v2 layout stable
      const offset = (page - 1) * limit;

      // Fetch data using the NEW service (postgres)
      const result = statKey
        ? await leaderboardService.getStatLeaderboard(statKey, { range, limit, offset })
        : await leaderboardService.getXPLeaderboard({ range, limit, offset });

      // If refresh hits an empty page, fallback to page 1 automatically
      let rows = Array.isArray(result?.leaderboard) ? result.leaderboard : [];
      let usedPage = page;
      let usedOffset = offset;

      if (!result?.success || rows.length === 0) {
        const fallback = statKey
          ? await leaderboardService.getStatLeaderboard(statKey, { range, limit, offset: 0 })
          : await leaderboardService.getXPLeaderboard({ range, limit, offset: 0 });

        if (!fallback?.success || !Array.isArray(fallback.leaderboard) || fallback.leaderboard.length === 0) {
          await safeEdit(interaction, { content: 'No data found for this range.', embeds: [], components: [] });
          return;
        }

        rows = fallback.leaderboard;
        usedPage = 1;
        usedOffset = 0;
      }

      // Resolve display names
      const guild = interaction.guild;
      const entries = [];
      const shown = rows.slice(0, USERS_PER_PAGE);

      for (let i = 0; i < shown.length; i++) {
        const entry = shown[i];
        const userId = entry.userId || entry.user_id;
        let displayName = entry.username || 'Unknown User';

        if (guild && userId) {
          try {
            const member = await guild.members.fetch(userId);
            displayName =
              member?.displayName ||
              member?.user?.globalName ||
              member?.user?.username ||
              displayName;
          } catch {}
        }

        entries.push({
          ...entry,
          userId,
          displayName,
          rank: Number(entry.rank ?? (usedOffset + i + 1)),
        });
      }

      const prettyRange = humanizeRange(result.range || range);

      // max for bars
      const maxValue = statKey
        ? Math.max(...entries.map(e => Number(e.statTotal || 0)), 1)
        : Math.max(...entries.map(e => Number(e.xp || 0)), 1);

      // faction totals
      const factionTotals = sumFactionTotals(entries, statKey);

      // Build embed (V2 style)
      const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle('🏆 LEADERBOARD - TOP PERFORMERS')
        .setTimestamp();

      // Branding like v2
      try {
        const config = require('../../config/settings');
        if (config?.branding?.logoUrl) embed.setThumbnail(config.branding.logoUrl);
        if (config?.branding?.name) embed.setFooter({ text: config.branding.name, iconURL: config.branding.logoUrl || null });
      } catch {}

      embed.setDescription(
        `Range: **${prettyRange}** • Page: **${usedPage}**${statKey ? ` • Stat: **${result.stat || statKey}**` : ''}`
      );

      // FACTION WAR field
      const factionWarText = formatFactionStatsLikeV2(factionTotals);
      if (factionWarText) {
        embed.addFields({ name: '⚔️ FACTION WAR', value: factionWarText, inline: false });
      }

      // Users (3 columns)
      let fieldCount = embed.data.fields?.length || 0;

      for (let i = 0; i < entries.length; i++) {
        if (fieldCount >= MAX_FIELDS) break;

        const e = entries[i];
        const rank = Number(e.rank ?? (usedOffset + i + 1));
        const xp = Number(e.xp || 0);
        const statVal = Number(e.statTotal || 0);

        const { factionEmoji, factionNameUpper } = factionMeta(e.faction);

        const ratio = Number.isFinite(Number(e.progress))
          ? clamp01(Number(e.progress))
          : clamp01(((statKey ? statVal : xp) / maxValue));

        const bar = prettyBar(ratio, 12);

        const className = e.className || e.class || e.tier || null;
        const level = e.level ?? null;
        const archetypeLabel = e.archetypeLabel || e.archetype || null;
        const archetypePct = Number.isFinite(Number(e.archetypePct)) ? Number(e.archetypePct) : null;

        const prestigeIndicator = Number(e.prestige || 0) > 0 ? ` ★x${Number(e.prestige)}` : '';
        const displayName = e.displayName || 'Unknown User';

        let nameField;
        if (rank <= 3) {
          nameField = `${rankTag(rank)} **${displayName}**${prestigeIndicator}\n${factionEmoji} ${factionNameUpper}${level != null ? ` • Lv${level}` : ''}`;
        } else {
          nameField = `${rankTag(rank)} ${displayName}${prestigeIndicator}\n${factionEmoji} ${factionNameUpper}`;
        }

        const mainNumber = statKey ? statVal : xp;
        const mainLabel = statKey ? (result.stat || statKey) : 'XP';

        const archetypeText =
          archetypeLabel
            ? ` • **${archetypeLabel}**${archetypePct != null ? ` ${archetypePct.toFixed(1)}%` : ''}`
            : '';

        const classLine =
          (level != null && className)
            ? `**Level ${level}** • ${className}\n`
            : (level != null)
              ? `**Level ${level}**\n`
              : (className ? `${className}\n` : '');

        const valueField =
          (rank <= 3)
            ? `${bar}\n**${Number(mainNumber).toLocaleString()}** ${mainLabel}${archetypeText}`
            : `${classLine}${bar}\n**${Number(mainNumber).toLocaleString()}** ${mainLabel}${archetypeText}`;

        embed.addFields({ name: nameField, value: valueField, inline: true });
        fieldCount++;

        // spacing every 3
        if ((i + 1) % 3 === 0 && i < entries.length - 1 && fieldCount < MAX_FIELDS) {
          embed.addFields({ name: '\u200b', value: '\u200b', inline: false });
          fieldCount++;
        }
      }

      // Buttons (keep same IDs)
      const refreshButton = new ButtonBuilder()
        .setCustomId('refresh-leaderboard')
        .setLabel('🔄 Refresh')
        .setStyle(ButtonStyle.Primary);

      const scorecardButton = new ButtonBuilder()
        .setCustomId('view-my-scorecard')
        .setLabel('📊 My Scorecard')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(refreshButton, scorecardButton);

      await safeEdit(interaction, { embeds: [embed], components: [row] });
    } catch (err) {
      logger.error('refresh-leaderboard failed', { error: err?.message || String(err) });
      try { await interaction.followUp({ content: '❌ Failed to refresh leaderboard.', ephemeral: true }).catch(() => {}); } catch {}
    }
  }
};

/* ---------------- small helpers ---------------- */

async function safeEdit(interaction, payload) {
  try {
    await interaction.message.edit(payload);
  } catch {
    try { await interaction.editReply(payload); } catch {}
  }
}

function parseParamsFromEmbed(embed) {
  const desc = String(embed?.description || '');

  let range = 'all';
  if (desc.includes('This Week')) range = 'week';
  else if (desc.includes('This Month')) range = 'month';
  else range = 'all';

  let page = 1;
  const mPage = desc.match(/Page:\s*\*\*(\d+)\*\*/i);
  if (mPage) page = Math.max(1, Number(mPage[1]) || 1);

  let statKey = null;
  const mStat = desc.match(/Stat:\s*\*\*([^*]+)\*\*/i);
  if (mStat) statKey = String(mStat[1]).trim();

  return { range, page, statKey };
}

function humanizeRange(range) {
  switch (range) {
    case 'week': return 'This Week';
    case 'month': return 'This Month';
    case 'all':
    default: return 'All-Time';
  }
}

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function rankTag(rank) {
  const n = Number(rank);
  if (n === 1) return '🥇';
  if (n === 2) return '🥈';
  if (n === 3) return '🥉';
  if (!Number.isFinite(n)) return '#?';
  return `#${n}`;
}

function prettyBar(progress01, size = 12) {
  const p = clamp01(progress01);
  const filled = Math.round(p * size);
  const empty = size - filled;
  return `${'▰'.repeat(filled)}${'▱'.repeat(empty)}`;
}

function factionMeta(faction) {
  const f = String(faction || '').toLowerCase();
  if (f === 'luminarchs') return { factionEmoji: '🦸', factionNameUpper: 'LUMINARCHS' };
  if (f === 'noctivores') return { factionEmoji: '🥷', factionNameUpper: 'NOCTIVORES' };
  return { factionEmoji: '❔', factionNameUpper: 'NO FACTION' };
}

function sumFactionTotals(entries, statKey) {
  const totals = {
    luminarchs: { count: 0, total: 0 },
    noctivores: { count: 0, total: 0 },
  };

  for (const e of entries) {
    const val = statKey ? Number(e.statTotal || 0) : Number(e.xp || 0);
    const f = String(e.faction || '').toLowerCase();
    if (f === 'luminarchs') {
      totals.luminarchs.count += 1;
      totals.luminarchs.total += val;
    } else if (f === 'noctivores') {
      totals.noctivores.count += 1;
      totals.noctivores.total += val;
    }
  }
  return totals;
}

function formatFactionStatsLikeV2(totals) {
  const lum = totals?.luminarchs;
  const noc = totals?.noctivores;

  let out = '';
  if (lum?.count > 0) out += `**LUMINARCHS**: ${lum.count} members, ${Number(lum.total).toLocaleString()} total XP\n`;
  if (noc?.count > 0) out += `**NOCTIVORES**: ${noc.count} members, ${Number(noc.total).toLocaleString()} total XP\n`;

  if ((lum?.count || 0) > 0 && (noc?.count || 0) > 0) {
    const leader = (lum.total > noc.total) ? 'LUMINARCHS' : (noc.total > lum.total) ? 'NOCTIVORES' : 'TIE';
    out += `\n👑 **${leader} ARE CURRENTLY WINNING!**`;
  }

  return out.trim();
}
