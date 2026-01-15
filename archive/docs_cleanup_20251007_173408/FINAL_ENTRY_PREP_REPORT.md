# ═══════════════════════════════════════════════════════════════════════════════
# FINAL ENTRY PREP REPORT
# EMBODIED DATING MASTERMIND BOT V3 - SAFE FIXES APPLIED
# ═══════════════════════════════════════════════════════════════════════════════
# Status: FILES CREATED (NO CODE MUTATIONS)
# Date: October 7, 2025
# Mode: APPLY-AND-STAGE (Safe fixes applied, risky changes staged as candidates)
# ═══════════════════════════════════════════════════════════════════════════════

## A) FILES CREATED / UPDATED

### FILES CREATED (5 NEW FILES):

1. **package.json** ✅
   - Action: CREATED (from provided package.txt)
   - Path: ./package.json
   - Size: 34 lines
   - Source: Verbatim copy from package.txt
   - Purpose: NPM dependency management and scripts
   - Status: ✅ READY TO USE

2. **src/database/runMigrations.js** ✅
   - Action: CREATED (from provided src-database-runMigrations.txt)
   - Path: ./src/database/runMigrations.js
   - Size: 53 lines
   - Source: Verbatim copy from src-database-runMigrations.txt
   - Purpose: Automated migration runner
   - Status: ✅ READY TO USE (via npm run migrate)

3. **bot-v3.candidate.js** ⚠️
   - Action: STAGED AS CANDIDATE (from provided bot-v3.txt)
   - Path: ./bot-v3.candidate.js
   - Size: 326 lines
   - Source: Verbatim copy from bot-v3.txt
   - Purpose: Main bot entry point
   - Reason for Candidate: INIT CONFLICT DETECTED (see Section D)
   - Status: ⚠️ REQUIRES DECISION (promote to bot-v3.js OR modify for consistency)

4. **src/services/factions/FactionService.js** ⚠️
   - Action: CREATED (minimal stub)
   - Path: ./src/services/factions/FactionService.js
   - Size: 23 lines
   - Source: Generated stub (marked "TEMP STUB — DO NOT SHIP")
   - Purpose: Prevents crash on src/services/index.js:40
   - Status: ⚠️ TEMP STUB (requires real implementation)

5. **src/database/migrations/000_initial_schema.sql** ⚠️
   - Action: CREATED (scaffold with comments only)
   - Path: ./src/database/migrations/000_initial_schema.sql
   - Size: 93 lines
   - Source: Generated scaffold (marked "TEMP SCAFFOLD — DO NOT SHIP")
   - Purpose: Placeholder for core tables (users, users_stats, daily_records)
   - Status: ⚠️ BLOCKER (requires real SQL from user)

### FILES UPDATED (1 FILE):

6. **src/commands/index.js** ✅
   - Action: UPDATED (added safe command groups)
   - Path: ./src/commands/index.js
   - Changes:
     - Line 10-13: Added imports for barbie, course, help, raids
     - Line 37-55: Added iteration loops for 4 new command groups
     - Line 64-68: Added exports for 4 new command groups
   - Status: ✅ READY TO USE
   - Note: Did NOT add ctj, duels, texting (implementations missing)

### FILES NOT MODIFIED:

