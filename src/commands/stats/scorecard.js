/**
 * Scorecard Command
 * Comprehensive player stats with K/D ratios and comparison mode
 *
 * Update:
 * - Visible/static like /leaderboard (no ephemeral)
 * - NO Refresh button (removed)
 * - Uses queryRows from postgres helper
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const { createLogger } = require('../../utils/logger');
const { getLocalDayString } = require('../../utils/timeUtils');
const config = require('../../config/settings');
const { getArchetypeIcon } = require('../../utils/archetypeVisuals');
const { queryRows } = require('../../database/postgres');

const logger = createLogger('ScorecardCommand');

// ===============================
// Auto-refresh scorecards (10 min)
// ===============================
const SCORECARD_TRACK = new Map();
// key: messageId, value: { channelId, guildId, targetUserId, viewerId, lastUpdatedAt }

function trackScorecardMessage(message, { targetUserId, viewerId }) {
  if (!message?.id || !message?.channelId) return;
  SCORECARD_TRACK.set(message.id, {
    channelId: message.channelId,
    guildId: message.guildId || null,
    targetUserId,
    viewerId,
    lastUpdatedAt: Date.now(),
  });
}

/**
 * Call once on bot startup if you want auto refresh
 * - client: discord.js client
 * - services: your DI services object
 */
function startScorecardAutoRefresh(client, services, { intervalMs = 10 * 60 * 1000 } = {}) {
  setInterval(async () => {
    const now = Date.now();

    // limpia scorecards viejos (> 6 horas)
    for (const [messageId, meta] of SCORECARD_TRACK.entries()) {
      if (now - (meta.lastUpdatedAt || 0) > 6 * 60 * 60 * 1000) {
        SCORECARD_TRACK.delete(messageId);
      }
    }

    for (const [messageId, meta] of SCORECARD_TRACK.entries()) {
      try {
        const channel = await client.channels.fetch(meta.channelId).catch(() => null);
        if (!channel || !channel.messages?.fetch) continue;

        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (!msg) {
          SCORECARD_TRACK.delete(messageId);
          continue;
        }

        const today = getLocalDayString();
        const { embed } = await module.exports._buildSoloPayloadForAuto(
          client,
          services,
          meta.targetUserId,
          today,
          meta.viewerId
        );

        await msg.edit({ embeds: [embed], components: [] });

        meta.lastUpdatedAt = Date.now();
        SCORECARD_TRACK.set(messageId, meta);
      } catch {
        // no rompas el loop
      }
    }
  }, intervalMs);
}

