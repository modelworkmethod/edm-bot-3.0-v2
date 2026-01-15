# CHECKLISTS AT A GLANCE
**Embodied Dating Mastermind Bot v3 - Quick Reference**

═══════════════════════════════════════════════════════════════════════════════

## M1: LOCAL FOUNDATION (8 Items)

| # | Item | Command to Run | Expected Substring (grep) | Evidence |
|---|------|-----------------|---------------------------|----------|
| 1.1 | Dependencies installed | `npm install` | `added` | `evidence/M1/npm-install.txt` |
| 1.2 | Database created | `psql -l \| grep embodied_dating_bot` | `embodied_dating_bot` | `evidence/M1/psql-list.txt` |
| 1.3 | .env file created | `ls .env` | `.env` | (redacted) |
| 1.4 | 6 required ENV vars set | `cat .env \| grep -cE "DISCORD_TOKEN\|DISCORD_CLIENT_ID\|DISCORD_GUILD_ID\|DATABASE_URL\|CHANNEL_GENERAL_ID\|ADMIN_USER_ID"` | `6` | (redacted) |
| 1.5 | Migrations run successfully | `npm run migrate 2>&1 \| grep "All migrations"` | `✅ All migrations completed successfully` | `evidence/M1/migrations.txt` |
| 1.6 | Core tables exist | `psql embodied_dating_bot -c "\\dt" \| grep -cE "users\|daily_records\|users_stats"` | `3` | `evidence/M1/tables.txt` |
| 1.7 | .gitignore protects .env | `git check-ignore .env` | `.env` | `evidence/M1/gitignore-check.txt` |
| 1.8 | Node version check | `node --version` | `v18` or higher | `evidence/M1/node-version.txt` |

**Gate to M2**: ALL 8 items ✅

═══════════════════════════════════════════════════════════════════════════════

## M2: CORE FEATURES VALIDATION (13 Items)

| # | Item | Command to Run | Expected Substring (grep) | Evidence |
|---|------|-----------------|---------------------------|----------|
| 2.1 | Bot starts without errors | `npm run dev 2>&1 \| grep "Bot is ready"` | `Bot is ready and operational` | `evidence/M2/bot-startup-log.txt` |
| 2.2 | Services initialized | `npm run dev 2>&1 \| grep "Services initialized"` | `Services initialized` | `evidence/M2/bot-startup-log.txt` |
| 2.3 | Commands registered | `npm run dev 2>&1 \| grep "commands loaded"` | `commands loaded` | `evidence/M2/bot-startup-log.txt` |
| 2.4 | Commands visible in Discord | (Manual: type `/`) | Bot commands appear | `evidence/M2/discord-commands-screenshot.png` |
| 2.5 | Stats submission works | (Manual: `/submit-stats`) | Confirmation message | `evidence/M2/submit-stats-screenshot.png` |
| 2.6 | XP awarded in database | `psql embodied_dating_bot -c "SELECT COUNT(*) FROM users WHERE xp > 0;"` | `1` or higher | `evidence/M2/xp-check.txt` |
| 2.7 | Scorecard displays | (Manual: `/scorecard`) | Embed with stats | `evidence/M2/scorecard-screenshot.png` |
| 2.8 | Leaderboard displays | (Manual: `/leaderboard`) | Embed with rankings | `evidence/M2/leaderboard-screenshot.png` |
| 2.9 | Faction stats display | (Manual: `/faction-stats`) | Faction XP totals | `evidence/M2/faction-stats-screenshot.png` |
| 2.10 | Raid start/status | (Manual: `/start-raid`, `/raid-status`) | Raid active | `evidence/M2/raid-screenshot.png` |
| 2.11 | Barbie list works | (Manual: `/barbie add`, `/barbie list`) | Contact listed | `evidence/M2/barbie-screenshot.png` |
| 2.12 | Course modules display | (Manual: `/course`) | Module list | `evidence/M2/course-screenshot.png` |
| 2.13 | Help responds | (Manual: `/help`) | Help message | `evidence/M2/help-screenshot.png` |

**Gate to M3**: ALL 13 items ✅

═══════════════════════════════════════════════════════════════════════════════

## M3: OPERATIONS & HARDENING (12 Items)

