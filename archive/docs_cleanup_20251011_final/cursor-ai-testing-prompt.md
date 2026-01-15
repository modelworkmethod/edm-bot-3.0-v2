# 🧪 CURSOR AI TESTING PROMPT - TENSEY BOT IMPLEMENTATION PLAN

**PURPOSE:** This prompt explains EXACTLY how the Tensey bot works NOW and what needs to be implemented. Copy this into Cursor AI to validate understanding before making changes.

---

## 📊 PROJECT OVERVIEW

**Bot Name:** Rememberson-San (Tensey Bot)  
**Purpose:** Discord bot managing 567 progressive social freedom challenges across 7 levels  
**Current Status:** Core systems complete, UI components stubbed, challenge data minimal (2 examples)

**Implementation Goal:**
- Replace 2 example challenges with 567 complete challenges
- Complete stubbed UI components
- Add INFO button for level help
- Maintain all existing functionality

---

## 🗄️ DATABASE ARCHITECTURE (✅ COMPLETE - DO NOT MODIFY)

### **Database Setup:**
- **Development:** SQLite at `data/tensey.db`
- **Production:** PostgreSQL (via DATABASE_URL env var)
- **Auto-detection:** `src/database/DatabaseFactory.js` handles switching

### **Table 1: user_progress** (Challenge Completion Tracking)
```sql
CREATE TABLE user_progress (
    user_id TEXT NOT NULL,              -- Discord user ID
    challenge_idx INTEGER NOT NULL,     -- 0-based index (0-566)
    completed_count INTEGER DEFAULT 1,  -- Usually 1, allows re-completion
    last_completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, challenge_idx)
);
```

**How it works:**
1. User clicks challenge button (e.g., button "3" on page 1)
2. `checklistToggleButton.js` handler triggered
3. Calls `TenseyProgressService.markComplete(userId, challengeIdx)`
4. Row inserted or `completed_count` incremented
5. Returns updated completion state

**Example Query:**
```sql
-- Get all completed challenges for user
SELECT challenge_idx FROM user_progress 
WHERE user_id = '123456789' AND completed_count > 0
ORDER BY challenge_idx;

-- Result: [0, 1, 5, 12, 23, ...] (indices of completed challenges)
```

### **Table 2: pending_xp_awards** (XP Award Queue)
```sql
CREATE TABLE pending_xp_awards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    challenge_idx INTEGER NOT NULL,
    xp_amount INTEGER NOT NULL,          -- Always 100
    award_scheduled_at TIMESTAMP NOT NULL, -- NOW() + 60 seconds
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**How it works:**
1. After marking challenge complete, `XPAwardService.scheduleAward()` called
2. Row inserted with `award_scheduled_at` = 60 seconds from now
3. Background job (`processXPAwards.js`) runs every 30 seconds
4. Job finds awards where `award_scheduled_at <= NOW()`
5. Job makes API call to main bot to award XP
6. Row deleted after successful award

**Example Data Flow:**
```javascript
// User completes challenge at 20:30:00
INSERT INTO pending_xp_awards VALUES (
  1,                           // id
  '123456789',                 // user_id
  0,                           // challenge_idx
  100,                         // xp_amount
  '2025-10-10 20:31:00',      // award_scheduled_at (60s later)
  '2025-10-10 20:30:00'       // created_at
);

