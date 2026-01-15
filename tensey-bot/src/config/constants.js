module.exports = {
  // Brand Colors
  BRAND: {
    primary: 0xFF1E27,
    accent: 0x1D44F7,
    ink: 0x050E1D,
    soft: 0xEAF1F7,
  },
  
  // XP Configuration
  XP_AWARD: {
    BASE_XP: 100,                           // XP awarded per challenge
    STAT_COLUMN: 'social_freedom_exercises_tenseys',  // Column to increment
    INCREMENT_AMOUNT: 1,                     // How much to increment
  },
  
  // Pagination
  CHECKLIST_ITEMS_PER_PAGE: 10,
  LEADERBOARD_PAGE_SIZE: 25,
  TOP_LEVELS_SHOW_LIMIT: 50,
  
  // Timing
  LEADERBOARD_DEBOUNCE_MS: 10_000,
  // ❌ DISABLED — tenseylist should be static (no auto notifications)
 //  ENSURE_BUTTON_EVERY_MS: 4 * 60 * 60 * 1000,  // 4 hours
  PENDING_AWARDS_CHECK_INTERVAL_MS: 10_000,     // 10 seconds
  
  // Level Titles
  LEVEL_TITLES: [
    'Level 1 – Warm-Up & Icebreakers',
    'Level 2 – Playful Curiosity',
    'Level 3 – Small Social Experiments',
    'Level 4 – Light Play in Public',
    'Level 5 – Fun Conversation Starters',
    'Level 6 – Social Warm-Up Games',
    'Level 7 – Physical Playfulness',
    'Level 8 – Small Challenges',
    'Level 9 – Vocal Play',
    'Level 10 – Crowd Energy',
    'Level 11 – Character Play',
    'Level 12 – Personal Sharing',
    'Level 13 – Unusual Questions',
    'Level 14 – Social Momentum',
    'Level 15 – Fun With Movement',
    'Level 16 – Playful Acting',
    'Level 17 – Public Games',
    'Level 18 – Friendly Dares',
    'Level 19 – Light Public Discomfort',
    'Level 20 – Group Play',
    'Level 21 – Self-Amplification',
    'Level 22 – Connection Depth',
    'Level 23 – Positive Impact',
    'Level 24 – Rapid Fire',
    'Level 25 – Grandmaster Challenges',
  ],
  
  /**
   * Get level title by index
   */
  getLevelTitle(index) {
    return this.LEVEL_TITLES[index] || `Level ${index + 1}`;
  },
};

