/**
 * Leaderboard Command (V2-style UI)
 * - Faction War block at top (field)
 * - Users displayed as 3-column inline fields (like old bot)
 * - Top 3 special formatting
 * - Shows: % line + bar + "XP • Archetype %"
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const { createLogger } = require('../../utils/logger');
const { fail, throttled } = require('../../utils/plainTextReplies');

const logger = createLogger('LeaderboardCommand');

const COLOR = 0xFF1E27;

// v2 layout safety (25 fields max, plus spacers)
const USERS_PER_PAGE = 20;
const MAX_FIELDS = 25;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View leaderboards by XP or specific stat with time ranges')
    .addStringOption(opt =>
      opt.setName('range')
        .setDescription('Time range')
        .addChoices(
          { name: 'All-Time (default)', value: 'all' },
          { name: 'This Week', value: 'week' },
          { name: 'This Month', value: 'month' }
        )
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('stat')
        .setDescription('Specific stat (e.g., Approaches, Numbers)')
        .setRequired(false)
    )
    .addIntegerOption(opt =>
      opt.setName('page')
        .setDescription('Page number (default: 1)')
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false)
    )
    .addIntegerOption(opt =>
      opt.setName('limit')
        .setDescription('Results per page (default: 10, max: 25)')
        .setMinValue(5)
        .setMaxValue(25)
        .setRequired(false)
    ),

  async execute(interaction, services) {
    try {
      if (services?.rateLimiter?.isRateLimited(interaction.user.id, 'leaderboard')) {
        await interaction.reply({ content: throttled(), flags: 1 << 6 });
        return;
      }

      // Defer visible
      try {
        if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
      } catch (err) {
        const msg = err?.message || '';
        const code = err?.code;
        if (
          code === 10062 ||
          code === 40060 ||
          msg.includes('Unknown interaction') ||
          msg.includes('already been acknowledged')
        ) return;
        throw err;
      }

      const range = interaction.options.getString('range') || 'all';
      const statKey = interaction.options.getString('stat');
      const page = interaction.options.getInteger('page') || 1;

      const requestedLimit = interaction.options.getInteger('limit') || USERS_PER_PAGE;
      const shownLimit = Math.min(requestedLimit, USERS_PER_PAGE);
      const offset = (page - 1) * requestedLimit;

      if (!services?.leaderboardService) {
        await interaction.editReply(fail('Leaderboard service not available'));
        return;
      }

      const result = statKey
        ? await services.leaderboardService.getStatLeaderboard(statKey, { range, limit: requestedLimit, offset })
        : await services.leaderboardService.getXPLeaderboard({ range, limit: requestedLimit, offset });

      if (!result?.success) {
        await interaction.editReply(fail(result?.error || 'Failed to load leaderboard.'));
        return;
      }

      const raw = Array.isArray(result.leaderboard) ? result.leaderboard : [];

      // ✅ EMPTY STATE (true empty)
      if (raw.length === 0) {
        await renderEmptyLeaderboard(interaction, {
          range,
          page,
          statKey,
          requestedLimit
        });
        return;
      }

      const prettyRange = humanizeRange(result.range || range);
      const shown = raw.slice(0, shownLimit);

      // Resolve display names
      const guild = interaction.guild;
      const entries = [];
      for (const entry of shown) {
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

        entries.push({ ...entry, userId, displayName });
      }

      // ✅ If all values are 0 (ghost user after reset), treat as empty
      const valuesForZeroCheck = entries.map(e => {
        const xp = Number(e.xp || 0);
        const statVal = Number(e.statTotal || 0);
        return statKey ? statVal : xp;
      });
      const allZeros = valuesForZeroCheck.length > 0 && valuesForZeroCheck.every(v => Number(v) <= 0);

      if (allZeros) {
        await renderEmptyLeaderboard(interaction, {
          range,
          page,
          statKey,
          requestedLimit
        });
        return;
      }

      // Fallback for bars if service doesn't provide per-user progress
      const maxValue = statKey
        ? Math.max(...entries.map(e => Number(e.statTotal || 0)), 1)
        : Math.max(...entries.map(e => Number(e.xp || 0)), 1);

      const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle('🏆 LEADERBOARD - TOP PERFORMERS')
        .setTimestamp();

      // Branding
      try {
        const config = require('../../config/settings');
        if (config?.branding?.logoUrl) embed.setThumbnail(config.branding.logoUrl);
        if (config?.branding?.name) embed.setFooter({ text: config.branding.name, iconURL: config.branding.logoUrl || null });
      } catch {}

      embed.setDescription(
        `Range: **${prettyRange}** • Page: **${page}**` +
        `${statKey ? ` • Stat: **${result.stat || statKey}**` : ''}`
      );

      // FACTION WAR (prefer global from service)
      const factionWarText = formatFactionWar({
        factionStats: result.factionStats,
        fallbackTotals: sumFactionTotalsFromShown(entries, statKey),
      });

      if (factionWarText) {
        embed.addFields({ name: '⚔️ FACTION WAR', value: factionWarText, inline: false });
      }

      let fieldCount = embed.data.fields?.length || 0;

      for (let i = 0; i < entries.length; i++) {
        if (fieldCount >= MAX_FIELDS) break;

        const e = entries[i];
        const rank = Number(e.rank ?? (offset + i + 1));
        const xp = Number(e.xp || 0);
        const statVal = Number(e.statTotal || 0);
        const baseVal = statKey ? statVal : xp;

        const { factionShort } = factionMeta(e.faction);

        // progress ratio:
        // 1) use e.progress (0..1) if present
        // 2) else fallback against max value
        const ratio = Number.isFinite(Number(e.progress))
          ? clamp01(Number(e.progress))
          : clamp01(baseVal / maxValue);

        const pct = Math.round(ratio * 100);
        const bar = prettyBar(ratio, 12);

        const level = e.level ?? '?';

        const archetypeLabel = e.archetypeLabel || null;
        const archetypePct = Number.isFinite(Number(e.archetypePct)) ? Number(e.archetypePct) : null;

        const archetypeText =
          archetypeLabel
            ? ` • **${archetypeLabel}**${archetypePct != null ? ` ${archetypePct.toFixed(1)}%` : ''}`
            : '';

        const prestigeIndicator = Number(e.prestige || 0) > 0 ? ` ★x${Number(e.prestige)}` : '';
        const displayName = e.displayName || 'Unknown User';

        const nameField =
          rank <= 3
            ? `${rankTag(rank)} **${displayName}**${prestigeIndicator}\n${factionShort} Lv${level}`
            : `${rankTag(rank)} ${displayName}${prestigeIndicator}\n${factionShort} Lv${level}`;

        const mainLabel = statKey ? (result.stat || statKey) : 'XP';

        const valueField =
          `**${pct}%**\n` +
          `${bar}\n` +
          `**${Number(baseVal).toLocaleString()}** ${mainLabel}${archetypeText}`;

        embed.addFields({ name: nameField, value: valueField, inline: true });
        fieldCount++;

        if ((i + 1) % 3 === 0 && i < entries.length - 1 && fieldCount < MAX_FIELDS) {
          embed.addFields({ name: '\u200b', value: '\u200b', inline: false });
          fieldCount++;
        }
      }

      const refreshButton = new ButtonBuilder()
        .setCustomId(`refresh-leaderboard:${range}:${page}:${encodeURIComponent(statKey || 'xp')}:${requestedLimit}`)
        .setLabel('🔄 Refresh')
        .setStyle(ButtonStyle.Primary);

      const scorecardButton = new ButtonBuilder()
        .setCustomId('view-my-scorecard')
        .setLabel('📊 My Scorecard')
        .setStyle(ButtonStyle.Secondary);

      const buttonRow = new ActionRowBuilder().addComponents(refreshButton, scorecardButton);

      await interaction.editReply({ embeds: [embed], components: [buttonRow] });

      logger.info('Leaderboard displayed', {
        userId: interaction.user.id,
        range,
        stat: statKey,
        page,
        shown: entries.length,
      });

    } catch (error) {
      const msg = error?.message || '';
      const code = error?.code;

      if (
        code === 10062 ||
        code === 40060 ||
        msg.includes('Unknown interaction') ||
        msg.includes('already been acknowledged')
      ) return;

      logger.error('Failed to show leaderboard', { error: msg });

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(fail('Failed to load leaderboard. Please try again.'));
        } else {
          await interaction.reply({ content: fail('Failed to load leaderboard. Please try again.'), flags: 1 << 6 });
        }
      } catch {}
    }
  },
};

/* ---------------- Empty State Renderer ---------------- */

