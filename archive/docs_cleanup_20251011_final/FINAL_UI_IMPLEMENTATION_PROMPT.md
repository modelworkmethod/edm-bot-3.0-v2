# 🎨 CURSOR AI PROMPT - COMPLETE TENSEY BOT UI

**COPY THIS ENTIRE PROMPT INTO CURSOR AI TO BUILD THE COMPLETE UI**

---

## 🎯 MISSION: Build Complete Working UI

**Current Status:** Backend 100% complete, UI 20% complete (mostly stubs)

**Goal:** Build fully functional Discord UI with all 4 button rows, progress tracking, and navigation

**Timeline:** 6-10 hours to complete working UI

---

## ✅ WHAT'S ALREADY WORKING (DON'T TOUCH)

```
✅ Challenge data: All 567 challenges loaded in src/config/challenges.js
✅ Database: user_progress, pending_xp_awards, artifacts tables working
✅ XP system: Awards process after 60 seconds via background job
✅ Background jobs: JobScheduler running, processing awards every 30s
```

**DO NOT MODIFY THESE FILES:**
- `src/config/challenges.js` - Complete
- `src/database/*` - Complete
- `src/services/XPAwardService.js` - Complete
- `src/jobs/*` - Complete
- `bot.js` - Complete

---

## 🚨 WHAT NEEDS TO BE BUILT (UI LAYER)

### **Priority 1: Core Service (CRITICAL - DO THIS FIRST)**

#### **TASK 1: Complete TenseyProgressService.js**
**File:** `tensey-bot/src/services/TenseyProgressService.js`

**Current Status:** Stub with empty methods

**What to build:**

```javascript
const db = require('../database/DatabaseFactory');
const { XPAwardService } = require('./XPAwardService');
const { XP_AWARD } = require('../config/constants');

class TenseyProgressService {
  /**
   * Mark a challenge as complete
   */
  async markComplete(userId, challengeIdx) {
    try {
      // Validate index (0-566)
      if (challengeIdx < 0 || challengeIdx > 566) {
        console.error(`Invalid challenge index: ${challengeIdx}`);
        return false;
      }

      // Check if already complete
      const existing = await db.get('user_progress', {
        user_id: userId,
        challenge_idx: challengeIdx
      });

      if (existing) {
        // Already complete - update count
        await db.update(
          'user_progress',
          { 
            completed_count: existing.completed_count + 1,
            last_completed_at: new Date()
          },
          { user_id: userId, challenge_idx: challengeIdx }
        );
      } else {
        // First completion - insert new row
        await db.insert('user_progress', {
          user_id: userId,
          challenge_idx: challengeIdx,
          completed_count: 1,
          last_completed_at: new Date()
        });
      }

      // Schedule XP award with 60s delay
      await XPAwardService.scheduleAward(
        userId,
        challengeIdx,
        XP_AWARD.BASE_XP  // 100 XP
      );

      console.log(`✅ Challenge ${challengeIdx} completed by ${userId}`);
      return true;

    } catch (error) {
      console.error('Error in markComplete:', error);
      return false;
    }
  }

  /**
   * Undo most recent completion
   */
  async undoLastCompletion(userId) {
    try {
      // Find most recent completion
      const result = await db.query(
        `SELECT * FROM user_progress 
         WHERE user_id = ? 
         ORDER BY last_completed_at DESC 
         LIMIT 1`,
        [userId]
      );

      if (!result || result.length === 0) {
        return null; // Nothing to undo
      }

      const lastCompletion = result[0];

      // Delete from user_progress
      await db.delete('user_progress', {
        user_id: userId,
        challenge_idx: lastCompletion.challenge_idx
      });

      // Cancel pending XP award (if not yet processed)
      await db.delete('pending_xp_awards', {
        user_id: userId,
        challenge_idx: lastCompletion.challenge_idx
      });

      console.log(`↩️ Undid challenge ${lastCompletion.challenge_idx} for ${userId}`);

      return {
        challengeIdx: lastCompletion.challenge_idx,
        completedAt: lastCompletion.last_completed_at
      };

    } catch (error) {
      console.error('Error in undoLastCompletion:', error);
      return null;
    }
  }

  /**
   * Get all completed challenge indices for user
   */
  async getUserProgress(userId) {
    try {
      const result = await db.query(
        `SELECT challenge_idx FROM user_progress 
         WHERE user_id = ? AND completed_count > 0 
         ORDER BY challenge_idx ASC`,
        [userId]
      );

      const indices = result.map(row => row.challenge_idx);
      return indices;

    } catch (error) {
      console.error('Error in getUserProgress:', error);
      return [];
    }
  }

  /**
   * Get total completion count
   */
  async getCompletionCount(userId) {
    try {
      const result = await db.query(
        `SELECT COUNT(*) as count FROM user_progress 
         WHERE user_id = ? AND completed_count > 0`,
        [userId]
      );

      return result[0]?.count || 0;

    } catch (error) {
      console.error('Error in getCompletionCount:', error);
      return 0;
    }
  }

  /**
   * Check if specific challenge is complete
   */
  async isComplete(userId, challengeIdx) {
    try {
      const result = await db.get('user_progress', {
        user_id: userId,
        challenge_idx: challengeIdx
      });

      return result && result.completed_count > 0;

    } catch (error) {
      console.error('Error in isComplete:', error);
      return false;
    }
  }
}

module.exports = new TenseyProgressService();
```

