/**
 * Raid Manager
 * Handles Warrior vs Mage raid events
 */

const { createLogger } = require('../../utils/logger');
const { query, queryRow, queryRows } = require('../../database/postgres');

const logger = createLogger('RaidManager');

// Raid point values - MUST match exact stat names from constants
const RAID_POINTS = {
  warrior: {
    'Approaches': 15,
    'Numbers': 15,
    'Dates Had': 40,
    'Instant Date': 40,
    'Same Night Pull': 40,
    'Hellos To Strangers': 15
  },
  mage: {
    'SBMM Meditation': 15,
    'Grounding': 15,
    'Releasing Sesh': 40,
    'Confidence Tension Journal Entry': 40,
    'Course Module': 40,
    'Course Experiment': 15
  }
};

class RaidManager {
  /**
   * @param {ChannelService|null} channelService
   * @param {object} repositories
   * @param {AnnouncementQueue|null} announcementQueue
   */
  constructor(channelService, repositories = {}, announcementQueue = null) {
    this.channelService = channelService || null;
    this.repos = repositories || {};
    this.repositories = this.repos; // alias
    this.announcementQueue = announcementQueue || null;
  }

  /**
   * Track contribution via affinities (usado desde StatsProcessor)
   * @param {string} userId
   * @param {object} stats      // { 'Approaches': 3, ... } (no se usan aquí)
   * @param {object} affinities // { warrior, mage, templar }
   */
  async trackStatsContribution(userId, stats, affinities) {
    const activeRaid = await this.getActiveRaid();
    if (!activeRaid) return;

    let points = 0;

    if (activeRaid.raid_type === 'warrior') {
      points = affinities.warrior || 0;
    } else if (activeRaid.raid_type === 'mage') {
      points = affinities.mage || 0;
    }

    if (points <= 0) return;

    const statType =
      activeRaid.raid_type === 'warrior'
        ? 'warrior_affinity'
        : 'mage_affinity';

    const insertSql = `
      INSERT INTO raid_contributions (
        raid_id, user_id, stat_type, value, points_earned
      )
      VALUES ($1, $2, $3, $4, $5)
    `;
    const insertParams = [activeRaid.id, userId, statType, points, points];

    const updateSql = `
      UPDATE raid_events
      SET current_points = current_points + $1
      WHERE id = $2
    `;
    const updateParams = [points, activeRaid.id];

    try {
      if (this.repos.raid && typeof this.repos.raid.raw === 'function') {
        await this.repos.raid.raw(insertSql, insertParams);
        await this.repos.raid.raw(updateSql, updateParams);
      } else {
        await query(insertSql, insertParams);
        await query(updateSql, updateParams);
      }

      logger.info('RaidManager: recorded stats contribution', {
        raidId: activeRaid.id,
        userId,
        points,
        raidType: activeRaid.raid_type
      });
    } catch (err) {
      logger.error('RaidManager: failed to record stats contribution', {
        raidId: activeRaid.id,
        userId,
        error: err.message
      });
    }
  }

  /**
   * ✅ NEW: Add manual points (admin correction)
   * Inserts a contribution row and increments raid_events.current_points.
   *
   * faction (optional): 'luminarchs' | 'noctivores' | 'unaligned'
   * We store it inside stat_type as: manual:luminarchs (so faction totals can count it)
   */
  async addManualPoints(raidId, points, { faction = null, reason = null, adminId = null } = {}) {
    try {
      const raid = await this.getRaid(raidId);
      if (!raid) return { success: false, error: 'Raid not found' };

      if (raid.status !== 'active') {
        return { success: false, error: `Raid is not active (status: ${raid.status})` };
      }

      const p = Number(points || 0);
      if (!Number.isFinite(p) || p <= 0) {
        return { success: false, error: 'Points must be a positive number' };
      }

      const f =
        faction === 'luminarchs' ? 'luminarchs' :
        faction === 'noctivores' ? 'noctivores' :
        faction === 'unaligned' ? 'unaligned' :
        null;

      // stat_type encodes faction + optional reason
      // (reason no lo guardamos como columna porque no existe; lo metemos en stat_type si quieres)
      // Mantenerlo simple y estable:
      const statType = f ? `manual:${f}` : 'manual';
      const value = 1; // "1 ajuste", points_earned contiene el impacto real

      // 1) log contribution
await query(
  `
  INSERT INTO raid_contributions (raid_id, user_id, stat_type, value, points_earned)
  VALUES ($1, $2, $3, $4, $5)
  `,
  [raidId, adminId || 'system', statType, value, p]
);

      // 2) increment raid total
      await query(
        `
        UPDATE raid_events
        SET current_points = current_points + $1
        WHERE id = $2
        `,
        [p, raidId]
      );

      logger.info('RaidManager: manual points added', {
        raidId,
        points: p,
        faction: f || null,
        adminId: adminId || null,
        reason: reason || null
      });

      return { success: true };
    } catch (err) {
      logger.error('RaidManager.addManualPoints: failed', {
        raidId,
        error: err.message
      });
      return { success: false, error: err.message };
    }
  }