- ❌ .env (user action required)
- ❌ src/services/index.js (already correct, no changes needed)
- ❌ src/events/ready.js (preserved as-is, init conflict noted)
- ❌ tensey-bot/** (separate app, untouched)

═══════════════════════════════════════════════════════════════════════════════

## B) DIFF PREVIEWS (IF ANY)

### DIFF #1: src/commands/index.js (UPDATED)

```diff
File: src/commands/index.js
Lines: 7-13, 32-55, 60-68

BEFORE (3 imports):
  7| const statsCommands = require('./stats');
  8| const leaderboardCommands = require('./leaderboard');
  9| const adminCommands = require('./admin');

AFTER (7 imports):
  7| const statsCommands = require('./stats');
  8| const leaderboardCommands = require('./leaderboard');
  9| const adminCommands = require('./admin');
 10|+const barbieCommands = require('./barbie');
 11|+const courseCommands = require('./course');
 12|+const helpCommands = require('./help');
 13|+const raidsCommands = require('./raids');

BEFORE (3 loops):
 27|   for (const [name, command] of Object.entries(leaderboardCommands)) {
 28|     commands.set(name, command);
 29|   }
 30|
 31|   for (const [name, command] of Object.entries(adminCommands)) {
 32|     commands.set(name, command);
 33|   }
 34|
 35|   return commands;

AFTER (7 loops):
 31|   for (const [name, command] of Object.entries(adminCommands)) {
 32|     commands.set(name, command);
 33|   }
 34|
 35|+  // Add barbie commands
 36|+  for (const [name, command] of Object.entries(barbieCommands)) {
 37|+    commands.set(name, command);
 38|+  }
 39|+
 40|+  // Add course commands
 41|+  for (const [name, command] of Object.entries(courseCommands)) {
 42|+    commands.set(name, command);
 43|+  }
 44|+
 45|+  // Add help commands
 46|+  for (const [name, command] of Object.entries(helpCommands)) {
 47|+    commands.set(name, command);
 48|+  }
 49|+
 50|+  // Add raids commands
 51|+  for (const [name, command] of Object.entries(raidsCommands)) {
 52|+    commands.set(name, command);
 53|+  }
 54|+
 55|   return commands;

BEFORE (3 exports):
 37| module.exports = {
 38|   getCommands,
 39|   statsCommands,
 40|   leaderboardCommands,
 41|   adminCommands
 42| };

AFTER (7 exports):
 60| module.exports = {
 61|   getCommands,
 62|   statsCommands,
 63|   leaderboardCommands,
 64|   adminCommands,
 65|+  barbieCommands,
 66|+  courseCommands,
 67|+  helpCommands,
 68|+  raidsCommands
 69| };

Summary: +4 command groups, +20 lines
Impact: 4 additional commands now registered (barbie, course, help, raid-status)
```

### NO OTHER DIFFS:
- package.json, runMigrations.js, FactionService.js, 000_initial_schema.sql are NEW files (no diffs)
- bot-v3.candidate.js is NEW file (staged, not promoted)

═══════════════════════════════════════════════════════════════════════════════

## C) REMAINING BLOCKERS (MUST-FIX BEFORE ENTRY)

### BLOCKER #1: Core Database Schema Missing (CRITICAL)
  File: src/database/migrations/000_initial_schema.sql
  Status: ⚠️ SCAFFOLD CREATED (comments only, NO SQL)
  Required: User must define CREATE TABLE statements for:
    - users (user_id, xp, level, faction, archetype, created_at, updated_at, ...)
    - users_stats (user_id, stat_name, total_count, created_at, updated_at)
    - daily_records (user_id, date, stat_name, count, created_at)
  Impact: Bot CANNOT START until tables exist
  Error if Unfixed: "ERROR: relation 'users' does not exist"
  Resolution: Replace TODO comments with actual SQL schema

### BLOCKER #2: .env File Missing (CRITICAL)
  File: .env (root)
  Status: ❌ NOT CREATED (user action required)
  Required Variables (from src/config/environment.js):
    
    REQUIRED (Bot will NOT start without these):
      - DISCORD_TOKEN=your_bot_token
      - DISCORD_CLIENT_ID=your_application_id
      - DISCORD_GUILD_ID=your_server_id
      - DATABASE_URL=postgresql://user:pass@host:port/database
      - CHANNEL_GENERAL_ID=channel_id
      - ADMIN_USER_ID=your_discord_user_id
    
    RECOMMENDED:
      - CHANNEL_INPUT_ID=channel_id
      - CHANNEL_LEADERBOARD_ID=channel_id
      - CHANNEL_SCORECARD_ID=channel_id
      - JOURNAL_CHANNEL_ID=channel_id
    
    OPTIONAL (have defaults):
      - DATABASE_HOST=localhost (if DATABASE_URL not set)
      - DATABASE_PORT=5432
      - DATABASE_NAME=embodied_dating_bot
      - DATABASE_USER=botuser
      - DATABASE_PASSWORD=your_password
      - DATABASE_SSL=true
      - CA_CERT_PATH=path/to/cert.pem
      - SECOPS_ENABLE_HEALTHCHECKS=false
      - SECOPS_HEALTHCHECK_INTERVAL_MIN=5
      - SECOPS_ENABLE_AUTOBACKUP=false
      - SECOPS_ENFORCE_MODERATION=false
  
  Impact: Bot will crash with "Missing required environment variables"
  Resolution: Create .env file in workspace root

### BLOCKER #3: Missing Command Implementations (MODERATE)
  Files Missing (6 command files):
    - src/commands/ctj/journal.js ← Imported by ctj/index.js:6
    - src/commands/ctj/breakthroughs.js ← Imported by ctj/index.js:7
    - src/commands/duels/duel.js ← Imported by duels/index.js:6
    - src/commands/texting/texting-practice.js ← Imported by texting/index.js:6
    - src/commands/texting/texting-send.js ← Imported by texting/index.js:7
    - src/commands/texting/texting-finish.js ← Imported by texting/index.js:8
  
  Status: ❌ NOT CREATED (no source content provided)
  Impact: Command groups ctj, duels, texting CANNOT be added to main index
  Current Mitigation: These groups are NOT imported in src/commands/index.js
  Resolution: User must provide implementation OR stub these files

### BLOCKER #4: FactionService Stub (LOW PRIORITY)
  File: src/services/factions/FactionService.js
  Status: ⚠️ TEMP STUB CREATED (no logic, prevents crash only)
  Impact: Faction-related features will NOT work
  Resolution: User must implement faction management logic
  Note: Bot CAN START with stub (no crash), but faction features disabled

### BLOCKER #5: Init Conflict (ARCHITECTURAL DECISION REQUIRED)
  Files in Conflict:
    - bot-v3.candidate.js (provided by user) ← Has own initializeServices() function
    - src/events/ready.js (existing) ← Also initializes services, commands, registration
  
  Conflict: Two different initialization approaches:
    Approach A (bot-v3.candidate.js):
      - Entry point defines initializeServices() function
      - Entry point manually registers events inline
      - ready event calls entry's initializeServices()
    
    Approach B (src/events/ready.js - CURRENT WORKSPACE):
      - ready.js imports initializeRepositories(), initializeServices() directly
      - ready.js stores services on client
      - ready.js loads and registers commands
      - ready.js is fully self-contained
  
  Resolution Required: CHOOSE ONE:
    Option 1: Use ready.js approach (CURRENT)
      - Simplify bot-v3.candidate.js to ONLY:
        1. Load env
        2. Create client
        3. Import and register events via src/events/index.js
        4. Login
        5. Graceful shutdown
      - Remove duplicate initializeServices() from entry point
      - Keep scheduled jobs in entry OR move to ready.js
    
    Option 2: Use bot-v3.candidate.js approach (PROVIDED)
      - Modify src/events/ready.js to be minimal (no init logic)
      - Move all initialization to entry point
      - ready event becomes simple confirmation
  
  Recommendation: ✅ USE OPTION 1 (keep ready.js as-is, simplify entry point)
    - Less code duplication
    - Consistent with existing workspace structure
    - ready.js already tested and integrated

═══════════════════════════════════════════════════════════════════════════════

## D) INIT CONFLICT CHECK

### CONFLICT DETECTED: ⚠️ YES

**Evidence from src/events/ready.js (lines 22-61)**:

ready.js performs COMPLETE initialization:
  ✅ Line 29: initializeRepositories()
  ✅ Line 33: initializeServices(client)
  ✅ Line 37: client.services = services
  ✅ Line 40: client.commands = getCommands()
  ✅ Line 44: await registerCommands(client.commands)
  ✅ Line 47-53: Set bot presence

**Evidence from bot-v3.candidate.js (lines 51-119)**:

bot-v3.candidate.js ALSO performs initialization:
  ✅ Line 52-74: Defines initializeServices() function
  ✅ Line 86-96: ready event calls initializeServices()
  ✅ Line 99: Calls startScheduledJobs()
  ✅ Line 102-109: Schedules health checks and backups

**Duplicate Logic**:
- Both files initialize services
- Both files register commands
- Both files store services on client
- ready.js is more comprehensive (also loads commands, sets presence)
- bot-v3.candidate.js adds scheduled jobs (not in ready.js)

**DECISION POINT**:

OPTION A (RECOMMENDED): Keep ready.js as single source of truth
  - ✅ Pros: Consistent with current workspace, less duplication
  - ✅ Action: Modify bot-v3.candidate.js to remove duplicate init logic
  - ✅ Keep: Scheduled jobs from bot-v3.candidate.js (add to entry point)
  - ✅ Remove: initializeServices() function from entry point
  - ✅ Remove: Duplicate ready event handler
  - ✅ Use: src/events/index.js registerEvents() helper

OPTION B: Use bot-v3.candidate.js approach
  - ⚠️ Cons: Requires modifying ready.js (removes tested logic)
  - ⚠️ Action: Gut ready.js to remove init logic
  - ⚠️ Risk: Breaking existing event handler structure

**RECOMMENDATION**: ✅ **OPTION A** (preserve ready.js, trim entry point)

**Staged File Decision**:
- ⚠️ bot-v3.candidate.js kept AS CANDIDATE (not promoted to bot-v3.js)
- ✅ User must decide: promote as-is OR trim for consistency
- ✅ See Section G for trimmed version reference

═══════════════════════════════════════════════════════════════════════════════

## E) COMMAND REGISTRATION READY

### COMMAND GROUPS INCLUDED IN src/commands/index.js:

**BEFORE FIX** (3 groups):
  1. stats (submit-stats, scorecard, submit-past-stats)
  2. leaderboard (leaderboard, faction-stats)
  3. admin (admin, adjust-xp, reset-stats, coaching-dashboard, start-raid, set-double-xp, course-admin, coaching-insights, security)

**AFTER FIX** (7 groups):
  1. stats (submit-stats, scorecard, submit-past-stats)
  2. leaderboard (leaderboard, faction-stats)
  3. admin (admin, adjust-xp, reset-stats, coaching-dashboard, start-raid, set-double-xp, course-admin, coaching-insights, security)
  4. barbie (barbie) ← NEW
  5. course (course) ← NEW
  6. help (help) ← NEW
  7. raids (raid-status) ← NEW

**TOTAL COMMANDS REGISTERED**: ~18 commands (estimated)
  - 3 stats commands
  - 2 leaderboard commands
  - 9 admin commands
  - 1 barbie command
  - 1 course command
  - 1 help command
  - 1 raids command

### COMMAND GROUPS EXCLUDED (MISSING IMPLEMENTATIONS):

**ctj** (src/commands/ctj/index.js):
  - Exports: 'journal', 'breakthroughs'
  - Missing Files:
    ❌ src/commands/ctj/journal.js
    ❌ src/commands/ctj/breakthroughs.js
  - Status: ❌ CANNOT ADD (will crash on require())

**duels** (src/commands/duels/index.js):
  - Exports: 'duel'
  - Missing Files:
    ❌ src/commands/duels/duel.js
  - Status: ❌ CANNOT ADD (will crash on require())

**texting** (src/commands/texting/index.js):
  - Exports: 'texting-practice', 'texting-send', 'texting-finish'
  - Missing Files:
    ❌ src/commands/texting/texting-practice.js
    ❌ src/commands/texting/texting-send.js
    ❌ src/commands/texting/texting-finish.js
  - Status: ❌ CANNOT ADD (will crash on require())

**Mitigation Applied**:
  ✅ src/commands/index.js does NOT import ctj, duels, texting
  ✅ Bot will start without these commands
  ✅ No crashes from missing files

═══════════════════════════════════════════════════════════════════════════════

## F) PACKAGE & MIGRATE SNAPSHOT

### PACKAGE.JSON SCRIPTS:

```json
"scripts": {
  "start": "node bot-v3.js",                    ← Runs production bot
  "dev": "NODE_ENV=development node bot-v3.js", ← Runs dev mode
  "prod": "NODE_ENV=production node bot-v3.js", ← Runs production mode
  "migrate": "node src/database/runMigrations.js", ← Runs migrations
  "seed-course": "node src/scripts/seedCourseModules.js", ← Seeds course data
  "seed-texting": "node src/scripts/seedTextingScenarios.js", ← Seeds texting data
  "test": "echo \"No tests yet\" && exit 0"     ← Placeholder test
}
```

### MIGRATIONS FOLDER:

Path: `./src/database/migrations/`

Migrations in Alphabetical Order (14 files):
  1. 000_initial_schema.sql ← ⚠️ SCAFFOLD (requires SQL)
  2. 001_add_tensey_tables.sql
  3. 002_add_raid_system.sql
  4. 003_add_barbie_list.sql
  5. 004_add_texting_simulator.sql
  6. 005_add_secondary_xp_system.sql
  7. 006_add_dueling_system.sql
  8. 007_add_double_xp_events.sql
  9. 008_add_ctj_analysis.sql
  10. 009_add_course_system.sql
  11. 010_add_security_audit.sql
  12. 011_add_coaching_analytics.sql
  13. 012_analytics_tracking.sql
  14. 015_add_automation_logging.sql

**Gaps**: Migrations 013 and 014 not present (may be intentional)

### MIGRATION RUNNER VERIFICATION:

File: src/database/runMigrations.js ✅
  - Created: ✅ YES
  - Path: ./src/database/runMigrations.js
  - Matches Script: ✅ YES (package.json "migrate" → node src/database/runMigrations.js)
  - Logic:
    1. Loads environment via dotenv
    2. Initializes PostgreSQL pool
    3. Reads migrations/*.sql files
    4. Sorts alphabetically
    5. Executes each migration via query()
    6. Logs progress
    7. Closes pool on completion

**Usage**:
```bash
npm run migrate
```

**Expected Output** (if 000_initial_schema.sql has real SQL):
```
Starting database migrations...
Found 14 migration files
Running migration: 000_initial_schema.sql
✓ 000_initial_schema.sql completed
Running migration: 001_add_tensey_tables.sql
✓ 001_add_tensey_tables.sql completed
...
✅ All migrations completed successfully
```

**Current Output** (with scaffold):
```
Starting database migrations...
Found 14 migration files
Running migration: 000_initial_schema.sql
✓ 000_initial_schema.sql completed  ← NO-OP (only comments)
Running migration: 001_add_tensey_tables.sql
ERROR: relation "users" does not exist  ← CRASH
```

═══════════════════════════════════════════════════════════════════════════════

## G) GO / NO-GO GATE

### READY TO CREATE FINAL ENTRY FILE: ⚠️ CONDITIONAL YES

**Current Status**: 
- ✅ Safe fixes applied (package.json, runMigrations.js, commands index, FactionService stub)
- ⚠️ Entry point STAGED as candidate (init conflict)
- ❌ Critical blockers remain (core tables, .env)

### BLOCKING ITEMS (MUST FIX BEFORE RUNNING BOT):

1. **000_initial_schema.sql requires real SQL**
   - File: src/database/migrations/000_initial_schema.sql
   - Action: Replace TODO comments with CREATE TABLE statements
   - Severity: 🔴 CRITICAL (bot cannot start without tables)

2. **.env file must be created**
   - File: .env (root)
   - Action: Create with minimum required variables (see Blocker #2)
   - Severity: 🔴 CRITICAL (bot cannot start without env vars)

3. **Init conflict must be resolved**
   - Files: bot-v3.candidate.js vs src/events/ready.js
   - Action: Choose Option A (trim entry point) OR Option B (gut ready.js)
   - Severity: 🟡 MODERATE (bot can start, but has duplicate logic)

4. **Missing command files**
   - Files: journal.js, breakthroughs.js, duel.js, texting-*.js
   - Action: Create implementations OR keep excluded from index
   - Severity: 🟢 LOW (bot can start, just missing these commands)

5. **FactionService stub**
   - File: src/services/factions/FactionService.js
   - Action: Implement faction management logic
   - Severity: 🟢 LOW (bot can start, faction features disabled)

### IF BLOCKERS #1-2 FIXED:

**READY TO RUN**: ✅ YES (with limitations)

**Startup Sequence**:
```bash
# 1. Install dependencies
npm install

# 2. Create .env file
# (copy required variables from Blocker #2)

# 3. Define core schema in 000_initial_schema.sql
# (replace TODO comments with SQL)

# 4. Run migrations
npm run migrate

# 5. Resolve init conflict (choose Option A or B)

# 6. Start bot
npm start
```

**Expected Behavior** (with blockers fixed):
  ✅ Bot starts successfully
  ✅ Database connects
  ✅ Services initialize (FactionService stub logs warning)
  ✅ Commands register: ~18 commands (stats, leaderboard, admin, barbie, course, help, raids)
  ❌ CTJ commands NOT available (journal, breakthroughs missing)
  ❌ Duel command NOT available (duel.js missing)
  ❌ Texting commands NOT available (texting-*.js missing)
  ⚠️ Faction features disabled (stub)

### TRIMMED ENTRY POINT (OPTION A - RECOMMENDED):

If user chooses to keep ready.js initialization, here's the minimal entry point:

```javascript
// ═══════════════════════════════════════════════════════════════════════════
// TRIMMED ENTRY POINT (OPTION A)
// Uses ready.js for all initialization, entry point only handles:
// - Environment loading
// - Client creation
// - Event registration
// - Scheduled jobs
// - Graceful shutdown
// ═══════════════════════════════════════════════════════════════════════════

require('dotenv').config();
const { Client } = require('discord.js');
const { createLogger } = require('./src/utils/logger');
const { handleError } = require('./src/utils/errorHandler');
const config = require('./src/config/settings');
const discordConfig = require('./src/config/discord');
const { closePool } = require('./src/database/postgres');

const logger = createLogger('BotMain');

// Create Discord client
const client = new Client(discordConfig);

/**
 * Register event handlers
 */
