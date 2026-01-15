/**
 * ONBOARDING TEMPLATE - CUSTOMIZE THIS FILE
 * 
 * This template contains all onboarding content.
 * Update this file as your program evolves.
 * 
 * HOW TO UPDATE:
 * 1. Add new categories in getCategories()
 * 2. Add keywords to trigger responses
 * 3. Update steps, examples, and commands
 * 4. Modify welcome message
 */

class OnboardingTemplate {
  /**
   * WELCOME MESSAGE
   * First thing new users see
   */
  getWelcomeMessage() {
    return {
      title: 'Welcome to Embodied Dating Mastermind!',
      description: [
        'You\'ve just joined a community of men committed to mastering social freedom and dating.',
        '',
        '**Your journey starts now:**',
        'Track your daily progress, level up, compete in faction wars, and build momentum.',
        '',
        '**What you\'ll get:**',
        '- XP system that tracks inner work AND outer action',
        '- Archetype system (Warrior/Mage/Templar) for balanced growth',
        '- Faction wars, boss raids, and community events',
        '- Personal coaching and accountability',
        '',
        'Use `/help` anytime to learn more!'
      ].join('\n'),
      color: 0x00FF00
    };
  }

  /**
   * QUICK START GUIDE
   */
  getQuickStart() {
    return {
      title: 'Quick Start Guide',
      steps: [
        'Submit your first stats with `/submit-stats`',
        'Check your profile with `/my-stats`',
        'View the leaderboard with `/leaderboard`',
        'Join a faction with `/set-faction`',
        'Track women you meet with `/barbie add`'
      ],
      description: 'Get started in 5 minutes!'
    };
  }

  /**
   * CATEGORIES
   * Each category has keywords that trigger it
   */
  getCategories() {
    return {
      stats: {
        title: 'How to Submit Stats',
        keywords: ['stats', 'submit', 'log', 'track', 'record', 'daily'],
        description: 'Track your daily activities to earn XP and level up.',
        steps: [
          'Use `/submit-stats` command',
          'Fill in the modal with your activities (approaches, dates, meditation, etc.)',
          'Submit to earn XP based on your multipliers',
          'Check your progress with `/my-stats`'
        ],
        examples: [
          '**Approaches:** Number of women you approached today',
          '**Numbers:** Phone numbers collected',
          '**Dates Had:** Dates you went on',
          '**SBMM:** Sexy Bastard Morning Meditation (1 if completed)',
          '**Overall State:** Rate 1-10 how you felt today'
        ],
        relatedCommands: ['/submit-stats', '/submit-past-stats', '/my-stats']
      },

      xp: {
        title: 'Understanding XP & Leveling',
        keywords: ['xp', 'experience', 'level', 'leveling', 'points', 'gain'],
        description: 'XP (Experience Points) is earned by submitting daily stats.',
        steps: [
          'Each activity has an XP value (e.g., Approaches = 100 XP)',
          'Your base XP is multiplied by bonuses (streak, state, archetype)',
          'Level up by accumulating XP',
          'Higher levels unlock new class names'
        ],
        examples: [
          '**Base XP:** Approaches (100) + Numbers (100) = 200 XP',
          '**With Streak:** 7-day streak adds +5% = 210 XP',
          '**With State Bonus:** State 8+ adds +5% = 220 XP',
          '**With Templar Bonus:** Templar archetype adds +30% = 286 XP'
        ],
        relatedCommands: ['/my-stats', '/leaderboard']
      },

      archetype: {
        title: 'Archetype System (Warrior/Mage/Templar)',
        keywords: ['archetype', 'warrior', 'mage', 'templar', 'balance', 'class'],
        description: 'Your archetype reflects whether you focus on outer action or inner work.',
        steps: [
          '**Warrior:** Outer action focused (approaches, dates, social)',
          '**Mage:** Inner work focused (meditation, releasing, journaling)',
          '**Templar:** Balanced between both (optimal momentum)',
          'Your archetype changes based on what stats you submit'
        ],
        examples: [
          'Submit lots of approaches → Warrior archetype',
          'Submit lots of meditation → Mage archetype',
          'Balance both → Templar archetype (best for growth)'
        ],
        relatedCommands: ['/my-stats']
      },

      factions: {
        title: 'Faction Wars',
        keywords: ['faction', 'luminarchs', 'noctivores', 'war', 'team'],
        description: 'Join a faction and compete for dominance!',
        steps: [
          'Choose Luminarchs or Noctivores',
          'Earn XP to contribute to your faction\'s total',
          'Watch the faction leaderboard',
          'Participate in faction-specific raids'
        ],
        relatedCommands: ['/set-faction', '/faction-stats']
      },

      raids: {
        title: 'Boss Raids',
        keywords: ['raid', 'boss', 'event', 'challenge'],
        description: 'Time-limited community challenges!',
        steps: [
          '**Warrior Raids:** Outer action challenge (approaches, dates)',
          '**Mage Raids:** Inner work challenge (meditation, releasing)',
          'Submit qualifying stats during raid window',
          'Community works together to hit target points'
        ],
        relatedCommands: ['/raid-status']
      },

      barbie: {
        title: 'Barbie List (Contact Manager)',
        keywords: ['barbie', 'contact', 'list', 'woman', 'women', 'phone', 'number'],
        description: 'Track women you meet and manage follow-ups.',
        steps: [
          'Add contacts with `/barbie add`',
          'Include name, where you met, vibe rating, notes',
          'Get AI opener suggestions',
          'Track follow-up reminders'
        ],
        relatedCommands: ['/barbie add', '/barbie list', '/barbie view', '/barbie reminders']
      },

      streak: {
        title: 'Submission Streaks',
        keywords: ['streak', 'daily', 'consecutive', 'bonus'],
        description: 'Submit stats daily to build your streak and earn bonus XP.',
        steps: [
          'Submit stats at least once per day',
          'Each 7 days adds +5% XP bonus (max +25%)',
          'Missing a day resets your streak',
          'Use `/submit-past-stats` to backfill if needed'
        ],
        relatedCommands: ['/my-stats', '/submit-past-stats']
      },

      coaching: {
        title: 'Getting Coaching Support',
        keywords: ['coach', 'help', 'stuck', 'call', 'support', 'guidance'],
        description: 'Need 1-on-1 support? I\'m here to help.',
        steps: [
          'If you\'re inactive for 3+ days, I\'ll reach out',
          'Book an emergency brief call anytime',
          'Get personalized guidance on your sticking points',
          'No judgment - we all hit roadblocks'
        ],
        examples: [
          'Booking link will be sent via DM if you go inactive',
          'You can also ask directly in the server'
        ]
      }
    };
  }

  /**
   * GENERAL HELP
   * Default response when no keywords match
   */
  getGeneralHelp() {
    return {
      title: 'How Can I Help?',
      description: [
        'I can help you with:',
        '',
        '**Getting Started:**',
        '- How to submit stats',
        '- Understanding XP and leveling',
        '- Choosing a faction',
        '',
        '**Systems:**',
        '- Archetype system (Warrior/Mage/Templar)',
        '- Boss raids and events',
        '- Barbie list (contact manager)',
        '- Streaks and bonuses',
        '',
        '**Support:**',
        '- Getting coaching help',
        '- Troubleshooting issues',
        '',
        '**Try asking:** "How do I submit stats?" or "What are archetypes?"'
      ].join('\n'),
      relatedCommands: [
        '/submit-stats',
        '/my-stats',
        '/leaderboard',
        '/faction-stats',
        '/barbie',
        '/raid-status'
      ]
    };
  }
}

module.exports = OnboardingTemplate;

