/**
 * Multiplier Service
 * Calculates XP multipliers from streaks, state, and bonuses
 *
 * ✅ NOW supports Double XP events from `double_xp_events`
 */

const { createLogger } = require('../../utils/logger');
const config = require('../../config/settings');

const logger = createLogger('MultiplierService');

class MultiplierService {
  constructor(repositories) {
    this.statsRepo = repositories.stats;

    // ✅ Needed for querying double_xp_events
    // In your codebase you already use services.repositories.user.raw(...)
    this.userRepo = repositories.user || null;
  }

  /**
   * Calculate streak from daily records
   * @param {string} userId - Discord user ID
   * @param {string} currentDay - Current day string (YYYY-MM-DD)
   * @returns {Promise<number>} Streak in days
   */
  async calculateStreak(userId, currentDay) {
    const records = await this.statsRepo.getRecentDailyRecords(userId, 60);

    if (records.length === 0) return 0;

    // Build map of active days
    const activeDays = new Map();
    records.forEach(r => {
      if (r.active === 1) {
        activeDays.set(r.day, true);
      }
    });

    // Count streak backwards from current day
    let streak = 0;
    let checkDay = currentDay;

    while (activeDays.has(checkDay)) {
      streak++;
      checkDay = this.subtractOneDay(checkDay);

      // Safety limit
      if (streak > 365) break;
    }

    return streak;
  }

  /**
   * Calculate full XP multiplier
   * @param {string} userId - Discord user ID
   * @param {string} day - Day string
   * @param {object} dailyData - Daily data {state, dom, active}
   * @param {string} faction - User's faction
   * @returns {Promise<object>} Multiplier breakdown
   */
  async calculateMultiplier(userId, day, dailyData = {}, faction = null) {
    const { state, dom, active } = dailyData;

    // Calculate streak (include today if active)
    const baseStreak = await this.calculateStreak(userId, day);
    const effectiveStreak = active ? baseStreak + 1 : baseStreak;

    // Streak bonus: +5% per 7 days, max config.multipliers.maxStreakBonus (e.g. 0.25)
    const streakBonus = Math.min(
      config.multipliers.maxStreakBonus,
      Math.floor(effectiveStreak / 7) * 0.05
    );

    // State bonus: +5% if state >= 8
    const stateBonus = Number(state) >= 8 ? config.multipliers.stateGoodBonus : 0;

    // Templar bonus: +30% if templar dominant today
    const templarBonus = dom === 'templar' ? config.multipliers.templarDayBonus : 0;

    // Catch-up bonus (mega mode)
    const megaBonus = await this.calculateCatchUpBonus(userId, day);

    // ✅ Global modifiers (double XP, faction buffs)
    const globalMods = await this.getActiveGlobalModifiers(faction);

    // Base multiplier starts at 1.0 (additive bonuses)
    let multiplier = 1.0;
    multiplier += streakBonus + stateBonus + templarBonus + megaBonus;

    // Apply global modifiers (multiplicative)
    for (const mod of globalMods) {
      if (mod.type === 'double_xp') {
        multiplier *= mod.factor;
      } else if (mod.type === 'faction_buff' && faction === mod.faction) {
        multiplier *= mod.factor;
      }
    }

    // ✅ Cap: allow up to 5x by default (because /set-double-xp allows up to 5.0)
    // If you have config.multipliers.maxTotalMultiplier, it will use that.
    const cap =
      typeof config?.multipliers?.maxTotalMultiplier === 'number'
        ? config.multipliers.maxTotalMultiplier
        : 5.0;

    multiplier = Math.min(multiplier, cap);

    return {
      multiplier,
      components: {
        streakDays: effectiveStreak,
        streakBonus,
        stateBonus,
        templarBonus,
        megaBonus,
        globalMods: globalMods.map(m => m.type),
      },
    };
  }

  /**
   * Calculate catch-up bonus (mega mode)
   * @param {string} userId - Discord user ID
   * @param {string} day - Current day
   * @returns {Promise<number>} Catch-up bonus (0 to max)
   */
  async calculateCatchUpBonus(userId, day) {
    // TODO: Implement mega mode window check
    // For now, return 0
    return 0;
  }

  /**
   * ✅ Get active global modifiers
   * Currently implements:
   *  - double_xp (from double_xp_events)
   *
   * @param {string} faction - User's faction (optional)
   * @returns {Promise<Array<{type:string,factor:number,faction?:string,eventId?:number}>>}
   */
  async getActiveGlobalModifiers(faction = null) {
    const mods = [];

    // If no repo/raw available, fail silently (no global mods)
    if (!this.userRepo || typeof this.userRepo.raw !== 'function') {
      return mods;
    }

    // ✅ Double XP event
    try {
      const result = await this.userRepo.raw(
        `SELECT id, multiplier
         FROM double_xp_events
         WHERE start_time <= NOW()
           AND end_time > NOW()
         ORDER BY id DESC
         LIMIT 1`
      );

      const row = result?.rows?.[0];
      if (row) {
        const factor = Number(row.multiplier) || 2.0;

        // Safety clamp (avoid nonsense)
        const safeFactor =
          Number.isFinite(factor) && factor >= 1 ? Math.min(factor, 10) : 1;

        if (safeFactor > 1) {
          mods.push({
            type: 'double_xp',
            factor: safeFactor,
            eventId: row.id,
          });
        }
      }
    } catch (err) {
      logger.warn('getActiveGlobalModifiers: failed to query double_xp_events', {
        error: err.message,
      });
    }

    // (Optional future) faction buffs / global_modifiers table could be added here

    return mods;
  }

  /**
   * Subtract one day from date string
   * @param {string} dayStr - Day string (YYYY-MM-DD)
   * @returns {string} Previous day string
   */
  subtractOneDay(dayStr) {
    const [y, m, d] = dayStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() - 1);

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}

module.exports = MultiplierService;