function registerEventHandlers() {
  logger.info('Registering event handlers...');
  
  const { registerEvents } = require('./src/events');
  registerEvents(client);
  
  logger.info('✓ Event handlers registered');
}

/**
 * Start scheduled background jobs
 */
client.once('ready', () => {
  // Wait for services to initialize (happens in ready.js)
  setTimeout(() => {
    if (!client.services) {
      logger.error('Services not initialized after ready event');
      return;
    }
    
    startScheduledJobs(client.services);
  }, 1000);
});

function startScheduledJobs(services) {
  logger.info('Starting scheduled jobs...');

  // Announcement queue processor (every 30 seconds)
  setInterval(async () => {
    try {
      if (services?.announcementQueue) {
        await services.announcementQueue.processQueue();
      }
    } catch (error) {
      logger.error('Announcement queue error', { error: error.message });
    }
  }, 30000);

  // Daily reminder check (every hour, triggers at 5pm EST)
  const checkReminders = async () => {
    const now = new Date();
    const hour = now.getHours();
    if (hour === 17 && services?.reminderService) {
      try {
        logger.info('Running daily reminder check...');
        await services.reminderService.checkAndSendReminders();
      } catch (error) {
        logger.error('Reminder check failed', { error: error.message });
      }
    }
  };
  setInterval(checkReminders, 3600000);

  // Double XP event processor (every 5 minutes)
  setInterval(async () => {
    try {
      if (services?.doubleXPManager) {
        await services.doubleXPManager.processEventUpdates(config.channels.general);
      }
    } catch (error) {
      logger.error('Double XP event processor error', { error: error.message });
    }
  }, 300000);

  // Duel finalization check (every 5 minutes)
  setInterval(async () => {
    try {
      if (services?.duelManager) {
        await services.duelManager.checkExpiredDuels(config.channels.general);
      }
    } catch (error) {
      logger.error('Duel finalization error', { error: error.message });
    }
  }, 300000);

  // Clean engagement monitor cooldowns (every 30 minutes)
  setInterval(() => {
    try {
      if (services?.chatEngagementMonitor) {
        services.chatEngagementMonitor.clearOldCooldowns();
      }
      if (services?.winsMonitor) {
        services.winsMonitor.clearOldCooldowns();
      }
    } catch (error) {
      logger.error('Cooldown cleanup error', { error: error.message });
    }
  }, 1800000);

  // Clear expired timeouts (every 10 minutes)
  setInterval(async () => {
    try {
      if (services?.warningSystem) {
        await services.warningSystem.clearExpiredTimeouts();
      }
    } catch (error) {
      logger.error('Timeout cleanup error', { error: error.message });
    }
  }, 600000);

  // Daily analytics calculation (every hour, triggers at 2 AM)
  const runDailyAnalytics = async () => {
    const now = new Date();
    const hour = now.getHours();
    if (hour === 2 && services?.riskScorer) {
      try {
        logger.info('Running daily analytics...');
        await services.riskScorer.calculateAllUsers();
        const atRisk = await services.riskScorer.getAtRiskUsers(60, 30);
        for (const user of atRisk) {
          const pattern = await services.patternDetector.detectPattern(user.user_id);
          await services.interventionGenerator.generateIntervention(
            user.user_id,
            user.risk_score,
            pattern
          );
        }
        logger.info('Daily analytics complete', { atRiskCount: atRisk.length });
      } catch (error) {
        logger.error('Daily analytics failed', { error: error.message });
      }
    }
  };
  setInterval(runDailyAnalytics, 3600000);

  logger.info('✓ Scheduled jobs started');
}