| # | Item | Command to Run | Expected Substring (grep) | Evidence |
|---|------|-----------------|---------------------------|----------|
| 3.1 | Phase 11 ENV vars set | `cat .env \| grep SECOPS_ENABLE` | `SECOPS_ENABLE_HEALTHCHECKS=true` | (redacted) |
| 3.2 | Health checks enabled | `npm run dev 2>&1 \| grep "Health"` | `Health` | `evidence/M3/health-log.txt` |
| 3.3 | Backup scheduled | `npm run dev 2>&1 \| grep "Backup"` | `Backup` | `evidence/M3/backup-log.txt` |
| 3.4 | Rate limiting works | (Manual: spam command) | `too fast` | `evidence/M3/rate-limit-screenshot.png` |
| 3.5 | Permission guards work | (Manual: non-admin `/admin`) | `don't have permission` | `evidence/M3/permission-denied-screenshot.png` |
| 3.6 | Admin commands audited | `psql embodied_dating_bot -c "SELECT COUNT(*) FROM audit_log WHERE action='ADJUST_XP';"` | `1` or higher | `evidence/M3/audit-log.txt` |
| 3.7 | Content flagged | `psql embodied_dating_bot -c "SELECT COUNT(*) FROM content_flags;"` | `1` or higher | `evidence/M3/content-flags.txt` |
| 3.8 | Warning system works | (Manual: `/security warn`) | Strike DM sent | `evidence/M3/warning-dm-screenshot.png` |
| 3.9 | Health check displays | (Manual: `/security health`) | Health embed | `evidence/M3/health-check-screenshot.png` |
| 3.10 | Backup created | `ls backups/ \| grep backup` | `backup-` | `evidence/M3/backup-file-list.txt` |
| 3.11 | GDPR export works | (Manual: `/security export-data`) | JSON attachment | `evidence/M3/gdpr-export-screenshot.png` |
| 3.12 | 5 security tables exist | `psql embodied_dating_bot -c "\\dt" \| grep -cE "audit_log\|user_warnings\|user_moderation\|rate_limit_violations\|content_flags"` | `5` | `evidence/M3/security-tables.txt` |

**Gate to M4**: ALL 12 items ✅

═══════════════════════════════════════════════════════════════════════════════

## M4: PRODUCTION READINESS (12 Items)

| # | Item | Command to Run | Expected Substring (grep) | Evidence |
|---|------|-----------------|---------------------------|----------|
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

**🚀 LAUNCH GATE**: ALL 12 items ✅ + ALL stakeholder sign-offs

═══════════════════════════════════════════════════════════════════════════════

## SUMMARY COUNTS

| Milestone | Total Items | Manual Tests | Automated Checks | Screenshots Required |
|-----------|-------------|--------------|------------------|---------------------|
| M1 | 8 | 0 | 8 | 0 |
| M2 | 13 | 8 | 5 | 8 |
| M3 | 12 | 5 | 7 | 5 |
| M4 | 12 | 1 | 11 | 1 (8 smoke test) |
| **Total** | **45** | **14** | **31** | **14+** |

**Estimated Testing Time**: 
- M1: 30 minutes (automated setup)
- M2: 2-3 hours (manual command testing)
- M3: 2-3 hours (security/ops validation)
- M4: 2-3 hours (deployment + smoke test)

**Total**: 7-10 hours of active testing across 6-7 day timeline

═══════════════════════════════════════════════════════════════════════════════

## PASS/FAIL CRITERIA

**PASS**: Item checkbox ✅ when:
- Command output contains expected substring (exact match via `grep`)
- Screenshot shows expected UI element
- Database query returns expected count
- Manual test produces expected behavior

**FAIL**: Item checkbox ❌ when:
- Command exits with non-zero code
- Expected substring absent from output
- Database count incorrect or table missing
- Manual test produces error or unexpected behavior

**BLOCKER**: Milestone gate blocked when ANY item fails

═══════════════════════════════════════════════════════════════════════════════

## QUICK COMMANDS (Copy/Paste Ready)

### M1 Quick Run
```bash
npm install && \
createdb embodied_dating_bot && \
cp ENV_TEMPLATE.txt .env && \
# (edit .env manually) && \
npm run migrate && \
psql embodied_dating_bot -c "\dt" | grep -E "users|daily_records|users_stats"
```

### M2 Quick Run
```bash
npm run dev
# Then manually test commands in Discord
```

### M3 Quick Run
```bash
# Add to .env: SECOPS_ENABLE_HEALTHCHECKS=true SECOPS_ENABLE_AUTOBACKUP=true SECOPS_ENFORCE_MODERATION=true
npm run dev
# Then manually test security features in Discord
```

### M4 Quick Run
```bash
mv bot-v3.candidate.js bot-v3.js && \
cd tensey-bot && npm install && cd .. && \
npm install -g pm2 && \
pm2 start bot-v3.js --name "edm-bot-main" && \
pm2 start tensey-bot/bot.js --name "edm-bot-tensey" && \
pm2 save && pm2 startup
```

═══════════════════════════════════════════════════════════════════════════════

**Full Details**: See individual milestone files in this directory

**Back to**: [MILESTONES_INDEX.md](./MILESTONES_INDEX.md)

═══════════════════════════════════════════════════════════════════════════════
**END OF CHECKLISTS AT A GLANCE**

