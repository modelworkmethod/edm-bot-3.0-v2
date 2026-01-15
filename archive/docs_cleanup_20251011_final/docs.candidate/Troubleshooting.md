# Troubleshooting

Common issues and solutions for Embodied Dating Mastermind Bot v3.

## Startup Failures

### "Missing required environment variables"

**Symptom**:
```
Missing required environment variables:
   - DISCORD_TOKEN
   - DATABASE_URL
Check your .env file and ensure all required variables are set.
```

**Cause**: `.env` file missing or incomplete

**Fix**:
1. Verify `.env` exists in workspace root
2. Check it contains all 6 required variables:
   - DISCORD_TOKEN
   - DISCORD_CLIENT_ID
   - DISCORD_GUILD_ID
   - DATABASE_URL
   - CHANNEL_GENERAL_ID
   - ADMIN_USER_ID
3. Copy template: `cp ENV_TEMPLATE.txt .env`

**File**: `src/config/environment.js:31-39`

---

### "Database connection failed"

**Symptom**:
```
Failed to initialize database pool
Error: connect ECONNREFUSED
```

**Cause**: PostgreSQL not running or incorrect DATABASE_URL

**Fix**:
1. Verify PostgreSQL is running:
   ```bash
   # Linux
   sudo systemctl status postgresql
   
   # macOS
   brew services list
   
   # Windows
   # Check Services app for PostgreSQL service
   ```

2. Test connection manually:
   ```bash
   psql -U botuser -d embodied_dating_bot -h localhost -p 5432
   ```

3. Verify DATABASE_URL format:
   ```env
   DATABASE_URL=postgresql://user:password@host:port/database
   ```

**File**: `src/database/postgres.js:21-76`

---

### "Relation 'users' does not exist"

**Symptom**:
```
Query failed
ERROR: relation "users" does not exist
```

**Cause**: Migrations not run or 000_initial_schema.sql incomplete

**Fix**:
1. Verify `src/database/migrations/000_initial_schema.sql` contains CREATE TABLE statements (not comments)
2. Run migrations:
   ```bash
   npm run migrate
   ```
3. Verify tables exist:
   ```bash
   psql -U botuser -d embodied_dating_bot -c "\dt"
   ```

**File**: `src/database/repositories/UserRepository.js:*`

---

### "Cannot find module './factions/FactionService'"

**Symptom**:
```
Error: Cannot find module './factions/FactionService'
    at Function.Module._resolveFilename
```

**Cause**: FactionService.js missing

**Fix**: File should exist at `src/services/factions/FactionService.js` (may be stub)

**File**: `src/services/index.js:40`

---

### "Cannot find module './journal'"

**Symptom**:
```
Error: Cannot find module './journal'
    at require (src/commands/ctj/index.js:6)
```

**Cause**: Command implementation missing

**Fix**: 
- CTJ, duels, texting command groups are NOT included in main command index
- This error should NOT occur unless you manually added these groups
- Verify `src/commands/index.js` does NOT import ctj, duels, or texting

**File**: `src/commands/ctj/index.js:6-7`

═══════════════════════════════════════════════════════════════════════════════

## Runtime Issues

### "Rate limited. Try again in X seconds"

**Symptom**: User sees ephemeral message when running command too frequently

**Cause**: Rate limiting active (Phase 11 security)

**Behavior**: Normal - prevents spam

**Rate Limits** (per user, per command):
- `/submit-stats`: 3 requests per hour
- `/duel`: 5 requests per hour
- Most commands: Reasonable limits

**Admin Override**:
```
/security reset-rate-limit <user>
```

**File**: `src/middleware/RateLimiter.js`

---

### "You do not have permission to use this command"

**Symptom**: User sees ephemeral denial message

**Cause**: User lacks required permission level

**Permission Levels**:
- USER - Default (all members)
- MODERATOR - Requires MODERATOR role
- ADMIN - Requires ADMINISTRATOR permission
- OWNER - Matches ADMIN_USER_ID in .env

**Fix**: Grant user appropriate role/permission in Discord

**File**: `src/middleware/PermissionGuard.js`

---

### Bot appears offline after startup

**Symptom**: Logs show "Bot is ready" but Discord shows offline

**Causes**:
1. Invalid bot token
2. Bot not invited to server
3. Intent/permission issues

**Fix**:
1. Verify DISCORD_TOKEN is correct
2. Re-invite bot with proper scopes: `bot` + `applications.commands`
3. Check required intents in `src/config/discord.js`

**File**: `src/config/discord.js`, `bot-v3.js:32-44`

---

### Commands not appearing in Discord

**Symptom**: Bot online but `/` shows no commands

**Causes**:
1. Commands not registered
2. Wrong guild ID
3. Registration failed

**Fix**:
1. Check logs for "Successfully registered X commands"
2. Verify DISCORD_GUILD_ID matches your server
3. Re-invite bot with `applications.commands` scope
4. Wait 1-2 minutes for Discord cache to update