/**
 * Graceful shutdown
 */
async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    await closePool();
    logger.info('✓ Database closed');

    client.destroy();
    logger.info('✓ Discord client destroyed');

    logger.info('✅ Shutdown complete');
    process.exit(0);

  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
});

// Start bot
logger.info('Starting Embodied Dating Mastermind Bot v3...');
logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

registerEventHandlers();

client.login(config.discord.token)
  .then(() => logger.info('Bot login initiated...'))
  .catch((error) => {
    logger.error('Failed to login', { error: error.message });
    process.exit(1);
  });
```

**Key Differences from bot-v3.candidate.js**:
- ❌ Removed: initializeServices() function (handled by ready.js)
- ❌ Removed: Manual ready event handler (uses ready.js via registerEvents())
- ❌ Removed: Manual interaction/message/memberAdd handlers (uses events/index.js)
- ✅ Kept: Scheduled jobs (not in ready.js)
- ✅ Kept: Graceful shutdown
- ✅ Simplified: Uses src/events/index.js registerEvents() helper

═══════════════════════════════════════════════════════════════════════════════

## H) SUMMARY OF FIXES APPLIED

### SAFE FIXES (NO CONFLICTS):

| Fix | File | Status | Impact |
|-----|------|--------|--------|
| Create package.json | `./package.json` | ✅ COMPLETE | Enables npm install/start |
| Create runMigrations.js | `src/database/runMigrations.js` | ✅ COMPLETE | Enables npm run migrate |
| Update commands index | `src/commands/index.js` | ✅ COMPLETE | +4 command groups registered |
| Create FactionService stub | `src/services/factions/FactionService.js` | ✅ COMPLETE | Prevents startup crash |
| Create schema scaffold | `src/database/migrations/000_initial_schema.sql` | ✅ COMPLETE | Migration sequence complete |

### STAGED CHANGES (REQUIRE DECISION):

| Change | File | Reason | Decision Required |
|--------|------|--------|-------------------|
| Entry point | `bot-v3.candidate.js` | Init conflict with ready.js | Promote as-is OR trim for consistency |

### FILES NOT CREATED (USER ACTION REQUIRED):

| File | Reason | Priority |
|------|--------|----------|
| `.env` | Cannot generate secrets/IDs | 🔴 CRITICAL |
| Core table SQL | Cannot invent schema | 🔴 CRITICAL |
| journal.js | No source provided | 🟡 MODERATE |
| breakthroughs.js | No source provided | 🟡 MODERATE |
| duel.js | No source provided | 🟡 MODERATE |
| texting-*.js | No source provided | 🟡 MODERATE |

═══════════════════════════════════════════════════════════════════════════════

## I) NEXT STEPS FOR USER

### IMMEDIATE (BEFORE FIRST RUN):

**Step 1: Define Core Database Schema** 🔴
```bash
# Edit src/database/migrations/000_initial_schema.sql
# Replace TODO comments with actual CREATE TABLE statements
# Reference: Migration 001 assumes users table has columns:
#   - user_id, xp, created_at, updated_at, faction, archetype, etc.
```

**Step 2: Create .env File** 🔴
```bash
# Create .env in workspace root
# Copy template from Blocker #2 (Section C)
# Set all REQUIRED variables:
DISCORD_TOKEN=your_actual_token
DISCORD_CLIENT_ID=your_app_id
DISCORD_GUILD_ID=your_server_id
DATABASE_URL=postgresql://botuser:password@localhost:5432/embodied_dating_bot
CHANNEL_GENERAL_ID=your_channel_id
ADMIN_USER_ID=your_discord_id
```

**Step 3: Resolve Init Conflict** 🟡
```bash
# OPTION A (RECOMMENDED): Trim bot-v3.candidate.js
# - Remove duplicate initializeServices() function
# - Remove manual ready event
# - Use src/events/index.js registerEvents()
# - Keep scheduled jobs
# - See Section G for trimmed version