async function renderEmptyLeaderboard(interaction, { range, page, statKey, requestedLimit }) {
  const prettyRange = humanizeRange(range);

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle('🏆 LEADERBOARD - TOP PERFORMERS')
    .setTimestamp();

  // Branding (keep consistent)
  try {
    const config = require('../../config/settings');
    if (config?.branding?.logoUrl) embed.setThumbnail(config.branding.logoUrl);
    if (config?.branding?.name) embed.setFooter({ text: config.branding.name, iconURL: config.branding.logoUrl || null });
  } catch {}

  embed.setDescription(
    `Range: **${prettyRange}** • Page: **${page}**` +
    `${statKey ? ` • Stat: **${statKey}**` : ''}`
  );

  embed.addFields({
    name: 'No data yet',
    value: '👑 **Be the first to Submit Stats to rule.**',
    inline: false,
  });

  const refreshButton = new ButtonBuilder()
    .setCustomId(`refresh-leaderboard:${range}:${page}:${encodeURIComponent(statKey || 'xp')}:${requestedLimit}`)
    .setLabel('🔄 Refresh')
    .setStyle(ButtonStyle.Primary);

  const scorecardButton = new ButtonBuilder()
    .setCustomId('view-my-scorecard')
    .setLabel('📊 My Scorecard')
    .setStyle(ButtonStyle.Secondary);

  const buttonRow = new ActionRowBuilder().addComponents(refreshButton, scorecardButton);

  await interaction.editReply({ embeds: [embed], components: [buttonRow] });
}

