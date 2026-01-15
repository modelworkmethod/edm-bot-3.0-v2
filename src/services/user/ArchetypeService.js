/**
 * Archetype Service
 * Handles Warrior/Mage/Templar archetype calculations and changes
 */

const { AFFINITY_WEIGHTS, STAT_ALIASES, ARCHETYPE_ICONS, ARCHETYPE_LABELS } = require('../../config/constants');
const { createLogger } = require('../../utils/logger');
const { queryRow } = require('../../database/postgres');
const { EmbedBuilder } = require('discord.js');
const { 
  generateArchetypeBar, 
  getArchetypeColor,
  getArchetypeIcon,
  calculateMovementVolatility
} = require('../../utils/archetypeVisuals');
const archetypeHistoryRepo = require('../../database/repositories/ArchetypeHistoryRepository');
const UserRepository = require('../../database/repositories/UserRepository');

const logger = createLogger('ArchetypeService');

class ArchetypeService {
  /**
   * Calculate affinity deltas from stats
   * @param {object} stats - Stats object
   * @returns {object} Affinity deltas {warrior, mage, templar}
   */
  calculateAffinityFromStats(stats) {
    const affinity = { warrior: 0, mage: 0, templar: 0 };

    for (const [statName, value] of Object.entries(stats)) {
      const normalizedName = STAT_ALIASES[statName.toLowerCase()] || statName;
      const weights = AFFINITY_WEIGHTS[normalizedName];

      if (!weights || typeof value !== 'number' || value <= 0) {
        continue;
      }

      affinity.warrior += value * weights.w;
      affinity.mage += value * weights.m;
      // Templar is not earned - it's a balance zone (40-60% Mage)
      // No templar points are awarded from stats
    }

    return affinity;
  }

  /**
   * Determine dominant archetype
   * @param {number} warrior - Warrior points
   * @param {number} mage - Mage points
   * @param {number} templar - Templar points
   * @returns {object} Archetype info
   */
  getDominantArchetype(warrior, mage, templar) {
    const w = parseFloat(warrior) || 0;
    const m = parseFloat(mage) || 0;
    const t = parseFloat(templar) || 0;

    // Calculate total on W/M spectrum (ignore templar for this)
    const total = w + m;

    // Brand new users
    if (total === 0) {
      return {
        key: null,
        label: 'New Initiate',
        icon: ARCHETYPE_ICONS.balanced,
        percentage: null,
        warriorPercent: 0,
        magePercent: 0
      };
    }

    // Calculate position on W/M spectrum (0-100%)
    const magePercent = (m / total) * 100;

    // Templar zone: 40-60% (balanced within 20%)
    if (magePercent >= 40 && magePercent <= 60) {
      return {
        key: 'templar',
        label: ARCHETYPE_LABELS.templar,
        icon: ARCHETYPE_ICONS.templar,
        percentage: Math.round(magePercent * 10) / 10,
        warriorPercent: Math.round((100 - magePercent) * 10) / 10,
        magePercent: Math.round(magePercent * 10) / 10
      };
    }

    // Warrior dominant (< 40% mage)
    if (magePercent < 40) {
      return {
        key: 'warrior',
        label: ARCHETYPE_LABELS.warrior,
        icon: ARCHETYPE_ICONS.warrior,
        percentage: Math.round((100 - magePercent) * 10) / 10,
        warriorPercent: Math.round((100 - magePercent) * 10) / 10,
        magePercent: Math.round(magePercent * 10) / 10
      };
    }

    // Mage dominant (> 60% mage)
    return {
      key: 'mage',
      label: ARCHETYPE_LABELS.mage,
      icon: ARCHETYPE_ICONS.mage,
      percentage: Math.round(magePercent * 10) / 10,
      warriorPercent: Math.round((100 - magePercent) * 10) / 10,
      magePercent: Math.round(magePercent * 10) / 10
    };
  }

  /**
   * Check if archetype changed
   * @param {object} oldArchetype - Previous archetype
   * @param {object} newArchetype - New archetype
   * @returns {boolean} True if changed
   */
  hasArchetypeChanged(oldArchetype, newArchetype) {
    // Don't count null -> archetype as a change
    if (!oldArchetype || !oldArchetype.key) return false;
    if (!newArchetype || !newArchetype.key) return false;

    return oldArchetype.key !== newArchetype.key;
  }