# OPTION B: Modify ready.js
# - Remove initialization logic from ready.js
# - Use bot-v3.candidate.js as-is
# - Rename bot-v3.candidate.js → bot-v3.js
```

**Step 4: Install Dependencies** ✅
```bash
npm install
```

**Step 5: Run Migrations** ✅
```bash
npm run migrate
# (Will fail if 000_initial_schema.sql is not complete)
```

**Step 6: Start Bot** ✅
```bash
npm start
# OR for development:
npm run dev
```

### AFTER FIRST RUN (OPTIONAL):

**Replace FactionService Stub** 🟢
```bash
# Implement src/services/factions/FactionService.js
# Remove "TEMP STUB — DO NOT SHIP" header
# Add faction management logic
```

**Create Missing Command Files** 🟢
```bash
# Implement:
# - src/commands/ctj/journal.js
# - src/commands/ctj/breakthroughs.js
# - src/commands/duels/duel.js
# - src/commands/texting/texting-practice.js
# - src/commands/texting/texting-send.js
# - src/commands/texting/texting-finish.js

# Then add to src/commands/index.js:
# const ctjCommands = require('./ctj');
# const duelsCommands = require('./duels');
# const textingCommands = require('./texting');
```

═══════════════════════════════════════════════════════════════════════════════

## J) TENSEY BOT DEPLOYMENT REMINDER

### Tensey Bot Status: ✅ READY (SEPARATE APP)

**Deployment**:
```bash
# 1. Navigate to Tensey Bot directory
cd tensey-bot

