/**
 * Stats Processor
 * Validates and processes stat submissions
 */

const { createLogger } = require('../../utils/logger');
const { STAT_WEIGHTS, AFFINITY_WEIGHTS, STAT_ALIASES } = require('../../config/constants');
const { getLocalDayString } = require('../../utils/timeUtils');

const logger = createLogger('StatsProcessor');

const { EmbedBuilder } = require('discord.js');


class StatsProcessor {
  /**
   * @param {object} repositories  services.repositories
   * @param {object|null} userServiceOrDuelManager  (para compatibilidad puede ser userService o duelManager)
   * @param {object|null} duelManagerMaybe
   *
   * Soporta:
   *  - new StatsProcessor(repos, duelManager)
   *  - new StatsProcessor(repos, userService)
   *  - new StatsProcessor(repos, userService, duelManager)
   */
  constructor(repositories, userServiceOrDuelManager = null, duelManagerMaybe = null, channelServiceMaybe = null) {
    this.repositories = repositories;

    this.userService = null;
    this.duelManager = null;
    this.raidManager = null;
    this.channelService = channelServiceMaybe || null; // ✅ NEW/Optional

    // Compatibilidad:
    if (duelManagerMaybe) {
      // new StatsProcessor(repos, userService, duelManager, channelService?)
      this.userService = userServiceOrDuelManager;
      this.duelManager = duelManagerMaybe;
    } else if (
      userServiceOrDuelManager &&
      typeof userServiceOrDuelManager.trackDuelStat === 'function'
    ) {
      // new StatsProcessor(repos, duelManager, null, channelService?)
      this.duelManager = userServiceOrDuelManager;
    } else {
      // new StatsProcessor(repos, userService, null, channelService?)
      this.userService = userServiceOrDuelManager;
    }
  }

  /**
   * Set RaidManager
   */
  setRaidManager(raidManager) {
    this.raidManager = raidManager;
  }

  /**
   * Ensure user exists in DB (if userService is available)
   */
  async ensureUserExists(userId, username = null) {
    // 1) intentar con userService si existe
    if (this.userService) {
      try {
        let user = null;

        if (typeof this.userService.getUser === 'function') {
          user = await this.userService.getUser(userId);
        }

        if (!user) {
          // soporta varios nombres de método
          if (typeof this.userService.getOrCreateUser === 'function') {
            user = await this.userService.getOrCreateUser(userId, username);
          } else if (typeof this.userService.getOrCreate === 'function') {
            user = await this.userService.getOrCreate(userId, username);
          }
        }

        if (user) return user;
      } catch (e) {
        logger.warn('ensureUserExists: userService failed, will fallback to repo', {
          userId,
          error: e?.message,
        });
      }
    }

    // 2) fallback: repo
    try {
      const userRepo = this.repositories?.user || this.repositories?.users;
      if (userRepo && typeof userRepo.getOrCreate === 'function') {
        return await userRepo.getOrCreate(userId, username);
      }
    } catch (e) {
      logger.error('ensureUserExists: repo.getOrCreate failed', {
        userId,
        error: e?.message,
      });
    }

    return null;
  }

  /**
   * Normalize stat key using STAT_ALIASES and STAT_WEIGHTS
   * @param {string} rawName
   * @returns {string|null} canonical stat key or null if unknown
   */
  normalizeStatKey(rawName) {
    if (!rawName) return null;

    const key = String(rawName).trim();
    const lower = key.toLowerCase();

    // 1) match directo con STAT_WEIGHTS (✅ no uses truthy check)
    if (STAT_WEIGHTS && STAT_WEIGHTS[key] !== undefined) return key;

    // 2) alias exacto
    if (STAT_ALIASES && STAT_ALIASES[lower]) {
      const canonical = STAT_ALIASES[lower];
      if (STAT_WEIGHTS && STAT_WEIGHTS[canonical] !== undefined) return canonical;
    }

    // 3) match case-insensitive contra las keys de STAT_WEIGHTS
    if (STAT_WEIGHTS) {
      for (const statKey of Object.keys(STAT_WEIGHTS)) {
        if (statKey.toLowerCase() === lower) return statKey;
      }
    }

    return null;
  }

