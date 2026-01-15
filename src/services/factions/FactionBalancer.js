/**
 * Faction Balancer
 * Threshold-based faction assignment for new members
 */

const { createLogger } = require('../../utils/logger');
const factionConfig = require('../../config/factionConfig');

const logger = createLogger('FactionBalancer');

class FactionBalancer {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  /**
   * Pick faction for new member using threshold-based balancing
   * @param {Guild} guild - Discord guild (for future use)
   * @returns {Promise<object>} { factionKey, reason, counts }
   */
  async pickFactionForNewMember(guild) {
    try {
      // Get current faction counts (only active users with XP > 0)
      const counts = await this.getActiveFactionCounts();
      
      const luminarchCount = counts.Luminarchs || 0;
      const noctivoreCount = counts.Noctivores || 0;
      const diff = Math.abs(luminarchCount - noctivoreCount);

      let chosenFaction;
      let reason;

      // Apply threshold-based balancing
      if (diff >= factionConfig.threshold) {
        // Assign to smaller faction
        chosenFaction = luminarchCount < noctivoreCount 
          ? factionConfig.factions.LUMINARCHS.key 
          : factionConfig.factions.NOCTIVORES.key;
        reason = 'balance';
      } else {
        // Within threshold - alternate by timestamp
        const timestamp = Date.now();
        chosenFaction = (timestamp % 2 === 0) 
          ? factionConfig.factions.LUMINARCHS.key 
          : factionConfig.factions.NOCTIVORES.key;
        reason = 'alternate';
      }

      logger.info('Faction assigned for new member', {
        faction: chosenFaction,
        reason,
        counts: { Luminarchs: luminarchCount, Noctivores: noctivoreCount },
        diff,
        threshold: factionConfig.threshold
      });

      return {
        factionKey: chosenFaction,
        reason,
        counts: {
          Luminarchs: luminarchCount,
          Noctivores: noctivoreCount
        }
      };

    } catch (error) {
      logger.error('Failed to pick faction', { error: error.message });
      // Default to Luminarchs on error
      return {
        factionKey: factionConfig.factions.LUMINARCHS.key,
        reason: 'default_error',
        counts: { Luminarchs: 0, Noctivores: 0 }
      };
    }
  }

  /**
   * Get faction counts (only active users with XP > 0)
   * @returns {Promise<object>} { Luminarchs: number, Noctivores: number }
   */
  async getActiveFactionCounts() {
    try {
      const result = await this.userRepository.raw(
        `SELECT faction, COUNT(*) as count 
         FROM users 
         WHERE faction IS NOT NULL AND xp > 0
         GROUP BY faction`
      );

      const counts = { Luminarchs: 0, Noctivores: 0 };
      
      if (result.rows) {
        for (const row of result.rows) {
          if (row.faction === 'Luminarchs' || row.faction === 'Noctivores') {
            counts[row.faction] = parseInt(row.count) || 0;
          }
        }
      }

      return counts;
    } catch (error) {
      logger.error('Failed to get faction counts', { error: error.message });
      return { Luminarchs: 0, Noctivores: 0 };
    }
  }
}

module.exports = FactionBalancer;