**Test it:**
```javascript
// In Discord, run this test:
const TenseyProgressService = require('./src/services/TenseyProgressService');

// Test mark complete
await TenseyProgressService.markComplete('TEST_USER', 0);
console.log('Marked complete');

// Test get progress
const progress = await TenseyProgressService.getUserProgress('TEST_USER');
console.log('Progress:', progress); // Should be [0]

// Test is complete
const isComplete = await TenseyProgressService.isComplete('TEST_USER', 0);
console.log('Is complete:', isComplete); // Should be true
```

---

### **Priority 2: UI Builder (CRITICAL)**

#### **TASK 2: Complete ChecklistEmbedBuilder.js**
**File:** `tensey-bot/src/embeds/ChecklistEmbedBuilder.js`

**Current Status:** Basic stub with minimal functionality

**What to build:**

```javascript
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { challenges } = require('../config/challenges');

class ChecklistEmbedBuilder {
  /**
   * Build complete embed with all 4 button rows
   * @param {number} page - Current page (0-56)
   * @param {number[]} completedIndices - Array of completed challenge indices
   * @param {string} userId - Discord user ID
   * @returns {Object} { embed, components }
   */
  static async build(page, completedIndices, userId) {
    // Calculate what challenges to show on this page
    const startIdx = page * 10;
    const endIdx = Math.min(startIdx + 10, 567);
    const pageChallenges = challenges.slice(startIdx, endIdx);

    // Get level info for this page
    const level = pageChallenges[0]?.level || 1;
    const levelInfo = this._getLevelInfo(level);

    // Build the embed
    const embed = new EmbedBuilder()
      .setTitle(`${levelInfo.emoji} LEVEL ${level}: ${levelInfo.name.toUpperCase()}`)
      .setDescription(this._buildChallengeList(pageChallenges, completedIndices, startIdx))
      .setColor(this._getLevelColor(level))
      .addFields({
        name: '📊 Your Progress',
        value: `${completedIndices.length}/567 Challenges Completed (${Math.round((completedIndices.length / 567) * 100)}%)`,
        inline: false
      })
      .setFooter({ 
        text: `Page ${page + 1}/57 • Click numbers to toggle • UNDO reverses • INFO shows help` 
      })
      .setTimestamp();

    // Build all button rows
    const components = [];

    // ROW 1: Challenge toggle buttons (1-10)
    const row1 = new ActionRowBuilder();
    for (let i = 0; i < pageChallenges.length; i++) {
      const challengeIdx = startIdx + i;
      const isComplete = completedIndices.includes(challengeIdx);
      
      row1.addComponents(
        new ButtonBuilder()
          .setCustomId(`checklist_toggle_P${page}_C${i}`)
          .setLabel(`${i + 1}`)
          .setStyle(isComplete ? ButtonStyle.Success : ButtonStyle.Secondary)
      );
    }
    components.push(row1);

    // ROW 2: Navigation + Undo + INFO
    const row2 = new ActionRowBuilder();
    
    // Previous button
    row2.addComponents(
      new ButtonBuilder()
        .setCustomId(`checklist_nav_prev_${page}`)
        .setLabel('◀️ Prev')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === 0)
    );
    
    // Undo button
    row2.addComponents(
      new ButtonBuilder()
        .setCustomId('checklist_undo')
        .setLabel('↩️ Undo')
        .setStyle(ButtonStyle.Danger)
    );
    
    // INFO button
    row2.addComponents(
      new ButtonBuilder()
        .setCustomId(`checklist_info_L${level}`)
        .setLabel('ℹ️ INFO')
        .setStyle(ButtonStyle.Primary)
    );
    
    // Next button
    row2.addComponents(
      new ButtonBuilder()
        .setCustomId(`checklist_nav_next_${page}`)
        .setLabel('Next ▶️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page >= 56)
    );
    
    components.push(row2);

    // ROW 3: Page number buttons (only if level has >5 pages)
    const levelPages = this._getLevelPages(level);
    if (levelPages.length > 5) {
      const row3 = new ActionRowBuilder();
      const visiblePages = this._getVisiblePages(page, levelPages);
      
      for (const p of visiblePages) {
        const isCurrent = p === page;
        row3.addComponents(
          new ButtonBuilder()
            .setCustomId(`checklist_page_${p}`)
            .setLabel(isCurrent ? `[${p + 1}]` : `${p + 1}`)
            .setStyle(isCurrent ? ButtonStyle.Success : ButtonStyle.Secondary)
        );
      }
      
      components.push(row3);
    }

    // ROW 4: Level jump buttons (always show all 7 levels)
    const row4 = new ActionRowBuilder();
    for (let l = 1; l <= 7; l++) {
      const lInfo = this._getLevelInfo(l);
      const isCurrent = l === level;
      
      row4.addComponents(
        new ButtonBuilder()
          .setCustomId(`checklist_level_${l}`)
          .setLabel(`${lInfo.emoji}L${l}`)
          .setStyle(isCurrent ? ButtonStyle.Success : ButtonStyle.Secondary)
      );
    }
    components.push(row4);

    return { embed, components };
  }

  /**
   * Build the challenge list description
   */
  static _buildChallengeList(pageChallenges, completedIndices, startIdx) {
    return pageChallenges.map((challenge, i) => {
      const idx = startIdx + i;
      const isComplete = completedIndices.includes(idx);
      const checkbox = isComplete ? '✅' : '❌';
      return `${i + 1}. ${checkbox} ${challenge.text}`;
    }).join('\n');
  }

  /**
   * Get level info
   */
  static _getLevelInfo(level) {
    const levelData = {
      1: { name: 'Basic Approach & Warm-Up', emoji: '🌱', count: 50 },
      2: { name: 'Social Creativity & Playfulness', emoji: '🎨', count: 70 },
      3: { name: 'Vulnerability & Authentic Expression', emoji: '💎', count: 80 },
      4: { name: 'Bold Social Experiments', emoji: '🚀', count: 100 },
      5: { name: 'Tension & Escalation', emoji: '⚡', count: 100 },
      6: { name: 'Embodied Approach Foundations', emoji: '🧘', count: 100 },
      7: { name: 'Deep Integration & Mastery', emoji: '🎯', count: 67 }
    };
    return levelData[level] || levelData[1];
  }

  /**
   * Get color for level
   */
  static _getLevelColor(level) {
    const colors = {
      1: 0x00FF00,  // Green
      2: 0xFF6B35,  // Orange
      3: 0x6C5CE7,  // Purple
      4: 0xFD79A8,  // Pink
      5: 0xE74C3C,  // Red
      6: 0x00CEC9,  // Cyan
      7: 0x2D3436   // Dark gray
    };
    return colors[level] || 0x000000;
  }

  /**
   * Get all pages for a level
   */
  static _getLevelPages(level) {
    const ranges = {
      1: [0, 4],    // 5 pages
      2: [5, 11],   // 7 pages
      3: [12, 19],  // 8 pages
      4: [20, 29],  // 10 pages
      5: [30, 39],  // 10 pages
      6: [40, 49],  // 10 pages
      7: [50, 56]   // 7 pages
    };
    
    const [start, end] = ranges[level];
    const pages = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  /**
   * Get visible page buttons (max 5, centered on current)
   */
  static _getVisiblePages(currentPage, allPages) {
    if (allPages.length <= 5) {
      return allPages;
    }

    const idx = allPages.indexOf(currentPage);
    if (idx === -1) {
      return allPages.slice(0, 5);
    }

    let start = Math.max(0, idx - 2);
    let end = Math.min(allPages.length, start + 5);

    if (end - start < 5) {
      start = Math.max(0, end - 5);
    }

    return allPages.slice(start, end);
  }
}

module.exports = ChecklistEmbedBuilder;
```

