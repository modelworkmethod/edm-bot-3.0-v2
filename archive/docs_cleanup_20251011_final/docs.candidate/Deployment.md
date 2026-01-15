# Deployment

Production deployment guide for Embodied Dating Mastermind Bot v3.

## Pre-Deployment Checklist

- [ ] Node.js >= 18.0.0 installed
- [ ] PostgreSQL database created
- [ ] Discord bot created (Discord Developer Portal)
- [ ] Bot token obtained
- [ ] Bot invited to server with proper permissions
- [ ] Server IDs and channel IDs collected

═══════════════════════════════════════════════════════════════════════════════

## Deployment Sequence

### 1. Install Dependencies

```bash
npm install
```

**Verifies**:
- package.json exists
- All dependencies install successfully

---

### 2. Configure Environment

Create `.env` file:

```bash
cp ENV_TEMPLATE.txt .env
```

Edit `.env` with production values:

```env
DISCORD_TOKEN=your_production_bot_token
DISCORD_CLIENT_ID=your_application_id
DISCORD_GUILD_ID=your_server_id
DATABASE_URL=postgresql://botuser:secure_password@db_host:5432/embodied_dating_bot
CHANNEL_GENERAL_ID=general_channel_id
ADMIN_USER_ID=your_discord_user_id

# Security & Operations (Production)
SECOPS_ENABLE_HEALTHCHECKS=true
SECOPS_HEALTHCHECK_INTERVAL_MIN=5
SECOPS_ENABLE_AUTOBACKUP=true
SECOPS_ENFORCE_MODERATION=true

NODE_ENV=production
LOG_LEVEL=info
```

**⚠️ CRITICAL**: Keep `.env` secure, never commit to version control.

See [Environment.md](./Environment.md) for complete variable reference.

---

### 3. Run Database Migrations

```bash
npm run migrate
```

**Expected output**:
```
Starting database migrations...
Found 14 migration files
Running migration: 000_initial_schema.sql
✓ 000_initial_schema.sql completed
...
✅ All migrations completed successfully
```

**Verification**:
```bash
# Check tables exist:
psql -U botuser -d embodied_dating_bot -c "\dt"

# Should show 30+ tables including:
# - users
# - users_stats
# - daily_records
# - tensey_completions
# - raid_events
# - barbie_list
# - ctj_entries
# - audit_log
# - etc.
```

---

### 4. (Optional) Seed Data

**Course modules**:
```bash
npm run seed-course
```

**Texting scenarios**:
```bash
npm run seed-texting
```

---

### 5. Start Bot

**Production**:
```bash
npm run prod
```

**OR with process manager** (recommended):
```bash
# Install PM2
npm install -g pm2

# Start bot
pm2 start bot-v3.js --name "embodied-dating-bot"

# Monitor
pm2 logs embodied-dating-bot

# Auto-restart on system reboot
pm2 startup
pm2 save
```

---

### 6. Verify Deployment

**Expected startup logs** (first 30 seconds):
```
Environment validation passed
Starting Embodied Dating Mastermind Bot v3...
Environment: production
Registering event handlers...
✓ Event handlers registered
Bot login initiated...
Bot logged in as BotName#1234
Serving 1 guild(s)
Watching 150 users
Repositories initialized
Initializing all services...
✓ All services initialized
✓ Health checks scheduled (every 5 minutes)
✓ Auto-backup scheduled (daily at 3 AM)
Services initialized
18 commands loaded
Registering 18 commands
Successfully registered 18 commands
Bot is ready and operational
✅ Bot is fully operational
Starting scheduled jobs...
✓ Scheduled jobs started
```

**In Discord**:
- [ ] Bot appears online
- [ ] Type `/` and see 18 commands
- [ ] Run `/help` to test
- [ ] Run `/leaderboard` to test database

---

### 7. Deploy Tensey Bot (Optional)

If using Tensey social freedom challenges:

```bash
cd tensey-bot
npm install

# Create .env (SAME PostgreSQL credentials as main bot)
cp .env.example .env
# Edit with SAME DB credentials

npm start
# OR with PM2:
pm2 start bot.js --name "tensey-bot"
```

See [Tensey_Bot_Integration.md](./Tensey_Bot_Integration.md) for details.