// ✅ FALLBACK profile (sin depender de user_daily.data)
async function safeGetProfileLite(services, userId) {
  // 1) Intentar el profile normal
  try {
    const p = await services?.userService?.getUserProfile?.(userId);
    if (p?.user) return p;
  } catch (e) {
    logger.warn('getUserProfile failed, using lite fallback', { userId, error: e?.message });
  }

  // 2) Fallback desde tabla users (si existe)
  let xp = 0;
  let faction = null;

  try {
    const rows = await queryRows(
      `SELECT xp, faction
       FROM users
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    ).catch(() => []);
    const u = rows?.[0];
    if (u) {
      xp = Number(u.xp || 0) || 0;
      faction = u.faction || null;
    }
  } catch (e) {
    logger.warn('Lite fallback users query failed', { userId, error: e?.message });
  }

  // rank best-effort
  let rank = 0;
  try {
    const rows = await queryRows(
      `SELECT 1 + COUNT(*) AS rank
       FROM users
       WHERE xp > $1`,
      [xp]
    ).catch(() => []);
    rank = Number(rows?.[0]?.rank || 0) || 0;
  } catch {}

  // levelInfo best-effort
  let levelInfo = {
    level: 1,
    className: 'Rookie',
    progress: 0,
    currentXP: xp,
    xpForNext: 1000
  };

  try {
    if (services?.levelService?.getLevelInfoFromXP) {
      levelInfo = await services.levelService.getLevelInfoFromXP(xp);
    }
  } catch {}

  return {
    user: { xp, faction },
    rank: rank || 0,
    levelInfo
  };
}

// --- Stat label helpers (we read from user_stats.stat) ---
const STAT_LABELS = {
  // Core Social
  WELCOME_COURAGE: ['Welcome Courage Upon Awakening', 'Welcome Courage', 'Courage Welcoming'],
  HELLOS: ['Hellos To Strangers', 'Hellos', 'Hellos to Strangers'],
  APPROACHES: ['Approaches', 'Apps', 'Approaches (Apps)'],
  NUMBERS: ['Numbers', 'Nums'],
  NEW_CONTACT_RESPONSE: ['New Contact Response', '#s Resp', 'Numbers Response', 'Number Response'],
  CTJ: ['Confidence Tension Journal Entry', 'Confidence-Tension Journal Entry', 'CTJ', 'Journal Entry'],

  // Dating & Results
  DATES_BOOKED: ['Dates Booked'],
  DATES_HAD: ['Dates Had'],
  INSTANT_DATES: ['Instant Date', 'Instant Dates'],
  GOT_LAID: ['Got Laid'],
  SAME_NIGHT_PULL: ['Same Night Pull From Instant Date', 'Same Night Pull'],

  // Inner Work
  SEXY_BASTARD: [
    'Sexy Bastard Morning Meditation',
    'SBMM Meditation',
    'Sexy Bastard',
    'Morning Meditation'
  ],
  GROUNDING: ['Grounding Practice', 'Grounding'],
  RELEASING: ['Releasing Session', 'Releasing'],
  IN_ACTION_RELEASE: ['In Action Release', 'Action Release'],

  // Practice / Auto-ish
  TENSEYS: [
    'Tensey Exercise',
    'Tensey Exercises',
    'Tenseys',
    'Social Freedom Exercises Tenseys',
    'Tensey'
  ],
  WINS_GAINS: ['Wins/Gains Shared', 'Wins & Gains Shared', 'Wins Gains Shared'],
  GROUP_CALLS: ['Attended Group Call', 'Group Calls'],

  // Learning
  MODULES_DONE: ['Finished 1 Undoing.U Module', 'Modules Done', 'Undoing.U Modules Done'],
  EXPERIMENTS: ['Undoing.U Module Experiment', 'Experiments', 'Undoing Experiments'],

  // Daily State / Other
  OVERALL_STATE: ['Overall State Today (1-10)', 'Overall State', 'Overall State Today'],
  SEMEN_RETENTION: ['Semen Retention Streak', 'Semen Retention']
};

function toInt(val) {
  const n = Number(val);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

function format1(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '0.0';
  return (Math.round(x * 10) / 10).toFixed(1);
}

/**
 * Build a map of totals from user_stats rows:
 * rows: [{stat, total}, ...]
 */
function buildStatsMap(rows = []) {
  const map = {};
  for (const r of rows) {
    if (!r || !r.stat) continue;
    map[String(r.stat).trim()] = toInt(r.total);
  }
  return map;
}

/**
 * Resolve a stat total by matching multiple possible labels.
 */
function getStat(statsMap, labels = []) {
  for (const label of labels) {
    if (statsMap[label] !== undefined) return statsMap[label];
  }
  return 0;
}

/**
 * V2-like archetype spectrum bar (40 chars)
 */
function buildArchetypeSpectrumBar(warriorPercent, magePercent) {
  const barLength = 40;
  const magePct = Math.max(0, Math.min(100, Number(magePercent) || 0));
  const position = Math.round((magePct / 100) * barLength);

  const templarStart = Math.floor(barLength * 0.4); // 16
  const templarEnd = Math.ceil(barLength * 0.6);    // 24

  let marker;
  if (magePct >= 40 && magePct <= 60) marker = '⬤';
  else if (magePct < 40) marker = '○';
  else marker = '⬤';

  let bar = '';
  for (let i = 0; i < barLength; i++) {
    if (i === position) bar += marker;
    else if (i >= templarStart && i <= templarEnd) bar += '|';
    else if (i < templarStart) bar += '█';
    else bar += '░';
  }

  return `\`[${bar}]\``;
}

function archetypeGuidance(magePercent) {
  const m = Number(magePercent) || 0;
  if (m < 40) return "You're leaning Warrior! Do more inner work.";
  if (m >= 40 && m <= 60) return "You're balanced! Keep up the momentum.";
  return "You're leaning Mage! Get out there and take more action.";
}

/**
 * Average Daily State from user_daily.state (best-effort)
 * ✅ Si la columna no existe, solo devuelve 0 sin romper.
 */
async function getAverageDailyState(userId) {
  try {
    const rows = await queryRows(
      `SELECT state
       FROM user_daily
       WHERE user_id = $1
         AND state IS NOT NULL`,
      [userId]
    ).catch((e) => {
      // si la columna no existe, no rompas
      const msg = e?.message || '';
      if (/column .*state.* does not exist/i.test(msg)) return [];
      throw e;
    });

    if (!rows || rows.length === 0) return 0;

    let sum = 0;
    let count = 0;
    for (const r of rows) {
      const v = Number(r.state);
      if (Number.isFinite(v)) {
        sum += v;
        count += 1;
      }
    }
    if (!count) return 0;
    return Math.round((sum / count) * 10) / 10;
  } catch {
    return 0;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scorecard')
    .setDescription('View your complete stats scorecard')
    .addUserOption(option =>
      option
        .setName('compare')
        .setDescription('Compare your scorecard with another player')
        .setRequired(false)
    ),

  // Export: call once on startup if you want auto refresh
  startScorecardAutoRefresh,

  // ✅ Build SOLO payload for auto refresh without Interaction
  async _buildSoloPayloadForAuto(client, services, targetUserId, today, viewerId) {
    const fakeInteraction = {
      user: {
        id: viewerId || targetUserId,
        username: 'User',
        displayAvatarURL: () => null
      },
      client,
    };

    // NOTA: aquí usamos fakeInteraction (no "interaction" ni "userId")
    return this._buildSoloPayload(fakeInteraction, services, targetUserId, today);
  },

  async execute(interaction, services) {
    const userId = interaction.user.id;
    const compareUser = interaction.options.getUser('compare') || null;
    const today = getLocalDayString();

    try {
      // ✅ DEFER INMEDIATO (evita 10062)
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }

      // Rate limiter AFTER defer
      if (services?.rateLimiter?.isRateLimited(userId, 'scorecard')) {
        await interaction.editReply({ content: '⏱️ Slow down a bit and try again shortly.' });
        return;
      }

      if (compareUser) {
        const compareId = compareUser.id;
        if (compareId === userId) {
          await this.handleSolo(interaction, services, userId, today);
        } else {
          await this.handleComparison(interaction, services, userId, compareId, today);
        }
      } else {
        await this.handleSolo(interaction, services, userId, today);
      }
    } catch (error) {
      logger.error('Failed to show scorecard', { userId, error: error?.message || String(error) });

      const errorMessage =
        error?.type === 'NOT_FOUND_ERROR'
          ? 'No stats found. Submit some stats first with `/submit-stats`!'
          : 'Failed to load your scorecard. Please try again.';

      try {
        await interaction.editReply({ content: errorMessage }).catch(() => {});
      } catch (e) {
        logger.error('Scorecard failed to send error message', { error: e?.message });
      }
    }
  },

  /**
   * SOLO
   */
  async handleSolo(interaction, services, userId, today) {
    const { embed } = await this._buildSoloPayload(interaction, services, userId, today);
    await interaction.editReply({ embeds: [embed], components: [] });

    // Track message for auto-refresh
    try {
      const msg = await interaction.fetchReply().catch(() => null);
      if (msg) trackScorecardMessage(msg, { targetUserId: userId, viewerId: interaction.user.id });
    } catch {}
  },

  /**
   * Comparison mode
   */
  async handleComparison(interaction, services, userId1, userId2, today) {
    const { embed } = await this._buildComparisonPayload(interaction, services, userId1, userId2, today);
    await interaction.editReply({ embeds: [embed], components: [] });
  },

  async _buildSoloPayload(interaction, services, targetUserId, today) {
    // ✅ profile best-effort (no rompe por user_daily.data)
    const profile = await safeGetProfileLite(services, targetUserId);

    // ✅ STREAK best-effort
    let streak = 0;
    try {
      if (services?.multiplierService?.calculateStreak) {
        streak = await services.multiplierService.calculateStreak(targetUserId, today);
      }
    } catch (e) {
      logger.warn('Streak calc failed (ignored for scorecard)', { userId: targetUserId, error: e?.message });
      streak = 0;
    }

    const detailedStats = await this.getDetailedStats(targetUserId);
    const statsMap = buildStatsMap(detailedStats);
    const kdRatios = this.calculateKDRatios(detailedStats);

    // ✅ Archetype (non-blocking)
    let archetypeData = { archetype: 'Unknown', warriorPercent: 50, magePercent: 50 };
    try {
      const ArchetypeService = require('../../services/user/ArchetypeService');
      const archetypeService = new ArchetypeService();
      const a = await archetypeService.calculateUserArchetype(targetUserId);
      if (a && typeof a === 'object') archetypeData = { ...archetypeData, ...a };
    } catch (e) {
      logger.warn('Scorecard: archetype calc failed (non-blocking)', { userId: targetUserId, error: e?.message });
    }

    const warriorPct = Number(archetypeData.warriorPercent || 0);
    const magePct = Number(archetypeData.magePercent || 0);

    const spectrum = buildArchetypeSpectrumBar(warriorPct, magePct);
    const guidance = archetypeGuidance(magePct);
    const archetypeIcon = getArchetypeIcon(archetypeData.archetype || 'Unknown');

    // ✅ DAILY STATE AVG best-effort
    let avgState = 0;
    try {
      avgState = await getAverageDailyState(targetUserId);
    } catch (e) {
      logger.warn('Scorecard: avg daily state failed (non-blocking)', { userId: targetUserId, error: e?.message });
      avgState = 0;
    }

    const totalStateSubs = getStat(statsMap, STAT_LABELS.OVERALL_STATE);

    const totals = {
      approaches: getStat(statsMap, STAT_LABELS.APPROACHES),
      numbers: getStat(statsMap, STAT_LABELS.NUMBERS),
      newContactResponse: getStat(statsMap, STAT_LABELS.NEW_CONTACT_RESPONSE),
      hellos: getStat(statsMap, STAT_LABELS.HELLOS),
      ctj: getStat(statsMap, STAT_LABELS.CTJ),

      datesBooked: getStat(statsMap, STAT_LABELS.DATES_BOOKED),
      datesHad: getStat(statsMap, STAT_LABELS.DATES_HAD),
      instantDates: getStat(statsMap, STAT_LABELS.INSTANT_DATES),
      gotLaid: getStat(statsMap, STAT_LABELS.GOT_LAID),
      sameNightPull: getStat(statsMap, STAT_LABELS.SAME_NIGHT_PULL),

      courage: getStat(statsMap, STAT_LABELS.WELCOME_COURAGE),
      sexyBastard: getStat(statsMap, STAT_LABELS.SEXY_BASTARD),
      grounding: getStat(statsMap, STAT_LABELS.GROUNDING),
      releasing: getStat(statsMap, STAT_LABELS.RELEASING),
      inActionRelease: getStat(statsMap, STAT_LABELS.IN_ACTION_RELEASE),

      groupCalls: getStat(statsMap, STAT_LABELS.GROUP_CALLS),
      modulesDone: getStat(statsMap, STAT_LABELS.MODULES_DONE),
      experiments: getStat(statsMap, STAT_LABELS.EXPERIMENTS),

      tenseys: getStat(statsMap, STAT_LABELS.TENSEYS),
      wins: getStat(statsMap, STAT_LABELS.WINS_GAINS),
      semenRetention: getStat(statsMap, STAT_LABELS.SEMEN_RETENTION)
    };

    const manualSubmissionTotal =
      totals.courage +
      totals.hellos +
      totals.approaches +
      totals.numbers +
      totals.newContactResponse +
      totals.ctj +
      totals.datesBooked +
      totals.datesHad +
      totals.instantDates +
      totals.gotLaid +
      totals.sameNightPull +
      totals.sexyBastard +
      totals.grounding +
      totals.releasing +
      totals.inActionRelease +
      totals.groupCalls +
      totals.modulesDone +
      totals.experiments +
      totals.semenRetention +
      totalStateSubs;

    // Display name + avatar
    let titleName = interaction.user?.username || 'User';
    let thumb = interaction.user?.displayAvatarURL?.() || null;

    if (targetUserId !== interaction.user?.id) {
      try {
        const u = await interaction.client.users.fetch(targetUserId);
        titleName = u?.username || titleName;
        thumb = u?.displayAvatarURL?.() || thumb;
      } catch {}
    }

    const embed = new EmbedBuilder()
      .setColor(config.branding.colorHex)
      .setTitle(`${titleName}'s Scorecard`)
      .setThumbnail(thumb)
      .setFooter({ text: config.branding.name, iconURL: config.branding.logoUrl })
      .setTimestamp();

    // Core Stats
    const progressBar = this.makeProgressBar(profile?.levelInfo?.progress || 0, 20);
    embed.addFields({
      name: '🏆 Core Stats',
      value: [
        `**Level:** ${profile?.levelInfo?.level ?? 1} - ${profile?.levelInfo?.className ?? 'Rookie'}`,
        `**XP:** ${(profile?.user?.xp ?? 0).toLocaleString?.() || String(profile?.user?.xp ?? 0)}`,
        `**Rank:** #${profile?.rank ?? 0}`,
        `${progressBar}`,
        `${profile?.levelInfo?.currentXP ?? (profile?.user?.xp ?? 0)}/${profile?.levelInfo?.xpForNext ?? 1000} XP to next level`
      ].join('\n'),
      inline: false
    });

    // Archetype + Streak
    const streakEmoji = streak >= 7 ? '🔥' : streak >= 3 ? '⚡' : '📅';
    embed.addFields(
      {
        name: `${archetypeIcon} Archetype`,
        value: `**${archetypeData.archetype}**`,
        inline: true
      },
      {
        name: `${streakEmoji} Streak`,
        value: [`**${streak} days**`, streak >= 7 ? `+${Math.floor(streak / 7) * 5}% XP Bonus` : 'Keep going!'].join('\n'),
        inline: true
      }
    );

    embed.addFields({
      name: '⚖️ Archetype Balance',
      value: [
        `⚔️ ${spectrum} 🔮`,
        '',
        `**${warriorPct.toFixed(0)}% Warrior | ${magePct.toFixed(0)}% Mage**`,
        `*${guidance}*`
      ].join('\n'),
      inline: false
    });

    // Faction
    if (profile?.user?.faction) {
      const factionEmoji = config.constants?.FACTION_EMOJIS?.[profile.user.faction] || '';
      embed.addFields({
        name: '⚔️ Faction',
        value: `${factionEmoji} **${profile.user.faction}**`,
        inline: true
      });
    }

    // Performance
    if (kdRatios.kd1.value !== null || kdRatios.kd2.value !== null) {
      const kd1Display =
        kdRatios.kd1.value !== null
          ? `**${kdRatios.kd1.value}** (${kdRatios.kd1.approaches}→${kdRatios.kd1.numbers})`
          : 'No data';

      const kd2Display =
        kdRatios.kd2.value !== null
          ? `**${kdRatios.kd2.value}** (${kdRatios.kd2.numbers}→${kdRatios.kd2.dates})`
          : 'No data';

      embed.addFields({
        name: '🎯 Performance Metrics',
        value: [
          `**K/D Ratio:** ${kd1Display}`,
          `*Approaches → Numbers*`,
          '',
          `**Conversion Rate:** ${kd2Display}`,
          `*Numbers → Dates Had*`
        ].join('\n'),
        inline: false
      });
    }

    // spacer
    embed.addFields({ name: '\u200b', value: '\u200b', inline: false });

    embed.addFields(
      {
        name: '🧘 Inner Work',
        value: [
          `**Courage:** ${totals.courage.toLocaleString()}`,
          `**SBMM:** ${totals.sexyBastard.toLocaleString()}`,
          `**Grounding:** ${totals.grounding.toLocaleString()}`,
          `**Releasing:** ${totals.releasing.toLocaleString()}`,
          `**In Action Release:** ${totals.inActionRelease.toLocaleString()}`
        ].join('\n'),
        inline: true
      },
      {
        name: '💕 Dating & Results',
        value: [
          `**Dates Booked:** ${totals.datesBooked.toLocaleString()}`,
          `**Dates Had:** ${totals.datesHad.toLocaleString()}`,
          `**Instant Dates:** ${totals.instantDates.toLocaleString()}`,
          `**Same Night Pull:** ${totals.sameNightPull.toLocaleString()}`,
          `**Got Laid:** ${totals.gotLaid.toLocaleString()}`
        ].join('\n'),
        inline: true
      },
      {
        name: '📚 Learning',
        value: [
          `**Group Calls:** ${totals.groupCalls.toLocaleString()}`,
          `**Modules Done:** ${totals.modulesDone.toLocaleString()}`,
          `**Experiments:** ${totals.experiments.toLocaleString()}`
        ].join('\n'),
        inline: true
      },
      {
        name: '🎭 Daily State',
        value: [
          `**Avg State:** ${format1(avgState)}/10`,
          `**State Subs:** ${totalStateSubs.toLocaleString()}`
        ].join('\n'),
        inline: true
      }
    );

    embed.addFields({
      name: '📈 Totals',
      value: [
        `**Total Stats Subs:** ${manualSubmissionTotal.toLocaleString()}`,
        `**Tenseys:** ${totals.tenseys.toLocaleString()}`,
        `**Wins/Gains:** ${totals.wins.toLocaleString()}`,
        `**Semen Ret:** ${totals.semenRetention.toLocaleString()}`
      ].join('\n'),
      inline: false
    });

    if (detailedStats.length > 0) {
      const topStats = detailedStats
        .slice(0, 10)
        .map(s => `**${s.stat}:** ${toInt(s.total).toLocaleString()}`)
        .join('\n');

      embed.addFields({
        name: '📊 All-Time Stats',
        value: topStats,
        inline: false
      });
    }

    return { embed };
  },

  async _buildComparisonPayload(interaction, services, userId1, userId2, today) {
    const [profile1, profile2] = await Promise.all([
      safeGetProfileLite(services, userId1).catch(() => null),
      safeGetProfileLite(services, userId2).catch(() => null)
    ]);

    if (!profile1 || !profile1.user) {
      throw { type: 'NOT_FOUND_ERROR', message: 'Profile not found' };
    }

    if (!profile2 || !profile2.user) {
      const compareUser = await interaction.client.users.fetch(userId2);
      const embed = new EmbedBuilder()
        .setColor(config.branding.colorHex)
        .setTitle('📊 Scorecard Comparison')
        .setDescription(`${compareUser.username} hasn't submitted any stats yet.`)
        .setFooter({ text: config.branding.name })
        .setTimestamp();

      return { embed };
    }

    const [stats1, stats2] = await Promise.all([
      this.getDetailedStats(userId1),
      this.getDetailedStats(userId2)
    ]);

    let streak1 = 0;
    let streak2 = 0;
    try {
      streak1 = await services?.multiplierService?.calculateStreak?.(userId1, today);
      streak2 = await services?.multiplierService?.calculateStreak?.(userId2, today);
    } catch {}

    const kd1 = this.calculateKDRatios(stats1);
    const kd2 = this.calculateKDRatios(stats2);

    const [user1, user2] = await Promise.all([
      interaction.client.users.fetch(userId1),
      interaction.client.users.fetch(userId2)
    ]);

    const embed = new EmbedBuilder()
      .setColor(config.branding.colorHex)
      .setTitle('📊 Scorecard Comparison')
      .setDescription(`**${user1.username}** vs **${user2.username}**`)
      .setFooter({ text: config.branding.name })
      .setTimestamp();

    const levelDiff = (profile1.levelInfo?.level ?? 0) - (profile2.levelInfo?.level ?? 0);
    const levelArrow = levelDiff > 0 ? '▲' : levelDiff < 0 ? '▼' : '━';

    embed.addFields({
      name: '🏆 Level',
      value: [
        `**${profile1.levelInfo?.level ?? 1}** ${profile1.levelInfo?.className ?? 'Rookie'}`,
        `**${profile2.levelInfo?.level ?? 1}** ${profile2.levelInfo?.className ?? 'Rookie'}`,
        `${levelArrow} ${Math.abs(levelDiff)} level${Math.abs(levelDiff) !== 1 ? 's' : ''} difference`
      ].join('\n'),
      inline: true
    });

    const xp1 = Number(profile1.user?.xp || 0) || 0;
    const xp2 = Number(profile2.user?.xp || 0) || 0;
    const xpDiff = xp1 - xp2;
    const xpArrow = xpDiff > 0 ? '▲' : xpDiff < 0 ? '▼' : '━';

    embed.addFields({
      name: '⚡ XP',
      value: [
        `**${xp1.toLocaleString()}**`,
        `**${xp2.toLocaleString()}**`,
        `${xpArrow} ${Math.abs(xpDiff).toLocaleString()} XP difference`
      ].join('\n'),
      inline: true
    });

    embed.addFields({
      name: '🔥 Streak',
      value: [
        `**${streak1}** days`,
        `**${streak2}** days`
      ].join('\n'),
      inline: true
    });

    if (kd1.kd1.value !== null && kd2.kd1.value !== null) {
      embed.addFields({
        name: '🎯 K/D Ratio',
        value: [
          `**${kd1.kd1.value}** (${user1.username})`,
          `**${kd2.kd1.value}** (${user2.username})`
        ].join('\n'),
        inline: true
      });
    }

    if (kd1.kd2.value !== null && kd2.kd2.value !== null) {
      embed.addFields({
        name: '🎯 Conversion Rate',
        value: [
          `**${kd1.kd2.value}** (${user1.username})`,
          `**${kd2.kd2.value}** (${user2.username})`
        ].join('\n'),
        inline: true
      });
    }

    return { embed };
  },

  async getDetailedStats(userId) {
    const rows = await queryRows(
      `SELECT stat, total
       FROM user_stats
       WHERE user_id = $1
       ORDER BY total DESC`,
      [userId]
    ).catch(() => []);
    return rows || [];
  },

  calculateKDRatios(stats) {
    const statsMap = {};
    stats.forEach(s => {
      statsMap[s.stat] = toInt(s.total);
    });

    const approaches = statsMap['Approaches'] || 0;
    const numbers = statsMap['Numbers'] || 0;
    const dates = statsMap['Dates Had'] || 0;

    const kd1 = approaches > 0 ? (numbers / approaches).toFixed(2) : null;
    const kd2 = numbers > 0 ? (dates / numbers).toFixed(2) : null;

    return {
      kd1: { value: kd1, approaches, numbers },
      kd2: { value: kd2, numbers, dates }
    };
  },

  makeProgressBar(progress, length = 20) {
    const filled = Math.floor(Math.max(0, Math.min(1, Number(progress) || 0)) * length);
    const empty = length - filled;
    return `[${'▓'.repeat(filled)}${'░'.repeat(empty)}]`;
  },

  /**
   * ==========================
   * Exports for ButtonHandler
   * ==========================
   */

  async renderSoloForButton(interaction, services, targetUserId) {
    const today = getLocalDayString();
    const { embed } = await this._buildSoloPayload(interaction, services, targetUserId, today);

    if (interaction.message && typeof interaction.message.edit === 'function') {
      await interaction.message.edit({ embeds: [embed], components: [] });
      return;
    }

    await interaction.editReply({ embeds: [embed], components: [] });
  },

  // alias usado por "view-my-scorecard"
  async renderScorecardForButton(interaction, services, targetUserId) {
    return this.renderSoloForButton(interaction, services, targetUserId);
  }
};
