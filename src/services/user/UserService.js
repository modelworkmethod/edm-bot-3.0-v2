/**
 * User Service
 * High-level user operations and orchestration
 */

const { createLogger } = require('../../utils/logger');
const { AppError, ErrorTypes } = require('../../utils/errorHandler');
const { XPCalculator } = require('../xp/XPCalculator');
const GAME_CONSTANTS = require('../../config/constants');


const LCmod = require('../xp/LevelCalculator');
const LevelCalculator = LCmod?.default || LCmod.LevelCalculator || LCmod;
const computeLevelFromTotalXP =
  LCmod.computeLevelFromTotalXP ||
  (LevelCalculator && LevelCalculator.computeLevelFromTotalXP) ||
  ((xp) => ({
    level: 1,
    currentXP: 0,
    xpForNext: 0,
    totalXP: Number(xp || 0),
    progress: 0,
    className: 'Unknown'
  }));

const checkLevelUp =
  LCmod.checkLevelUp ||
  (LevelCalculator && LevelCalculator.checkLevelUp) ||
  ((oldXP, newXP) => ({
    leveledUp: false,
    oldLevel: 1,
    newLevel: 1,
    oldClassName: 'Unknown',
    newClassName: 'Unknown'
  }));

const ArchetypeService = require('./ArchetypeService');

const logger = createLogger('UserService');

const { query } = require('../../database/postgres');

// ✅ Optional config sources (don’t hard-crash if missing)
let envConfig = null;
let settingsConfig = null;
try { envConfig = require('../../config/environment'); } catch {}
try { settingsConfig = require('../../config/settings'); } catch {}

class UserService {
  constructor(
    reposOrUserRepo,
    archetypeService = new ArchetypeService(),
    levelCalculator = null,
    nicknameService = null
  ) {
    // Normalize repository input
    if (!reposOrUserRepo) {
      throw new Error('UserService: repositories (or userRepository) is undefined');
    }

    if (reposOrUserRepo.user || reposOrUserRepo.stats) {
      // Get the UserRepository & StatsRepository
      this.repos = reposOrUserRepo;
      this.userRepo = reposOrUserRepo.user;
      this.statsRepo = reposOrUserRepo.stats || null;
    } else {
      // Only UserRepository passed
      this.repos = { user: reposOrUserRepo };
      this.userRepo = reposOrUserRepo;
      this.statsRepo = null;
    }

    if (!this.userRepo) {
      throw new Error('UserService: user repository is missing (repositories.user is undefined)');
    }

    this.archetypeService = archetypeService;

    // LevelCalculator (accepts class or functional module)
    if (levelCalculator) {
      this.levelCalculator = levelCalculator;
    } else if (typeof LevelCalculator === 'function') {
      // If LevelCalculator is a class/constructor
      this.levelCalculator = new LevelCalculator();
    } else {
      // Fallback to standalone functions
      this.levelCalculator = {
        compute: computeLevelFromTotalXP,
        checkLevelUp
      };
    }

    this.nicknameService = nicknameService;

    // ✅ NEW: discord client injection (optional)
    this.discordClient = null;

    // ✅ NEW: simple dedupe to avoid double-announce if multiple sources award XP fast
    // key: `${userId}:${newLevel}`
    this._announcedLevels = new Set();
  }

  // Compute helper
  compute(xp) {
    if (this.levelCalculator && typeof this.levelCalculator.compute === 'function') {
      return this.levelCalculator.compute(xp);
    }
    return computeLevelFromTotalXP(xp);
  }

  /**
   * Set nickname service (called after initialization)
   * @param {NicknameService} nicknameService
   */
  setNicknameService(nicknameService) {
    this.nicknameService = nicknameService;
  }

  /**
   * ✅ NEW: Inject Discord client so UserService can announce level-ups.
   * Call this once on startup after client is ready.
   * @param {import('discord.js').Client} client
   */
  setDiscordClient(client) {
    this.discordClient = client || null;
  }

  /**
   * ✅ Resolve General channel ID from config (single source of truth)
   */
  _getGeneralChannelId() {
    const { getGeneralChannelId } = require('../../config/environment');
    const config = require('../../config/settings');
    return getGeneralChannelId() || config.channels?.general || null;
  }