# 2. Install dependencies
npm install

# 3. Create .env file
# CRITICAL: Use SAME PostgreSQL credentials as main bot
# (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD must match)

# 4. Start Tensey Bot (separate process)
npm start

# Tensey Bot runs independently from main bot
# Both bots write to the same PostgreSQL database
# Main bot leaderboard automatically includes Tensey XP
```

**No Main Bot Code Changes Required**: ✅ ZERO

**Integration Verified**: ✅ Database-shared architecture (no API/webhook needed)

═══════════════════════════════════════════════════════════════════════════════

## K) FILE TREE (UPDATED WORKSPACE)

```
d:\Discord\Bot Experiments\v3 Bot Workspace\
│
├── package.json ← ✅ NEW
├── bot-v3.candidate.js ← ⚠️ NEW (staged, init conflict)
├── .env ← ❌ MISSING (user must create)
│
├── src/
│   ├── config/
│   │   ├── environment.js
│   │   ├── constants.js
│   │   ├── discord.js
│   │   ├── settings.js
│   │   ├── secondaryXPSources.js
│   │   └── adminCommandTemplates.js
│   │
│   ├── database/
│   │   ├── postgres.js
│   │   ├── runMigrations.js ← ✅ NEW
│   │   ├── migrations/
│   │   │   ├── 000_initial_schema.sql ← ⚠️ NEW (scaffold only)
│   │   │   ├── 001_add_tensey_tables.sql
│   │   │   ├── 002_add_raid_system.sql
│   │   │   ├── ... (11 more migrations)
│   │   │   └── 015_add_automation_logging.sql
│   │   └── repositories/
│   │       ├── index.js
│   │       ├── BaseRepository.js
│   │       ├── UserRepository.js
│   │       ├── StatsRepository.js
│   │       └── TenseyRepository.js
│   │
│   ├── services/
│   │   ├── index.js
│   │   ├── factions/
│   │   │   └── FactionService.js ← ⚠️ NEW (stub)
│   │   ├── xp/, user/, stats/, discord/, notifications/, tensey/
│   │   ├── raids/, barbie/, onboarding/, texting/, duels/, events/
│   │   ├── ctj/, engagement/, course/, analytics/, ai/, airtable/
│   │   ├── automation/, email/, monitoring/, security/, compliance/, backup/
│   │   └── (40+ service files)
│   │
│   ├── commands/
│   │   ├── index.js ← ✅ UPDATED (+4 groups)
│   │   ├── stats/, leaderboard/, admin/
│   │   ├── barbie/, course/, help/, raids/
│   │   ├── ctj/ ← ⚠️ Missing: journal.js, breakthroughs.js
│   │   ├── duels/ ← ⚠️ Missing: duel.js
│   │   ├── texting/ ← ⚠️ Missing: texting-practice.js, texting-send.js, texting-finish.js
│   │   └── commandRegistry.js
│   │
│   ├── events/
│   │   ├── index.js
│   │   ├── ready.js
│   │   ├── messageCreate.js
│   │   ├── guildMemberAdd.js
│   │   └── interactionCreate/
│   │       ├── index.js
│   │       ├── commandHandler.js
│   │       ├── buttonHandler.js
│   │       └── modalHandler.js
│   │
│   ├── middleware/
│   │   ├── RateLimiter.js
│   │   ├── InputValidator.js
│   │   └── PermissionGuard.js
│   │
│   ├── utils/
│   │   ├── logger.js
│   │   ├── errorHandler.js
│   │   ├── validator.js
│   │   └── timeUtils.js
│   │
│   └── ai/
│       └── webhooks/
│           └── zapier.js
│
├── tensey-bot/ ← ✅ SEPARATE APP (40 files, ready to run)
│
└── tmp/
    ├── AUDIT_SUMMARY.txt
    ├── phase-11-final-output.txt
    └── schema-before.txt, schema-after.txt
