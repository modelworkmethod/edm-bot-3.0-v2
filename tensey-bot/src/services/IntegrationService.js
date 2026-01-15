// ═══════════════════════════════════════════════════════════════════════════════
// TEMP STUB — DO NOT SHIP
// Integration service - bridge to main bot DB
// ═══════════════════════════════════════════════════════════════════════════════

const MainBotRepository = require('../database/repositories/MainBotRepository');

class IntegrationService {
  /**
   * Verify integration with main bot database
   */
  async testIntegration() {
    const postgres = require('../database/postgres');
    await postgres.testConnection();
    return true;
  }
  
  /**
   * Get user stats from main bot
   */
  async getUserStats(userId) {
    const result = await MainBotRepository.getLeaderboard(1000);
    return result.find(u => u.user_id === userId) || null;
  }
}

module.exports = new IntegrationService();

