/**
 * Nickname Service
 * Manages user nickname updates with rank, level, and archetype display
 */

const { createLogger } = require('../../utils/logger');
const { getArchetypeIcon } = require('../../utils/archetypeVisuals');
const config = require('../../config/settings');

const logger = createLogger('NicknameService');

class NicknameService {
  constructor(client, userService, leaderboardService) {
    this.client = client;
    this.userService = userService;
    this.leaderboardService = leaderboardService;
    this.maxLength = config.features.nicknameMaxLength || 32;
    this.enabled = config.features.nicknameSync !== false;
    this.optedOutUsers = new Set(); // Users who opted out
  }

  /**
   * Update user's nickname with current stats
   * @param {string} userId - Discord user ID
   * @param {object} options - Update options
   * @returns {Promise<boolean>} Success status
   */
  async updateNickname(userId, options = {}) {
    if (!this.enabled) {
      return false;
    }

    // Check if user opted out
    if (this.optedOutUsers.has(userId)) {
      logger.debug('User opted out of nickname sync', { userId });
      return false;
    }

    try {
      // Get guild
      const guild = this.client.guilds.cache.get(config.discord.guildId);
      if (!guild) {
        logger.error('Guild not found', { guildId: config.discord.guildId });
        return false;
      }

      // Get member
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        logger.warn('Member not found in guild', { userId });
        return false;
      }

      // Get user profile data
      const profile = await this.userService.getUserProfile(userId);
      
      // Build nickname
      const nickname = this.buildNickname(profile, member.user.username);

      // Update nickname if changed
      if (member.nickname !== nickname) {
        await member.setNickname(nickname);
        logger.info('Nickname updated', {
          userId,
          oldNickname: member.nickname,
          newNickname: nickname
        });
        return true;
      }

      return false;

    } catch (error) {
      // Handle rate limits gracefully
      if (error.code === 50013) {
        logger.warn('Missing permissions to change nickname', { userId });
      } else if (error.code === 429) {
        logger.warn('Rate limited on nickname change', { userId });
      } else {
        logger.error('Failed to update nickname', {
          userId,
          error: error.message
        });
      }
      return false;
    }
  }

  /**
   * Build nickname string with tier medals
   * @param {object} profile - User profile data
   * @param {string} originalUsername - Discord username
   * @returns {string} Formatted nickname
   */
  buildNickname(profile, originalUsername) {
    const rank = profile.rank;
    const level = profile.levelInfo.level;
    const archetype = getArchetypeIcon(profile.archetype.label);
    
    // Get tier emoji based on rank
    const tierEmoji = this.getTierEmoji(rank);
    
    // Calculate available space for username
    // Format: "[TIER ]#RANK | LVLXX | ARCH | USERNAME"
    const tierSpace = tierEmoji ? tierEmoji.length + 1 : 0; // +1 for space
    const rankSpace = `#${rank}`.length;
    const levelSpace = `L${level}`.length;
    const archetypeSpace = archetype.length;
    const separators = ' | '.length * 3; // Three separators
    
    const usedSpace = tierSpace + rankSpace + levelSpace + archetypeSpace + separators;
    const availableForUsername = this.maxLength - usedSpace;
    
    // Truncate username if needed
    const username = this.truncateUsername(originalUsername, availableForUsername);
    
    // Build nickname
    let nickname = '';
    if (tierEmoji) {
      nickname = `${tierEmoji} #${rank} | L${level} | ${archetype} | ${username}`;
    } else {
      nickname = `#${rank} | L${level} | ${archetype} | ${username}`;
    }
    
    return nickname;
  }

  /**
   * Get tier emoji based on rank
   * @param {number} rank - Leaderboard rank
   * @returns {string} Tier emoji or empty string
   */
  getTierEmoji(rank) {
    if (rank === 1) return '🥇'; // Gold medal
    if (rank === 2) return '🥈'; // Silver medal
    if (rank === 3) return '🥉'; // Bronze medal
    if (rank <= 10) return '💎'; // Diamond (top 10)
    if (rank <= 20) return '⭐'; // Star (top 20)
    return ''; // No emoji for regular ranks
  }

  /**
   * Truncate username if it's too long
   * @param {string} username - Original username
   * @param {number} maxLength - Maximum length allowed
   * @returns {string} Truncated username
   */
  truncateUsername(username, maxLength) {
    if (username.length <= maxLength) {
      return username;
    }
    
    // Truncate with ellipsis
    if (maxLength <= 3) {
      return username.substring(0, maxLength);
    }
    
    return username.substring(0, maxLength - 3) + '...';
  }

  /**
   * Sync all nicknames in guild (admin command)
   * @param {Guild} guild - Discord guild
   * @param {number} limit - Max users to update (rate limit protection)
   * @returns {Promise<object>} Sync results
   */
  async syncAllNicknames(guild, limit = 50) {
    if (!this.enabled) {
      return { success: false, error: 'Nickname sync is disabled' };
    }

    try {
      logger.info('Starting bulk nickname sync', { guildId: guild.id, limit });

      // Get all members
      const members = await guild.members.fetch();
      
      let updated = 0;
      let skipped = 0;
      let failed = 0;

      // Process members (with rate limit consideration)
      for (const [memberId, member] of members) {
        if (member.user.bot) {
          skipped++;
          continue;
        }

        if (updated >= limit) {
          logger.info('Reached update limit', { limit });
          break;
        }

        // Add delay between updates to avoid rate limits
        if (updated > 0 && updated % 10 === 0) {
          await this.sleep(5000); // 5 second pause every 10 updates
        }

        const success = await this.updateNickname(memberId);
        if (success) {
          updated++;
        } else {
          skipped++;
        }

        await this.sleep(500); // Small delay between each update
      }

      logger.info('Bulk nickname sync complete', { updated, skipped, failed });

      return {
        success: true,
        updated,
        skipped,
        failed,
        total: members.size
      };

    } catch (error) {
      logger.error('Bulk nickname sync failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Opt user out of nickname sync
   * @param {string} userId - Discord user ID
   */
  optOut(userId) {
    this.optedOutUsers.add(userId);
    logger.info('User opted out of nickname sync', { userId });
  }

  /**
   * Opt user back in to nickname sync
   * @param {string} userId - Discord user ID
   */
  optIn(userId) {
    this.optedOutUsers.delete(userId);
    logger.info('User opted in to nickname sync', { userId });
  }

  /**
   * Check if user is opted out
   * @param {string} userId - Discord user ID
   * @returns {boolean} True if opted out
   */
  isOptedOut(userId) {
    return this.optedOutUsers.has(userId);
  }

  /**
   * Reset user's nickname to original username
   * @param {string} userId - Discord user ID
   * @returns {Promise<boolean>} Success status
   */
  async resetNickname(userId) {
    try {
      const guild = this.client.guilds.cache.get(config.discord.guildId);
      if (!guild) return false;

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return false;

      await member.setNickname(null); // Reset to username
      logger.info('Nickname reset', { userId });
      return true;

    } catch (error) {
      logger.error('Failed to reset nickname', { userId, error: error.message });
      return false;
    }
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = NicknameService;