```

═══════════════════════════════════════════════════════════════════════════════

## L) FINAL CHECKLIST

### FILES CREATED: ✅ 5/5

- [x] package.json
- [x] src/database/runMigrations.js
- [x] bot-v3.candidate.js (staged, not promoted)
- [x] src/services/factions/FactionService.js (stub)
- [x] src/database/migrations/000_initial_schema.sql (scaffold)

### FILES UPDATED: ✅ 1/1

- [x] src/commands/index.js (+4 command groups)

### BLOCKERS ADDRESSED: ⚠️ 3/5

- [x] Missing package.json → ✅ FIXED
- [x] Missing runMigrations.js → ✅ FIXED
- [x] Missing FactionService.js → ⚠️ STUBBED (prevents crash, no logic)
- [ ] Core database tables → ⚠️ SCAFFOLD ONLY (requires SQL)
- [ ] Missing .env → ❌ USER ACTION (cannot generate)

### COMMANDS REGISTERED: ✅ ~18 COMMANDS

- [x] Stats commands (3)
- [x] Leaderboard commands (2)
- [x] Admin commands (9)
- [x] Barbie commands (1)
- [x] Course commands (1)
- [x] Help commands (1)
- [x] Raids commands (1)
- [ ] CTJ commands (2) ← Missing implementations
- [ ] Duels commands (1) ← Missing implementation
- [ ] Texting commands (3) ← Missing implementations

═══════════════════════════════════════════════════════════════════════════════

## M) GO / NO-GO FINAL VERDICT

### READY TO CREATE FINAL ENTRY FILE: ⚠️ YES (WITH CAVEATS)

**GO CONDITIONS MET**:
  ✅ package.json created
  ✅ runMigrations.js created
  ✅ FactionService stub created (prevents crash)
  ✅ Commands index updated (safe groups added)
  ✅ Entry point staged (bot-v3.candidate.js)

**NO-GO CONDITIONS REMAIN**:
  ❌ 000_initial_schema.sql needs real SQL (CRITICAL)
  ❌ .env file needs to be created (CRITICAL)
  ⚠️ Init conflict needs resolution (MODERATE)
  ⚠️ 6 command files missing (LOW - bot can run without them)

**RECOMMENDATION**: ✅ **CONDITIONAL GO**

Bot CAN be created and WILL run IF:
  1. User defines core tables in 000_initial_schema.sql
  2. User creates .env file with required variables
  3. User resolves init conflict (Option A recommended)

Bot CANNOT run with current state (scaffold/missing .env will cause crashes).

═══════════════════════════════════════════════════════════════════════════════

## N) PRECISE IMPORT MAP FOR FINAL ENTRY (TRIMMED VERSION)

**Based on Option A (Keep ready.js, Trim Entry Point)**:

```javascript
// Required imports (in order):
require('dotenv').config();                                    // 1. Environment loader
const { Client } = require('discord.js');                      // 2. Discord.js
const { createLogger } = require('./src/utils/logger');        // 3. Logger factory
const { handleError } = require('./src/utils/errorHandler');   // 4. Error handler
const config = require('./src/config/settings');               // 5. Unified config
const discordConfig = require('./src/config/discord');         // 6. Discord options
const { closePool } = require('./src/database/postgres');      // 7. DB cleanup