  /**
   * Get balance guidance for archetype
   * @param {string} archetypeKey - Archetype key (warrior/mage/templar)
   * @returns {string} Guidance message
   */
  getBalanceGuidance(archetypeKey) {
    const guidance = {
      warrior: `You're leaning heavily into **outer action**. To move toward the **templar path**, focus on:
- **Inner Work**: Meditation, journaling, releasing sessions
- **Self-Reflection**: Confidence tension journal entries
- **Spiritual Practice**: Grounding exercises, SBMM
*The templar path requires both action AND reflection.*`,

      mage: `You're leaning heavily into **inner work**. To move toward the **templar path**, focus on:
- **Outer Action**: Approaches, numbers, dates
- **Social Engagement**: Tenseys, group calls
- **Warrior Activities**: Direct approaches, instant dates
*The templar path requires both reflection AND action.*`,

      templar: `You've found the **balanced momentum curve**! Continue by:
- **Balanced Practice**: Mix of inner work AND outer action
- **Consistent Tracking**: Overall state, wins/gains sharing
- **Steady Growth**: Regular approaches, meditation, and reflection
*You're on the optimal path for sustained growth.*`
    };

    return guidance[archetypeKey] || 'Continue your journey toward balanced growth!';
  }

  /**
   * Calculate user's current archetype from database
   * @param {string} userId - Discord user ID
   * @returns {Promise<object>} Archetype data
   */
  async calculateUserArchetype(userId) {
    const user = await queryRow(
      'SELECT archetype_warrior, archetype_mage, archetype_templar, total_xp FROM users WHERE user_id = $1',
      [userId]
    );

    if (!user) {
      return {
        archetype: 'New Initiate',
        key: null,
        magePercent: 0,
        warriorPercent: 0,
        isBalanced: false,
        rawPoints: { warrior: 0, mage: 0, templar: 0 },
        totalActionPoints: 0
      };
    }

    const warrior = parseFloat(user.archetype_warrior) || 0;
    const mage = parseFloat(user.archetype_mage) || 0;
    const templar = parseFloat(user.archetype_templar) || 0;
    const total = warrior + mage;

    // Brand new users
    if (total === 0) {
      return {
        archetype: 'New Initiate',
        key: null,
        magePercent: 0,
        warriorPercent: 0,
        isBalanced: false,
        rawPoints: { warrior, mage, templar },
        totalActionPoints: total
      };
    }

    // Calculate position on W/M spectrum (0-100%)
    const magePercent = (mage / total) * 100;
    const warriorPercent = 100 - magePercent;

    // Determine archetype
    let archetype, key;
    const isBalanced = magePercent >= 40 && magePercent <= 60;

    if (isBalanced) {
      archetype = 'Templar';
      key = 'templar';
    } else if (magePercent < 40) {
      archetype = 'Warrior';
      key = 'warrior';
    } else {
      archetype = 'Mage';
      key = 'mage';
    }

    return {
      archetype,
      key,
      magePercent,
      warriorPercent,
      isBalanced,
      rawPoints: { warrior, mage, templar },
      totalActionPoints: total
    };
  }