---

### **Priority 3: Button Handlers**

#### **TASK 3: Complete checklistToggleButton.js**
**File:** `tensey-bot/src/interactions/buttons/checklistToggleButton.js`

```javascript
const TenseyProgressService = require('../../services/TenseyProgressService');
const ChecklistEmbedBuilder = require('../../embeds/ChecklistEmbedBuilder');

module.exports = {
  async execute(interaction) {
    try {
      // Parse custom ID: "checklist_toggle_P0_C2"
      const parts = interaction.customId.split('_');
      const pageStr = parts[2];  // "P0"
      const challengeStr = parts[3];  // "C2"
      
      const page = parseInt(pageStr.substring(1));  // 0
      const challenge = parseInt(challengeStr.substring(1));  // 2
      
      // Calculate challenge index
      const challengeIdx = (page * 10) + challenge;
      
      // Check if already complete
      const isComplete = await TenseyProgressService.isComplete(
        interaction.user.id,
        challengeIdx
      );
      
      if (isComplete) {
        return interaction.reply({
          content: '❌ Challenge already complete! Use the UNDO button to reverse.',
          ephemeral: true
        });
      }
      
      // Mark complete
      const success = await TenseyProgressService.markComplete(
        interaction.user.id,
        challengeIdx
      );
      
      if (!success) {
        return interaction.reply({
          content: '❌ Failed to mark challenge complete. Please try again.',
          ephemeral: true
        });
      }
      
      // Get updated progress
      const userProgress = await TenseyProgressService.getUserProgress(
        interaction.user.id
      );
      
      // Rebuild embed
      const { embed, components } = await ChecklistEmbedBuilder.build(
        page,
        userProgress,
        interaction.user.id
      );
      
      // Update message
      await interaction.update({
        embeds: [embed],
        components: components
      });
      
      // Send confirmation
      const count = await TenseyProgressService.getCompletionCount(interaction.user.id);
      await interaction.followUp({
        content: `✅ Challenge ${challengeIdx + 1} complete! Progress: ${count}/567\n💰 +100 XP in 60 seconds`,
        ephemeral: true
      });
      
    } catch (error) {
      console.error('Toggle button error:', error);
      await interaction.reply({
        content: '❌ An error occurred. Please try again.',
        ephemeral: true
      }).catch(() => {});
    }
  }
};
```

