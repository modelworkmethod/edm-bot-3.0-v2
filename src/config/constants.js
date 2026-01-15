/**
 * Game constants - XP values, level classes, affinity weights
 * Centralized source of truth for all game mechanics
 */

/**
 * XP values for each stat type
 * (Canonical keys en Title Case)
 */
const STAT_WEIGHTS = {
  'Approaches': 100,
  'Numbers': 100,
  'New Contact Response': 100,
  'Hellos To Strangers': 10,
  'Confidence Tension Journal Entry': 100,
  'Dates Booked': 100,
  'Dates Had': 250,
  'Instant Date': 500,
  'Got Laid': 250,
  'Same Night Pull': 2000,
  'Courage Welcoming': 50,
  'SBMM Meditation': 100,
  'Grounding': 50,
  'Releasing Sesh': 25,
  'In Action Release': 50,
  'Course Module': 250,
  'Course Experiment': 100,
  'Attended Group Call': 200,
  'Overall State Today (1-10)': 50,
  'Retention Streak': 100,
  'Tensey Exercise': 100,
  'Chat Engagement': 5,
  'Wins Sharing': 25,
};

/**
 * Stat name aliases for flexible input
 * Las keys aquí van en minúsculas y/o snake_case y apuntan
 * SIEMPRE a una key CANÓNICA de STAT_WEIGHTS.
 */
const STAT_ALIASES = {
  // Approaches
  'approach': 'Approaches',
  'approaches': 'Approaches',
  'approach_count': 'Approaches',

  // Numbers
  'number': 'Numbers',
  'numbers': 'Numbers',

  // New Contact Response
  'new_contact_response': 'New Contact Response',
  'new contact response': 'New Contact Response',
  'contact_response': 'New Contact Response',
  'contact': 'New Contact Response',

  // Hellos To Strangers
  'hellos_to_strangers': 'Hellos To Strangers',
  'hellos to strangers': 'Hellos To Strangers',
  'hello_to_strangers': 'Hellos To Strangers',
  'hello': 'Hellos To Strangers',
  'hellos': 'Hellos To Strangers',

  // Confidence Tension Journal Entry
  'ctj': 'Confidence Tension Journal Entry',
  'confidence_tension_journal': 'Confidence Tension Journal Entry',
  'confidence_tension_journal_entry': 'Confidence Tension Journal Entry',
  'journal': 'Confidence Tension Journal Entry',
  'journal_entry': 'Confidence Tension Journal Entry',

  // Dates Booked
  'date_booked': 'Dates Booked',
  'dates_booked': 'Dates Booked',

  // Dates Had
  'date_had': 'Dates Had',
  'dates_had': 'Dates Had',
  'date': 'Dates Had',

  // Instant Date
  'instant_date': 'Instant Date',
  'instant-date': 'Instant Date',

  // Got Laid
  'got_laid': 'Got Laid',
  'got laid': 'Got Laid',
  'laid': 'Got Laid',
  'sex': 'Got Laid',

  // Same Night Pull
  'same_night_pull': 'Same Night Pull',
  'same night pull': 'Same Night Pull',
  'same_night': 'Same Night Pull',
  'same-night': 'Same Night Pull',
  'snp': 'Same Night Pull',

  // Courage Welcoming
  'courage_welcoming': 'Courage Welcoming',
  'courage-welcoming': 'Courage Welcoming',
  'courage': 'Courage Welcoming',
  'welcoming': 'Courage Welcoming',

  // SBMM Meditation
  'sbmm_meditation': 'SBMM Meditation',
  'sbmm-meditation': 'SBMM Meditation',
  'sbmm': 'SBMM Meditation',
  'meditation': 'SBMM Meditation',

  // Grounding
  'grounding': 'Grounding',

  // Releasing Sesh
  'releasing_sesh': 'Releasing Sesh',
  'releasing-sesh': 'Releasing Sesh',
  'releasing_session': 'Releasing Sesh',
  'releasing': 'Releasing Sesh',

  // In Action Release
  'in_action_release': 'In Action Release',
  'in-action-release': 'In Action Release',
  'in_action': 'In Action Release',
  'in-action': 'In Action Release',

  // Course Module
  'course_module': 'Course Module',
  'course-module': 'Course Module',
  'module': 'Course Module',

  // Course Experiment
  'course_experiment': 'Course Experiment',
  'course-experiment': 'Course Experiment',
  'experiment': 'Course Experiment',

  // Attended Group Call
  'attended_group_call': 'Attended Group Call',
  'group_call': 'Attended Group Call',
  'group-call': 'Attended Group Call',
  'call': 'Attended Group Call',

  // Overall State Today (1-10)
  'overall_state_today': 'Overall State Today (1-10)',
  'overall_state_today_(1-10)': 'Overall State Today (1-10)',
  'overall_state_today_1_10': 'Overall State Today (1-10)', // ⬅️ clave del modal
  'state': 'Overall State Today (1-10)',
  'state_1_10': 'Overall State Today (1-10)',

  // Retention Streak
  'retention_streak': 'Retention Streak',
  'retention': 'Retention Streak',
  'sr': 'Retention Streak',
  'streak': 'Retention Streak',

  // Tensey Exercise
  'tensey_exercise': 'Tensey Exercise',
  'tensey': 'Tensey Exercise',
  'tenseys': 'Tensey Exercise',

  // Chat Engagement
  'chat_engagement': 'Chat Engagement',
  'chat': 'Chat Engagement',
  'engagement': 'Chat Engagement',

  // Wins Sharing
  'wins_sharing': 'Wins Sharing',
  'wins': 'Wins Sharing',
  'sharing': 'Wins Sharing',
};


