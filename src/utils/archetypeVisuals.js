/**
 * Archetype Visual Utilities
 * Generates visual bars and helpers for archetype system
 */

/**
 * Generate visual archetype bar with zones and position marker
 * Format: ⚔️ [████████⬤| | | | | |░░░░░░] 🔮
 * 
 * Warrior zone: filled blocks (█) up to position
 * Templar zone: spaced pipes (| | | |) representing 40-60% balance zone
 * Mage zone: empty blocks (░) for mage side
 * Position marker: ⬤ at user's exact position
 * 
 * @param {number} warriorPercent - Warrior percentage (0-100)
 * @param {number} magePercent - Mage percentage (0-100)
 * @returns {string} - Visual bar with zones and marker
 */
function generateArchetypeBar(warriorPercent, magePercent) {
  const TEMPLAR_MIN = 40; // Start of Templar zone (% Mage)
  const TEMPLAR_MAX = 60; // End of Templar zone (% Mage)
  
  const WARRIOR_BLOCKS = 16; // Visual length of warrior section
  const TEMPLAR_PIPES = 8;   // Number of pipes in templar section
  const MAGE_BLOCKS = 15;    // Visual length of mage section
  
  let bar = '';
  
  // Determine which zone user is in
  if (magePercent < TEMPLAR_MIN) {
    // USER IS IN WARRIOR ZONE
    const fillAmount = Math.round((magePercent / TEMPLAR_MIN) * WARRIOR_BLOCKS);
    bar += '█'.repeat(fillAmount) + '⬤';
    const remaining = WARRIOR_BLOCKS - fillAmount;
    if (remaining > 0) bar += ' '.repeat(remaining);
    bar += '| '.repeat(TEMPLAR_PIPES).trim();
    bar += '░'.repeat(MAGE_BLOCKS);
    
  } else if (magePercent <= TEMPLAR_MAX) {
    // USER IS IN TEMPLAR ZONE
    bar += '█'.repeat(WARRIOR_BLOCKS);
    
    // Position marker in templar zone
    const templarProgress = (magePercent - TEMPLAR_MIN) / (TEMPLAR_MAX - TEMPLAR_MIN);
    const markerPosition = Math.round(templarProgress * TEMPLAR_PIPES);
    
    // Build templar zone with marker
    for (let i = 0; i < TEMPLAR_PIPES; i++) {
      if (i === markerPosition) {
        bar += '⬤';
      }
      bar += '|';
      if (i < TEMPLAR_PIPES - 1) {
        bar += ' ';
      }
    }
    
    // If marker is at the very end (exactly 60% Mage), add it after last pipe
    if (markerPosition === TEMPLAR_PIPES) {
      bar += '⬤';
    }
    
    bar += '░'.repeat(MAGE_BLOCKS);
    
  } else {
    // USER IS IN MAGE ZONE
    bar += '█'.repeat(WARRIOR_BLOCKS);
    bar += '| '.repeat(TEMPLAR_PIPES).trim();
    
    const mageProgress = (magePercent - TEMPLAR_MAX) / (100 - TEMPLAR_MAX);
    const fillAmount = Math.round(mageProgress * MAGE_BLOCKS);
    bar += ' '.repeat(fillAmount) + '⬤';
    const remaining = MAGE_BLOCKS - fillAmount - 1;
    if (remaining > 0) bar += '░'.repeat(remaining);
  }
  
  return `⚔️ [${bar}] 🔮`;
}

/**
 * Get archetype icon based on type
 * @param {string} archetype - 'Warrior', 'Mage', 'Templar', or 'New Initiate'
 * @returns {string} - Emoji icon
 */
function getArchetypeIcon(archetype) {
  switch (archetype) {
    case 'Warrior':
      return '⚔️';
    case 'Mage':
      return '🔮';
    case 'Templar':
      return '⚖️';
    default:
      return '⚖️'; // New Initiate
  }
}

/**
 * Get archetype color for embeds
 * @param {string} archetype - Archetype type
 * @returns {number} - Hex color code
 */
function getArchetypeColor(archetype) {
  switch (archetype) {
    case 'Warrior':
      return 0xFF4444; // Red
    case 'Mage':
      return 0x4444FF; // Blue
    case 'Templar':
      return 0xFFAA00; // Gold/Orange
    default:
      return 0x808080; // Gray
  }
}

/**
 * Get encouragement text based on archetype balance
 * Matches screenshot text exactly
 * @param {string} archetype - Current archetype
 * @param {boolean} isBalanced - Whether in Templar zone
 * @returns {string} - Encouragement message
 */
function getEncouragementText(archetype, isBalanced) {
  if (isBalanced) {
    return "You're balanced! Keep up the momentum.";
  }
  
  if (archetype === 'Warrior') {
    return "Too much action! Balance with inner work.";
  }
  
  if (archetype === 'Mage') {
    return "Too much reflection! Time for action.";
  }
  
  return "Build your momentum!";
}

/**
 * Calculate movement volatility based on total XP
 * Low XP = fast movement, High XP = slow movement
 * @param {number} totalXP - User's total XP
 * @returns {Object} - { dampening, description, emoji, percentage }
 */
function calculateMovementVolatility(totalXP) {
  const MIN_XP = 1000;   // Below this: maximum volatility (1.0)
  const MAX_XP = 50000;  // Above this: maximum stability (0.3)
  const MIN_DAMPENING = 0.3; // Minimum (veterans still move)
  const MAX_DAMPENING = 1.0; // Maximum (new users)
  
  let dampening;
  if (totalXP <= MIN_XP) {
    dampening = MAX_DAMPENING;
  } else if (totalXP >= MAX_XP) {
    dampening = MIN_DAMPENING;
  } else {
    const ratio = (totalXP - MIN_XP) / (MAX_XP - MIN_XP);
    dampening = MAX_DAMPENING - (ratio * (MAX_DAMPENING - MIN_DAMPENING));
  }
  
  let description, emoji;
  if (dampening > 0.8) {
    description = 'Very High - Archetype shifts quickly';
    emoji = '⚡';
  } else if (dampening > 0.6) {
    description = 'High - Archetype is fluid';
    emoji = '🌊';
  } else if (dampening > 0.4) {
    description = 'Moderate - Becoming stable';
    emoji = '🏔️';
  } else {
    description = 'Low - Very stable';
    emoji = '🛡️';
  }
  
  return {
    dampening: parseFloat(dampening.toFixed(3)),
    percentage: Math.round(dampening * 100),
    description,
    emoji
  };
}

module.exports = {
  generateArchetypeBar,
  getArchetypeIcon,
  getArchetypeColor,
  getEncouragementText,
  calculateMovementVolatility
};