#### **TASK 4: Complete checklistUndoButton.js**
**File:** `tensey-bot/src/interactions/buttons/checklistUndoButton.js`

```javascript
const TenseyProgressService = require('../../services/TenseyProgressService');
const ChecklistEmbedBuilder = require('../../embeds/ChecklistEmbedBuilder');
const { challenges } = require('../../config/challenges');

module.exports = {
  async execute(interaction) {
    try {
      // Undo last completion
      const undone = await TenseyProgressService.undoLastCompletion(
        interaction.user.id
      );
      
      if (!undone) {
        return interaction.reply({
          content: '❌ Nothing to undo! You haven\'t completed any challenges yet.',
          ephemeral: true
        });
      }
      
      // Calculate page containing undone challenge
      const page = Math.floor(undone.challengeIdx / 10);
      
      // Get updated progress
      const userProgress = await TenseyProgressService.getUserProgress(
        interaction.user.id
      );
      
      // Rebuild embed
      const { embed, components } = await ChecklistEmbedBuilder.build(
        page,
        userProgress,
        interaction.user.id
      );
      
      // Update message
      await interaction.update({
        embeds: [embed],
        components: components
      });
      
      // Send confirmation
      const challenge = challenges[undone.challengeIdx];
      const count = await TenseyProgressService.getCompletionCount(interaction.user.id);
      
      await interaction.followUp({
        content: `↩️ **Undid Challenge ${undone.challengeIdx + 1}**\n"${challenge.text}"\n\n📊 New Progress: ${count}/567`,
        ephemeral: true
      });
      
    } catch (error) {
      console.error('Undo button error:', error);
      await interaction.reply({
        content: '❌ An error occurred. Please try again.',
        ephemeral: true
      }).catch(() => {});
    }
  }
};
```