/**
 * Affinity weights (Warrior/Mage distribution per stat)
 * Note: Templar is not a separate archetype with points - it's the balance zone (40-60% Mage)
 * Las keys aquí siguen siendo las canónicas de STAT_WEIGHTS.
 */
const AFFINITY_WEIGHTS = {
  // CORE SOCIAL STATS
  'Approaches': { w: 3, m: 0 },           // 3-5 min, 7/10 intensity ✅
  'Numbers': { w: 1, m: 0 },              // Instant, 3/10 intensity ⬇️
  'New Contact Response': { w: 1, m: 0 }, // Instant, 2/10 intensity ⬇️
  'Hellos To Strangers': { w: 1, m: 0 },  // Instant, 3/10 intensity ⬇️
  'In Action Release': { w: 0, m: 3 },    // Quick, 3/10 intensity ⬇️

  // DATING & RESULTS
  'Dates Booked': { w: 2, m: 0 },         // Instant, 4/10 intensity ⬇️
  'Dates Had': { w: 3, m: 0 },            // Instant, 7/10 intensity ✅
  'Instant Date': { w: 4, m: 0 },         // 5+ min, 7/10 intensity ✅
  'Got Laid': { w: 1, m: 1 },             // Variable, 7/10 intensity ⬆️
  'Same Night Pull': { w: 8, m: 0 },      // Variable, 10/10 intensity ⬆️

  // INNER WORK
  'Courage Welcoming': { w: 2, m: 1 },    // 5 min, 3/10 intensity ✅
  'SBMM Meditation': { w: 0, m: 9 },      // 30 min, 5/10 intensity ⬆️
  'Grounding': { w: 0, m: 4 },            // 3-5+ min, 4/10 intensity ⬆️
  'Releasing Sesh': { w: 0, m: 6 },       // 5-20+ min, 4/10 intensity ⬆️

  // LEARNING
  'Course Module': { w: 2, m: 9 },        // 60+ min, 6/10 intensity ⬆️
  'Course Experiment': { w: 2, m: 4 },    // Variable, 5/10 intensity ⬆️

  // DAILY STATE
  'Attended Group Call': { w: 1, m: 3 },  // 30-120 min, 5/10 intensity ⬆️
  'Overall State Today (1-10)': { w: 0, m: 2 }, // Pure mage reflection ⬆️
  'Retention Streak': { w: 0, m: 4 },     // Daily, 8/10 intensity ⬆️

  // OTHER
  'Confidence Tension Journal Entry': { w: 0, m: 3 }, // 5-10 min, 4/10 intensity ⬆️
  'Tensey Exercise': { w: 3, m: 1 },      // Variable, 6/10 intensity ⬆️

  // NEW ADDITIONS
  'Chat Engagement': { w: 0, m: 0.5 },    // Minimal mage points
  'Wins Sharing': { w: 1, m: 1 },         // Balanced sharing
};