**File**: `src/commands/commandRegistry.js:17-44`

═══════════════════════════════════════════════════════════════════════════════

## Database Issues

### "Too many clients"

**Symptom**:
```
Error: sorry, too many clients already
```

**Cause**: PostgreSQL max_connections exceeded

**Fix**:
1. Check active connections:
   ```sql
   SELECT count(*) FROM pg_stat_activity;
   ```
2. Increase PostgreSQL max_connections (postgresql.conf)
3. Reduce bot connection pool size (postgres.js:56, currently 20)

**File**: `src/database/postgres.js:48-59`

---

### Migrations fail midway

**Symptom**: Some migrations succeed, later ones fail

**Cause**: SQL error in migration file or missing dependency (table/column)

**Fix**:
1. Check migration runner logs for exact error
2. Verify migration order (should be alphabetical)
3. Fix SQL syntax error in failing migration
4. Re-run: `npm run migrate` (idempotent - uses IF NOT EXISTS)

**File**: `src/database/runMigrations.js`

═══════════════════════════════════════════════════════════════════════════════

## Tensey Bot Issues

### XP not syncing between bots

**Symptom**: User completes Tensey challenge, main bot leaderboard doesn't update

**Causes**:
1. Different database credentials
2. Tensey awards not yet processed (60s delay)
3. Pending awards processor not running

**Fix**:
1. Wait 60 seconds after challenge completion
2. Verify both bots use same DATABASE credentials:
   ```bash
   # Main bot .env
   cat .env | grep DATABASE_URL
   
   # Tensey bot .env
   cat tensey-bot/.env | grep DB_
   ```
3. Check Tensey Bot logs for "XP awarded successfully"
4. Query database directly:
   ```sql
   SELECT xp, social_freedom_exercises_tenseys 
   FROM users 
   WHERE user_id = 'YOUR_ID';
   ```

**Files**: `tensey-bot/src/jobs/pendingAwardsProcessor.js`, `tensey-bot/src/database/repositories/MainBotRepository.js`

---

### Tensey Bot not starting

**Symptom**: Tensey Bot crashes on startup

**Causes**:
1. Missing dependencies
2. Invalid .env
3. SQLite permission issues

**Fix**:
1. `cd tensey-bot && npm install`
2. Verify `.env` exists with all required variables
3. Check `tensey-bot/data/` directory is writable

**File**: `tensey-bot/bot.js`

═══════════════════════════════════════════════════════════════════════════════

## Performance Issues

### High CPU usage

**Symptom**: Bot uses excessive CPU

**Causes**:
1. Too many scheduled jobs
2. Health checks too frequent
3. Memory leak

**Fix**:
1. Disable health checks: `SECOPS_ENABLE_HEALTHCHECKS=false`
2. Reduce check interval: `SECOPS_HEALTHCHECK_INTERVAL_MIN=10`
3. Monitor scheduled job intervals in entry point

**Files**: Entry point (scheduled jobs), `src/services/monitoring/HealthCheck.js`

---

### High memory usage

**Symptom**: Bot memory grows over time

**Causes**:
1. Connection pool leaks
2. In-memory caches not cleared
3. Event listener leaks

**Fix**:
1. Monitor health check logs (memory stats)
2. Restart bot if memory exceeds threshold
3. Check for clearOldCooldowns() calls in engagement monitors

**Files**: `src/services/engagement/ChatEngagementMonitor.js`, `src/services/engagement/WinsMonitor.js`

═══════════════════════════════════════════════════════════════════════════════

## Debug Mode

### Enable Verbose Logging

**In .env**:
```env
LOG_LEVEL=debug
NODE_ENV=development
```

**Effect**: More detailed logs for all operations

### Query Logging

**In postgres.js**: Debug logs show:
```
[Database] Query executed { duration: '15ms', rows: 5 }
```

Enable with `LOG_LEVEL=debug`

═══════════════════════════════════════════════════════════════════════════════

## Getting Help

### Check Logs

```bash
# If using PM2:
pm2 logs embodied-dating-bot

# If running directly:
# Logs appear in console
```

### Check Database

```bash
# Connect to database
psql -U botuser -d embodied_dating_bot

# List tables
\dt

# Check user count
SELECT COUNT(*) FROM users;

# Check recent entries
SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10;
```

### Verify Bot Status

```bash
# If using PM2:
pm2 status

# Check process
ps aux | grep bot-v3
```

### Common Log Patterns

**Successful startup**:
- ✅ "Environment validation passed"
- ✅ "Bot logged in as"
- ✅ "Successfully registered X commands"
- ✅ "Bot is fully operational"

**Failure patterns**:
- ❌ "Missing required environment variables"
- ❌ "Database connection failed"
- ❌ "Cannot find module"
- ❌ "Failed to initialize services"

