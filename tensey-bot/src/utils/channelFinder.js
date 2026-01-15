// ═══════════════════════════════════════════════════════════════════════════════
// TEMP STUB — DO NOT SHIP
// Channel finder utility for Tensey Bot
// ═══════════════════════════════════════════════════════════════════════════════

class ChannelFinder {
  static async findChannel(client, channelId) {
    if (!channelId) return null;
    try {
      return await client.channels.fetch(channelId);
    } catch (err) {
      return null;
    }
  }
}

module.exports = ChannelFinder;