#### **TASK 5: Complete checklistNavigationButton.js**
**File:** `tensey-bot/src/interactions/buttons/checklistNavigationButton.js`

```javascript
const TenseyProgressService = require('../../services/TenseyProgressService');
const ChecklistEmbedBuilder = require('../../embeds/ChecklistEmbedBuilder');

module.exports = {
  async execute(interaction) {
    try {
      const parts = interaction.customId.split('_');
      let targetPage;
      
      // Determine target page based on button type
      if (parts[2] === 'prev') {
        // Previous: "checklist_nav_prev_5" → page 4
        targetPage = parseInt(parts[3]) - 1;
      } else if (parts[2] === 'next') {
        // Next: "checklist_nav_next_5" → page 6
        targetPage = parseInt(parts[3]) + 1;
      } else if (parts[1] === 'page') {
        // Direct jump: "checklist_page_10" → page 10
        targetPage = parseInt(parts[2]);
      } else if (parts[1] === 'level') {
        // Level jump: "checklist_level_3" → first page of level 3
        const level = parseInt(parts[2]);
        targetPage = this._getLevelStartPage(level);
      }
      
      // Validate page bounds
      if (targetPage < 0 || targetPage > 56) {
        return interaction.reply({
          content: `❌ Invalid page: ${targetPage}`,
          ephemeral: true
        });
      }
      
      // Get user progress
      const userProgress = await TenseyProgressService.getUserProgress(
        interaction.user.id
      );
      
      // Build embed for target page
      const { embed, components } = await ChecklistEmbedBuilder.build(
        targetPage,
        userProgress,
        interaction.user.id
      );
      
      // Update message
      await interaction.update({
        embeds: [embed],
        components: components
      });
      
    } catch (error) {
      console.error('Navigation error:', error);
      await interaction.reply({
        content: '❌ Navigation failed. Please try again.',
        ephemeral: true
      }).catch(() => {});
    }
  },

  _getLevelStartPage(level) {
    const levelStarts = {
      1: 0,   // Level 1 starts at page 0
      2: 5,   // Level 2 starts at page 5
      3: 12,  // Level 3 starts at page 12
      4: 20,  // Level 4 starts at page 20
      5: 30,  // Level 5 starts at page 30
      6: 40,  // Level 6 starts at page 40
      7: 50   // Level 7 starts at page 50
    };
    return levelStarts[level] || 0;
  }
};
```

#### **TASK 6: Create checklistInfoButton.js (NEW FILE)**
**File:** `tensey-bot/src/interactions/buttons/checklistInfoButton.js`