  /**
   * Validate raw stats input
   * - Uses STAT_ALIASES to map incoming names to canonical keys
   * - Skips invalid/negative values
   */
  validateStats(rawStats) {
    const validated = {};

    for (const [rawName, value] of Object.entries(rawStats)) {
      const canonical = this.normalizeStatKey(rawName);

      if (!canonical) {
        logger.warn('Unknown stat submitted', { statName: rawName });
        continue;
      }

      const numValue = parseInt(value, 10);
      if (isNaN(numValue) || numValue < 0) {
        logger.warn('Invalid stat value', { statName: canonical, value });
        continue;
      }

      validated[canonical] = (validated[canonical] || 0) + numValue;
    }

    return validated;
  }

  /**
   * Calculate affinity points from stats
   */
  calculateAffinities(stats) {
    let warriorAffinity = 0;
    let mageAffinity = 0;
    let templarAffinity = 0;

    for (const [statName, value] of Object.entries(stats)) {
      const weights = AFFINITY_WEIGHTS[statName];

      if (weights) {
        warriorAffinity += (weights.w || 0) * value;
        mageAffinity += (weights.m || 0) * value;
        templarAffinity += (weights.t || 0) * value;
      }
    }

    return {
      warrior: Math.round(warriorAffinity),
      mage: Math.round(mageAffinity),
      templar: Math.round(templarAffinity),
    };
  }

  /**
   * Persist stats in DB:
   * - user_daily: marca que ese día hubo submission
   * - user_stats: acumula totales por stat
   */
  async persistStats(userId, day, validatedStats) {
    if (!this.repositories || !this.repositories.stats || typeof this.repositories.stats.raw !== 'function') {
      logger.warn('StatsProcessor: repositories.stats.raw not available, skipping DB persist');
      return;
    }

    // 1) user_daily → sólo aseguramos fila (para streaks/recordatorios)
    try {
      await this.repositories.stats.raw(
        `
        INSERT INTO user_daily (user_id, day)
        VALUES ($1, $2)
        ON CONFLICT (user_id, day) DO NOTHING
        `,
        [userId, day]
      );
    } catch (error) {
      logger.error('StatsProcessor: failed to upsert user_daily', {
        userId,
        day,
        error: error.message
      });
    }

    // 2) user_stats
    for (const [statName, value] of Object.entries(validatedStats)) {
      try {
        await this.repositories.stats.raw(
          `
          INSERT INTO user_stats (user_id, stat, total)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, stat)
          DO UPDATE SET total = user_stats.total + EXCLUDED.total
          `,
          [userId, statName, value]
        );
      } catch (error) {
        logger.error('StatsProcessor: failed to upsert user_stats', {
          userId,
          statName,
          value,
          error: error.message
        });
      }
    }
  }

