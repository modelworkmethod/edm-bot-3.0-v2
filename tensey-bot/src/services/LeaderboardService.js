// ═══════════════════════════════════════════════════════════════════════════════
// TEMP STUB — DO NOT SHIP
// Leaderboard service - pulls from PostgreSQL and SQLite
// ═══════════════════════════════════════════════════════════════════════════════

const MainBotRepository = require('../database/repositories/MainBotRepository');
const UserProgressRepository = require('../database/repositories/UserProgressRepository');

class LeaderboardService {
  /**
   * Get top users by Tensey completions
   */
  async getTopUsers(limit = 25) {
    return await MainBotRepository.getLeaderboard(limit);
  }
  
  /**
   * Get faction stats
   */
  async getFactionStats() {
    return await MainBotRepository.getFactionStats();
  }
  
  /**
   * Get most completed challenges
   */
  getMostCompletedChallenges(limit = 10) {
    return UserProgressRepository.getChallengeStats().slice(0, limit);
  }
}

module.exports = new LeaderboardService();