```javascript
const { EmbedBuilder } = require('discord.js');

// Level help content
const LEVEL_HELP = {
  1: {
    name: 'Basic Approach & Warm-Up',
    emoji: '🌱',
    description: 'Foundation exercises for social freedom and grounded presence.',
    tips: [
      'Start with 5-10 exercises daily',
      'Focus on belly breathing and grounded presence',
      'Notice your body sensations during interactions'
    ]
  },
  2: {
    name: 'Social Creativity & Playfulness',
    emoji: '🎨',
    description: 'Playful experiments to expand social comfort zones.',
    tips: [
      'Embrace the absurd and silly',
      'Let go of needing to look cool',
      'Dance, play pretend, and have fun'
    ]
  },
  3: {
    name: 'Vulnerability & Authentic Expression',
    emoji: '💎',
    description: 'Share your truth and practice emotional authenticity.',
    tips: [
      'Share embarrassing facts openly',
      'Admit when you feel nervous',
      'Practice emotional honesty'
    ]
  },
  4: {
    name: 'Bold Social Experiments',
    emoji: '🚀',
    description: 'Push boundaries with creative social experiments.',
    tips: [
      'Embrace the weird and unusual',
      'Run fake campaigns and absurd scenarios',
      'Challenge yourself with bold moves'
    ]
  },
  5: {
    name: 'Tension & Escalation',
    emoji: '⚡',
    description: 'Master tension, silence, and sexual energy.',
    tips: [
      'Practice 20-second silence holds',
      'Make direct attraction statements',
      'Work with sexual energy authentically'
    ]
  },
  6: {
    name: 'Embodied Approach Foundations',
    emoji: '🧘',
    description: 'Embody sexual authenticity and pattern awareness.',
    tips: [
      'Approach with jaw relaxed',
      'Notice body sensations deeply',
      'Practice sexual authenticity'
    ]
  },
  7: {
    name: 'Deep Integration & Mastery',
    emoji: '🎯',
    description: 'Build community and integrate all previous learning.',
    tips: [
      'Create integration circles',
      'Build long-term relationships',
      'Transform your entire life'
    ]
  }
};

module.exports = {
  async execute(interaction) {
    try {
      // Parse level: "checklist_info_L3"
      const levelStr = interaction.customId.split('_')[2];
      const level = parseInt(levelStr.substring(1));
      
      // Get level info
      const help = LEVEL_HELP[level];
      
      // Build help embed
      const embed = new EmbedBuilder()
        .setTitle(`${help.emoji} Level ${level}: ${help.name}`)
        .setDescription(help.description)
        .setColor(this._getLevelColor(level))
        .addFields(
          {
            name: '💡 Tips',
            value: help.tips.map((tip, i) => `${i + 1}. ${tip}`).join('\n'),
            inline: false
          }
        )
        .setFooter({ text: 'Social Freedom Exercises • +100 XP per challenge' });
      
      // Send as ephemeral (only visible to user)
      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
      
    } catch (error) {
      console.error('Info button error:', error);
      await interaction.reply({
        content: '❌ Could not load help content.',
        ephemeral: true
      }).catch(() => {});
    }
  },

  _getLevelColor(level) {
    const colors = {
      1: 0x00FF00, 2: 0xFF6B35, 3: 0x6C5CE7, 4: 0xFD79A8,
      5: 0xE74C3C, 6: 0x00CEC9, 7: 0x2D3436
    };
    return colors[level] || 0x000000;
  }
};
```

---

### **Priority 4: Commands**

#### **TASK 7: Complete /tenseylist command**
**File:** `tensey-bot/src/commands/tenseylist.js`

```javascript
const { SlashCommandBuilder } = require('discord.js');
const TenseyProgressService = require('../services/TenseyProgressService');
const ChecklistEmbedBuilder = require('../embeds/ChecklistEmbedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tenseylist')
    .setDescription('View and track your Tensey challenge progress'),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      // Get user's progress
      const userProgress = await TenseyProgressService.getUserProgress(
        interaction.user.id
      );

      // Build embed for page 0 (first page)
      const { embed, components } = await ChecklistEmbedBuilder.build(
        0,  // Start at page 0
        userProgress,
        interaction.user.id
      );

      // Send the interactive checklist
      await interaction.editReply({
        embeds: [embed],
        components: components
      });

    } catch (error) {
      console.error('tenseylist command error:', error);
      await interaction.editReply({
        content: '❌ Failed to load Tensey challenges. Please try again.',
        embeds: [],
        components: []
      });
    }
  }
};
```

#### **TASK 8: Complete /tenseyleaderboard command**
**File:** `tensey-bot/src/commands/tenseyleaderboard.js`