  /**
   * ✅ Award XP to user (safe, supports multiple implementations)
   * Tries userService first, then repositories.user.updateXPAndAffinities,
   * then SQL fallback.
   */
  async awardXpSafely(userId, xpAmount, affinityDeltas = {}, context = {}) {
    const xp = Math.floor(Number(xpAmount) || 0);
    if (xp <= 0) return { success: true, xpAwarded: 0, via: 'noop' };

    // 0) asegurar usuario existe
    try {
      if (this.userService && typeof this.userService.getOrCreateUser === 'function') {
        await this.userService.getOrCreateUser(userId, context?.username || null);
      } else {
        const userRepo = this.repositories?.user || this.repositories?.users;
        if (userRepo && typeof userRepo.getOrCreate === 'function') {
          await userRepo.getOrCreate(userId, context?.username || null);
        }
      }
    } catch (e) {
      logger.warn('StatsProcessor: ensure user exists failed (continuing anyway)', {
        userId,
        error: e?.message,
      });
    }

    // 1) ✅ Preferido: userService.updateUserStats
    if (this.userService && typeof this.userService.updateUserStats === 'function') {
      try {
        await this.userService.updateUserStats(
          userId,
          xp,
          affinityDeltas,
          context?.source || 'stats_submission'
        );
        return { success: true, xpAwarded: xp, via: 'userService.updateUserStats' };
      } catch (e) {
        logger.warn('StatsProcessor: userService.updateUserStats failed, fallback repo/SQL', {
          userId, xp, error: e?.message, context,
        });
      }
    }

    // 2) Repo fallback
    const usersRepo = this.repositories?.user || this.repositories?.users;
    if (usersRepo && typeof usersRepo.updateXPAndAffinities === 'function') {
      try {
        await usersRepo.updateXPAndAffinities(userId, xp, affinityDeltas);
        return { success: true, xpAwarded: xp, via: 'repositories.user.updateXPAndAffinities' };
      } catch (e) {
        logger.warn('StatsProcessor: repo.updateXPAndAffinities failed, fallback SQL', {
          userId, xp, error: e?.message, context,
        });
      }
    }

    // 3) SQL fallback UPSERT
    try {
      const { query } = require('../../database/postgres');
      await query(
        `
        INSERT INTO users (user_id, xp, warrior_affinity, mage_affinity, templar_affinity)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id)
        DO UPDATE SET
          xp = COALESCE(users.xp, 0) + EXCLUDED.xp,
          warrior_affinity = COALESCE(users.warrior_affinity, 0) + EXCLUDED.warrior_affinity,
          mage_affinity = COALESCE(users.mage_affinity, 0) + EXCLUDED.mage_affinity,
          templar_affinity = COALESCE(users.templar_affinity, 0) + EXCLUDED.templar_affinity,
          updated_at = NOW()
        `,
        [
          userId,
          xp,
          Math.floor(Number(affinityDeltas?.warrior || 0)),
          Math.floor(Number(affinityDeltas?.mage || 0)),
          Math.floor(Number(affinityDeltas?.templar || 0)),
        ]
      );
      return { success: true, xpAwarded: xp, via: 'sql.upsert(users + affinities)' };
    } catch (e) {
      logger.error('StatsProcessor: SQL award failed', { userId, xp, error: e?.message, context });
      return { success: false, xpAwarded: 0, error: e?.message };
    }
  }

  /**
   * ✅ Resolve general channel id (env-first)
   */
  getGeneralChannelId() {
    return (
      process.env.GENERAL_CHANNEL_ID ||
      process.env.CHANNEL_GENERAL_ID ||
      process.env.WINGMAN_GENERAL_CHANNEL_ID ||
      null
    );
  }

  /**
   * ✅ Send announcement safely
   * Supports:
   *  - channelService.sendToChannel(channelId, payload)
   *  - context.client.channels.fetch(channelId) fallback
   */
  async sendToGeneral(payload, context = {}) {
    const channelId = this.getGeneralChannelId();
    if (!channelId) return;

    // 1) prefer ChannelService
    try {
      if (this.channelService && typeof this.channelService.sendToChannel === 'function') {
        await this.channelService.sendToChannel(channelId, payload);
        return;
      }
    } catch (e) {
      logger.warn('StatsProcessor: channelService send failed', { error: e?.message, channelId });
    }

    // 2) fallback using Discord client from context
    try {
      const client = context?.client || null;
      if (!client?.channels?.fetch) return;

      const ch = await client.channels.fetch(channelId).catch(() => null);
      if (!ch || typeof ch.send !== 'function') return;

      await ch.send(payload);
    } catch (e) {
      logger.warn('StatsProcessor: failed to send general announcement via client', {
        error: e?.message,
        channelId,
      });
    }
  }

