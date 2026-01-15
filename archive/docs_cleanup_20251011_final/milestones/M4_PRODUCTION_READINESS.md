# M4: PRODUCTION READINESS
**Embodied Dating Mastermind Bot v3 - Milestone 4**

═══════════════════════════════════════════════════════════════════════════════

## OBJECTIVE

Promote entry point from candidate to production, deploy Tensey Bot (separate process), verify documentation completeness, establish monitoring/alerting, and prepare for live launch with real users.

**Binary Definition of Done**: `bot-v3.js` exists and runs stably, Tensey Bot running independently, both bots share PostgreSQL, docs reviewed, deployment runbook verified, monitoring active, ready for community invite.

═══════════════════════════════════════════════════════════════════════════════

## GATES & OWNERSHIP

| Field | Value |
|-------|-------|
| **Owner** | Release Manager + DevOps |
| **Reviewer** | Product Owner + Technical Lead |
| **Due** | Day 6-7 |
| **Dependencies** | M3 complete (operations hardened) |

═══════════════════════════════════════════════════════════════════════════════

## ENTRY CRITERIA

- [x] **M3 Complete**: All M3 acceptance criteria pass
- [x] Security features validated (rate limiting, permissions, audits)
- [x] All 14 migrations run successfully
- [x] `bot-v3.candidate.js` runs stably for 24+ hours without crashes
- [x] Production Discord server created (or staging server ready)
- [x] Production database provisioned (or separate from dev)

═══════════════════════════════════════════════════════════════════════════════

## TASKS

### Task 4.1: Promote Entry Point (bot-v3.candidate.js → bot-v3.js)

**Verify candidate stability**:
```bash
# Check bot has run for 24+ hours without restart
ps aux | grep "node bot-v3.candidate.js"
```

**If stable, promote**:
```bash
mv bot-v3.candidate.js bot-v3.js
```

**Update `package.json` verification** (already references bot-v3.js):
```bash
cat package.json | grep '"main"'
```

**Expected**: `"main": "bot-v3.js"`

**Verify startup**:
```bash
npm start
```

**Expected log**:
- `Bot logged in as <BotName>#<discriminator>`
- `Bot is ready and operational`

**Screenshot**: Bot running with `bot-v3.js` in process list

**Derived from**: Promotion gate logic (candidate → production after stability proven)

---

### Task 4.2: Deploy Tensey Bot (Separate Process)

**Navigate to Tensey Bot directory**:
```bash
cd tensey-bot/
```

**Install dependencies**:
```bash
npm install
```

**Expected**: `discord.js`, `better-sqlite3`, `pg`, `dotenv`, `winston` installed

**Create Tensey Bot `.env`**:
```bash
cp ../.env tensey-bot/.env
# OR manually create with same DATABASE_URL + Tensey-specific vars
```

**Tensey Bot ENV vars** (in `tensey-bot/.env`):
```bash
# Discord (separate bot token)
TENSEY_DISCORD_TOKEN=<tensey-bot-token>
TENSEY_DISCORD_CLIENT_ID=<tensey-application-id>
TENSEY_DISCORD_GUILD_ID=<same-server-id>

# Database (MUST match main bot)
DATABASE_URL=postgresql://botuser:password@localhost:5432/embodied_dating_bot

# Channels (Tensey-specific)
TENSEYLIST_CHANNEL_ID=<channel-id>
LEADERBOARD_CHANNEL_ID=<channel-id>

# Optional banners
BANNER_URL_OPEN_BUTTON=<image-url>
BANNER_URL_LEADERBOARD=<image-url>
```

**Run Tensey Bot migrations** (SQLite local + verify PostgreSQL shared):
```bash
cd tensey-bot/
npm start
```

**Verify in logs**:
```bash
npm start 2>&1 | grep -E "Tensey Bot.*logged in|SQLite initialized|PostgreSQL connected"
```

**Expected substrings**:
- `Tensey Bot logged in`
- `SQLite initialized` (local progress tracking)
- `PostgreSQL connected` (shared users table)

**Keep both bots running simultaneously.**

**Derived from**: `tensey-bot/` directory structure, `tensey-bot/bot.js`, `tensey-bot/src/config/environment.js`

---

### Task 4.3: Verify Tensey Bot <→ Main Bot Integration

**In Discord** (Tensey Bot commands):

Run: `/tenseylist`

**Expected**:
- Checklist embed displays
- Shows 303 challenges organized by level
- Pagination buttons work

