# 🚀 CURSOR AI PROMPT - COMPLETE TENSEY BOT IMPLEMENTATION

**STATUS UPDATE:** ✅ Challenge data is COMPLETE (567 challenges loaded!)

**COPY THIS PROMPT INTO CURSOR AI TO COMPLETE THE REMAINING WORK**

---

## ✅ WHAT'S ALREADY DONE

### **Phase 1: Core Data (COMPLETE)**
- ✅ **challenges.js** - All 567 challenges added and verified
- ✅ **Database schema** - Complete and working
- ✅ **XP award system** - Complete and tested
- ✅ **Background jobs** - Running correctly
- ✅ **Configuration** - All constants defined

**Test Results:**
```bash
✅ Total Challenges: 567
✅ Level Distribution: Perfect (50/70/80/100/100/100/67)
✅ Indexing: Continuous 0-566, no gaps
✅ Utility Functions: Working correctly
✅ Total XP: 56,700 available
```

---

## ⚠️ WHAT NEEDS TO BE COMPLETED

### **Phase 2: Core Services (HIGH PRIORITY) - 2-3 hours**

#### **Task 1: Complete TenseyProgressService.js**
**Location:** `src/services/TenseyProgressService.js`

**Current Status:** Stub with method signatures only

**Implementation Required:**

```javascript
const db = require('../database/DatabaseFactory');
const { XPAwardService } = require('./XPAwardService');
const { XP_AWARD } = require('../config/constants');

class TenseyProgressService {
  async markComplete(userId, challengeIdx) {
    try {
      // 1. Validate index
      if (challengeIdx < 0 || challengeIdx > 566) return false;

      // 2. Check if already complete
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
        // First completion - insert
        await db.insert('user_progress', {
          user_id: userId,
          challenge_idx: challengeIdx,
          completed_count: 1,
          last_completed_at: new Date()
        });
      }

      // 3. Schedule XP award (60s delay)
      await XPAwardService.scheduleAward(
        userId,
        challengeIdx,
        XP_AWARD.BASE_XP
      );

      return true;
    } catch (error) {
      console.error('Error marking challenge complete:', error);
      return false;
    }
  }

  async undoLastCompletion(userId) {
    try {
      // Find most recent completion
      const lastCompletion = await db.query(
        `SELECT * FROM user_progress 
         WHERE user_id = ? 
         ORDER BY last_completed_at DESC 
         LIMIT 1`,
        [userId]
      );

      if (!lastCompletion || lastCompletion.length === 0) {
        return null;
      }

      const completion = lastCompletion[0];

      // Delete from user_progress
      await db.delete('user_progress', {
        user_id: userId,
        challenge_idx: completion.challenge_idx
      });

      // Cancel pending XP award
      await db.delete('pending_xp_awards', {
        user_id: userId,
        challenge_idx: completion.challenge_idx
      });

      return {
        challengeIdx: completion.challenge_idx,
        level: this._getChallengeLevel(completion.challenge_idx)
      };
    } catch (error) {
      console.error('Error undoing completion:', error);
      return null;
    }
  }

  async getUserProgress(userId) {
    try {
      const progress = await db.query(
        `SELECT challenge_idx FROM user_progress 
         WHERE user_id = ? AND completed_count > 0 
         ORDER BY challenge_idx ASC`,
        [userId]
      );
      return progress.map(row => row.challenge_idx);
    } catch (error) {
      console.error('Error getting user progress:', error);
      return [];
    }
  }

  async getCompletionCount(userId) {
    try {
      const result = await db.query(
        `SELECT COUNT(*) as count FROM user_progress 
         WHERE user_id = ? AND completed_count > 0`,
        [userId]
      );
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting completion count:', error);
      return 0;
    }
  }

  async isComplete(userId, challengeIdx) {
    try {
      const result = await db.get('user_progress', {
        user_id: userId,
        challenge_idx: challengeIdx
      });
      return result && result.completed_count > 0;
    } catch (error) {
      console.error('Error checking completion:', error);
      return false;
    }
  }

  _getChallengeLevel(idx) {
    if (idx < 50) return 1;
    if (idx < 120) return 2;
    if (idx < 200) return 3;
    if (idx < 300) return 4;
    if (idx < 400) return 5;
    if (idx < 500) return 6;
    return 7;
  }
}

module.exports = new TenseyProgressService();
```

**Ask Cursor:**
```
"Complete the TenseyProgressService.js file with all methods shown above"
```

---

### **Phase 3: UI Components (HIGH PRIORITY) - 4-6 hours**