/* ---------------- Helpers ---------------- */

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
  if (f === 'luminarchs') return { factionShort: 'CV' }; // como screenshot
  if (f === 'noctivores') return { factionShort: 'BE' }; // como screenshot
  return { factionShort: '??' };
}

function sumFactionTotalsFromShown(entries, statKey) {
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

function formatFactionWar({ factionStats, fallbackTotals }) {
  let lumCount = 0, lumXP = 0, nocCount = 0, nocXP = 0;

  if (factionStats?.luminarchs || factionStats?.noctivores) {
    lumCount = Number(factionStats?.luminarchs?.count || 0);
    lumXP = Number(factionStats?.luminarchs?.totalXP || 0);
    nocCount = Number(factionStats?.noctivores?.count || 0);
    nocXP = Number(factionStats?.noctivores?.totalXP || 0);
  } else if (fallbackTotals) {
    lumCount = Number(fallbackTotals?.luminarchs?.count || 0);
    lumXP = Number(fallbackTotals?.luminarchs?.total || 0);
    nocCount = Number(fallbackTotals?.noctivores?.count || 0);
    nocXP = Number(fallbackTotals?.noctivores?.total || 0);
  }

  let out = '';
  if (lumCount > 0) out += `**LUMINARCHS**: ${lumCount} members, ${lumXP.toLocaleString()} total XP\n`;
  if (nocCount > 0) out += `**NOCTIVORES**: ${nocCount} members, ${nocXP.toLocaleString()} total XP\n`;

  if (lumCount > 0 && nocCount > 0) {
    const leader = lumXP > nocXP ? 'LUMINARCHS' : (nocXP > lumXP ? 'NOCTIVORES' : 'TIE');
    out += `\n👑 **${leader} ARE CURRENTLY WINNING!**`;
  }

  return out.trim();
}
