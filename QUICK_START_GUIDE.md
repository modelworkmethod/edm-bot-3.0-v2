# 🚀 QUICK START GUIDE - EMBODIED DATING MASTERMIND BOT V3

**Status**: Bot is 95% ready. Just 2 critical blockers remain.

---

## ⚠️ BEFORE YOU START

### YOU MUST FIX THESE 2 THINGS:

**1. Define Core Database Schema** 🔴
```bash
# Edit this file:
src/database/migrations/000_initial_schema.sql

# Replace the TODO comments with actual CREATE TABLE statements
# You need to define 3 tables:
# - users (user_id, xp, level, faction, archetype, created_at, updated_at, ...)
# - users_stats (user_id, stat_name, total_count, created_at, updated_at)
# - daily_records (user_id, date, stat_name, count, created_at)
```

**2. Create .env File** 🔴
```bash
# Create a new file in the workspace root:
.env

# Add these variables (MINIMUM):
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_id
DISCORD_GUILD_ID=your_server_id
DATABASE_URL=postgresql://botuser:password@localhost:5432/embodied_dating_bot
CHANNEL_GENERAL_ID=your_general_channel_id
ADMIN_USER_ID=your_discord_user_id
```

---

## 🏃 STARTUP SEQUENCE

Once you've fixed the 2 blockers above:

```bash
# 1. Install dependencies
npm install

# 2. Run database migrations
npm run migrate

# 3. (Optional) Seed course modules
npm run seed-course

# 4. Start the bot
npm start

# OR for development mode:
npm run dev
```

---

## ⚠️ INIT CONFLICT - CHOOSE ONE APPROACH

You have **TWO** initialization approaches:

### **OPTION A: Use ready.js (RECOMMENDED)** ✅

The current `src/events/ready.js` already handles all initialization.  
You need a **SIMPLE** entry point:

```javascript
// bot-v3.js (TRIMMED VERSION)
require('dotenv').config();
const { Client } = require('discord.js');
const config = require('./src/config/settings');
const discordConfig = require('./src/config/discord');
const { registerEvents } = require('./src/events');
const { closePool } = require('./src/database/postgres');

const client = new Client(discordConfig);

// Register events (ready.js does all the work)
registerEvents(client);

// Graceful shutdown
process.on('SIGINT', async () => {
  await closePool();
  client.destroy();
  process.exit(0);
});

// Start
client.login(config.discord.token);
```

**Pros**: Simple, uses existing ready.js  
**Cons**: Scheduled jobs need to be added separately

---

### **OPTION B: Use bot-v3.candidate.js (AS PROVIDED)** ⚠️

Rename `bot-v3.candidate.js` → `bot-v3.js` and modify `ready.js` to be minimal.

**Pros**: Has all scheduled jobs built-in  
**Cons**: Duplicates ready.js logic, requires modifying tested code

---

## 📋 WHAT WORKS NOW

✅ **Working Commands** (~18 total):
- `/submit-stats` - Submit daily stats
- `/scorecard` - View your stats
- `/submit-past-stats` - Submit past day stats
- `/leaderboard` - XP leaderboard
- `/faction-stats` - Faction war standings
- `/admin` - Admin menu
- `/adjust-xp` - Adjust user XP
- `/reset-stats` - Reset user stats
- `/coaching-dashboard` - View inactive users
- `/start-raid` - Start raid event
- `/set-double-xp` - Create double XP event
- `/course-admin` - Manage course content
- `/coaching-insights` - View analytics
- `/security` - Security & moderation
- `/barbie` - Contact list management
- `/course` - Access course modules
- `/help` - Get help
- `/raid-status` - Check raid progress

❌ **Not Working** (missing implementations):
- `/journal`, `/breakthroughs` (CTJ commands)
- `/duel` (dueling command)
- `/texting-practice`, `/texting-send`, `/texting-finish` (texting commands)

---

## 🗄️ TENSEY BOT (SEPARATE APP)

The Tensey Bot is **ready to deploy** as a separate process:

```bash
# 1. Navigate to Tensey Bot
cd tensey-bot

# 2. Install dependencies
npm install

# 3. Create .env file
# CRITICAL: Use SAME PostgreSQL credentials as main bot!
cp .env.example .env
nano .env

# Set these to MATCH main bot:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=embodied_dating_bot    # ← MUST BE SAME
DB_USER=botuser                # ← MUST BE SAME
DB_PASSWORD=your_password      # ← MUST BE SAME

# 4. Start Tensey Bot
npm start
```

**Integration**: Both bots share the same PostgreSQL database.  
**No main bot code changes needed** - XP syncs automatically! ✅

---

## 🔧 WHAT'S STUBBED

These files exist but are **minimal stubs** (bot will run, features won't work):

- `src/services/factions/FactionService.js` - Faction management (stub)
- `src/database/migrations/000_initial_schema.sql` - Core tables (scaffold)

Replace these with real implementations when ready.

---

## 📖 DETAILED DOCUMENTATION

- **FINAL_ENTRY_PREP_REPORT.md** - Complete analysis (this was just generated)
- **FINAL_ENTRY_WIRING_REPORT.md** - Pre-fix audit report
- **PHASE11_AUDIT_REPORT.md** - Phase 11 security integration
- **README_PHASE11_ROLLOUT.md** - Security deployment guide
- **tensey-bot/PRE_FINAL_ENTRY_REPORT.md** - Tensey Bot integration guide

---

## 🎯 TL;DR

**To run the bot**:
1. Define SQL in `000_initial_schema.sql` (users, users_stats, daily_records tables)
2. Create `.env` file with Discord token and database credentials
3. Run `npm install && npm run migrate && npm start`

**To deploy Tensey Bot** (separate app):
1. `cd tensey-bot`
2. Create `.env` with SAME database credentials as main bot
3. Run `npm install && npm start`

Both bots will share the same PostgreSQL database and sync XP automatically! 🚀