#### **Task 2: Complete ChecklistEmbedBuilder.js**
**Location:** `src/utils/builders/ChecklistEmbedBuilder.js`

**Implementation Required:**

```javascript
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { CHALLENGES, getLevelInfo } = require('../../config/challenges');

class ChecklistEmbedBuilder {
  static async build(page, completedIndices, userId) {
    // Calculate page info
    const startIdx = page * 10;
    const endIdx = Math.min(startIdx + 10, 567);
    const pageChallenges = CHALLENGES.slice(startIdx, endIdx);
    
    // Get level info
    const level = pageChallenges[0]?.level || 1;
    const levelInfo = getLevelInfo(level);
    
    // Build embed
    const embed = new EmbedBuilder()
      .setTitle(`${levelInfo.emoji} LEVEL ${level}: ${levelInfo.name.toUpperCase()}`)
      .setDescription(this._buildDescription(pageChallenges, completedIndices, startIdx))
      .setColor(this._getLevelColor(level))
      .addFields({
        name: '📊 Your Progress',
        value: `${completedIndices.length}/567 Challenges Completed (${Math.round((completedIndices.length / 567) * 100)}%)`,
        inline: false
      })
      .setFooter({ text: `Page ${page + 1}/57 • Click numbers to toggle • UNDO reverses • INFO shows help` })
      .setTimestamp();

    // Build button rows
    const components = [];

    // ROW 1: Challenge toggle buttons (1-10)
    const challengeRow = new ActionRowBuilder();
    for (let i = 0; i < pageChallenges.length; i++) {
      const challengeIdx = startIdx + i;
      const isComplete = completedIndices.includes(challengeIdx);
      
      challengeRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`checklist_toggle_P${page}_C${i}`)
          .setLabel(`${i + 1}`)
          .setStyle(isComplete ? ButtonStyle.Success : ButtonStyle.Secondary)
      );
    }
    components.push(challengeRow);

    // ROW 2: Navigation + Undo + INFO
    const navRow = new ActionRowBuilder();
    navRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`checklist_nav_prev_${page}`)
        .setLabel('◀️ Prev')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId('checklist_undo')
        .setLabel('↩️ Undo')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`checklist_info_L${level}`)
        .setLabel('ℹ️ INFO')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`checklist_nav_next_${page}`)
        .setLabel('Next ▶️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page >= 56)
    );
    components.push(navRow);

    // ROW 3: Page numbers (if >5 pages in level)
    const levelPages = this._getLevelPages(level);
    if (levelPages.length > 5) {
      const pageRow = new ActionRowBuilder();
      const visiblePages = this._getVisiblePages(page, levelPages);
      
      for (const p of visiblePages) {
        pageRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`checklist_page_${p}`)
            .setLabel(p === page ? `[${p + 1}]` : `${p + 1}`)
            .setStyle(p === page ? ButtonStyle.Success : ButtonStyle.Secondary)
        );
      }
      components.push(pageRow);
    }

    // ROW 4: Level jump buttons
    const levelRow = new ActionRowBuilder();
    for (let l = 1; l <= 7; l++) {
      const lInfo = getLevelInfo(l);
      levelRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`checklist_level_${l}`)
          .setLabel(`${lInfo.emoji}L${l}`)
          .setStyle(l === level ? ButtonStyle.Success : ButtonStyle.Secondary)
      );
    }
    components.push(levelRow);

    return { embed, components };
  }

  static _buildDescription(pageChallenges, completedIndices, startIdx) {
    return pageChallenges.map((challenge, i) => {
      const idx = startIdx + i;
      const isComplete = completedIndices.includes(idx);
      const checkbox = isComplete ? '✅' : '❌';
      return `${i + 1}. ${checkbox} ${challenge.text}`;
    }).join('\n');
  }

  static _getLevelColor(level) {
    const colors = {
      1: 0x00FF00, 2: 0xFF6B35, 3: 0x6C5CE7, 4: 0xFD79A8,
      5: 0xE74C3C, 6: 0x00CEC9, 7: 0x2D3436
    };
    return colors[level] || 0x000000;
  }

  static _getLevelPages(level) {
    const ranges = {
      1: [0, 4], 2: [5, 11], 3: [12, 19], 4: [20, 29],
      5: [30, 39], 6: [40, 49], 7: [50, 56]
    };
    const [start, end] = ranges[level];
    const pages = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  static _getVisiblePages(currentPage, allPages) {
    if (allPages.length <= 5) return allPages;
    const idx = allPages.indexOf(currentPage);
    const start = Math.max(0, idx - 2);
    const end = Math.min(allPages.length, start + 5);
    return allPages.slice(start, end);
  }
}

module.exports = ChecklistEmbedBuilder;
```