  /**
   * ✅ Best-effort level title resolver (YOUR constants structure)
   * Priority:
   * 1) exact match in LEVEL_THRESHOLDS for that level
   * 2) tier match in LEVEL_CLASSES (min/max)
   * 3) fallbackName (e.g. LevelCalculator newClassName)
   */
  _getLevelTitle(level, fallbackName = 'Unknown') {
    const lvl = Number(level);
    if (!Number.isFinite(lvl) || lvl < 1) return (fallbackName || 'Unknown');

    // Your constants block
    const thresholds = GAME_CONSTANTS?.LEVEL_THRESHOLDS;
    if (Array.isArray(thresholds)) {
      const exact = thresholds.find((x) => Number(x?.level) === lvl);
      const name = exact?.className;
      if (typeof name === 'string' && name.trim()) return name.trim();
    }

    const tiers = GAME_CONSTANTS?.LEVEL_CLASSES;
    if (Array.isArray(tiers)) {
      const tier = tiers.find((t) => lvl >= Number(t?.min) && lvl <= Number(t?.max));
      const tname = tier?.name;
      if (typeof tname === 'string' && tname.trim()) return tname.trim();
    }

    if (typeof fallbackName === 'string' && fallbackName.trim()) return fallbackName.trim();
    return 'Unknown';
  }

  /**
   * ✅ Announce level up in General (best-effort, never throws)
   */
  async _announceLevelUp(userId, newLevel, className = 'Unknown') {
    try {
      // allow disabling via env
      if (String(process.env.ANNOUNCE_LEVEL_UPS || '').toLowerCase() === 'false') return;

      const generalChannelId = this._getGeneralChannelId();
      if (!generalChannelId) return;
      if (!this.discordClient) return;

      const key = `${userId}:${newLevel}`;
      if (this._announcedLevels.has(key)) return; // simple dedupe
      this._announcedLevels.add(key);

      // keep set from growing forever
      if (this._announcedLevels.size > 2000) {
        this._announcedLevels.clear();
        this._announcedLevels.add(key);
      }

      const channel = await this.discordClient.channels.fetch(generalChannelId).catch(() => null);
      if (!channel || typeof channel.send !== 'function') return;

      const title = this._getLevelTitle(newLevel, className);
      const msg = `🎉 **<@${userId}>** leveled up to **LVL ${newLevel} — ${title}**!`;

      await channel.send({ content: msg }).catch(() => {});
    } catch {
      // never break XP flow
    }
  }

  /**
   * Get or create user
   * @param {string} userId - Discord user ID
   * @param {string} username - Discord username
   * @returns {Promise<object>} User data
   */
  async getOrCreateUser(userId, username = null) {
    return await this.userRepo.getOrCreate(userId, username);
  }

  /**
   * Update user stats with XP and affinities
   * - Usa columnas: warrior_affinity, mage_affinity, templar_affinity
   * - Hace UPSERT  users
   * @param {string} userId - Discord user ID
   * @param {number} xpDelta - XP change
   * @param {object} affinityDeltas - { warrior, mage, templar }
   * @param {string} source - Source of change
   * @returns {Promise<object>} Update result with level-up & archetype info
   */
  async updateUserStats(userId, xpDelta, affinityDeltas = {}, source = 'stats_submission') {
    try {
      // 1) Get old user stats
      const oldUser = await this.userRepo.findByUserId(userId);
      const oldXP = oldUser ? Number(oldUser.xp || 0) : 0;

      const oldWarrior = oldUser ? Number(oldUser.warrior_affinity || 0) : 0;
      const oldMage = oldUser ? Number(oldUser.mage_affinity || 0) : 0;
      const oldTemplar = oldUser ? Number(oldUser.templar_affinity || 0) : 0;

      const warriorDelta = affinityDeltas.warrior || 0;
      const mageDelta = affinityDeltas.mage || 0;
      const templarDelta = affinityDeltas.templar || 0;

      // 2) UPSERT direct in users table
      const result = await this.repos.user.raw(
        `
        INSERT INTO users (user_id, xp, warrior_affinity, mage_affinity, templar_affinity)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id) DO UPDATE
        SET xp = users.xp + EXCLUDED.xp,
            warrior_affinity = users.warrior_affinity + EXCLUDED.warrior_affinity,
            mage_affinity = users.mage_affinity + EXCLUDED.mage_affinity,
            templar_affinity = users.templar_affinity + EXCLUDED.templar_affinity,
            updated_at = NOW()
        RETURNING *;
        `,
        [userId, xpDelta, warriorDelta, mageDelta, templarDelta]
      );

      const updatedUser = result.rows[0];

      // 3) Level-up
      let levelChange;
      if (this.levelCalculator && typeof this.levelCalculator.checkLevelUp === 'function') {
        levelChange = this.levelCalculator.checkLevelUp(oldXP, updatedUser.xp);
      } else {
        levelChange = checkLevelUp(oldXP, updatedUser.xp);
      }

      // ✅ NEW: announce level-up (best-effort)
      if (levelChange?.leveledUp) {
        const newLevel = Number(levelChange.newLevel || 1);
        const className =
          levelChange.newClassName ||
          this.compute(updatedUser.xp)?.className ||
          'Unknown';

        // fire-and-forget (don’t block XP pipeline)
        this._announceLevelUp(userId, newLevel, className).catch(() => {});
      }

      // 4) Archetype change
      const newWarrior = Number(updatedUser.warrior_affinity || 0);
      const newMage = Number(updatedUser.mage_affinity || 0);
      const newTemplar = Number(updatedUser.templar_affinity || 0);

      const oldArchetype = this.archetypeService.getDominantArchetype(
        oldWarrior,
        oldMage,
        oldTemplar
      );
      const newArchetype = this.archetypeService.getDominantArchetype(
        newWarrior,
        newMage,
        newTemplar
      );
      const archetypeChanged = this.archetypeService.hasArchetypeChanged(
        oldArchetype,
        newArchetype
      );

      logger.info('User stats updated', {
        userId,
        xpDelta,
        newXP: updatedUser.xp,
        leveledUp: levelChange?.leveledUp,
        archetypeChanged,
        source
      });

      // 5) Nickname async if needed
      if (this.nicknameService && (levelChange?.leveledUp || archetypeChanged)) {
        this.nicknameService.updateNickname(userId).catch(err => {
          logger.warn('Nickname update failed (non-critical)', { userId, error: err.message });
        });
      }

      return {
        user: updatedUser,
        levelChange,
        archetypeChange: archetypeChanged
          ? { old: oldArchetype, new: newArchetype }
          : null
      };

    } catch (error) {
      logger.error('Failed to update user stats', {
        userId,
        error: error.message
      });
      throw new AppError(
        'Failed to update user stats',
        ErrorTypes.DATABASE,
        { userId, originalError: error.message }
      );
    }
  }

