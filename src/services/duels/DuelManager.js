/**
 * Duel Manager
 * Handles player vs player XP duels with balance requirements
 */

const { createLogger } = require('../../utils/logger');
const { query, queryRow, queryRows } = require('../../database/postgres');

const logger = createLogger('DuelManager');

// Balance thresholds (Templar range: 40-60%)
const BALANCE_MIN = 40;
const BALANCE_MAX = 60;

class DuelManager {
  /**
   * @param {UserService} userService
   * @param {ChannelService} channelService
   * @param {object} repositories
   * @param {AnnouncementQueue|null} announcementQueue
   */
  constructor(userService, channelService, repositories, announcementQueue = null) {
    this.userService = userService || null;
    this.channelService = channelService;
    this.repositories = repositories || {};
    this.announcementQueue = announcementQueue || null;

    logger.info('DuelManager initialized', {
      hasUserService: !!this.userService,
      hasUserRepo: !!(this.repositories?.user || this.repositories?.users),

    });
  }

  /**
   * Internal helper to get user from repositories (prefer) or fallback to userService
   */
  async _getUser(userId) {
    try {
      // 1) Prefer repositories.user.findByUserId
      if (this.repositories?.user?.findByUserId) {
        return await this.repositories.user.findByUserId(userId);
      }

      // 2) Fallback a userService.getUser si existe
      if (this.userService && typeof this.userService.getUser === 'function') {
        return await this.userService.getUser(userId);
      }

      // 3) Nada disponible
      logger.warn('DuelManager._getUser: no usable user provider', { userId });
      return null;
    } catch (err) {
      logger.error('DuelManager._getUser failed', { userId, error: err.message });
      return null;
    }
  }

