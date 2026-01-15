# Tensey Bot Integration

How the separate Tensey Bot integrates with the main bot.

## Architecture: Separate Process with Shared Database

```
┌─────────────────────────────────────────────────────────────┐
│                      MAIN BOT                                │
│                    (bot-v3.js)                               │
│                                                              │
│  - User commands (/submit-stats, /leaderboard, etc.)        │
│  - Stats tracking                                            │
│  - XP calculation                                            │
│  - Leaderboard display                                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
         ┌───────────────────────────────────┐
         │     POSTGRESQL DATABASE            │
         │        (SHARED)                    │
         │                                    │
         │  Table: users                      │
         │  - user_id                         │
         │  - xp ← Both bots read/write       │
         │  - social_freedom_exercises_tenseys│
         │    ← Tensey Bot writes             │
         │    ← Main Bot reads                │
         └───────────────────────────────────┘
                         │
                         ↑
┌─────────────────────────────────────────────────────────────┐
│                    TENSEY BOT                                │
│                (tensey-bot/bot.js)                           │
│                                                              │
│  - Challenge checklist UI (/tenseylist)                     │
│  - Challenge completion tracking                            │
│  - XP award scheduler (60 second delay)                     │
│  - Leaderboard (/tenseyleaderboard)                         │
│                                                              │
│  SQLite (Local):                                             │
│  - user_progress (which challenges completed)               │
│  - pending_xp_awards (queued XP awards)                     │
└─────────────────────────────────────────────────────────────┘
```

## Integration Method: Direct Database Writes

**NO API/Webhook Required**

Both bots connect to the **SAME PostgreSQL database** using identical credentials.

### Main Bot Changes Required: ✅ ZERO

**Verified**: `src/commands/leaderboard/leaderboard.js`
- Queries: `SELECT user_id, xp FROM users ORDER BY xp DESC`
- Tensey XP is automatically included in `users.xp` column
- No code changes needed

## XP Flow (Tensey Challenge Completion)

```
1. User clicks challenge button (Tensey Bot)
   ↓
2. Tensey Bot saves to LOCAL SQLite:
   - user_progress table (for UI)
   - pending_xp_awards table (scheduled for NOW + 60 seconds)
   ↓
3. User sees challenge marked as completed (instant UI feedback)
   ↓
4. [60 SECONDS WAIT]
   ↓
5. Background job runs (every 10 seconds):
   - Checks pending_xp_awards table
   - Finds awards due for processing
   ↓
6. Tensey Bot writes to SHARED PostgreSQL:
   UPDATE users
   SET xp = xp + 100,
       social_freedom_exercises_tenseys = social_freedom_exercises_tenseys + 1,
       updated_at = NOW()
   WHERE user_id = $1
   ↓
7. Main Bot leaderboard automatically reflects change (no action needed)
```

**XP Per Challenge**: 100  
**Delay Before Award**: 60 seconds  
**Column Incremented**: `users.social_freedom_exercises_tenseys`

## Database Credentials (MUST MATCH)

**Main Bot** (`.env`):
```env
DATABASE_URL=postgresql://botuser:password@localhost:5432/embodied_dating_bot
```

**Tensey Bot** (`tensey-bot/.env`):
```env
DB_HOST=localhost                    # ← MUST MATCH
DB_PORT=5432                         # ← MUST MATCH
DB_NAME=embodied_dating_bot          # ← MUST MATCH
DB_USER=botuser                      # ← MUST MATCH
DB_PASSWORD=password                 # ← MUST MATCH
```

⚠️ **CRITICAL**: If credentials don't match, bots will use different databases and XP won't sync.

## Deployment

### Main Bot

```bash
# In workspace root:
npm install
npm run migrate
npm start
```

### Tensey Bot (Separate Process)

```bash
# In tensey-bot/ directory:
cd tensey-bot
npm install
npm start
```

**Run Both**: Start both processes separately (different terminals or process managers).

## Features

### Tensey Bot Commands

- `/tenseylist` - View personal challenge checklist
- `/tenseyleaderboard` - View Tensey challenge leaderboard

### Tensey Bot Background Jobs

- **Pending Awards Processor** - Every 10 seconds (awards XP after 60s delay)
- **Button Ensurer** - Every 4 hours (maintains UI buttons)
- **Leaderboard Refresh** - Every 5 minutes (updates leaderboard display)

### Main Bot Integration Points

**None Required** - Integration is automatic via shared database.

**Optional Enhancements** (Not Required):
1. Display `social_freedom_exercises_tenseys` count in `/scorecard`
2. Add Tensey completion count to `/leaderboard` embed
3. Announce Tensey milestones (10, 50, 100 completions)

## Troubleshooting

### "XP not syncing between bots"

**Cause**: Different database credentials

**Fix**: Verify Main Bot DATABASE_URL matches Tensey Bot DB_* credentials

---

### "Tensey Bot crashes on startup"

**Cause**: Missing dependencies or invalid credentials

**Fix**: 
1. `cd tensey-bot && npm install`
2. Verify `.env` exists with correct DB credentials
3. Check logs: Tensey Bot startup logs

---

### "Main bot doesn't show Tensey XP"

**Cause**: Bots using different databases OR Tensey awards haven't been processed

**Fix**:
1. Wait 60 seconds after challenge completion
2. Check PostgreSQL: `SELECT xp, social_freedom_exercises_tenseys FROM users WHERE user_id = 'YOUR_ID'`
3. Verify both bots connect to same database

## Documentation

**Tensey Bot Specific**:
- `tensey-bot/README.md` - Tensey Bot setup guide
- `tensey-bot/PRE_FINAL_ENTRY_REPORT.md` - Comprehensive technical reference