═══════════════════════════════════════════════════════════════════════════════

## Monitoring

### Health Checks

**Enabled**: `SECOPS_ENABLE_HEALTHCHECKS=true`

**Logs** (every 5 minutes):
```
[HealthCheck] Discord connection check: PASS
[HealthCheck] Database connection check: PASS
[HealthCheck] Memory: { heapUsed: '45 MB', heapTotal: '120 MB' }
```

---

### Automated Backups

**Enabled**: `SECOPS_ENABLE_AUTOBACKUP=true`

**Schedule**: Daily at 3:00 AM server time

**Location**: `./backups/` directory

**Verification**:
```bash
ls -lah backups/
# Should see: backup-YYYY-MM-DD.sql.gz
```

---

### Error Monitoring

**Logs**: Bot logs to console (winston)

**Critical errors trigger**:
- Graceful shutdown on uncaught exceptions
- Database connection retries
- Service initialization failures logged

**For production**: Consider external error tracking (Sentry, etc.)

═══════════════════════════════════════════════════════════════════════════════

## Rollback Procedure

### Code Rollback

```bash
# Stop bot
pm2 stop embodied-dating-bot

# Revert to previous version
git revert <commit-sha>
# OR
git reset --hard <previous-commit>

# Restart
pm2 restart embodied-dating-bot
```

---

### Database Rollback

**⚠️ WARNING**: Migrations do NOT have automated rollback.

**Manual rollback** (if needed):
```sql
-- Only if tables are empty and causing issues
DROP TABLE IF EXISTS <table_name>;
```

**Better approach**: Keep backups and restore if needed:
```bash
# Restore from backup
psql -U botuser -d embodied_dating_bot < backups/backup-YYYY-MM-DD.sql
```

---

### Emergency Disable (No Code Changes)

Disable security features via environment:

```bash
export SECOPS_ENABLE_HEALTHCHECKS=false
export SECOPS_ENABLE_AUTOBACKUP=false
export SECOPS_ENFORCE_MODERATION=false
pm2 restart embodied-dating-bot
```

Warnings still log, but no actual bans/timeouts (safe mode).

═══════════════════════════════════════════════════════════════════════════════

## Production Best Practices

### Security

- ✅ Use strong PostgreSQL passwords
- ✅ Enable SSL for database connection (`DATABASE_SSL=true`)
- ✅ Restrict bot permissions (least privilege)
- ✅ Enable moderation only after testing (`SECOPS_ENFORCE_MODERATION=true`)
- ✅ Review audit logs regularly (`/security audit`)

### Reliability

- ✅ Use process manager (PM2 recommended)
- ✅ Enable health checks (`SECOPS_ENABLE_HEALTHCHECKS=true`)
- ✅ Enable auto-backup (`SECOPS_ENABLE_AUTOBACKUP=true`)
- ✅ Monitor logs for errors
- ✅ Test in staging before production

### Performance

- ✅ PostgreSQL connection pool (max 20 connections)
- ✅ Rate limiting enabled (prevents spam)
- ✅ Scheduled jobs optimized (staggered intervals)

═══════════════════════════════════════════════════════════════════════════════

## Environment-Specific Configuration

### Development

```env
NODE_ENV=development
LOG_LEVEL=debug
SECOPS_ENABLE_HEALTHCHECKS=false
SECOPS_ENABLE_AUTOBACKUP=false
SECOPS_ENFORCE_MODERATION=false
```

**Behavior**: Quiet mode, no background jobs, warnings only (no bans)

---

### Staging

```env
NODE_ENV=staging
LOG_LEVEL=info
SECOPS_ENABLE_HEALTHCHECKS=true
SECOPS_ENABLE_AUTOBACKUP=true
SECOPS_ENFORCE_MODERATION=false
```

**Behavior**: Full monitoring, safe mode enforcement (24h soak test)

---

### Production

```env
NODE_ENV=production
LOG_LEVEL=info
SECOPS_ENABLE_HEALTHCHECKS=true
SECOPS_ENABLE_AUTOBACKUP=true
SECOPS_ENFORCE_MODERATION=true
```

**Behavior**: Full enforcement (Strike 2 = timeout, Strike 3 = ban)

See `README_PHASE11_ROLLOUT.md` for detailed Phase 11 deployment guide.