  /**
   * Update user stat total (for specific activities)
   * @param {string} userId - Discord user ID
   * @param {string} statType - Type of stat
   * @param {number} increment - Amount to add
   * @returns {Promise<object>} Updated stat
   */
  async updateUserStatTotal(userId, statType, increment) {
    return await this.statsRepo.updateTotal(userId, statType, increment);
  }

  /**
   * Get user's full profile
   * @param {string} userId - Discord user ID
   * @returns {Promise<object>} Full user profile
   */
  async getUserProfile(userId) {
    const user = await this.userRepo.findByUserId(userId);

    if (!user) {
      throw new AppError(
        'User not found',
        ErrorTypes.NOT_FOUND,
        { userId }
      );
    }

    // Level info
    const levelInfo =
      (this.levelCalculator && typeof this.levelCalculator.compute === 'function')
        ? this.levelCalculator.compute(user.xp)
        : computeLevelFromTotalXP(user.xp);

    // Archetype usando *_affinity
    const archetype = this.archetypeService.getDominantArchetype(
      Number(user.warrior_affinity || 0),
      Number(user.mage_affinity || 0),
      Number(user.templar_affinity || 0)
    );

    const rank = await this.userRepo.getRankByXP(userId);
    const topStats = this.statsRepo
      ? await this.statsRepo.getTopStatsForUser(userId, 5)
      : [];

    return {
      user,
      levelInfo,
      archetype,
      rank,
      topStats
    };
  }

  /**
   * Set user faction
   * @param {string} userId - Discord user ID
   * @param {string} faction - Faction name
   * @returns {Promise<object>} Updated user
   */
  async setUserFaction(userId, faction) {
    return await this.userRepo.setFaction(userId, faction);
  }

  async getUser(userId) {
    if (!this.userRepo || !userId) return null;
    return this.userRepo.findByUserId(userId);
  }

  /**
   * Reset all stats for a user:
   * - XP y afinidades en `users`
   * - Registros de `user_stats`
   * - Registros de `user_daily`
   */
  async resetUserStats(userId) {
    logger.warn('Resetting user stats', { userId });

    if (!userId) {
      throw new Error('UserService.resetUserStats: userId is required');
    }

    try {
      await query(
        `
        UPDATE users
        SET 
          xp = 0,
          warrior_affinity = 0,
          mage_affinity = 0,
          templar_affinity = 0,
          updated_at = NOW()
        WHERE user_id = $1
        `,
        [userId]
      );

      await query(`DELETE FROM user_stats WHERE user_id = $1`, [userId]);
      await query(`DELETE FROM user_daily WHERE user_id = $1`, [userId]);
      await query(`DELETE FROM processed_msgs WHERE user_id = $1`, [userId]);

      logger.info('UserService.resetUserStats: stats reset OK', { userId });
      return { success: true };
    } catch (error) {
      logger.error('UserService.resetUserStats: failed', {
        userId,
        error: error.message
      });

      throw new AppError(
        'Failed to reset user stats',
        ErrorTypes.DATABASE,
        { userId, originalError: error.message }
      );
    }
  }
}

module.exports = UserService;