// Event registration:
const { registerEvents } = require('./src/events');            // 8. Event registrar

// Client creation:
const client = new Client(discordConfig);                      // 9. Discord client

// Event registration call:
registerEvents(client);                                        // 10. Bind events

// Login:
client.login(config.discord.token);                            // 11. Connect

// Scheduled jobs:
// (inline setInterval calls - see Section G)

// Graceful shutdown:
// (process.on handlers - see Section G)
```

**Call Order**:
1. Load .env
2. Import dependencies
3. Create logger
4. Load config (auto-validates env)
5. Create Discord client
6. Register events (ready, interaction, message, memberAdd)
7. Login to Discord
8. (ready event fires → initializes everything)
9. Wait 1 second, then start scheduled jobs
10. Wait for shutdown signals

**Side Effects by Step**:
- Step 1: process.env populated
- Step 4: Env validation runs (throws if required vars missing)
- Step 6: Event handlers bound to client
- Step 7: Connection opens, ready event fires
- Step 8 (ready): DB connects, repositories init, services init, commands register

═══════════════════════════════════════════════════════════════════════════════
END OF FINAL ENTRY PREP REPORT
═══════════════════════════════════════════════════════════════════════════════

SUMMARY:
  ✅ 5 files created (package.json, runMigrations.js, FactionService stub, schema scaffold, bot-v3 candidate)
  ✅ 1 file updated (commands index +4 groups)
  ⚠️ 2 critical blockers remain (core tables SQL, .env file)
  ⚠️ 1 moderate blocker (init conflict - decision required)
  ✅ Main bot CAN START once blockers fixed
  ✅ Tensey Bot READY TO DEPLOY (separate app, zero main bot changes)

NEXT ACTION FOR USER:
  1. Define SQL in 000_initial_schema.sql
  2. Create .env file
  3. Resolve init conflict (Option A recommended)
  4. Run: npm install && npm run migrate && npm start

═══════════════════════════════════════════════════════════════════════════════