  /**
   * ✅ Compute level from XP using levelCalculator if available (fallback safe)
   */
  computeLevelFromXp(xp) {
    try {
      const lc = this.userService?.levelCalculator || this.userService?.levelCalc || null;
      if (lc && typeof lc.getLevelFromXP === 'function') return lc.getLevelFromXP(xp);
      if (lc && typeof lc.getLevel === 'function') return lc.getLevel(xp);
    } catch {}
    return null;
  }

    // ✅ Elige un stat “principal” para el mensaje (prioriza Approaches)
  pickHighlightStat(validatedStats = {}) {
    const preferred = [
      'Approaches',
      'Numbers',
      'Dates Booked',
      'Dates Had',
      'Instant Date',
      'Got Laid',
      'Same Night Pull From Instant Date',
      'Hellos To Strangers',
      'Wins/Gains Shared',
      'Attending Group Calls',
      'Overall State Today (1-10)',
    ];

    for (const key of preferred) {
      if (validatedStats[key] !== undefined) return { name: key, value: validatedStats[key] };
    }

    const first = Object.entries(validatedStats)[0];
    if (!first) return null;
    return { name: first[0], value: first[1] };
  }

  buildGeneralLevelUpEmbed({ userId, levelAfter }) {
    const mention = `<@${userId}>`;

    const embed = new EmbedBuilder()
      .setTitle('🎉 LEVEL UP!')
      .setDescription(`${mention} leveled up to **LVL ${levelAfter}** — **Charisma Vanguard!**`)
      .setTimestamp(new Date())
      .setColor(0x00d4aa);

    return embed;
  }

/* 
  // ✅ Mensaje estilo v2.0 (como el screenshot)
  buildGeneralStatsMessage({ userId, validatedStats }) {
    const mention = `<@${userId}>`;
    const highlight = this.pickHighlightStat(validatedStats);

    const intro =
      `🔥 Another rep in the social gym, ${mention}! ` +
      `Approaches like this sculpt unshakable confidence. Tell the crew how it went down!`;

    if (!highlight) {
      return [intro].join('\n');
    }

    const { name, value } = highlight;

    // Si el highlight es Approaches, que quede igual que la v2
    if (name === 'Approaches') {
      return [
        intro,
        `🔥 ${mention} just logged **${value}** approaches. Keep going, beast!`,
      ].join('\n');
    }

    // Fallback si fue otro stat
    return [
      intro,
      `🔥 ${mention} just logged **${value}** in **${name}**. Keep going, beast!`,
    ].join('\n');
  } */

  // ✅ Mensaje level-up estilo v2
/*   buildGeneralLevelUpMessage({ userId, levelAfter }) {
    const mention = `<@${userId}>`;
    return `🎉 ${mention} leveled up to **LVL ${levelAfter}** — **Charisma Vanguard!**`;
  } */


  /**
   * ✅ helper: snapshot user profile (xp/level) if possible
   */
  async snapshotUser(userId) {
    try {
      if (this.userService && typeof this.userService.getUserProfile === 'function') {
        const profile = await this.userService.getUserProfile(userId);
        return {
          level: profile?.user?.level ?? null,
          xp: profile?.user?.xp ?? null,
        };
      }
    } catch (e) {
      // ignore
    }
    return { level: null, xp: null };
  }

