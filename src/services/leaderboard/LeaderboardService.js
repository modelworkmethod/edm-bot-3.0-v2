/**
 * Leaderboard Service
 * Time-ranged and stat-specific leaderboards with caching
 * - Adds factionStats (global all-time)
 * - Adds archetypeLabel/archetypePct if warrior/mage/templar exist
 * - Adds progress/className via LevelCalculator (v2-style)
 */

const { createLogger } = require('../../utils/logger');
const { queryRows } = require('../../database/postgres');
const { STAT_WEIGHTS, STAT_ALIASES } = require('../../config/constants');

// ✅ Use your XP curve (v2-style)
const { computeLevelFromTotalXP } = require('../xp/LevelCalculator');
// Ajusta la ruta si tu LevelCalculator está en otro folder.
// Ejemplo alterno si está en src/services/LevelCalculator.js:
// const { computeLevelFromTotalXP } = require('../LevelCalculator');

const logger = createLogger('LeaderboardService');
const CACHE_TTL = 60000;

class LeaderboardService {
  constructor() {
    this.cache = new Map();
    this._usersColumns = null;
  }

  /* ---------------- Date Range ---------------- */

  getDateRange(range, tz = 'America/New_York') {
    const now = new Date();

    if (range === 'all') return { start: null, end: null, label: 'All-Time' };

    if (range === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setHours(0, 0, 0, 0);
      const day = startOfWeek.getDay();
      startOfWeek.setDate(startOfWeek.getDate() - day); // Sunday
      return {
        start: startOfWeek.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0],
        label: 'This Week',
      };
    }