  /**
   * Create new raid event
   */
  async createRaid(raidType, durationMinutes = 60, targetPoints = 1000) {
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

    const result = await queryRow(
      `INSERT INTO raid_events (raid_type, start_time, end_time, status, target_points, current_points)
       VALUES ($1, $2, $3, 'scheduled', $4, 0)
       RETURNING *`,
      [raidType, startTime, endTime, targetPoints]
    );

    logger.info('Raid created', { raidId: result.id, raidType, targetPoints });
    return result;
  }

  /**
   * Start raid (change status to active)
   * @param {number} raidId
   * @param {string} channelId
   */
  async startRaid(raidId, channelId) {
    await query(
      `UPDATE raid_events SET status = 'active' WHERE id = $1`,
      [raidId]
    );

    const raid = await this.getRaid(raidId);

    const descriptionLines = [
      `**${raid.raid_type === 'warrior' ? 'Outer Action' : 'Inner Work'} Challenge**`,
      '',
      `**Target:** ${raid.target_points.toLocaleString()} points`,
      `**Time Limit:** ${this.getTimeRemaining(raid.end_time)}`,
      ''
    ];

    if (raid.raid_type === 'warrior') {
      descriptionLines.push(
        '🔥 **Warrior Stats Count:**',
        '• Approaches: 5pts',
        '• Numbers: 10pts',
        '• Dates: 40pts',
        '• Instant Dates: 120pts',
        '• SNPs: 400pts'
      );
    } else {
      descriptionLines.push(
        '🧘 **Mage Stats Count:**',
        '• SBMM: 50pts',
        '• Grounding: 30pts',
        '• Releasing: 25pts',
        '• CTJ: 40pts',
        '• Module: 200pts'
      );
    }

    descriptionLines.push(
      '',
      '**Submit your stats to contribute!**',
      'Use `/submit-stats` and your qualifying activities will count toward the raid.'
    );

    const embed = {
      color: raid.raid_type === 'warrior' ? 0xFF6B6B : 0x9B59B6,
      title: `${raid.raid_type === 'warrior' ? '⚔️ WARRIOR' : '🔮 MAGE'} RAID ACTIVE!`,
      description: descriptionLines.join('\n'),
      footer: { text: 'The clock is ticking...' },
      timestamp: new Date(raid.end_time).toISOString()
    };

    // End Raid button (start message)
    const components = [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 4,
            custom_id: `raid-end:${raid.id}`,
            label: 'End Raid ❌'
          }
        ]
      }
    ];

    if (this.channelService && typeof this.channelService.sendToChannel === 'function') {
      try {
        await this.channelService.sendToChannel(channelId, {
          embeds: [embed],
          components
        });
      } catch (err) {
        logger.error('RaidManager.startRaid: failed to send raid start message', {
          channelId,
          error: err.message
        });
      }
    } else {
      logger.error('RaidManager.startRaid: channelService is missing or invalid', {
        hasChannelService: !!this.channelService
      });
    }

    logger.info('Raid started', { raidId, raidType: raid.raid_type });
    return raid;
  }

  /**
   * End raid and determine result
   */
  async endRaid(raidId, channelId) {
    const raid = await this.getRaid(raidId);

    const success = raid.current_points >= raid.target_points;
    const newStatus = success ? 'completed' : 'failed';

    await query(
      `UPDATE raid_events SET status = $1 WHERE id = $2`,
      [newStatus, raidId]
    );

    const topContributors = await this.getTopContributors(raidId, 5);

    const resultEmbed = {
      color: success ? 0x00FF00 : 0xFF0000,
      title: success ? '🎉 RAID VICTORY!' : '💔 RAID FAILED',
      description: success
        ? `The ${raid.raid_type === 'warrior' ? '⚔️ Warriors' : '🔮 Mages'} achieved victory!\n\n**${raid.current_points.toLocaleString()}** / **${raid.target_points.toLocaleString()}** points reached!`
        : `The raid fell short...\n\n**${raid.current_points.toLocaleString()}** / **${raid.target_points.toLocaleString()}** points\n\n*Better luck next time.*`,
      fields: [],
      timestamp: new Date().toISOString()
    };

    if (topContributors.length > 0) {
      resultEmbed.fields.push({
        name: '🏆 Top Contributors',
        value: topContributors
          .map((c, i) => `${i + 1}. <@${c.user_id}>: **${Number(c.total_points || 0).toLocaleString()}** pts`)
          .join('\n')
      });
    }

    if (this.channelService && typeof this.channelService.sendToChannel === 'function') {
      try {
        await this.channelService.sendToChannel(channelId, { embeds: [resultEmbed] });
      } catch (err) {
        logger.error('RaidManager.endRaid: failed to send raid end message', {
          channelId,
          error: err.message
        });
      }
    } else {
      logger.error('RaidManager.endRaid: channelService is missing or invalid', {
        hasChannelService: !!this.channelService
      });
    }

    logger.info('Raid ended', { raidId, success, finalPoints: raid.current_points });
    return { success, finalPoints: raid.current_points };
  }

  /**
   * ✅ Single cancelRaid (no duplicates)
   * Marks raid as 'cancelled' and announces.
   */
  async cancelRaid(raidId, channelId, cancelledBy = null) {
    const raid = await this.getRaid(raidId);
    if (!raid) {
      logger.warn('RaidManager.cancelRaid: raid not found', { raidId });
      return { success: false, error: 'Raid not found' };
    }

    await query(
      `UPDATE raid_events SET status = 'cancelled' WHERE id = $1`,
      [raidId]
    );

    const title = '⛔ RAID CANCELLED';
    const descLines = [
      `${raid.raid_type === 'warrior' ? '⚔️ Warrior' : '🔮 Mage'} raid **#${raid.id}** was cancelled by an admin.`,
      '',
      cancelledBy ? `Cancelled by: <@${cancelledBy}>` : 'Cancelled by an admin.',
      '',
      `Final points: **${Number(raid.current_points || 0).toLocaleString()}** / **${Number(raid.target_points || 0).toLocaleString()}**`
    ];

    const embed = {
      color: 0x95A5A6,
      title,
      description: descLines.join('\n'),
      timestamp: new Date().toISOString()
    };

    if (channelId && this.channelService && typeof this.channelService.sendToChannel === 'function') {
      try {
        await this.channelService.sendToChannel(channelId, { embeds: [embed] });
      } catch (err) {
        logger.error('RaidManager.cancelRaid: failed to send cancel message', {
          channelId,
          error: err.message
        });
      }
    }

    logger.info('RaidManager: raid cancelled', { raidId, cancelledBy });
    return { success: true };
  }

  /**
   * Add contribution to active raid (stat-based)
   */
  async addContribution(userId, stats) {
    const activeRaid = await queryRow(
      `SELECT * FROM raid_events 
       WHERE status = 'active' 
       AND end_time > NOW() 
       ORDER BY start_time DESC 
       LIMIT 1`
    );

    if (!activeRaid) {
      return { contributed: false, reason: 'No active raid' };
    }

    const raidType = activeRaid.raid_type;
    const validStats = RAID_POINTS[raidType];

    let totalPoints = 0;
    const contributions = [];

    for (const [statName, value] of Object.entries(stats)) {
      if (validStats[statName] && value > 0) {
        const points = validStats[statName] * value;
        totalPoints += points;

        contributions.push({
          statType: statName,
          value,
          points
        });

        await query(
          `INSERT INTO raid_contributions (raid_id, user_id, stat_type, value, points_earned)
           VALUES ($1, $2, $3, $4, $5)`,
          [activeRaid.id, userId, statName, value, points]
        );
      }
    }

    if (totalPoints > 0) {
      await query(
        `UPDATE raid_events 
         SET current_points = current_points + $1 
         WHERE id = $2`,
        [totalPoints, activeRaid.id]
      );

      logger.info('Raid contribution added', {
        raidId: activeRaid.id,
        userId,
        points: totalPoints
      });
    }

    return {
      contributed: totalPoints > 0,
      points: totalPoints,
      contributions,
      raidType,
      raidProgress: await this.getRaidProgress(activeRaid.id)
    };
  }

  /**
   * Get raid progress
   */
  async getRaidProgress(raidId) {
    const raid = await this.getRaid(raidId);
    const factions = await this.getFactionTotals(raidId);

    return {
      raidId: raid.id,
      raidType: raid.raid_type,
      currentPoints: raid.current_points,
      targetPoints: raid.target_points,
      progress: raid.target_points > 0
        ? (raid.current_points / raid.target_points) * 100
        : 0,
      timeRemaining: this.getTimeRemaining(raid.end_time),
      status: raid.status,
      factions
    };
  }

  /**
   * Get raid by ID
   */
  async getRaid(raidId) {
    return await queryRow('SELECT * FROM raid_events WHERE id = $1', [raidId]);
  }

  /**
   * Get active raid
   */
  async getActiveRaid() {
    return await queryRow(
      `SELECT * FROM raid_events 
       WHERE status = 'active' 
       AND end_time > NOW() 
       ORDER BY start_time DESC 
       LIMIT 1`
    );
  }

  /**
   * Get top contributors for raid
   */
  async getTopContributors(raidId, limit = 10) {
    return await queryRows(
      `SELECT 
         user_id,
         SUM(points_earned) AS total_points,
         COUNT(*) AS contribution_count
       FROM raid_contributions
       WHERE raid_id = $1
       GROUP BY user_id
       ORDER BY total_points DESC
       LIMIT $2`,
      [raidId, limit]
    );
  }

  /**
   * ✅ Get faction totals for a raid
   * Fixes join + supports manual points with stat_type = manual:<faction>
   *
   * Assumptions:
   * - raid_contributions.user_id stores Discord ID (string)
   * - users.user_id is the Discord ID (like used in LeaderboardService)
   */
  async getFactionTotals(raidId) {
    try {
      const rows = await queryRows(
        `
        SELECT
          CASE
            WHEN rc.stat_type LIKE 'manual:%' THEN LOWER(SPLIT_PART(rc.stat_type, ':', 2))
            ELSE COALESCE(LOWER(u.faction), 'unaligned')
          END AS faction,
          SUM(rc.points_earned) AS total_points
        FROM raid_contributions rc
        LEFT JOIN users u
          ON u.user_id = rc.user_id
        WHERE rc.raid_id = $1
        GROUP BY
          CASE
            WHEN rc.stat_type LIKE 'manual:%' THEN LOWER(SPLIT_PART(rc.stat_type, ':', 2))
            ELSE COALESCE(LOWER(u.faction), 'unaligned')
          END
        `,
        [raidId]
      );

      const result = { luminarchs: 0, noctivores: 0, unaligned: 0 };

      for (const row of rows) {
        const f = (row.faction || 'unaligned').toLowerCase();
        if (f === 'luminarchs') result.luminarchs = Number(row.total_points) || 0;
        else if (f === 'noctivores') result.noctivores = Number(row.total_points) || 0;
        else result.unaligned = Number(row.total_points) || 0;
      }

      return result;
    } catch (err) {
      logger.error('RaidManager.getFactionTotals: failed to compute faction totals', {
        raidId,
        error: err.message
      });

      return { luminarchs: 0, noctivores: 0, unaligned: 0 };
    }
  }

  /**
   * Get time remaining string
   */
  getTimeRemaining(endTime) {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end - now;

    if (diff <= 0) return 'Ended';

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) return `${hours}h ${mins}m remaining`;
    return `${mins}m remaining`;
  }

  /**
   * Check if raid should end (cron job helper)
   */
  async checkAndEndExpiredRaids(channelId) {
    const expiredRaids = await queryRows(
      `SELECT * FROM raid_events 
       WHERE status = 'active' 
       AND end_time < NOW()`
    );

    for (const raid of expiredRaids) {
      await this.endRaid(raid.id, channelId);
    }
  }
}

module.exports = RaidManager;