  /**
   * Process submission (writes to DB, tracks duel stats y raids)
   */
    async processSubmission(userId, rawStats, dayString = null, context = {}) {
    try {
      const day = dayString || getLocalDayString();

      // ✅ Asegura usuario
      await this.ensureUserExists(userId, context?.username || null);

      // ✅ Snapshot BEFORE (antes de sumar XP)
      let beforeLevel = null;
      let beforeXp = null;

      try {
        if (this.userService && typeof this.userService.getUserProfile === 'function') {
          const beforeProfile = await this.userService.getUserProfile(userId);
          beforeLevel = beforeProfile?.user?.level ?? null;
          beforeXp = beforeProfile?.user?.xp ?? null;
        }
      } catch (e) {
        // ignore
      }

      // ✅ Validate + normalize stats
      const validated = this.validateStats(rawStats);
      if (Object.keys(validated).length === 0) {
        return { success: false, error: 'No valid stats provided' };
      }

      // ✅ Affinities
      const affinities = this.calculateAffinities(validated);

      // ✅ XP del submission (ANTES de anunciar)
      let xpAwarded = 0;
      for (const [statName, value] of Object.entries(validated)) {
        const w = (STAT_WEIGHTS && STAT_WEIGHTS[statName] !== undefined) ? STAT_WEIGHTS[statName] : 0;
        xpAwarded += (Number(w) || 0) * (Number(value) || 0);
      }
      xpAwarded = Math.floor(xpAwarded);

      // ✅ Persist stats
      await this.persistStats(userId, day, validated);

      // ✅ Persist XP + affinities
      const xpResult = await this.awardXpSafely(
        userId,
        xpAwarded,
        affinities,
        {
          source: 'stats_submission',
          day,
          username: context?.username || null,
        }
      );

      // ✅ Snapshot AFTER (ya con XP aplicado)
      let afterLevel = null;
      let afterXp = null;

      try {
        if (this.userService && typeof this.userService.getUserProfile === 'function') {
          const afterProfile = await this.userService.getUserProfile(userId);
          afterLevel = afterProfile?.user?.level ?? null;
          afterXp = afterProfile?.user?.xp ?? null;
        }
      } catch (e) {
        // ignore
      }


      // ✅ 2) Announcement: Level up (General) — estilo v2
      const lvlBefore = beforeLevel ?? (beforeXp != null ? this.computeLevelFromXp(beforeXp) : null);
      const lvlAfter = afterLevel ?? (afterXp != null ? this.computeLevelFromXp(afterXp) : null);

      if (lvlBefore != null && lvlAfter != null && lvlAfter > lvlBefore) {
        try {
          await this.sendToGeneral({
            content: this.buildGeneralLevelUpMessage({ userId, levelAfter: lvlAfter }),
          });
        } catch {}
      }

      // Duel tracking (igual que ya lo tienes)
      if (this.duelManager) {
        for (const [statName, value] of Object.entries(validated)) {
          const xpValue = (STAT_WEIGHTS && STAT_WEIGHTS[statName] !== undefined) ? STAT_WEIGHTS[statName] : 0;
          const affinityWeights = AFFINITY_WEIGHTS[statName];

          if (affinityWeights) {
            await this.duelManager.trackDuelStat(
              userId,
              statName,
              value,
              xpValue * value,
              (affinityWeights.w || 0) * value,
              (affinityWeights.m || 0) * value
            );
          }
        }
      }

      // Raid tracking (igual que ya lo tienes)
      if (this.raidManager) {
        try {
          if (typeof this.raidManager.addContribution === 'function') {
            await this.raidManager.addContribution(userId, validated);
          } else if (typeof this.raidManager.trackStatsContribution === 'function') {
            await this.raidManager.trackStatsContribution(userId, validated, affinities);
          } else {
            logger.warn('StatsProcessor: raidManager no tiene métodos de contribución válidos');
          }
        } catch (err) {
          logger.error('StatsProcessor: failed to send contribution to raidManager', {
            userId,
            error: err.message
          });
        }
      } else {
        logger.debug('StatsProcessor: no raidManager attached, skipping raid contribution');
      }

      logger.info('StatsProcessor: recorded stats', {
        userId,
        day,
        stats: validated,
        affinities,
        xpAwarded,
        xpVia: xpResult?.via || null,
        xpPersisted: !!xpResult?.success,
      });

      return {
        success: true,
        day,
        validatedStats: validated,
        affinities,
        xpAwarded,
      };
    } catch (error) {
      logger.error('Failed to process stats submission', { error: error.message });
      return { success: false, error: error.message };
    }
  }

}

module.exports = StatsProcessor;
