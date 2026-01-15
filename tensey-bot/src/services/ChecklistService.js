// ═══════════════════════════════════════════════════════════════════════════════
// TEMP STUB — DO NOT SHIP
// Checklist service - pagination logic
// ═══════════════════════════════════════════════════════════════════════════════

const { CHECKLIST_ITEMS_PER_PAGE } = require('../config/constants');
const challenges = require('../config/challenges');
const UserProgressRepository = require('../database/repositories/UserProgressRepository');

class ChecklistService {
  /**
   * Get paginated checklist for user
   */
  getChecklistPage(userId, page = 0) {
    const userProgress = UserProgressRepository.getUserProgress(userId);
    const progressMap = new Map(userProgress.map(p => [p.challenge_idx, p.completed_count]));
    
    const totalChallenges = challenges.challenges.length;
    const totalPages = Math.ceil(totalChallenges / CHECKLIST_ITEMS_PER_PAGE);
    
    const start = page * CHECKLIST_ITEMS_PER_PAGE;
    const end = start + CHECKLIST_ITEMS_PER_PAGE;
    
    const items = challenges.challenges.slice(start, end).map(challenge => ({
      ...challenge,
      completed: progressMap.has(challenge.idx),
      completionCount: progressMap.get(challenge.idx) || 0
    }));
    
    return {
      items,
      page,
      totalPages,
      hasNext: page < totalPages - 1,
      hasPrev: page > 0
    };
  }
}

module.exports = new ChecklistService();