/**
 * Level thresholds (CORRECTED FOR HIGH XP VALUES)
 * Level 50 = ~95,000 XP (achievable in 90 days with current XP values)
 */
const LEVEL_THRESHOLDS = [
  { level: 1, xp: 0, className: 'Awkward Initiate' },
  { level: 2, xp: 500, className: 'Awkward Initiate' },
  { level: 3, xp: 1200, className: 'Awkward Initiate' },
  { level: 4, xp: 2000, className: 'Awkward Initiate' },
  { level: 5, xp: 3000, className: 'Social Squire' },
  { level: 6, xp: 4200, className: 'Social Squire' },
  { level: 7, xp: 5600, className: 'Social Squire' },
  { level: 8, xp: 7200, className: 'Social Squire' },
  { level: 9, xp: 9000, className: 'Social Squire' },
  { level: 10, xp: 11000, className: 'Bold Explorer' },
  { level: 11, xp: 13200, className: 'Bold Explorer' },
  { level: 12, xp: 15600, className: 'Bold Explorer' },
  { level: 13, xp: 18200, className: 'Bold Explorer' },
  { level: 14, xp: 21000, className: 'Bold Explorer' },
  { level: 15, xp: 24000, className: 'Magnetic Challenger' },
  { level: 16, xp: 27200, className: 'Magnetic Challenger' },
  { level: 17, xp: 30600, className: 'Magnetic Challenger' },
  { level: 18, xp: 34200, className: 'Magnetic Challenger' },
  { level: 19, xp: 38000, className: 'Magnetic Challenger' },
  { level: 20, xp: 42000, className: 'Audacious Knight' },
  { level: 21, xp: 46200, className: 'Audacious Knight' },
  { level: 22, xp: 50600, className: 'Audacious Knight' },
  { level: 23, xp: 55200, className: 'Audacious Knight' },
  { level: 24, xp: 60000, className: 'Audacious Knight' },
  { level: 25, xp: 65000, className: 'Charisma Vanguard' },
  { level: 26, xp: 70200, className: 'Charisma Vanguard' },
  { level: 27, xp: 75600, className: 'Charisma Vanguard' },
  { level: 28, xp: 81200, className: 'Charisma Vanguard' },
  { level: 29, xp: 87000, className: 'Charisma Vanguard' },
  { level: 30, xp: 93000, className: 'Seduction Sage' },
  { level: 31, xp: 99200, className: 'Seduction Sage' },
  { level: 32, xp: 105600, className: 'Seduction Sage' },
  { level: 33, xp: 112200, className: 'Seduction Sage' },
  { level: 34, xp: 119000, className: 'Seduction Sage' },
  { level: 35, xp: 126000, className: 'Embodiment Warlord' },
  { level: 36, xp: 133200, className: 'Embodiment Warlord' },
  { level: 37, xp: 140600, className: 'Embodiment Warlord' },
  { level: 38, xp: 148200, className: 'Embodiment Warlord' },
  { level: 39, xp: 156000, className: 'Embodiment Warlord' },
  { level: 40, xp: 164000, className: 'Flirtation Overlord' },
  { level: 41, xp: 172200, className: 'Flirtation Overlord' },
  { level: 42, xp: 180600, className: 'Flirtation Overlord' },
  { level: 43, xp: 189200, className: 'Flirtation Overlord' },
  { level: 44, xp: 198000, className: 'Flirtation Overlord' },
  { level: 45, xp: 207000, className: 'Reality Architect' },
  { level: 46, xp: 216200, className: 'Reality Architect' },
  { level: 47, xp: 225600, className: 'Reality Architect' },
  { level: 48, xp: 235200, className: 'Reality Architect' },
  { level: 49, xp: 245000, className: 'Reality Architect' },
  { level: 50, xp: 255000, className: 'Galactic Sexy Bastard God-King' },
];