// At 20:31:00, background job processes:
SELECT * FROM pending_xp_awards 
WHERE award_scheduled_at <= '2025-10-10 20:31:00';
// Finds row, awards XP, deletes row
```

### **Table 3: artifacts** (UI Message Persistence)
```sql
CREATE TABLE artifacts (
    guild_id TEXT PRIMARY KEY,
    checklist_message_ids TEXT,      -- JSON array: ["msgId1", "msgId2"]
    leaderboard_message_id TEXT,     -- Single message ID
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**How it works:**
1. When `/tenseylist` first posted → Message ID stored
2. When user clicks button → Bot edits existing message instead of posting new
3. Prevents message spam, maintains clean channel

**Why this exists:**
- Discord has rate limits on message posting
- Editing existing messages is faster and cleaner
- Allows persistent UI that updates in place

---

## ⚙️ XP AWARD SYSTEM (✅ COMPLETE - DO NOT MODIFY)

### **Configuration File:**
**Location:** `src/config/constants.js`

```javascript
XP_AWARD: {
  BASE_XP: 100,                                    // XP per challenge
  AWARD_DELAY_SECONDS: 60,                         // Delay before awarding
  STAT_COLUMN: 'social_freedom_exercises_tenseys', // Column in main bot DB
  INCREMENT_AMOUNT: 1,                             // How much to increment
}
```

### **Complete XP Flow (Step-by-Step):**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER CLICKS CHALLENGE BUTTON                             │
│    Button custom ID: "checklist_toggle_P0_C2"               │
│    (Page 0, Challenge 2 → challenge_idx = 2)                │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. BUTTON HANDLER TRIGGERED                                 │
│    File: src/interactions/buttons/checklistToggleButton.js  │
│    Extracts: page=0, challenge=2                            │
│    Calculates: challengeIdx = (0 * 10) + 2 = 2              │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. MARK COMPLETION IN DATABASE                              │
│    TenseyProgressService.markComplete(userId, 2)            │
│    SQL: INSERT INTO user_progress VALUES                    │
│         ('123456789', 2, 1, CURRENT_TIMESTAMP)              │
│         ON CONFLICT UPDATE completed_count = completed_count + 1 │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. SCHEDULE XP AWARD (60 SECOND DELAY)                      │
│    XPAwardService.scheduleAward(userId, 2, 100)             │
│    SQL: INSERT INTO pending_xp_awards VALUES                │
│         (NULL, '123456789', 2, 100,                         │
│          DATETIME('now', '+60 seconds'), CURRENT_TIMESTAMP) │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. UPDATE UI (IMMEDIATE FEEDBACK)                           │
│    - Re-render embed with challenge marked complete ✅       │
│    - Update progress counter: "3/567 Completed"             │
│    - Edit existing Discord message (no new post)            │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. WAIT 60 SECONDS                                          │
│    Award stays in pending_xp_awards table                   │
│    User sees completion in UI but XP not yet awarded        │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. BACKGROUND JOB RUNS (EVERY 30 SECONDS)                   │
│    File: src/jobs/processXPAwards.js                        │
│    SQL: SELECT * FROM pending_xp_awards                     │
│         WHERE award_scheduled_at <= CURRENT_TIMESTAMP       │
│    Finds award ready to process                             │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. AWARD XP TO MAIN BOT                                     │
│    POST http://mainbot:3000/api/xp/award                   │
│    Body: {                                                  │
│      "userId": "123456789",                                 │
│      "column": "social_freedom_exercises_tenseys",          │
│      "increment": 1                                         │
│    }                                                        │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. MAIN BOT UPDATES LEADERBOARD                             │
│    Main bot receives API request                            │
│    Updates leaderboard table:                               │
│      UPDATE leaderboard                                     │
│      SET social_freedom_exercises_tenseys =                 │
│          social_freedom_exercises_tenseys + 1               │
│      WHERE user_id = '123456789'                            │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 10. CLEANUP PENDING AWARD                                   │
│     DELETE FROM pending_xp_awards WHERE id = 1              │
│     Award successfully processed and removed from queue     │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 11. USER SEES XP IN BOTH LEADERBOARDS                       │
│     - Tensey Leaderboard: Shows challenge completions       │
│     - Main Bot Leaderboard: Shows +100 XP earned            │
│     - Column: social_freedom_exercises_tenseys              │
└─────────────────────────────────────────────────────────────┘
```

### **Key Services:**

#### **XPAwardService.js** (✅ COMPLETE)
**Location:** `src/services/XPAwardService.js`

```javascript
class XPAwardService {
  // Schedule XP award with 60s delay
  async scheduleAward(userId, challengeIdx, xpAmount) {
    const scheduledAt = new Date(Date.now() + 60000); // +60 seconds
    await db.insert('pending_xp_awards', {
      user_id: userId,
      challenge_idx: challengeIdx,
      xp_amount: xpAmount,
      award_scheduled_at: scheduledAt
    });
  }

  // Process all pending awards (called by background job)
  async processAwards() {
    const pending = await db.query(
      'SELECT * FROM pending_xp_awards WHERE award_scheduled_at <= ?',
      [new Date()]
    );
    
    for (const award of pending) {
      await this._awardXP(award.user_id);
      await db.delete('pending_xp_awards', { id: award.id });
    }
  }

  // Make API call to main bot
  async _awardXP(userId) {
    await fetch('http://mainbot:3000/api/xp/award', {
      method: 'POST',
      body: JSON.stringify({
        userId: userId,
        column: 'social_freedom_exercises_tenseys',
        increment: 1
      })
    });
  }
}
```

**Status:** ✅ This service is COMPLETE and WORKING. Do not modify.

#### **TenseyProgressService.js** (⚠️ STUB - NEEDS COMPLETION)
**Location:** `src/services/TenseyProgressService.js`

**Current Status:** File exists with method signatures only (no implementation)

**Needed Implementation:**
```javascript
class TenseyProgressService {
  // Mark challenge as complete
  async markComplete(userId, challengeIdx) {
    // TODO: INSERT OR UPDATE user_progress table
    // TODO: Call XPAwardService.scheduleAward(userId, challengeIdx, 100)
    // TODO: Return success status
  }
  
  // Undo last completion
  async undoLastCompletion(userId) {
    // TODO: Find most recent completion
    // TODO: DELETE from user_progress
    // TODO: DELETE from pending_xp_awards if not yet processed
    // TODO: Return undone challenge info
  }
  
  // Get user's completed challenges
  async getUserProgress(userId) {
    // TODO: SELECT challenge_idx FROM user_progress WHERE user_id = ?
    // TODO: Return array of indices: [0, 1, 5, 12, ...]
  }
  
  // Get completion count for user
  async getCompletionCount(userId) {
    // TODO: COUNT(*) FROM user_progress WHERE user_id = ?
    // TODO: Return number
  }
  
  // Check if challenge is complete
  async isComplete(userId, challengeIdx) {
    // TODO: SELECT EXISTS(SELECT 1 FROM user_progress WHERE ...)
    // TODO: Return boolean
  }
}
```

---

## 🎯 CHALLENGE DATA STRUCTURE (❌ NEEDS 565 MORE CHALLENGES)

### **Current File:**
**Location:** `src/config/challenges.js`

**Current Content (2 examples only):**
```javascript
const CHALLENGES = [
  {
    idx: 0,
    level: 1,
    description: "Make eye contact with a stranger for 3 seconds"
  },
  {
    idx: 1,
    level: 1,
    description: "Say 'good morning' to someone you don't know"
  }
  // TODO: Add 565 more challenges (idx 2-566)
];

module.exports = { CHALLENGES };
```

### **Required Structure for 567 Challenges:**
```javascript
const CHALLENGES = [
  // Level 1: Foundation (50 challenges, idx 0-49)
  { idx: 0, level: 1, description: "Make eye contact with a stranger for 3 seconds" },
  { idx: 1, level: 1, description: "Say 'good morning' to someone you don't know" },
  // ... 48 more Level 1 challenges
  
  // Level 2: Exploration (70 challenges, idx 50-119)
  { idx: 50, level: 2, description: "Strike up a conversation with a barista" },
  // ... 69 more Level 2 challenges
  
  // Level 3: Integration (80 challenges, idx 120-199)
  { idx: 120, level: 3, description: "Attend a social event alone" },
  // ... 79 more Level 3 challenges
  
  // Level 4: Expansion (100 challenges, idx 200-299)
  { idx: 200, level: 4, description: "Give a compliment to a stranger" },
  // ... 99 more Level 4 challenges
  
  // Level 5: Mastery (100 challenges, idx 300-399)
  { idx: 300, level: 5, description: "Speak up in a group discussion" },
  // ... 99 more Level 5 challenges
  
  // Level 6: Wisdom (100 challenges, idx 400-499)
  { idx: 400, level: 6, description: "Lead a small group activity" },
  // ... 99 more Level 6 challenges
  
  // Level 7: Transcendence (67 challenges, idx 500-566)
  { idx: 500, level: 7, description: "Present in front of a large audience" },
  // ... 66 more Level 7 challenges
];

// Total: 567 challenges (0-indexed: 0-566)
```

### **Level Distribution:**
```
Level 1 (🌱 Foundation):      50 challenges  (idx 0-49)
Level 2 (🎨 Exploration):     70 challenges  (idx 50-119)
Level 3 (💎 Integration):     80 challenges  (idx 120-199)
Level 4 (🚀 Expansion):       100 challenges (idx 200-299)
Level 5 (⚡ Mastery):         100 challenges (idx 300-399)
Level 6 (🧘 Wisdom):          100 challenges (idx 400-499)
Level 7 (🎯 Transcendence):   67 challenges  (idx 500-566)
─────────────────────────────────────────────────────────
Total:                        567 challenges
```

---

## 🎨 UI COMPONENTS (⚠️ STUBS - NEED COMPLETION)

### **Command: /tenseylist** (⚠️ STUB)
**Location:** `src/commands/tenseylist.js`

**Current Status:** Basic structure, needs full implementation

**What it should do:**
1. Get user's completed challenges from database
2. Calculate current page (default: page 0)
3. Build embed with ChecklistEmbedBuilder
4. Display 10 challenges per page with buttons
5. Show level header, progress counter, navigation

**Expected UI Layout:**
```
┌───────────────────────────────────────────────────┐
│ 🌱 LEVEL 1: FOUNDATION (Challenges 1-50)         │
│ Progress: 3/567 Completed                         │
├───────────────────────────────────────────────────┤
│ 1. ✅ Make eye contact with a stranger            │
│ 2. ✅ Say 'good morning' to someone               │
│ 3. ❌ Smile at 5 people today                     │
│ 4. ❌ Hold the door open for someone              │
│ 5. ✅ Compliment someone's outfit                 │
│ 6. ❌ Ask for directions even if you know the way │
│ 7. ❌ Start a conversation in an elevator         │
│ 8. ❌ Wave at a neighbor                          │
│ 9. ❌ Say "thank you" with eye contact            │
│ 10. ❌ Introduce yourself to someone new          │
├───────────────────────────────────────────────────┤
│ [1] [2] [3] [4] [5] [6] [7] [8] [9] [10]         │ Row 1: Challenge toggle buttons
│ [◀️ Prev] [↩️ Undo] [ℹ️ INFO] [Next ▶️]           │ Row 2: Navigation + INFO
│ Page: [1] [2] [3] [4] [5]                        │ Row 3: Page numbers (if >5 pages)
│ [🌱L1] [🎨L2] [💎L3] [🚀L4] [⚡L5] [🧘L6] [🎯L7]  │ Row 4: Level jump buttons
└───────────────────────────────────────────────────┘
```

### **ChecklistEmbedBuilder** (⚠️ STUB)
**Location:** `src/utils/builders/ChecklistEmbedBuilder.js`

**Current Status:** Basic embed creation, needs button rows and level headers

**What it should build:**
1. **Embed Title:** Level name with emoji (e.g., "🌱 LEVEL 1: FOUNDATION")
2. **Embed Description:** Challenge range (e.g., "Challenges 1-50")
3. **Field:** Progress counter (e.g., "Progress: 3/567 Completed")
4. **Description:** 10 challenges with checkmarks (✅/❌)
5. **Color:** Level-specific color
6. **Footer:** "Click numbers to toggle • UNDO reverses last action"

**Button Rows:**
```javascript
// Row 1: Challenge toggle buttons (1-10)
[Button 1] [Button 2] ... [Button 10]
// Custom IDs: checklist_toggle_P{page}_C{challenge}

// Row 2: Navigation + INFO + Undo
[◀️ Previous] [↩️ Undo] [ℹ️ INFO] [Next ▶️]
// Custom IDs: checklist_nav_prev_{page}, checklist_undo, 
//             checklist_info_L{level}, checklist_nav_next_{page}

// Row 3: Page numbers (if level has >5 pages)
[Page: 1] [2] [3] [4] [5]
// Custom IDs: checklist_page_{pageNum}

// Row 4: Level jump buttons
[🌱 L1] [🎨 L2] [💎 L3] [🚀 L4] [⚡ L5] [🧘 L6] [🎯 L7]
// Custom IDs: checklist_level_{levelNum}
```

### **Button Handlers** (⚠️ STUBS)

#### **checklistToggleButton.js** (⚠️ STUB)
**Location:** `src/interactions/buttons/checklistToggleButton.js`

**Pattern:** `checklist_toggle_P{page}_C{challenge}`
**Example:** `checklist_toggle_P0_C2` = Page 0, Challenge 2

**What it should do:**
```javascript
async execute(interaction) {
  // 1. Parse custom ID
  const [, , page, challenge] = interaction.customId.split('_');
  const pageNum = parseInt(page.substring(1)); // "P0" → 0
  const challengeNum = parseInt(challenge.substring(1)); // "C2" → 2
  
  // 2. Calculate challenge index
  const challengeIdx = (pageNum * 10) + challengeNum; // (0 * 10) + 2 = 2
  
  // 3. Check current state
  const isComplete = await TenseyProgressService.isComplete(
    interaction.user.id, 
    challengeIdx
  );
  
  // 4. Toggle completion
  if (!isComplete) {
    await TenseyProgressService.markComplete(interaction.user.id, challengeIdx);
  } else {
    // Optional: Allow un-toggle or just prevent
    return interaction.reply({ content: 'Use UNDO to reverse', ephemeral: true });
  }
  
  // 5. Rebuild embed with updated state
  const userProgress = await TenseyProgressService.getUserProgress(interaction.user.id);
  const embed = ChecklistEmbedBuilder.build(pageNum, userProgress);
  
  // 6. Update message
  await interaction.update({ embeds: [embed], components: [...] });
}
```

#### **checklistUndoButton.js** (⚠️ STUB)
**Location:** `src/interactions/buttons/checklistUndoButton.js`

**Pattern:** `checklist_undo`

**What it should do:**
```javascript
async execute(interaction) {
  // 1. Find user's most recent completion
  const lastCompletion = await TenseyProgressService.undoLastCompletion(
    interaction.user.id
  );
  
  // 2. Check if anything to undo
  if (!lastCompletion) {
    return interaction.reply({ 
      content: 'Nothing to undo!', 
      ephemeral: true 
    });
  }
  
  // 3. Calculate which page contains the undone challenge
  const page = Math.floor(lastCompletion.challengeIdx / 10);
  
  // 4. Rebuild embed for that page
  const userProgress = await TenseyProgressService.getUserProgress(interaction.user.id);
  const embed = ChecklistEmbedBuilder.build(page, userProgress);
  
  // 5. Update message
  await interaction.update({ embeds: [embed], components: [...] });
  
  // 6. Send confirmation
  await interaction.followUp({ 
    content: `Undid: ${lastCompletion.description}`, 
    ephemeral: true 
  });
}
```

#### **checklistInfoButton.js** (❌ NEW - NEEDS CREATION)
**Location:** `src/interactions/buttons/checklistInfoButton.js` (NEW FILE)

**Pattern:** `checklist_info_L{level}`
**Example:** `checklist_info_L3` = Level 3 info

**What it should do:**
```javascript
const { LevelHelpContent } = require('../../utils/levelHelp');

module.exports = {
  data: {
    name: 'checklist_info',
    description: 'Show help for current level'
  },
  
  async execute(interaction) {
    // 1. Parse level from custom ID
    const level = parseInt(interaction.customId.split('_')[2].substring(1));
    
    // 2. Get help embed for this level
    const helpEmbed = LevelHelpContent.getHelpEmbed(level);
    
    // 3. Send as ephemeral (only visible to user)
    await interaction.reply({
      embeds: [helpEmbed],
      ephemeral: true
    });
  }
};
```

#### **checklistNavigationButton.js** (⚠️ STUB)
**Location:** `src/interactions/buttons/checklistNavigationButton.js`

**Patterns:** 
- `checklist_nav_prev_{page}` = Previous page
- `checklist_nav_next_{page}` = Next page
- `checklist_page_{pageNum}` = Jump to specific page
- `checklist_level_{levelNum}` = Jump to level's first page

**What it should do:**
```javascript
async execute(interaction) {
  // 1. Parse custom ID to determine action
  const parts = interaction.customId.split('_');
  let targetPage;
  
  if (parts[2] === 'prev') {
    targetPage = parseInt(parts[3]) - 1;
  } else if (parts[2] === 'next') {
    targetPage = parseInt(parts[3]) + 1;
  } else if (parts[1] === 'page') {
    targetPage = parseInt(parts[2]);
  } else if (parts[1] === 'level') {
    const level = parseInt(parts[2]);
    targetPage = getLevelStartPage(level); // Helper function
  }
  
  // 2. Validate page bounds
  if (targetPage < 0 || targetPage >= 57) {
    return interaction.reply({ 
      content: 'Invalid page!', 
      ephemeral: true 
    });
  }
  
  // 3. Rebuild embed for new page
  const userProgress = await TenseyProgressService.getUserProgress(interaction.user.id);
  const embed = ChecklistEmbedBuilder.build(targetPage, userProgress);
  
  // 4. Update message
  await interaction.update({ embeds: [embed], components: [...] });
}
```

### **Level Help Content** (❌ NEW - NEEDS CREATION)
**Location:** `src/utils/levelHelp.js` (NEW FILE)

**Purpose:** Store help content for each level's INFO button

**Structure:**
```javascript
const { EmbedBuilder } = require('discord.js');
const { LEVEL_EMOJIS, LEVEL_COLORS } = require('../config/constants');

const LEVEL_HELP = {
  1: {
    title: '🌱 Level 1: Foundation',
    description: 'Welcome to your Tensey journey! These exercises build basic awareness.',
    tips: [
      'Start with 5-10 exercises daily',
      'Focus on understanding, not speed',
      'Mark challenges as you complete them naturally',
      'Use UNDO if you accidentally click'
    ],
    challenges: 50,
    xp_total: 5000
  },
  2: {
    title: '🎨 Level 2: Exploration',
    description: 'Deepen your practice with varied challenges.',
    tips: [
      'Experiment with different challenge types',
      'Notice patterns in your responses',
      'Complete 10-15 daily for steady progress'
    ],
    challenges: 70,
    xp_total: 7000
  },
  // ... Levels 3-7 with similar structure
};

class LevelHelpContent {
  static getHelpEmbed(level) {
    const help = LEVEL_HELP[level];
    
    return new EmbedBuilder()
      .setTitle(help.title)
      .setDescription(help.description)
      .setColor(LEVEL_COLORS[level])
      .addFields(
        {
          name: '💡 Tips',
          value: help.tips.map((tip, i) => `${i + 1}. ${tip}`).join('\n')
        },
        {
          name: '📊 Level Stats',
          value: `**Challenges:** ${help.challenges}\n**Total XP:** ${help.xp_total.toLocaleString()}`
        }
      )
      .setFooter({ text: 'Click challenges to mark complete • Use UNDO to reverse' });
  }
}

module.exports = { LevelHelpContent, LEVEL_HELP };
```

---

## 📋 LEADERBOARD INTEGRATION (⚠️ STUB)

### **Command: /tenseyleaderboard** (⚠️ STUB)
**Location:** `src/commands/tenseyleaderboard.js`

**What it should do:**
```javascript
async execute(interaction) {
  // 1. Query top users by completion count
  const topUsers = await db.query(`
    SELECT 
      user_id, 
      COUNT(*) as completion_count
    FROM user_progress
    WHERE completed_count > 0
    GROUP BY user_id
    ORDER BY completion_count DESC
    LIMIT 10
  `);
  
  // 2. Build leaderboard embed
  const embed = new EmbedBuilder()
    .setTitle('🏆 Tensey Challenge Leaderboard')
    .setColor(0xFFD700)
    .setDescription('Top users by challenges completed')
    .addFields(
      topUsers.map((user, index) => ({
        name: `${index + 1}. ${user.user_id}`,
        value: `${user.completion_count}/567 challenges`
      }))
    );
  
  // 3. Reply with embed
  await interaction.reply({ embeds: [embed] });
}
```

### **Main Bot Leaderboard** (✅ ALREADY INTEGRATED)
**Location:** Main bot `/leaderboard` command

**How it works:**
1. Main bot has a leaderboard table with columns for different XP types
2. Column: `social_freedom_exercises_tenseys`
3. When Tensey bot awards XP → Main bot increments this column
4. User's total XP includes Tensey completions
5. Main bot `/leaderboard` command shows all XP sources

**No changes needed** - this integration is complete and working.

---

## 🎯 IMPLEMENTATION PRIORITY

### **Phase 1: Core Functionality (MUST COMPLETE)**
1. ✅ Replace `challenges.js` with 567 challenges (SAFE - just data)
2. ⚠️ Complete `TenseyProgressService.js` methods (CRITICAL - needed for all features)
3. ⚠️ Complete `ChecklistEmbedBuilder.js` with all button rows (HIGH PRIORITY)
4. ⚠️ Complete all button handlers (HIGH PRIORITY)

### **Phase 2: UI Enhancements (SHOULD COMPLETE)**
5. ❌ Add `levelHelp.js` utility file (NEW - for INFO button)
6. ❌ Add `checklistInfoButton.js` handler (NEW - INFO button functionality)
7. ⚠️ Complete `/tenseyleaderboard` command (STUB completion)

### **Phase 3: Polish (NICE TO HAVE)**
8. Add error handling and validation
9. Add loading states for slow operations
10. Add confirmation messages for actions

---

## 🚨 SAFETY RULES

### **❌ NEVER MODIFY THESE FILES:**
- `bot.js` - Main entry point
- `src/database/` - Database layer (complete and working)
- `src/services/XPAwardService.js` - XP awarding (complete and working)
- `src/jobs/processXPAwards.js` - Background job (complete and working)
- Database schema - Tables are final

### **✅ SAFE TO MODIFY:**
- `src/config/challenges.js` - Just replace array (SAFE)
- `src/config/constants.js` - Add level emoji/colors if needed
- `src/services/TenseyProgressService.js` - Complete stubs (SAFE)
- `src/utils/builders/ChecklistEmbedBuilder.js` - Complete UI (SAFE)
- All button handlers - Complete implementations (SAFE)

### **❌ NEVER ADD:**
- New database tables
- New background jobs
- New XP award logic
- Breaking changes to customId patterns

---

## 📊 EXPECTED RESULTS AFTER IMPLEMENTATION

### **Challenge Stats:**
```
Total Challenges: 567
Total Pages: 57 (10 per page)
Total Levels: 7
Total XP Possible: 56,700 (567 × 100)

Level Breakdown:
  Level 1: Pages 0-4   (50 challenges)
  Level 2: Pages 5-11  (70 challenges)
  Level 3: Pages 12-19 (80 challenges)
  Level 4: Pages 20-29 (100 challenges)
  Level 5: Pages 30-39 (100 challenges)
  Level 6: Pages 40-49 (100 challenges)
  Level 7: Pages 50-56 (67 challenges)
```

### **UI Features:**
```
✅ Level headers with emoji (🌱🎨💎🚀⚡🧘🎯)
✅ Progress counter (X/567 Completed)
✅ Challenge toggle buttons (1-10 per page)
✅ Navigation buttons (Previous/Next)
✅ UNDO button (reverses last action)
✅ INFO button (level-specific help, ephemeral)
✅ Page number buttons (quick jump)
✅ Level jump buttons (jump to level start)
✅ Persistent UI (edits messages, doesn't spam)
```

### **Data Flow:**
```
User clicks challenge → Immediate UI update with ✅
                     → Database records completion
                     → XP award scheduled (60s delay)
                     → Background job processes
                     → Main bot receives XP
                     → Both leaderboards update

User clicks UNDO → Most recent completion reversed
                 → Pending XP award cancelled (if not yet processed)
                 → UI updates to show ❌

User clicks INFO → Ephemeral help embed appears
                → Shows level tips, stats, XP info
                → Only visible to user who clicked
```

---

## 🧪 TESTING CHECKLIST

### **Before Implementation:**
```
□ Review this entire document
□ Understand current architecture
□ Identify which files are complete vs. stubs
□ Understand XP flow and database schema
```

### **During Implementation:**
```
□ Start with Phase 1 (core functionality)
□ Test each component individually
□ Don't modify complete files
□ Follow existing code patterns
□ Use existing constants and utilities
```

### **After Implementation:**
```
□ Test /tenseylist command loads
□ Test challenge button toggles work
□ Test UNDO reverses last action
□ Test INFO button shows help (ephemeral)
□ Test navigation between pages
□ Test level jump buttons
□ Test pagination (page number buttons)
□ Wait 60s, verify XP awarded
□ Check /tenseyleaderboard shows completions
□ Check main bot /leaderboard shows XP
□ Test with multiple users
□ Verify database integrity
```

### **Database Verification:**
```sql
-- Check user progress
SELECT COUNT(*) FROM user_progress;
SELECT * FROM user_progress WHERE user_id = 'YOUR_USER_ID';

-- Check pending XP awards
SELECT COUNT(*) FROM pending_xp_awards;
SELECT * FROM pending_xp_awards ORDER BY award_scheduled_at DESC LIMIT 5;

-- Check leaderboard
SELECT user_id, COUNT(*) as completions 
FROM user_progress 
GROUP BY user_id 
ORDER BY completions DESC;
```

---

## 💬 HOW TO USE THIS PROMPT WITH CURSOR AI

**Copy this entire document into Cursor AI and then ask:**

### **Understanding Questions:**
- "Explain the XP award flow step by step"
- "Show me how the database tables relate to each other"
- "What files are complete vs. stubs?"
- "How does the INFO button work?"

### **Implementation Requests:**
- "Complete the TenseyProgressService.js file"
- "Add all 567 challenges to challenges.js"
- "Complete the ChecklistEmbedBuilder with all button rows"
- "Create the checklistInfoButton.js handler"
- "Complete the /tenseyleaderboard command"

### **Debugging Help:**
- "Why isn't my challenge button working?"
- "The UNDO button isn't reversing - what's wrong?"
- "XP isn't showing in main leaderboard - debug the flow"
- "INFO button isn't appearing - what's missing?"

### **Testing Guidance:**
- "What should I test first?"
- "How do I verify the XP was awarded?"
- "Show me the SQL query to check user progress"

---

**This prompt provides COMPLETE context for safe implementation. Cursor AI will now understand exactly how your bot works and what needs to be added!** 🚀
