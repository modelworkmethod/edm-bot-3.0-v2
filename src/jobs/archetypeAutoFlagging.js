/**
 * Archetype Auto-Flagging System
 * Automatically flags users out of Templar balance for 14+ days
 * Sends daily alerts to coaching channel
 */

const { EmbedBuilder } = require('discord.js');
const { createLogger } = require('../utils/logger');
const archetypeHistoryRepo = require('../database/repositories/ArchetypeHistoryRepository');
const { getArchetypeIcon, getArchetypeColor } = require('../utils/archetypeVisuals');
const config = require('../config/settings');

const logger = createLogger('ArchetypeAutoFlagging');

class ArchetypeAutoFlagging {
  constructor(client) {
    this.client = client;
    this.isRunning = false;
    this.cronJob = null;
  }
  
  /**
   * Start the auto-flagging system
   * Runs daily at 9:00 AM EST (14:00 UTC)
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Archetype auto-flagging already running');
      return;
    }
    
    // Use node-cron if available, otherwise skip cron and just provide manual trigger
    try {
      const cron = require('node-cron');
      
      // Schedule: Every day at 9:00 AM EST (14:00 UTC)
      this.cronJob = cron.schedule('0 14 * * *', async () => {
        await this.runDailyCheck();
      }, {
        timezone: 'America/New_York'
      });
      
      this.isRunning = true;
      logger.info('✅ Archetype auto-flagging started (daily at 9 AM EST)');
      
    } catch (error) {
      logger.warn('node-cron not available, auto-flagging will only work via manual trigger');
      logger.warn('Install with: npm install node-cron');
      this.isRunning = true; // Still mark as running for manual triggers
    }
  }
  
  /**
   * Stop the auto-flagging system
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
    }
    this.isRunning = false;
    logger.info('Archetype auto-flagging stopped');
  }
  
  /**
   * Run the daily balance check
   */
  async runDailyCheck() {
    try {
      logger.info('[Auto-Flagging] Running daily archetype balance check...');
      
      // Get users out of balance for 7+ days
      const usersOutOfBalance = await archetypeHistoryRepo.getUsersOutOfBalance(7);
      
      if (usersOutOfBalance.length === 0) {
        logger.info('[Auto-Flagging] ✅ All users balanced!');
        return;
      }
      
      // Send alert to coaching channel
      await this.sendCoachingAlert(usersOutOfBalance);
      
      logger.info(`[Auto-Flagging] Flagged ${usersOutOfBalance.length} users for coaching`);
      
    } catch (error) {
      logger.error('[Auto-Flagging] Error running daily check:', error);
    }
  }
  
  /**
   * Send coaching alert embed
   */
  async sendCoachingAlert(users) {
    try {
      // Get coaching channel
      const coachingChannel = await this.getCoachingChannel();
      
      if (!coachingChannel) {
        logger.error('[Auto-Flagging] Coaching channel not found');
        return;
      }
      
      // Sort by days out of balance (most critical first)
      users.sort((a, b) => b.days_in_archetype - a.days_in_archetype);
      
      // Take top 20 to avoid overwhelming
      const topUsers = users.slice(0, 20);
      
      // Create embed
      const embed = new EmbedBuilder()
        .setColor(0xFF4444) // Red for alert
        .setTitle('🚨 Daily Archetype Balance Alert')
        .setDescription(`**${users.length} users** have been out of Templar balance for 7+ days`)
        .setTimestamp();
      
      // Group by severity
      const critical = topUsers.filter(u => u.days_in_archetype >= 21);
      const high = topUsers.filter(u => u.days_in_archetype >= 14 && u.days_in_archetype < 21);
      const medium = topUsers.filter(u => u.days_in_archetype >= 7 && u.days_in_archetype < 14);
      
      // Add critical users
      if (critical.length > 0) {
        const criticalList = critical.map(u => {
          const icon = getArchetypeIcon(u.new_archetype);
          return `🔴 <@${u.user_id}> - ${icon} ${u.new_archetype} (**${Math.floor(u.days_in_archetype)}d**)`;
        }).join('\n');
        
        embed.addFields({
          name: '🔴 CRITICAL (21+ days)',
          value: criticalList,
          inline: false
        });
      }
      
      // Add high priority users
      if (high.length > 0) {
        const highList = high.map(u => {
          const icon = getArchetypeIcon(u.new_archetype);
          return `⚠️ <@${u.user_id}> - ${icon} ${u.new_archetype} (${Math.floor(u.days_in_archetype)}d)`;
        }).join('\n');
        
        embed.addFields({
          name: '⚠️ HIGH PRIORITY (14-20 days)',
          value: highList,
          inline: false
        });
      }
      
      // Add medium priority users
      if (medium.length > 0) {
        const mediumList = medium
          .slice(0, 10) // Limit to 10 for space
          .map(u => {
            const icon = getArchetypeIcon(u.new_archetype);
            return `🟡 <@${u.user_id}> - ${icon} ${u.new_archetype} (${Math.floor(u.days_in_archetype)}d)`;
          }).join('\n');
        
        embed.addFields({
          name: '🟡 MEDIUM (7-13 days)',
          value: mediumList,
          inline: false
        });
      }
      
      // Add recommendations
      embed.addFields({
        name: '💡 Recommended Actions',
        value: 
          '1. Review coaching dashboard for detailed analysis\n' +
          '2. Reach out to users with personal check-ins\n' +
          '3. Assess if workload balance needs adjustment\n' +
          '4. Consider group coaching session on balance',
        inline: false
      });
      
      embed.setFooter({ text: 'Automated daily archetype balance check' });
      
      // Send the alert
      await coachingChannel.send({ embeds: [embed] });
      
      logger.info(`[Auto-Flagging] Alert sent to coaching channel`);
      
    } catch (error) {
      logger.error('[Auto-Flagging] Error sending coaching alert:', error);
    }
  }
  
  /**
   * Get coaching channel
   * Falls back to general channel if coaching channel not configured
   */
  async getCoachingChannel() {
    try {
      const guild = await this.client.guilds.fetch(config.discord.guildId || process.env.GUILD_ID);
      
      // Try to get coaching channel from config
      const coachingChannelId = process.env.COACHING_CHANNEL_ID || config.channels?.coaching;
      
      if (coachingChannelId) {
        const channel = await guild.channels.fetch(coachingChannelId);
        if (channel) return channel;
      }
      
      // Fallback: Find channel named 'coaching' or 'coaching-dashboard'
      const coachingChannel = guild.channels.cache.find(
        channel => 
          channel.name === 'coaching' ||
          channel.name === 'coaching-dashboard' ||
          channel.name === 'coach'
      );
      
      if (coachingChannel) return coachingChannel;
      
      // Final fallback: General channel
      logger.warn('[Auto-Flagging] Coaching channel not found, falling back to general');
      const generalChannel = guild.channels.cache.find(
        channel => 
          channel.name === 'general' ||
          channel.name === 'bot-commands'
      );
      
      return generalChannel || null;
      
    } catch (error) {
      logger.error('[Auto-Flagging] Error fetching coaching channel:', error);
      return null;
    }
  }
  
  /**
   * Manual trigger for testing
   */
  async manualTrigger() {
    logger.info('[Auto-Flagging] Manual trigger initiated');
    await this.runDailyCheck();
  }
}

module.exports = ArchetypeAutoFlagging;

