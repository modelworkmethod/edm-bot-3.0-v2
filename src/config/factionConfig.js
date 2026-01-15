/**
 * Faction Configuration
 * Centralized faction settings, role IDs, and colors
 */

module.exports = {
  // Balance threshold: assign to smaller faction if diff >= this value
  threshold: 2,

  // Faction definitions
  factions: {
    LUMINARCHS: {
      key: 'Luminarchs',
      roleId: process.env.LUMINARCH_ROLE_ID || 'REPLACE_ME',
      colorHex: '#FFD700',
      colorInt: 0xFFD700,
      emoji: '🦸',
      displayName: 'Luminarchs'
    },
    NOCTIVORES: {
      key: 'Noctivores',
      roleId: process.env.NOCTIVORE_ROLE_ID || 'REPLACE_ME',
      colorHex: '#9B59B6',
      colorInt: 0x9B59B6,
      emoji: '🥷',
      displayName: 'Noctivores'
    }
  },

  // Get faction by key (case-insensitive)
  getFactionByKey(key) {
    const normalized = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
    if (normalized === 'Luminarchs') return this.factions.LUMINARCHS;
    if (normalized === 'Noctivores') return this.factions.NOCTIVORES;
    return null;
  },

  // Get all faction keys
  getAllFactionKeys() {
    return [this.factions.LUMINARCHS.key, this.factions.NOCTIVORES.key];
  },

  // Check if role IDs are configured
  hasValidRoleIds() {
    return this.factions.LUMINARCHS.roleId !== 'REPLACE_ME' &&
           this.factions.NOCTIVORES.roleId !== 'REPLACE_ME';
  }
};