  /**
   * Challenge another player to a duel
   */
  async createDuel(challengerId, opponentId) {
    try {
      const challenger = await this._getUser(challengerId);
      const opponent = await this._getUser(opponentId);

      if (!challenger || !opponent) {
        return {
          success: false,
          error: 'Player not found',
        };
      }

      // Validation
      if (challengerId === opponentId) {
        return { success: false, error: 'You cannot duel yourself!' };
      }

      // Check if either player has an active or pending duel
      const activeDuel = await this.getActiveDuel(challengerId, opponentId);
      if (activeDuel) {
        return { success: false, error: 'One of you already has an active or pending duel!' };
      }

      // Get fresh starting stats again (por si cambian entre lecturas)
      const [freshChallenger, freshOpponent] = await Promise.all([
        this._getUser(challengerId),
        this._getUser(opponentId),
      ]);

      if (!freshChallenger || !freshOpponent) {
        return { success: false, error: 'Player not found' };
      }

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000); // 24h

      const duel = await queryRow(
        `INSERT INTO duels (
          challenger_id,
          opponent_id,
          start_time,
          end_time,
          status,
          challenger_start_xp,
          challenger_start_warrior_affinity,
          challenger_start_mage_affinity,
          opponent_start_xp,
          opponent_start_warrior_affinity,
          opponent_start_mage_affinity
        )
        VALUES (
          $1, $2, $3, $4, 'pending',
          $5, $6, $7,
          $8, $9, $10
        )
        RETURNING *`,
        [
          challengerId,
          opponentId,
          startTime,
          endTime,
          Number(freshChallenger.xp || 0),
          Number(freshChallenger.warrior_affinity || 0),
          Number(freshChallenger.mage_affinity || 0),
          Number(freshOpponent.xp || 0),
          Number(freshOpponent.warrior_affinity || 0),
          Number(freshOpponent.mage_affinity || 0),
        ]
      );

      logger.info('Duel created', { duelId: duel.id, challengerId, opponentId });

      return {
        success: true,
        duel,
        message: 'Duel challenge sent! Opponent has 1 hour to accept.',
      };
    } catch (error) {
      logger.error('Failed to create duel', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Accept duel challenge
   */
  async acceptDuel(duelId, userId) {
    const duel = await this.getDuel(duelId);

    if (!duel || duel.opponent_id !== userId) {
      return { success: false, error: 'Duel not found or you are not the opponent' };
    }

    if (duel.status !== 'pending') {
      return { success: false, error: 'Duel is no longer pending' };
    }

    // Check if challenge expired (1 hour timeout)
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (new Date(duel.created_at) < hourAgo) {
      await query(`UPDATE duels SET status = 'declined' WHERE id = $1`, [duelId]);
      return { success: false, error: 'Challenge expired' };
    }

    await query(`UPDATE duels SET status = 'active' WHERE id = $1`, [duelId]);
    logger.info('Duel accepted', { duelId, userId });

    return {
      success: true,
      message: 'Duel accepted! You have 24 hours to earn XP while staying balanced.',
    };
  }

  /**
   * Decline duel challenge
   */
  async declineDuel(duelId, userId) {
    const duel = await this.getDuel(duelId);

    if (!duel || duel.opponent_id !== userId) {
      return { success: false, error: 'Duel not found or you are not the opponent' };
    }

    if (duel.status !== 'pending') {
      return { success: false, error: 'Duel is no longer pending' };
    }

    await query(`UPDATE duels SET status = 'declined' WHERE id = $1`, [duelId]);
    logger.info('Duel declined', { duelId, userId });

    return { success: true, message: 'Duel declined' };
  }

  /**
   * Track stats submitted during active duel
   */
  async trackDuelStat(userId, statName, statValue, xpEarned, warriorChange, mageChange) {
    const duel = await this.getActiveDuelForUser(userId);
    if (!duel) return;

    await query(
      `INSERT INTO duel_stats (
        duel_id,
        user_id,
        stat_name,
        stat_value,
        xp_earned,
        warrior_affinity_change,
        mage_affinity_change
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        duel.id,
        userId,
        statName,
        statValue,
        xpEarned,
        warriorChange || 0,
        mageChange || 0,
      ]
    );

    const isBalanced = await this.checkBalance(duel.id, userId);
    if (!isBalanced) {
      logger.warn('Duel balance violation', { duelId: duel.id, userId });

      if (userId === duel.challenger_id) {
        await query(`UPDATE duels SET challenger_balance_penalty = true WHERE id = $1`, [duel.id]);
      } else {
        await query(`UPDATE duels SET opponent_balance_penalty = true WHERE id = $1`, [duel.id]);
      }
    }
  }

  /**
   * Check if user maintains Templar balance
   */
  async checkBalance(_duelId, userId) {
    const user = await this._getUser(userId);
    if (!user) return true;

    const warriorAffinity = Number(user.warrior_affinity || 0);
    const mageAffinity = Number(user.mage_affinity || 0);
    const totalAffinity = warriorAffinity + mageAffinity;

    if (totalAffinity === 0) return true;

    const warriorPercent = (warriorAffinity / totalAffinity) * 100;
    return warriorPercent >= BALANCE_MIN && warriorPercent <= BALANCE_MAX;
  }

  /**
   * Complete duel and determine winner
   */
  async completeDuel(duelId, channelId) {
    const duel = await this.getDuel(duelId);

    if (!duel || duel.status !== 'active') {
      return { success: false, error: 'Duel not found or not active' };
    }

    const [challenger, opponent] = await Promise.all([
      this._getUser(duel.challenger_id),
      this._getUser(duel.opponent_id),
    ]);

    const challengerXP = Number(challenger?.xp || 0);
    const opponentXP = Number(opponent?.xp || 0);

    const challengerXPGained =
      challengerXP - Number(duel.challenger_start_xp || 0);
    const opponentXPGained =
      opponentXP - Number(duel.opponent_start_xp || 0);

    // Final balance verification at completion
    const challengerBalanced = await this.checkBalance(duel.id, duel.challenger_id);
    const opponentBalanced = await this.checkBalance(duel.id, duel.opponent_id);

    if (!challengerBalanced) {
      await query(`UPDATE duels SET challenger_balance_penalty = true WHERE id = $1`, [duel.id]);
      duel.challenger_balance_penalty = true;
    }

    if (!opponentBalanced) {
      await query(`UPDATE duels SET opponent_balance_penalty = true WHERE id = $1`, [duel.id]);
      duel.opponent_balance_penalty = true;
    }

    let winnerId = null;

    if (duel.challenger_balance_penalty && duel.opponent_balance_penalty) {
      winnerId = null;
    } else if (duel.challenger_balance_penalty) {
      winnerId = duel.opponent_id;
    } else if (duel.opponent_balance_penalty) {
      winnerId = duel.challenger_id;
    } else {
      winnerId =
        challengerXPGained > opponentXPGained
          ? duel.challenger_id
          : duel.opponent_id;
    }

    const challengerPerfect = challenger ? this.isPerfectBalance(challenger) : false;
    const opponentPerfect = opponent ? this.isPerfectBalance(opponent) : false;

    await query(
      `UPDATE duels SET
        status = 'completed',
        winner_id = $1,
        challenger_final_xp = $2,
        challenger_final_warrior_affinity = $3,
        challenger_final_mage_affinity = $4,
        opponent_final_xp = $5,
        opponent_final_warrior_affinity = $6,
        opponent_final_mage_affinity = $7,
        completed_at = NOW()
      WHERE id = $8`,
      [
        winnerId,
        challengerXP,
        Number(challenger?.warrior_affinity || 0),
        Number(challenger?.mage_affinity || 0),
        opponentXP,
        Number(opponent?.warrior_affinity || 0),
        Number(opponent?.mage_affinity || 0),
        duelId,
      ]
    );

    if (winnerId) {
      await this.awardDuelVictoryXP(
        winnerId,
        challengerPerfect || opponentPerfect
      );
    }

    await this.announceDuelResult(
      channelId,
      duel,
      winnerId,
      challengerXPGained,
      opponentXPGained
    );

    logger.info('Duel completed', { duelId, winnerId });

    return {
      success: true,
      winnerId,
      challengerXPGained,
      opponentXPGained,
    };
  }

  /**
   * Check if balance is perfect (45-55%)
   */
  isPerfectBalance(user) {
    const warriorAffinity = Number(user.warrior_affinity || 0);
    const mageAffinity = Number(user.mage_affinity || 0);
    const totalAffinity = warriorAffinity + mageAffinity;

    if (totalAffinity === 0) return false;

    const warriorPercent = (warriorAffinity / totalAffinity) * 100;
    return warriorPercent >= 45 && warriorPercent <= 55;
  }

  /**
   * Award victory XP
   */
  async awardDuelVictoryXP(userId, hadPerfectBalance) {
    const SecondaryXPProcessor = require('../xp/SecondaryXPProcessor');
    const secondaryXP = new SecondaryXPProcessor(this.repositories, this.userService);

    await secondaryXP.awardSecondaryXP(userId, 'duels', 'winDuel');

    if (hadPerfectBalance) {
      await secondaryXP.awardSecondaryXP(userId, 'duels', 'perfectBalance');
    }
  }

  /**
   * Announce duel result
   */
  async announceDuelResult(channelId, duel, winnerId, challengerXP, opponentXP) {
    let description;

    if (!winnerId) {
      description = `**DRAW!**\n\nBoth players became unbalanced during the duel.\n\nNo winner declared.`;
    } else if (winnerId === duel.challenger_id) {
      description =
        `**<@${duel.challenger_id}> WINS!**\n\n` +
        `**XP Gained:**\n<@${duel.challenger_id}>: ${challengerXP} XP\n<@${duel.opponent_id}>: ${opponentXP} XP`;
    } else {
      description =
        `**<@${duel.opponent_id}> WINS!**\n\n` +
        `**XP Gained:**\n<@${duel.opponent_id}>: ${opponentXP} XP\n<@${duel.challenger_id}>: ${challengerXP} XP`;
    }

    if (duel.challenger_balance_penalty) {
      description += `\n\n<@${duel.challenger_id}> became unbalanced (forfeit)`;
    }
    if (duel.opponent_balance_penalty) {
      description += `\n\n<@${duel.opponent_id}> became unbalanced (forfeit)`;
    }

    await this.channelService.sendToChannel(channelId, {
      embeds: [
        {
          color: winnerId ? 0x00ff00 : 0xff6b6b,
          title: 'DUEL COMPLETE',
          description,
          footer: { text: '24-hour balanced XP challenge' },
        },
      ],
    });
  }

  /**
   * Get duel by ID
   */
  async getDuel(duelId) {
    return await queryRow('SELECT * FROM duels WHERE id = $1', [duelId]);
  }

  /**
   * Get active duel for user
   */
  async getActiveDuelForUser(userId) {
    return await queryRow(
      `SELECT *
       FROM duels
       WHERE (challenger_id = $1 OR opponent_id = $1)
         AND status = 'active'
         AND end_time > NOW()
       LIMIT 1`,
      [userId]
    );
  }

  /**
   * Check if either player has active/pending duel
   */
  async getActiveDuel(challengerId, opponentId) {
    return await queryRow(
      `SELECT *
       FROM duels
       WHERE (challenger_id = $1 OR opponent_id = $1 OR challenger_id = $2 OR opponent_id = $2)
         AND (
           (status = 'pending' AND created_at > NOW() - INTERVAL '1 hour')
           OR (status = 'active' AND end_time > NOW())
         )
       LIMIT 1`,
      [challengerId, opponentId]
    );
  }

  /**
   * Get duel history for user
   */
  async getUserDuelHistory(userId, limit = 10) {
    return await queryRows(
      `SELECT *
       FROM duels
       WHERE (challenger_id = $1 OR opponent_id = $1)
         AND status = 'completed'
       ORDER BY completed_at DESC
       LIMIT $2`,
      [userId, limit]
    );
  }

  /**
   * Get duel win/loss record
   */
  async getUserDuelRecord(userId) {
    const result = await queryRow(
      `SELECT
         COUNT(*) FILTER (WHERE winner_id = $1)                         AS wins,
         COUNT(*) FILTER (WHERE winner_id IS NOT NULL AND winner_id != $1) AS losses,
         COUNT(*) FILTER (WHERE winner_id IS NULL)                      AS draws
       FROM duels
       WHERE (challenger_id = $1 OR opponent_id = $1)
         AND status = 'completed'`,
      [userId]
    );

    return {
      wins: parseInt(result?.wins || 0, 10),
      losses: parseInt(result?.losses || 0, 10),
      draws: parseInt(result?.draws || 0, 10),
    };
  }

  /**
   * Check and complete expired duels (cron job helper)
   */
  async checkExpiredDuels(channelId) {
    const expired = await queryRows(
      `SELECT *
       FROM duels
       WHERE status = 'active'
         AND end_time < NOW()`
    );

    for (const duel of expired) {
      await this.completeDuel(duel.id, channelId);
    }
  }
}

module.exports = DuelManager;