    if (range === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        start: startOfMonth.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0],
        label: 'This Month',
      };
    }

    return { start: null, end: null, label: 'All-Time' };
  }

  /* ---------------- Stat Key ---------------- */

  normalizeStatKey(key) {
    const lower = String(key || '').toLowerCase().trim();

    if (STAT_WEIGHTS[key]) return key;
    if (STAT_ALIASES[lower]) return STAT_ALIASES[lower];

    for (const statKey of Object.keys(STAT_WEIGHTS)) {
      if (statKey.toLowerCase() === lower) return statKey;
    }
    return null;
  }

  /* ---------------- Cache ---------------- */

  getCacheKey(type, options) {
    return `${type}:${options.range || 'all'}:${options.stat || 'xp'}:${options.limit || 10}:${options.offset || 0}`;
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    return cached.data;
  }

  setCache(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });

    if (this.cache.size > 100) {
      const oldest = Array.from(this.cache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      this.cache.delete(oldest[0]);
    }
  }

  /* ---------------- Schema detection (users columns) ---------------- */

  async _loadUsersColumns() {
    if (this._usersColumns) return this._usersColumns;

    try {
      const rows = await queryRows(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
        `
      );

      const set = new Set((rows || []).map(r => String(r.column_name || '').toLowerCase()));
      this._usersColumns = set;
      return set;
    } catch (err) {
      logger.warn('Failed to detect users columns', { error: err?.message });
      this._usersColumns = new Set();
      return this._usersColumns;
    }
  }

  _has(col) {
    return this._usersColumns?.has(String(col).toLowerCase());
  }

  /* ---------------- Faction stats (global all-time) ---------------- */

  async getFactionStatsAllTime() {
    const rows = await queryRows(
      `
      SELECT faction,
             COUNT(*)::int AS count,
             COALESCE(SUM(xp),0)::bigint AS total_xp
      FROM users
      WHERE faction IS NOT NULL AND xp > 0
      GROUP BY faction
      `
    );

    const out = {
      luminarchs: { count: 0, totalXP: 0 },
      noctivores: { count: 0, totalXP: 0 },
    };

    for (const r of rows || []) {
      const f = String(r.faction || '').toLowerCase();
      if (f === 'luminarchs') {
        out.luminarchs.count = Number(r.count || 0);
        out.luminarchs.totalXP = Number(r.total_xp || 0);
      } else if (f === 'noctivores') {
        out.noctivores.count = Number(r.count || 0);
        out.noctivores.totalXP = Number(r.total_xp || 0);
      }
    }

    return out;
  }

  /* ---------------- Archetype ---------------- */

  computeArchetype(warrior, mage, templar) {
    const w = Number(warrior || 0);
    const m = Number(mage || 0);
    const t = Number(templar || 0);
    const sum = w + m + t;

    if (!Number.isFinite(sum) || sum <= 0) return { label: null, pct: null };

    let label = 'Warrior';
    let best = w;
    if (m > best) { best = m; label = 'Mage'; }
    if (t > best) { best = t; label = 'Templar'; }

    return { label, pct: (best / sum) * 100 };
  }

  /* ---------------- Leaderboards ---------------- */

  async getXPLeaderboard(options = {}) {
    try {
      const { range = 'all', limit = 10, offset = 0 } = options;
      const cappedLimit = Math.min(limit, 25);

      const cacheKey = this.getCacheKey('xp', { range, limit: cappedLimit, offset });
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      await this._loadUsersColumns();

      const dateRange = this.getDateRange(range);
      const factionStats = await this.getFactionStatsAllTime();

      // Optional columns
      const extraCols = [];
      const maybeAdd = (col) => { if (this._has(col)) extraCols.push(col); };

      maybeAdd('warrior');
      maybeAdd('mage');
      maybeAdd('templar');
      maybeAdd('prestige');

      // Some installs keep level in DB, but we'll compute it for progress consistency
      // maybeAdd('level'); // already selected below

      const selectExtras = extraCols.length ? `, ${extraCols.join(', ')}` : '';

      // v2 style: order by total xp
      const results = await queryRows(
        `
        SELECT user_id, xp, level, faction${selectExtras}
        FROM users
        WHERE COALESCE(xp, 0) > 0
        ORDER BY xp DESC
        LIMIT $1 OFFSET $2
        `,
        [cappedLimit, offset]
      );

      const response = {
        success: true,
        range: dateRange.label,
        factionStats,
        leaderboard: (results || []).map((u, i) => {
          const totalXP = Number(u.xp || 0);
          const lvlInfo = computeLevelFromTotalXP(totalXP); // ✅ v2 curve

          const arche = this.computeArchetype(u.warrior, u.mage, u.templar);

          return {
            rank: offset + i + 1,
            userId: u.user_id,
            username: null,

            xp: parseInt(totalXP, 10),

            // ✅ use computed (stable progress)
            level: parseInt(lvlInfo.level, 10),
            className: lvlInfo.className || null,
            progress: Number.isFinite(Number(lvlInfo.progress)) ? Number(lvlInfo.progress) : null,
            currentXP: Number(lvlInfo.currentXP || 0),
            xpForNext: Number(lvlInfo.xpForNext || 0),

            faction: u.faction,
            prestige: u.prestige ?? 0,

            archetypeLabel: arche.label,
            archetypePct: arche.pct,
          };
        }),
        limit: cappedLimit,
        offset,
      };

      this.setCache(cacheKey, response);
      return response;

    } catch (error) {
      logger.error('Failed to get XP leaderboard', { error: error.message, options });
      return { success: false, error: error.message };
    }
  }

  async getStatLeaderboard(statKey, options = {}) {
    try {
      const { range = 'all', limit = 10, offset = 0 } = options;
      const cappedLimit = Math.min(limit, 25);

      const normalized = this.normalizeStatKey(statKey);
      if (!normalized) {
        return {
          success: false,
          error: `Unknown stat: ${statKey}`,
          validStats: Object.keys(STAT_WEIGHTS),
        };
      }

      const cacheKey = this.getCacheKey('stat', { stat: normalized, range, limit: cappedLimit, offset });
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      await this._loadUsersColumns();

      const dateRange = this.getDateRange(range);
      const factionStats = await this.getFactionStatsAllTime();

      // Optional columns (from users u)
      const extraCols = [];
      const maybeAdd = (col) => { if (this._has(col)) extraCols.push(`u.${col} AS ${col}`); };

      maybeAdd('warrior');
      maybeAdd('mage');
      maybeAdd('templar');
      maybeAdd('prestige');

      const selectExtras = extraCols.length ? `, ${extraCols.join(', ')}` : '';

      let query;
      let params;

      if (range === 'all') {
        // ✅ include u.xp so we can compute progress/class
        query = `
          SELECT us.user_id,
                 us.total_count AS stat_total,
                 u.xp,
                 u.level,
                 u.faction
                 ${selectExtras}
          FROM users_stats us
          JOIN users u ON us.user_id = u.user_id
          WHERE us.stat_name = $1 AND us.total_count > 0
          ORDER BY us.total_count DESC
          LIMIT $2 OFFSET $3`;
        params = [normalized, cappedLimit, offset];
      } else {
        query = `
          SELECT dr.user_id,
                 SUM(dr.count) AS stat_total,
                 u.xp,
                 u.level,
                 u.faction
                 ${selectExtras}
          FROM daily_records dr
          JOIN users u ON dr.user_id = u.user_id
          WHERE dr.stat_name = $1
            AND dr.date >= $2
            AND dr.date <= $3
          GROUP BY dr.user_id, u.xp, u.level, u.faction
          HAVING SUM(dr.count) > 0
          ORDER BY stat_total DESC
          LIMIT $4 OFFSET $5`;
        params = [normalized, dateRange.start, dateRange.end, cappedLimit, offset];
      }

      const results = await queryRows(query, params);

      const response = {
        success: true,
        stat: normalized,
        range: dateRange.label,
        factionStats,
        leaderboard: (results || []).map((u, i) => {
          const totalXP = Number(u.xp || 0);
          const lvlInfo = computeLevelFromTotalXP(totalXP);

          const arche = this.computeArchetype(u.warrior, u.mage, u.templar);

          return {
            rank: offset + i + 1,
            userId: u.user_id,
            username: null,

            statTotal: parseInt(u.stat_total, 10),

            // ✅ computed level info for v2 progress bar
            xp: parseInt(totalXP, 10),
            level: parseInt(lvlInfo.level, 10),
            className: lvlInfo.className || null,
            progress: Number.isFinite(Number(lvlInfo.progress)) ? Number(lvlInfo.progress) : null,
            currentXP: Number(lvlInfo.currentXP || 0),
            xpForNext: Number(lvlInfo.xpForNext || 0),

            faction: u.faction,
            prestige: u.prestige ?? 0,

            archetypeLabel: arche.label,
            archetypePct: arche.pct,
          };
        }),
        limit: cappedLimit,
        offset,
      };

      this.setCache(cacheKey, response);
      return response;

    } catch (error) {
      logger.error('Failed to get stat leaderboard', { error: error.message, statKey, options });
      return { success: false, error: error.message };
    }
  }

  getValidStatKeys() {
    return Object.keys(STAT_WEIGHTS);
  }

  clearCache() {
    this.cache.clear();
    logger.info('Leaderboard cache cleared');
  }
}

module.exports = LeaderboardService;