**Complete a Tensey challenge**:
1. Click checkbox to mark challenge complete
2. Wait 60 seconds (XP award delay)

**Then check Main Bot database**:
```bash
psql embodied_dating_bot -c "SELECT user_id, social_freedom_exercises_tenseys FROM users WHERE social_freedom_exercises_tenseys > 0 LIMIT 1;"
```

**Expected**: Tensey count incremented (`social_freedom_exercises_tenseys = 1`)

**Also check XP awarded**:
```bash
psql embodied_dating_bot -c "SELECT user_id, xp FROM users WHERE social_freedom_exercises_tenseys > 0 LIMIT 1;"
```

**Expected**: User XP increased by +100 (or configured amount)

**Screenshot**: Tensey checklist + Main Bot `/scorecard` showing Tensey stat

**Derived from**: 
- Tensey Bot: `tensey-bot/src/services/XPAwardService.js`, `tensey-bot/src/database/repositories/MainBotRepository.js`
- Main Bot: `users` table columns, `001_add_tensey_tables.sql` migration

---

### Task 4.4: Verify Documentation Completeness

**Check canonical docs exist**:
```bash
ls docs/ | grep -E "README|Getting_Started|Architecture|Commands|Environment|Migrations|Phases_Map|Tensey_Bot_Integration|Deployment|Troubleshooting|DOCS_INDEX|BIG_BEAUTIFUL_EMBED_GUIDE"
```

**Expected count**: 12 files (canonical docs set)

**Verify links not broken** (manual check):
- Open `README.md` in root
- Click all links to `docs/*.md`
- Verify all resolve (no 404s)

**Screenshot**: `docs/` directory listing

**Derived from**: `DOCS_FINAL_POLISH_SUMMARY.md` (previous docs cleanup)

---

### Task 4.5: Review Deployment Documentation

**Read and validate**:
```bash
cat docs/Deployment.md | grep -E "Prerequisites|Database Setup|Env Config|Migration|Startup|Monitoring"
```

**Expected**: All sections present

**Manual review checklist**:
- [ ] Prerequisites list accurate (Node >=18, PostgreSQL, Discord bot)
- [ ] Database setup steps correct (createdb, migrations)
- [ ] ENV vars documented (matches `docs/Environment.md`)
- [ ] Startup commands correct (`npm start`, `npm run prod`)
- [ ] Monitoring sections reference Phase 11 features
- [ ] Rollback procedures documented

**Screenshot**: Deployment.md open (first page)

**Derived from**: `docs/Deployment.md` (259 lines)

---

### Task 4.6: Create Production .gitignore (if not exists)

**Verify .gitignore protects secrets**:
```bash
cat .gitignore | grep -E "\.env|node_modules|backups|logs"
```

**Expected lines**:
- `.env`
- `node_modules/`
- `backups/`
- `logs/`

**If missing, create** (from M1 template).

**Test**:
```bash
git check-ignore .env
git check-ignore tensey-bot/.env
```

**Expected**: Both `.env` files ignored

**Derived from**: M1 Task 1.6

---

### Task 4.7: Set Up Process Manager (PM2 or systemd)

**Option A: PM2** (recommended for multi-process):
```bash
npm install -g pm2

# Start main bot
pm2 start bot-v3.js --name "edm-bot-main"

# Start Tensey bot
pm2 start tensey-bot/bot.js --name "edm-bot-tensey"

# Save PM2 config
pm2 save

# Set up auto-restart on reboot
pm2 startup
```

**Verify both running**:
```bash
pm2 list
```

**Expected**: 2 processes, both `online`

**Option B: systemd** (Linux servers):
- Create service files for both bots
- Enable with `systemctl enable`

**Screenshot**: PM2 list showing both bots online

**Derived from**: `docs/Deployment.md` PM2 section

---

### Task 4.8: Configure Monitoring & Alerting

**Enable health checks** (already done in M3):
```bash
cat .env | grep SECOPS_ENABLE_HEALTHCHECKS
```

**Expected**: `SECOPS_ENABLE_HEALTHCHECKS=true`

**Set up external monitoring** (optional but recommended):
- UptimeRobot / Pingdom / custom healthcheck endpoint
- Alert if bot offline >5 minutes

**Configure Discord webhook for alerts** (optional):
```bash
# Add to .env
ALERT_WEBHOOK_URL=<discord-webhook-url>
```