```javascript
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/DatabaseFactory');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tenseyleaderboard')
    .setDescription('View top users by Tensey challenge completions'),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      // Query top 10 users
      const topUsers = await db.query(`
        SELECT 
          user_id,
          COUNT(*) as completions
        FROM user_progress
        WHERE completed_count > 0
        GROUP BY user_id
        ORDER BY completions DESC
        LIMIT 10
      `);

      // Build leaderboard embed
      const embed = new EmbedBuilder()
        .setTitle('🏆 Tensey Challenge Leaderboard')
        .setDescription('Top users by challenges completed')
        .setColor(0xFFD700)
        .setTimestamp();

      if (topUsers.length === 0) {
        embed.setDescription('No completions yet! Be the first to complete a Tensey challenge.');
      } else {
        const leaderboardText = topUsers.map((user, index) => {
          const rank = index + 1;
          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
          const percentage = Math.round((user.completions / 567) * 100);
          return `${medal} <@${user.user_id}> - **${user.completions}/567** (${percentage}%)`;
        }).join('\n');

        embed.setDescription(leaderboardText);
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('tenseyleaderboard command error:', error);
      await interaction.editReply({
        content: '❌ Failed to load leaderboard. Please try again.'
      });
    }
  }
};
```

---

## ✅ TESTING CHECKLIST

After completing each task, test:

### **Test 1: Service Methods**
```javascript
// In node console or test file:
const TenseyProgressService = require('./src/services/TenseyProgressService');

// Mark complete
await TenseyProgressService.markComplete('TEST_USER', 0);

// Get progress
const progress = await TenseyProgressService.getUserProgress('TEST_USER');
console.log(progress); // [0]

// Is complete
const isComplete = await TenseyProgressService.isComplete('TEST_USER', 0);
console.log(isComplete); // true

// Undo
const undone = await TenseyProgressService.undoLastCompletion('TEST_USER');
console.log(undone); // { challengeIdx: 0 }
```

### **Test 2: UI Builder**
```javascript
// Test embed building
const ChecklistEmbedBuilder = require('./src/embeds/ChecklistEmbedBuilder');
const { embed, components } = await ChecklistEmbedBuilder.build(0, [0, 1, 5], 'TEST_USER');

console.log('Embed title:', embed.data.title);
console.log('Button rows:', components.length); // Should be 4
console.log('Row 1 buttons:', components[0].components.length); // Should be 10
```

### **Test 3: Commands in Discord**
1. Run `/tenseylist` - Should show page 1 with all 4 button rows
2. Click challenge button 1 - Should turn green
3. Click challenge button 2 - Should turn green
4. Click UNDO - Should reverse button 2
5. Click Next - Should go to page 2
6. Click L2 button - Should jump to Level 2
7. Click INFO - Should show level help (ephemeral)

### **Test 4: XP Flow**
1. Complete a challenge
2. Wait 60 seconds
3. Check main bot `/leaderboard`
4. Verify +100 XP in `social_freedom_exercises_tenseys` column

---

## 🎯 SUCCESS CRITERIA

UI is complete when:

```
✅ /tenseylist shows page 1 with level header
✅ Progress counter shows X/567 (%)
✅ 10 challenge buttons appear (1-10)
✅ Challenge buttons turn green when clicked
✅ UNDO button reverses last completion
✅ Previous/Next buttons navigate correctly
✅ INFO button shows level help (ephemeral)
✅ Page number buttons appear (when >5 pages in level)
✅ Level jump buttons (L1-L7) work
✅ All 567 challenges accessible
✅ XP awards after 60 seconds
✅ Both leaderboards update
✅ No console errors
```

---

## 💬 HOW TO USE THIS PROMPT

**Step 1:** Copy this entire prompt into Cursor AI

**Step 2:** Complete tasks in order:
```
1. Complete TenseyProgressService.js
2. Complete ChecklistEmbedBuilder.js
3. Complete checklistToggleButton.js
4. Complete checklistUndoButton.js
5. Complete checklistNavigationButton.js
6. Create checklistInfoButton.js
7. Complete /tenseylist command
8. Complete /tenseyleaderboard command
```

**Step 3:** Test after each task using testing checklist

**Step 4:** Ask Cursor for help if stuck:
- "Debug why toggle button isn't working"
- "Show me the button handler registration code"
- "How do I test the embed builder?"

---

## ⏱️ TIMELINE

- Task 1 (Service): 1 hour
- Task 2 (UI Builder): 2 hours
- Tasks 3-6 (Buttons): 3 hours
- Tasks 7-8 (Commands): 1 hour
- Testing: 1-2 hours

**Total: 8-9 hours**

---

**LET'S BUILD THIS UI! 🚀**