**Ask Cursor:**
```
"Complete the ChecklistEmbedBuilder.js file with all 4 button rows as shown above"
```

#### **Task 3: Create levelHelp.js**
**Location:** `src/utils/levelHelp.js` (NEW FILE)

**Implementation Required:**

```javascript
const { EmbedBuilder } = require('discord.js');

const LEVEL_HELP = {
  1: {
    title: '🌱 Level 1: Basic Approach & Warm-Up',
    description: 'Foundation exercises for social freedom and grounded presence.',
    tips: [
      'Start with 5-10 exercises daily',
      'Focus on belly breathing and grounded presence',
      'Notice your body sensations during interactions',
      'Use UNDO if you accidentally click'
    ],
    challenges: 50,
    xp_total: 5000
  },
  2: {
    title: '🎨 Level 2: Social Creativity & Playfulness',
    description: 'Playful experiments to expand social comfort zones.',
    tips: [
      'Embrace the absurd and silly',
      'Let go of needing to look cool',
      'Dance, play pretend, and have fun',
      'Aim for 10-15 challenges daily'
    ],
    challenges: 70,
    xp_total: 7000
  },
  3: {
    title: '💎 Level 3: Vulnerability & Authentic Expression',
    description: 'Share your truth and practice emotional authenticity.',
    tips: [
      'Share embarrassing facts openly',
      'Admit when you feel nervous',
      'Practice emotional honesty',
      'Complete 8-12 daily for growth'
    ],
    challenges: 80,
    xp_total: 8000
  },
  4: {
    title: '🚀 Level 4: Bold Social Experiments',
    description: 'Push boundaries with creative social experiments.',
    tips: [
      'Embrace the weird and unusual',
      'Run fake campaigns and absurd scenarios',
      'Challenge yourself with bold moves',
      'Aim for 8-10 daily completions'
    ],
    challenges: 100,
    xp_total: 10000
  },
  5: {
    title: '⚡ Level 5: Tension & Escalation',
    description: 'Master tension, silence, and sexual energy.',
    tips: [
      'Practice 20-second silence holds',
      'Make direct attraction statements',
      'Work with sexual energy authentically',
      'Complete 6-8 challenges daily'
    ],
    challenges: 100,
    xp_total: 10000
  },
  6: {
    title: '🧘 Level 6: Embodied Approach Foundations',
    description: 'Embody sexual authenticity and pattern awareness.',
    tips: [
      'Approach with jaw relaxed',
      'Notice body sensations deeply',
      'Practice sexual authenticity',
      'Complete 6-8 challenges daily'
    ],
    challenges: 100,
    xp_total: 10000
  },
  7: {
    title: '🎯 Level 7: Deep Integration & Mastery',
    description: 'Build community and integrate all previous learning.',
    tips: [
      'Create integration circles',
      'Build long-term relationships',
      'Transform your entire life',
      'Complete 2-3 challenges weekly'
    ],
    challenges: 67,
    xp_total: 6700
  }
};

class LevelHelpContent {
  static getHelpEmbed(level) {
    const help = LEVEL_HELP[level];
    if (!help) throw new Error(`Invalid level: ${level}`);

    return new EmbedBuilder()
      .setTitle(help.title)
      .setDescription(help.description)
      .setColor(this._getColor(level))
      .addFields(
        {
          name: '💡 Tips',
          value: help.tips.map((tip, i) => `${i + 1}. ${tip}`).join('\n'),
          inline: false
        },
        {
          name: '📊 Level Stats',
          value: `**Challenges:** ${help.challenges}\n**Total XP:** ${help.xp_total.toLocaleString()}`,
          inline: true
        }
      )
      .setFooter({ text: 'Click challenges to mark complete • Use UNDO to reverse' })
      .setTimestamp();
  }

  static _getColor(level) {
    const colors = {
      1: 0x00FF00, 2: 0xFF6B35, 3: 0x6C5CE7, 4: 0xFD79A8,
      5: 0xE74C3C, 6: 0x00CEC9, 7: 0x2D3436
    };
    return colors[level] || 0x000000;
  }
}

module.exports = { LevelHelpContent, LEVEL_HELP };
```

**Ask Cursor:**
```
"Create the src/utils/levelHelp.js file with the content shown above"
```

---

### **Phase 4: Button Handlers (HIGH PRIORITY) - 3-4 hours**