**Test alert** (manual):
- Stop bot
- Wait 5+ minutes
- Verify alert sent (if webhook configured)

**Screenshot**: Health check log showing `Health checks enabled`

**Derived from**: `src/services/monitoring/HealthCheck.js`, `src/services/monitoring/AlertSystem.js` (Phase 12)

---

### Task 4.9: Final Smoke Test (Production Env)

**In production Discord server**:

1. `/submit-stats` → Works
2. `/scorecard` → Displays correctly
3. `/leaderboard` → Shows rankings
4. `/help` → Responds
5. `/start-raid` (admin) → Creates raid
6. `/security health` (admin) → Shows system status
7. `/tenseylist` (Tensey Bot) → Shows checklist
8. `/tenseyleaderboard` (Tensey Bot) → Shows rankings

**All commands must complete without errors.**

**Database health check**:
```bash
psql embodied_dating_bot -c "SELECT 
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM daily_records) as daily_records,
  (SELECT COUNT(*) FROM course_modules) as modules,
  (SELECT COUNT(*) FROM raid_events) as raids;"
```

**Expected**: Counts > 0 for active tables

**Screenshot**: All 8 commands working in production

---

### Task 4.10: Prepare Launch Checklist

**Pre-launch checklist** (all must be ✅):

- [ ] Main bot (`bot-v3.js`) running stably for 24+ hours
- [ ] Tensey bot running stably for 12+ hours
- [ ] Both bots connected to same PostgreSQL database
- [ ] `.env` files secured (not in git, proper file permissions)
- [ ] Health checks enabled and reporting
- [ ] Backups scheduled (auto-backup at 03:00)
- [ ] Rate limiting active (tested in M3)
- [ ] Permission guards active (admin commands protected)
- [ ] Documentation reviewed and accurate
- [ ] Deployment runbook validated
- [ ] Monitoring/alerting configured
- [ ] PM2 (or systemd) auto-restart enabled
- [ ] Course modules seeded (`npm run seed-course`)
- [ ] Server invites prepared (roles, channels set up)
- [ ] Announcement drafted (launch message ready)

═══════════════════════════════════════════════════════════════════════════════

## BINARY CHECKLIST

| # | Item | Command to Run | Expected Substring (grep) | Evidence to Attach |
|---|------|-----------------|---------------------------|--------------------|
| 4.1 | bot-v3.js exists | `ls bot-v3.js` | `bot-v3.js` | `evidence/M4/entry-file.txt` |
| 4.2 | Main bot runs from bot-v3.js | `ps aux \| grep "node bot-v3.js"` | `bot-v3.js` | `evidence/M4/process-list.txt` |
| 4.3 | Tensey Bot dependencies installed | `ls tensey-bot/node_modules \| grep discord.js` | `discord.js` | `evidence/M4/tensey-deps.txt` |
| 4.4 | Tensey Bot runs | `ps aux \| grep "tensey-bot/bot.js"` | `tensey-bot/bot.js` | `evidence/M4/process-list.txt` |
| 4.5 | Both bots logged in | `pm2 list \| grep -c online` | `2` | `evidence/M4/pm2-list.txt` |
| 4.6 | Tensey XP syncs to main bot | `psql embodied_dating_bot -c "SELECT COUNT(*) FROM users WHERE social_freedom_exercises_tenseys > 0;"` | `1` or higher | `evidence/M4/tensey-sync.txt` |
| 4.7 | 12 canonical docs exist | `ls docs/ \| grep -cE "\.md$"` | `12` | `evidence/M4/docs-list.txt` |
| 4.8 | .gitignore protects secrets | `git check-ignore .env` | `.env` | `evidence/M4/gitignore-test.txt` |
| 4.9 | Health checks active | `npm start 2>&1 \| grep "Health"` | `Health` | `evidence/M4/health-log.txt` |
| 4.10 | Backups scheduled | `npm start 2>&1 \| grep "Backup"` | `Backup` | `evidence/M4/backup-log.txt` |
| 4.11 | PM2 auto-restart enabled | `pm2 startup \| grep "systemd"` | `systemd` (or equivalent) | `evidence/M4/pm2-startup.txt` |
| 4.12 | Production smoke test | (Manual: 8 commands) | All execute | `evidence/M4/smoke-test-screenshots/` |

═══════════════════════════════════════════════════════════════════════════════

## ACCEPTANCE CRITERIA (ALL MUST BE TRUE)