  /**
   * Check if archetype changed and notify if user fell out of Templar balance
   * @param {string} userId - Discord user ID
   * @param {object} previousArchetype - Previous archetype data (before stat submission)
   * @param {object} interaction - Discord interaction for accessing guild/channels
   */
  async checkAndNotifyArchetypeChange(userId, previousArchetype, interaction) {
    try {
      // Get current archetype
      const newArchetype = await this.calculateUserArchetype(userId);
      
      // Log archetype change if it actually changed
      if (previousArchetype && previousArchetype.archetype !== newArchetype.archetype) {
        const userRepository = new UserRepository();
        const user = await userRepository.findByUserId(userId);
        const volatilityData = calculateMovementVolatility(user.total_xp);
        
        // Log to history table
        await archetypeHistoryRepo.logArchetypeChange(
          userId,
          previousArchetype.archetype,
          newArchetype.archetype,
          {
            warrior: newArchetype.rawPoints.warrior,
            mage: newArchetype.rawPoints.mage,
            templar: newArchetype.rawPoints.templar,
            warriorPercent: newArchetype.warriorPercent,
            magePercent: newArchetype.magePercent
          },
          user.total_xp,
          volatilityData.dampening
        );
        
        logger.info(`Archetype changed: ${userId} ${previousArchetype.archetype} → ${newArchetype.archetype}`);
      }
      
      // Only notify if user was Templar and fell out of balance
      if (!previousArchetype || previousArchetype.key !== 'templar') {
        return; // User wasn't Templar before, no notification needed
      }
      
      if (newArchetype.isBalanced) {
        return; // User is still balanced, no notification needed
      }
      
      // User fell out of Templar balance! Send notification
      const newArchetypeIcon = getArchetypeIcon(newArchetype.archetype);
      const visualBar = generateArchetypeBar(newArchetype.warriorPercent, newArchetype.magePercent);
      const color = getArchetypeColor(newArchetype.archetype);
      
      // Determine guidance based on new archetype
      let guidanceTitle, guidanceMessage;
      if (newArchetype.archetype === 'Warrior') {
        guidanceTitle = '🔮 Get Back to Balance - Do More Inner Work';
        guidanceMessage = 
          '• **SBMM Meditation** - Ground yourself\n' +
          '• **Grounding Sessions** - Connect within\n' +
          '• **Releasing Work** - Process emotions\n' +
          '• **CTJ Entries** - Reflect on tension\n' +
          '• **Course Modules** - Deepen understanding';
      } else if (newArchetype.archetype === 'Mage') {
        guidanceTitle = '⚔️ Get Back to Balance - Take More Action';
        guidanceMessage = 
          '• **Do Approaches** - Talk to strangers\n' +
          '• **Get Numbers** - Build connections\n' +
          '• **Book Dates** - Create opportunities\n' +
          '• **Field Work** - Practice in real world\n' +
          '• **Social Interactions** - Engage with people';
      }
      
      // Create notification embed
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${newArchetypeIcon} Archetype Shift: You're now ${newArchetype.archetype}!`)
        .setDescription(`<@${userId}>, you've fallen out of **Templar balance**!`)
        .addFields(
          {
            name: '⚖️ Your Current Balance',
            value: `${visualBar}\n**${newArchetype.warriorPercent.toFixed(1)}% Warrior | ${newArchetype.magePercent.toFixed(1)}% Mage**`,
            inline: false
          },
          {
            name: guidanceTitle,
            value: guidanceMessage,
            inline: false
          },
          {
            name: '💡 Why Balance Matters',
            value: '**Templar balance (40-60% Mage)** unlocks:\n' +
                   '✨ **+30% XP bonus** on Templar days\n' +
                   '⚡ **Maximum momentum** through integrated action\n' +
                   '🎯 **Sustainable growth** without burnout\n\n' +
                   '*Action without reflection is reckless.*\n' +
                   '*Reflection without action is stagnation.*',
            inline: false
          }
        )
        .setFooter({ text: 'Return to Templar for maximum power! ⚖️' })
        .setTimestamp();
      
      // Send to general channel
      const generalChannel = await this.getGeneralChannel(interaction);
      if (generalChannel) {
        await generalChannel.send({ embeds: [embed] });
        logger.info(`Archetype notification sent to ${userId}: Templar → ${newArchetype.archetype}`);
      }
      
    } catch (error) {
      logger.error('Failed to check/notify archetype change', { userId, error: error.message });
      // Don't throw - this is a non-critical notification
    }
  }

  /**
   * Log initial archetype for new users
   * Call this after first stat submission
   * @param {string} userId - Discord user ID
   */
  async logInitialArchetype(userId) {
    try {
      // Check if user already has history
      const existingHistory = await archetypeHistoryRepo.getUserHistory(userId, 1);
      if (existingHistory.length > 0) {
        return; // Already logged, skip
      }
      
      // Get current archetype
      const archetypeData = await this.calculateUserArchetype(userId);
      const userRepository = new UserRepository();
      const user = await userRepository.findByUserId(userId);
      
      if (!user) {
        logger.error('User not found for initial archetype log', { userId });
        return;
      }
      
      const volatilityData = calculateMovementVolatility(user.total_xp);
      
      // Log as initial entry (no previous archetype)
      await archetypeHistoryRepo.logArchetypeChange(
        userId,
        null, // No previous archetype
        archetypeData.archetype,
        {
          warrior: archetypeData.rawPoints.warrior,
          mage: archetypeData.rawPoints.mage,
          templar: archetypeData.rawPoints.templar,
          warriorPercent: archetypeData.warriorPercent,
          magePercent: archetypeData.magePercent
        },
        user.total_xp,
        volatilityData.dampening
      );
      
      logger.info(`Initial archetype logged for ${userId}: ${archetypeData.archetype}`);
      
    } catch (error) {
      logger.error('Failed to log initial archetype', { userId, error: error.message });
      // Don't throw - this is not critical
    }
  }

  /**
   * Get general channel for notifications
   * @param {object} interaction - Discord interaction
   * @returns {Promise<Channel|null>} General channel or null
   */
  async getGeneralChannel(interaction) {
    try {
      const guild = interaction.guild;
      if (!guild) return null;
      
      // Try to find a channel named 'general' or similar
      const generalChannel = guild.channels.cache.find(
        channel => 
          channel.name === 'general' || 
          channel.name === 'general-chat' ||
          channel.name === '💬general'
      );
      
      return generalChannel || null;
    } catch (error) {
      logger.error('Failed to get general channel', { error: error.message });
      return null;
    }
  }
}

module.exports = ArchetypeService;