#### **Task 4: Complete checklistToggleButton.js**
**Ask Cursor:**
```
"Complete src/interactions/buttons/checklistToggleButton.js to:
1. Parse custom ID (checklist_toggle_P{page}_C{challenge})
2. Calculate challenge index: (page * 10) + challenge
3. Check if already complete using TenseyProgressService
4. If not complete, call markComplete()
5. Get updated progress and rebuild embed
6. Update message with new embed
7. Send ephemeral confirmation with completion count"
```

#### **Task 5: Complete checklistUndoButton.js**
**Ask Cursor:**
```
"Complete src/interactions/buttons/checklistUndoButton.js to:
1. Call TenseyProgressService.undoLastCompletion()
2. If nothing to undo, send error message
3. Calculate which page contains undone challenge
4. Rebuild embed for that page
5. Update message
6. Send confirmation with challenge description"
```

#### **Task 6: Complete checklistNavigationButton.js**
**Ask Cursor:**
```
"Complete src/interactions/buttons/checklistNavigationButton.js to handle:
1. Previous page: checklist_nav_prev_{page}
2. Next page: checklist_nav_next_{page}
3. Direct page jump: checklist_page_{pageNum}
4. Level jump: checklist_level_{levelNum}
   - Level start pages: 1→0, 2→5, 3→12, 4→20, 5→30, 6→40, 7→50
5. Validate page bounds (0-56)
6. Rebuild embed for target page
7. Update message"
```

#### **Task 7: Create checklistInfoButton.js**
**Ask Cursor:**
```
"Create src/interactions/buttons/checklistInfoButton.js to:
1. Parse level from custom ID: checklist_info_L{level}
2. Import LevelHelpContent from utils/levelHelp
3. Get help embed using LevelHelpContent.getHelpEmbed(level)
4. Send as ephemeral reply (only visible to user)"
```

---

### **Phase 5: Commands (MEDIUM PRIORITY) - 2-3 hours**

#### **Task 8: Complete /tenseylist command**
**Ask Cursor:**
```
"Complete src/commands/tenseylist.js to:
1. Get user's completed challenges from TenseyProgressService
2. Build initial embed for page 0 using ChecklistEmbedBuilder
3. Reply with embed and all button components
4. Store message ID in artifacts table for future edits"
```

#### **Task 9: Complete /tenseyleaderboard command**
**Ask Cursor:**
```
"Complete src/commands/tenseyleaderboard.js to:
1. Query top 10 users by completion count:
   SELECT user_id, COUNT(*) as completions 
   FROM user_progress 
   WHERE completed_count > 0 
   GROUP BY user_id 
   ORDER BY completions DESC 
   LIMIT 10
2. Build leaderboard embed with rankings
3. Show: Rank, User, Completions (X/567)
4. Reply with embed"
```

---

## 🧪 TESTING CHECKLIST

After completing each task, test:

```bash
# Test challenge loading
node -e "const {challenges} = require('./src/config/challenges'); console.log('Total:', challenges.length)"

# Test service methods
# (Create test script to verify markComplete, undo, getUserProgress)

# Test UI builder
# (Load bot and run /tenseylist)

# Test buttons
# (Click each button type and verify behavior)

# Test XP flow
# (Complete challenge, wait 60s, check main leaderboard)
```

---

## 📊 SUCCESS CRITERIA

Implementation is complete when:

```
✅ /tenseylist command loads with all 4 button rows
✅ Challenge toggle buttons (1-10) work correctly
✅ UNDO button reverses most recent completion
✅ INFO button shows level help (ephemeral)
✅ Navigation works (Previous, Next, Pages, Levels)
✅ Progress counter is accurate (X/567 with %)
✅ XP awards process after 60 seconds
✅ Both leaderboards update correctly
✅ All 567 challenges accessible
✅ No errors in console
```

---

## 💬 HOW TO USE WITH CURSOR

1. **Copy this entire prompt** into Cursor AI
2. **Complete tasks in order** (Services → UI → Buttons → Commands)
3. **Test after each task** using the testing checklist
4. **Ask for help** if you get stuck:
   - "Debug why the toggle button isn't working"
   - "Show me the correct SQL query for getUserProgress"
   - "How do I test the XP flow end-to-end?"

---

## 🎯 ESTIMATED TIMELINE

- **Task 1** (TenseyProgressService): 1-2 hours
- **Task 2** (ChecklistEmbedBuilder): 2-3 hours
- **Task 3** (levelHelp): 30 minutes
- **Tasks 4-7** (Button handlers): 2-3 hours
- **Tasks 8-9** (Commands): 1-2 hours
- **Testing**: 2-3 hours
- **Total: 9-13.5 hours**

---

**The foundation is complete. Let's finish building this! 🚀**

