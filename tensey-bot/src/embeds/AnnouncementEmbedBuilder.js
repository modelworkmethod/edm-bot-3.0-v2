// ═══════════════════════════════════════════════════════════════════════════════
// TEMP STUB — DO NOT SHIP
// Announcement embed builder
// ═══════════════════════════════════════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const { BRAND } = require('../config/constants');

class AnnouncementEmbedBuilder {
  static buildCompletionAnnouncement(userId, challengeIdx, challengeText) {
    return new EmbedBuilder()
      .setColor(BRAND.primary)
      .setTitle('🎉 Tensey Challenge Completed!')
      .setDescription(`<@${userId}> just completed challenge #${challengeIdx + 1}!\n\n**${challengeText}**\n\n⭐ XP +100`)
      .setTimestamp();
  }
}

module.exports = AnnouncementEmbedBuilder;