/**
 * Level class tiers (for reference)
 */
const LEVEL_CLASSES = [
  { min: 1, max: 4, name: 'Awkward Initiate' },
  { min: 5, max: 9, name: 'Social Squire' },
  { min: 10, max: 14, name: 'Bold Explorer' },
  { min: 15, max: 19, name: 'Magnetic Challenger' },
  { min: 20, max: 24, name: 'Audacious Knight' },
  { min: 25, max: 29, name: 'Charisma Vanguard' },
  { min: 30, max: 34, name: 'Seduction Sage' },
  { min: 35, max: 39, name: 'Embodiment Warlord' },
  { min: 40, max: 44, name: 'Flirtation Overlord' },
  { min: 45, max: 49, name: 'Reality Architect' },
  { min: 50, max: 99, name: 'Galactic Sexy Bastard God-King' },
];

/**
 * Level class abbreviations (for compact display)
 */
const LEVEL_CLASS_CODES = {
  'Awkward Initiate': 'AI',
  'Social Squire': 'SQ',
  'Bold Explorer': 'BE',
  'Magnetic Challenger': 'MC',
  'Audacious Knight': 'AK',
  'Charisma Vanguard': 'CV',
  'Seduction Sage': 'SD',
  'Embodiment Warlord': 'EW',
  'Flirtation Overlord': 'FO',
  'Reality Architect': 'RA',
  'Galactic Sexy Bastard God-King': 'GK',
};

/**
 * Archetype icons
 */
const ARCHETYPE_ICONS = {
  warrior: '⚔️',
  mage: '🔮',
  templar: '⚖️',
  balanced: '⚖️',
};

/**
 * Archetype labels
 */
const ARCHETYPE_LABELS = {
  warrior: 'Warrior',
  mage: 'Mage',
  templar: 'Templar',
  balanced: 'Balanced',
};

/**
 * Faction configuration
 */
const FACTION_EMOJIS = {
  Luminarchs: '🦸',
  Noctivores: '🥷',
};

const FACTION_NAMES = ['Luminarchs', 'Noctivores'];

/**
 * Tier colors for embeds
 */
const TIER_COLORS = {
  'Awkward Initiate': 0x9CA3AF,
  'Social Squire': 0x60A5FA,
  'Bold Explorer': 0x34D399,
  'Magnetic Challenger': 0xF59E0B,
  'Audacious Knight': 0xEF4444,
  'Charisma Vanguard': 0xA855F7,
  'Seduction Sage': 0xEC4899,
  'Embodiment Warlord': 0x06B6D4,
  'Flirtation Overlord': 0xF472B6,
  'Reality Architect': 0x22C55E,
  'Galactic Sexy Bastard God-King': 0xFFD700,
};

/**
 * Event types
 */
const EVENT_TYPES = {
  ATTACK: 'attack',
  MAGIC: 'magic',
  TEMPLAR: 'templar',
};

const EVENT_STATUS = {
  SCHEDULED: 'scheduled',
  ACTIVE: 'active',
  ENDED: 'ended',
  CANCELED: 'canceled',
};

/**
 * Raid bonus points (faction events)
 */
const RAID_BONUS_POINTS = {
  approach: 5,
  number: 10,
  dateBooked: 20,
  dateHad: 40,
  instantDate: 120,
  sameNightPull: 400,
};

module.exports = {
  STAT_WEIGHTS,
  STAT_ALIASES,
  AFFINITY_WEIGHTS,
  LEVEL_THRESHOLDS,
  LEVEL_CLASSES,
  LEVEL_CLASS_CODES,
  ARCHETYPE_ICONS,
  ARCHETYPE_LABELS,
  FACTION_EMOJIS,
  FACTION_NAMES,
  TIER_COLORS,
  EVENT_TYPES,
  EVENT_STATUS,
  RAID_BONUS_POINTS,
};
