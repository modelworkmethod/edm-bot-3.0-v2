# Commands

Available Discord slash commands for Embodied Dating Mastermind Bot v3.

**Total Registered**: 18 commands (7 command groups)

═══════════════════════════════════════════════════════════════════════════════

## Stats Commands (3)

### /submit-stats
Submit your daily stats via modal form.

**Usage**: `/submit-stats`  
**File**: `src/commands/stats/submit-stats.js`

---

### /scorecard
View your comprehensive stats including K/D ratios and comparison mode.

**Usage**: `/scorecard [user]`  
**File**: `src/commands/stats/scorecard.js`

---

### /submit-past-stats
Submit stats for a previous day.

**Usage**: `/submit-past-stats`  
**File**: `src/commands/stats/submit-past-stats.js`

═══════════════════════════════════════════════════════════════════════════════

## Leaderboard Commands (2)

### /leaderboard
Display the XP leaderboard.

**Usage**: `/leaderboard [limit]`  
**Options**: limit (5-50, default: 10)  
**File**: `src/commands/leaderboard/leaderboard.js`

---

### /faction-stats
Display faction war leaderboard.

**Usage**: `/faction-stats`  
**File**: `src/commands/leaderboard/faction-stats.js`

═══════════════════════════════════════════════════════════════════════════════

## Admin Commands (9)

### /admin
Main admin command menu.

**Usage**: `/admin`  
**File**: `src/commands/admin/admin.js`  
**Permissions**: ADMIN

---

### /adjust-xp
Manually adjust user XP.

**Usage**: `/adjust-xp <user> <amount>`  
**File**: `src/commands/admin/adjust-xp.js`  
**Permissions**: ADMIN

---

### /reset-stats
Reset all user stats.

**Usage**: `/reset-stats <user>`  
**File**: `src/commands/admin/reset-stats.js`  
**Permissions**: ADMIN

---

### /coaching-dashboard
View inactive users and engagement metrics.

**Usage**: `/coaching-dashboard`  
**File**: `src/commands/admin/coaching-dashboard.js`  
**Permissions**: ADMIN

---

### /start-raid
Start a Warrior or Mage raid event.

**Usage**: `/start-raid <type> <duration>`  
**File**: `src/commands/admin/start-raid.js`  
**Permissions**: ADMIN

---

### /set-double-xp
Create or manage Double XP events.

**Usage**: `/set-double-xp <multiplier> <duration>`  
**File**: `src/commands/admin/set-double-xp.js`  
**Permissions**: ADMIN

---

### /course-admin
Manage course content and answer questions.

**Usage**: `/course-admin`  
**File**: `src/commands/admin/course-admin.js`  
**Permissions**: ADMIN

---

### /coaching-insights
View comprehensive analytics dashboard.

**Usage**: `/coaching-insights [user]`  
**File**: `src/commands/admin/coaching-insights.js`  
**Permissions**: ADMIN

---

### /security
Security and moderation management.

**Usage**: `/security <subcommand>`  
**Subcommands**: warn, warnings, flags, audit, export-data, backup  
**File**: `src/commands/admin/security.js`  
**Permissions**: ADMIN

═══════════════════════════════════════════════════════════════════════════════

## Barbie Commands (1)

### /barbie
Contact list management with AI-generated openers.

**Usage**: `/barbie <action>`  
**Actions**: add, list, view, reminders  
**File**: `src/commands/barbie/barbie.js`

═══════════════════════════════════════════════════════════════════════════════

## Course Commands (1)

### /course
Access course modules and track progress.

**Usage**: `/course [module]`  
**File**: `src/commands/course/course.js`

═══════════════════════════════════════════════════════════════════════════════

## Help Commands (1)

### /help
Get help using the AI-powered onboarding chatbot.

**Usage**: `/help [topic]`  
**File**: `src/commands/help/help.js`

═══════════════════════════════════════════════════════════════════════════════

## Raids Commands (1)

### /raid-status
Check current raid progress.

**Usage**: `/raid-status`  
**File**: `src/commands/raids/raid-status.js`

═══════════════════════════════════════════════════════════════════════════════

## Commands Not Yet Implemented

The following command groups are defined but missing implementations:

### CTJ Commands (Confidence Tension Journal)
- ❌ `/journal` - File missing: `src/commands/ctj/journal.js`
- ❌ `/breakthroughs` - File missing: `src/commands/ctj/breakthroughs.js`

**Status**: Command group exists (`src/commands/ctj/index.js`) but not registered (implementations missing)

---

### Duels Commands
- ❌ `/duel` - File missing: `src/commands/duels/duel.js`

**Status**: Command group exists (`src/commands/duels/index.js`) but not registered (implementation missing)

---

### Texting Commands
- ❌ `/texting-practice` - File missing: `src/commands/texting/texting-practice.js`
- ❌ `/texting-send` - File missing: `src/commands/texting/texting-send.js`
- ❌ `/texting-finish` - File missing: `src/commands/texting/texting-finish.js`

**Status**: Command group exists (`src/commands/texting/index.js`) but not registered (implementations missing)

**To Enable**: Create missing command files, then add groups to `src/commands/index.js`

═══════════════════════════════════════════════════════════════════════════════

## Command Registration

**Registry**: `src/commands/commandRegistry.js`  
**Aggregator**: `src/commands/index.js`  
**Scope**: Guild-specific (instant registration)  
**API**: Discord REST API `Routes.applicationGuildCommands()`

**Registration Flow**:
1. ready.js calls `getCommands()`
2. `getCommands()` aggregates from 7 command groups
3. `registerCommands()` sends to Discord API
4. Commands appear instantly in Discord server

═══════════════════════════════════════════════════════════════════════════════

## Permission Levels

**From**: `src/middleware/PermissionGuard.js`

1. **USER** - All members (default)
2. **MODERATOR** - Requires MODERATOR role (TODO: verify role ID in config)
3. **ADMIN** - Requires ADMINISTRATOR permission
4. **OWNER** - Matches ADMIN_USER_ID environment variable

**Applied**: In `src/events/interactionCreate/commandHandler.js` (Phase 11 security)

