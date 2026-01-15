/**
 * Secondary XP Sources Configuration
 * Defines non-stats activities that can earn XP
 * 
 * CUSTOMIZABLE: Add new XP sources here as features are added
 */

const SECONDARY_XP_SOURCES = {
  // Barbie List (Contact Management)
  barbie: {
    enabled: true,
    actions: {
      addContact: {
        xp: 50,
        description: 'Add woman to contact list after approach',
        cooldown: 300,
        maxPerDay: 20
      },
      logFollowup: {
        xp: 30,
        description: 'Log follow-up text/call attempt',
        cooldown: 3600,
        maxPerDay: 10
      },
      updateWithDate: {
        xp: 100,
        description: 'Update contact with date result',
        cooldown: null,
        maxPerDay: 5
      },
      perfectVibe: {
        xp: 25,
        description: 'Bonus for rating contact 9-10 vibe',
        cooldown: null,
        maxPerDay: null
      }
    }
  },

  // Texting Simulator
  textingPractice: {
    enabled: true,
    actions: {
      completeScenario: {
        xp: 0,
        description: 'Complete texting scenario',
        unlocks: {
          score80Plus: {
            multiplier: 1.1,
            duration: 86400,
            appliesTo: ['Approaches', 'Numbers'],
            description: '+10% XP on next approach/number stats for 24hrs'
          },
          perfectScore: {
            multiplier: 1.25,
            duration: 86400,
            appliesTo: ['Approaches', 'Numbers', 'Dates Had'],
            description: '+25% XP on social stats for 24hrs'
          }
        }
      },
      firstCompletionBonus: {
        xp: 200,
        description: 'First time completing any scenario',
        oneTime: true
      },
      masterDifficulty: {
        xp: 500,
        description: 'Complete advanced scenario with 90+ score',
        cooldown: 86400
      }
    }
  },

  // Confidence Tension Journal (AUTO-AWARDED ONLY)
  journal: {
    enabled: true,
    actions: {
      submitEntry: {
        xp: 75,
        description: 'Submit journal entry with image (AUTO-AWARDED)',
        cooldown: 3600,
        maxPerDay: 3
      },
      breakthrough: {
        xp: 200,
        description: 'Entry selected as breakthrough moment (AUTO-AWARDED)',
        cooldown: null
      }
    }
  },

  // Chat Engagement (AUTO-AWARDED ONLY)
  chatEngagement: {
    enabled: true,
    actions: {
      textMessage: {
        xp: 10,
        description: 'Send text message in general (50+ chars) (AUTO-AWARDED)',
        cooldown: 300,
        maxPerDay: null
      },
      voiceMessage: {
        xp: 15,
        description: 'Send voice note in general (AUTO-AWARDED)',
        cooldown: 300,
        maxPerDay: null
      }
    }
  },

  // Wins Channel (AUTO-AWARDED ONLY)
  wins: {
    enabled: true,
    actions: {
      shareWin: {
        xp: 50,
        description: 'Share a win (text only) (AUTO-AWARDED)',
        cooldown: 3600,
        maxPerDay: 5
      }
    }
  },

  // Duel Victories
  duels: {
    enabled: true,
    actions: {
      winDuel: {
        xp: 500,
        description: 'Win a balanced duel',
        cooldown: null
      },
      perfectBalance: {
        xp: 250,
        description: 'Bonus for maintaining perfect Templar balance during duel',
        cooldown: null
      }
    }
  },

  // Course System (Phase 7)
  course: {
    enabled: true,
    actions: {
      completeModule: {
        xp: 500,
        description: 'Complete an entire course module',
        cooldown: null,
        maxPerDay: null
      },
      watchFirstVideo: {
        xp: 100,
        description: 'Watch your first course video',
        oneTime: true
      },
      completeAllModules: {
        xp: 2000,
        description: 'Complete all course modules',
        oneTime: true
      }
    }
  },

  // Group Call Attendance (AUTO-AWARDED ONLY)
  groupCall: {
    enabled: true,
    actions: {
      attendCall: {
        xp: 200,
        description: 'Attend group call (AUTO-AWARDED)',
        cooldown: 7200, // 2 hours (prevents double-claiming same call)
        maxPerDay: 1 // Only one call per day can be claimed
      }
    }
  }
};

/**
 * Get XP value for an action
 */
function getSecondaryXP(category, action) {
  if (!SECONDARY_XP_SOURCES[category]?.enabled) {
    return null;
  }

  const actionConfig = SECONDARY_XP_SOURCES[category].actions[action];
  if (!actionConfig) {
    return null;
  }

  return {
    xp: actionConfig.xp,
    cooldown: actionConfig.cooldown,
    maxPerDay: actionConfig.maxPerDay,
    description: actionConfig.description,
    unlocks: actionConfig.unlocks,
    oneTime: actionConfig.oneTime || false
  };
}

/**
 * Check if action is on cooldown
 */
function isOnCooldown(lastUsed, cooldownSeconds) {
  if (!cooldownSeconds) return false;
  if (!lastUsed) return false;

  const now = Date.now();
  const timeSince = (now - lastUsed) / 1000;
  return timeSince < cooldownSeconds;
}

module.exports = {
  SECONDARY_XP_SOURCES,
  getSecondaryXP,
  isOnCooldown
};

