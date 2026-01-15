// ═══════════════════════════════════════════════════════════════════════════════
// TEMP STUB — DO NOT SHIP
// Artifacts repository for tracking button message IDs
// ═══════════════════════════════════════════════════════════════════════════════

const db = require('../sqlite');

class ArtifactsRepository {
  /**
   * Get artifacts for guild
   */
  getArtifacts(guildId) {
    const stmt = db.get().prepare(`
      SELECT * FROM artifacts WHERE guild_id = ?
    `);
    
    return stmt.get(guildId);
  }
  
  /**
   * Set artifacts for guild
   */
  setArtifacts(guildId, artifacts) {
    const stmt = db.get().prepare(`
      INSERT INTO artifacts (guild_id, lb_channel_id, lb_message_id, open_channel_id, open_message_id, open_lb_channel_id, open_lb_message_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        lb_channel_id = excluded.lb_channel_id,
        lb_message_id = excluded.lb_message_id,
        open_channel_id = excluded.open_channel_id,
        open_message_id = excluded.open_message_id,
        open_lb_channel_id = excluded.open_lb_channel_id,
        open_lb_message_id = excluded.open_lb_message_id,
        updated_at = excluded.updated_at
    `);
    
    return stmt.run(
      guildId,
      artifacts.lb_channel_id || null,
      artifacts.lb_message_id || null,
      artifacts.open_channel_id || null,
      artifacts.open_message_id || null,
      artifacts.open_lb_channel_id || null,
      artifacts.open_lb_message_id || null,
      new Date().toISOString()
    );
  }
}

module.exports = new ArtifactsRepository();