- [x] **AC4.1**: `bot-v3.js` exists and is the running entry point (not candidate)
- [x] **AC4.2**: Main bot runs stably for 24+ hours without crashes
- [x] **AC4.3**: Tensey Bot runs as separate process with own `tensey-bot/.env`
- [x] **AC4.4**: Both bots connected to same PostgreSQL database (DATABASE_URL matches)
- [x] **AC4.5**: Tensey XP awards sync to main bot's `users` table (`social_freedom_exercises_tenseys` increments)
- [x] **AC4.6**: PM2 (or equivalent) manages both processes with auto-restart enabled
- [x] **AC4.7**: Health checks run every 5 minutes (logs visible or `/security health` works)
- [x] **AC4.8**: Automated backups scheduled at 03:00 (verify `backups/` directory populated)
- [x] **AC4.9**: All 12 canonical docs exist in `docs/` directory (README, Getting_Started, Architecture, Commands, Environment, Migrations, Phases_Map, Tensey_Bot_Integration, Deployment, Troubleshooting, DOCS_INDEX, BIG_BEAUTIFUL_EMBED_GUIDE)
- [x] **AC4.10**: `.gitignore` protects `.env` files for both bots (verify with `git check-ignore`)
- [x] **AC4.11**: Production smoke test passes (8 commands execute without errors)
- [x] **AC4.12**: Deployment runbook validated (reviewed and steps verified)

═══════════════════════════════════════════════════════════════════════════════

## ROLLBACK PROCEDURE

If any acceptance criteria fail before launch:

```bash
# 1. Revert entry point if unstable
mv bot-v3.js bot-v3.candidate.js

# 2. Stop Tensey Bot if causing issues
pm2 stop edm-bot-tensey

# 3. Switch back to dev environment
# Edit .env to point to dev database
DATABASE_URL=postgresql://botuser:password@localhost:5432/embodied_dating_bot_dev

# 4. Restart main bot only
pm2 restart edm-bot-main

# 5. Debug issues before re-attempting M4
```

**Data Loss**: Minimal (production data not yet populated)

**Critical Blocker Resolution**:
- Main bot crashes → Check logs for specific error, rollback to candidate
- Tensey Bot can't connect → Verify DATABASE_URL matches main bot
- PM2 not auto-restarting → Re-run `pm2 startup` and `pm2 save`

═══════════════════════════════════════════════════════════════════════════════

## SIGN-OFF

| Role | Name | Date | Signature (Initials) |
|------|------|------|---------------------|
| DevOps | | | ☐ |
| Release Manager | | | ☐ |
| Product Owner | | | ☐ |
| Technical Lead | | | ☐ |

**🚀 LAUNCH APPROVED**: All 12 checklist items pass + all stakeholders signed ✅

═══════════════════════════════════════════════════════════════════════════════

## RISKS & NOTES

**Risk**: Tensey Bot XP awards duplicate
- **Mitigation**: XPAwardService uses `pending_xp_awards` table with 60s delay + deduplication
- **Verify**: Check for duplicate entries in `users` table XP changes

**Risk**: Both bots down simultaneously (single point of failure: PostgreSQL)
- **Mitigation**: Database monitoring + backup/restore procedures tested
- **Recovery**: Restore from latest backup in `backups/` directory

**Risk**: PM2 process limit reached
- **Mitigation**: Only 2 processes (main + Tensey), well within limits
- **Monitor**: `pm2 status` shows resource usage

**Note**: Tensey Bot is intentionally separate (not a module of main bot) to allow independent scaling and deployment.

**Note**: Entry point promotion is one-way (candidate → production). If rollback needed, rename back to candidate.

**Future Scope** (post-M4, not blockers):
- Implement missing commands (CTJ, duels, texting)
- Replace FactionService stub with real logic
- Add external HTML/CSS shells (from BIG_BEAUTIFUL_EMBED_GUIDE)
- Phase 12 automation webhooks (if needed)

**Derived Facts**:
- Entry point: `package.json:5` ("main": "bot-v3.js")
- Tensey Bot: `tensey-bot/` directory (40 files)
- Tensey integration: `tensey-bot/src/database/repositories/MainBotRepository.js`
- Canonical docs: `docs/` (12 .md files verified in docs cleanup)
- PM2 deployment: `docs/Deployment.md` lines 100-150

═══════════════════════════════════════════════════════════════════════════════
**END M4 - READY FOR LAUNCH 🚀**

