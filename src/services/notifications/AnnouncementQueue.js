/**
 * Announcement Queue
 * Debounces and batches announcements to prevent spam
 */

const { createLogger } = require('../../utils/logger');
const { generateArchetypeBar, getArchetypeIcon, getArchetypeColor } = require('../../utils/archetypeVisuals');

const logger = createLogger('AnnouncementQueue');

class AnnouncementQueue {
  constructor(channelService) {
    this.channelService = channelService;
    this.queue = new Map(); // channelId -> announcements[]
    this.timers = new Map(); // channelId -> timeout
    this.debounceMs = 2000; // 2 seconds

    // Send adapter: support different ChannelService method names

    this._send = async (channelId, payload) => {
      if (this.channelService?.sendToChannel) {
        return this.channelService.sendToChannel(channelId, payload);
      }
      if (this.channelService?.sendMessage) {
        return this.channelService.sendMessage(channelId, payload);
      }
      if (this.channelService?.send) {
        return this.channelService.send(channelId, payload);
      }
      throw new Error('AnnouncementQueue: No compatible sned method found on channelService');
    }
  }

  /**
   * Queue announcement for sending
   * @param {string} channelId - Channel ID
   * @param {string|object} content - Message content
   * @param {string} type - Announcement type (for deduplication)
   * @returns {void}
   */
  queueAnnouncement(channelId, content, type = 'generic') {
    if (!this.queue.has(channelId)) {
      this.queue.set(channelId, []);
    }

    const announcements = this.queue.get(channelId);
    
    // Deduplicate by type
    const existing = announcements.find(a => a.type === type);
    if (existing) {
      existing.content = content; // Update with latest
    } else {
      announcements.push({ content, type, timestamp: Date.now() });
    }

    // Reset debounce timer
    this.resetTimer(channelId);
  }

  /**
   * Queue level-up announcement
   * @param {string} channelId - Channel ID
   * @param {string} userId - User ID
   * @param {number} level - New level
   * @param {string} className - Class name
   * @returns {void}
   */
  queueLevelUp(channelId, userId, level, className) {
    const content = `🎉 <@${userId}> leveled up to **Level ${level} — ${className}**!`;
    this.queueAnnouncement(channelId, content, `levelup-${userId}`);
  }

  /**
   * Queue archetype change announcement with visual bars
   * @param {string} channelId - Channel ID
   * @param {string} userId - User ID
   * @param {object} archetypeChange - Archetype change info
   * @returns {void}
   */
  queueArchetypeChange(channelId, userId, archetypeChange) {
    const { old, new: newArchetype } = archetypeChange;
    
    // Generate visual bars for before/after
    const oldBar = generateArchetypeBar(old.warriorPercent, old.magePercent);
    const newBar = generateArchetypeBar(newArchetype.warriorPercent, newArchetype.magePercent);
    
    // Get icons
    const oldIcon = getArchetypeIcon(old.label);
    const newIcon = getArchetypeIcon(newArchetype.label);
    
    // Get color based on new archetype
    const embedColor = getArchetypeColor(newArchetype.label);
    
    const content = {
      embeds: [{
        color: embedColor,
        title: '🎭 Archetype Evolution!',
        description: `<@${userId}> evolved from **${oldIcon} ${old.label}** to **${newIcon} ${newArchetype.label}**!`,
        fields: [
          {
            name: `Previous: ${old.label} (${old.magePercent.toFixed(1)}% Mage)`,
            value: `${oldBar}\n**${old.warriorPercent.toFixed(1)}% Warrior | ${old.magePercent.toFixed(1)}% Mage**`,
            inline: false
          },
          {
            name: `Now: ${newArchetype.label} (${newArchetype.magePercent.toFixed(1)}% Mage)`,
            value: `${newBar}\n**${newArchetype.warriorPercent.toFixed(1)}% Warrior | ${newArchetype.magePercent.toFixed(1)}% Mage**`,
            inline: false
          },
          {
            name: '⚖️ Balance Guidance',
            value: this.getBalanceGuidance(newArchetype.key),
            inline: false
          }
        ],
        timestamp: new Date().toISOString()
      }]
    };
    this.queueAnnouncement(channelId, content, `archetype-${userId}`);
  }

  /**
   * Reset debounce timer for channel
   * @param {string} channelId - Channel ID
   * @returns {void}
   */
  resetTimer(channelId) {
    // Clear existing timer
    const existingTimer = this.timers.get(channelId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.flushChannel(channelId);
    }, this.debounceMs);

    this.timers.set(channelId, timer);
  }

  /**
   * Flush announcements for channel
   * @param {string} channelId - Channel ID
   * @returns {Promise<void>}
   */
  async flushChannel(channelId) {
    const announcements = this.queue.get(channelId);
    
    if (!announcements || announcements.length === 0) {
      return;
    }

    try {
      // Send all queued announcements
      for (const announcement of announcements) {
        await this._send(channelId, announcement.content);
        await this.sleep(500); // Small delay between messages
      }

      logger.debug('Flushed announcements', {
        channelId,
        count: announcements.length
      });

    } catch (error) {
      logger.error('Failed to flush announcements', {
        channelId,
        error: error.message
      });
    } finally {
      // Clear queue
      this.queue.delete(channelId);
      this.timers.delete(channelId);
    }
  }

  async processQueue() {
    const channelIds = Array.from(this.queue.keys());
    for (const channelId of channelIds) {
      await this.flushChannel(channelId);
    }
  }
 
  /**
   * Get balance guidance text
   * @param {string} archetypeKey - Archetype key
   * @returns {string} Guidance text
   */
  getBalanceGuidance(archetypeKey) {
    const guidance = {
      warrior: 'Focus on inner work: meditation, journaling, releasing sessions',
      mage: 'Focus on outer action: approaches, numbers, dates',
      templar: 'You\'ve found balance! Keep it up with consistent practice'
    };
    return guidance[archetypeKey] || 'Continue your journey';
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

module.exports = AnnouncementQueue;

