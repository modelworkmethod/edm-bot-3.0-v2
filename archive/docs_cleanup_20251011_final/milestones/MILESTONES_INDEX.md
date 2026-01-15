# MILESTONES INDEX
**Embodied Dating Mastermind Bot v3 - Project Plan**

═══════════════════════════════════════════════════════════════════════════════

## OVERVIEW

This document provides a complete overview of the 4-milestone launch plan for the Embodied Dating Mastermind Bot v3, including binary checklists, promotion gates, and acceptance criteria.

**Total Duration**: 6-7 days (estimated)  
**Phases Integrated**: 11 phases (Phases 1-12, excluding 9 renamed to 11, 12 renamed to 10)  
**Commands Registered**: ~18 commands across 7 groups  
**Services Initialized**: 40+ services  
**Migrations**: 14 SQL files (000-012, 015)

═══════════════════════════════════════════════════════════════════════════════

## MILESTONES AT A GLANCE

| Milestone | Objective | Entry Gates | Exit (Definition of Done) | Evidence Required |
|-----------|-----------|-------------|---------------------------|-------------------|
| **M1: LOCAL FOUNDATION** | Establish local dev environment with database and Discord auth | PostgreSQL installed, Node >=18, Discord bot token | `.env` configured, 14 migrations run, bot logs `Bot is ready and operational` | 8 items (npm install, DB tables, migrations log) |
| **M2: CORE FEATURES VALIDATION** | Validate commands, services, and gameplay loops | M1 complete, bot invited to test server | All core commands work (`/submit-stats`, `/leaderboard`, `/scorecard`, `/raid-status`, `/barbie`, `/course`, `/help`), XP awarded correctly | 13 items (bot logs, command screenshots, DB queries) |
| **M3: OPERATIONS & HARDENING** | Enable Phase 11 security, rate limiting, audits, health checks, backups | M2 complete, security tables exist | Rate limiting blocks spam, permissions enforced, warnings escalate, health checks run, backups created | 12 items (rate limit test, audit logs, backup files) |
| **M4: PRODUCTION READINESS** | Promote entry point, deploy Tensey Bot, verify docs, prepare launch | M3 complete, 24hr stability proven | `bot-v3.js` running, Tensey Bot syncing XP, docs complete, PM2 managing both, smoke test passes | 12 items (entry promotion, Tensey sync, PM2 list, docs count) |

═══════════════════════════════════════════════════════════════════════════════

## PROMOTION GATES (BINARY)

### Gate 1: M1 → M2

**Required**: ALL of the following MUST be ✅

- [ ] `npm install` completed (exit code 0)
- [ ] Database `embodied_dating_bot` exists
- [ ] `.env` file exists with 6 required vars
- [ ] `npm run migrate` logs `✅ All migrations completed successfully`
- [ ] Tables exist: `users`, `users_stats`, `daily_records` (verified via `\dt`)
- [ ] `.gitignore` protects `.env` (verified via `git check-ignore .env`)
- [ ] `bot-v3.candidate.js` file exists
- [ ] No migration errors (check logs for absence of `Migration failed`)

**If ANY fail**: Resolve blocker before proceeding to M2

---

### Gate 2: M2 → M3

**Required**: ALL of the following MUST be ✅

- [ ] Bot starts and logs `Bot is ready and operational`
- [ ] Services initialized (log shows `Services initialized`)
- [ ] ~18 commands registered (log shows `commands loaded`)
- [ ] Commands visible in Discord (type `/` to verify)
- [ ] `/submit-stats` awards XP (verify in database: `xp > 0`)
- [ ] `/scorecard` displays user stats embed
- [ ] `/leaderboard` shows rankings sorted by XP
- [ ] `/faction-stats` displays faction war standings
- [ ] `/start-raid` creates active raid (verify with `/raid-status`)
- [ ] `/barbie add` and `/barbie list` work
- [ ] `/course` displays modules
- [ ] `/help` responds with help message
- [ ] Database shows at least 1 user with `xp > 0`

**If ANY fail**: Debug command/service before proceeding to M3

---

### Gate 3: M3 → M4

**Required**: ALL of the following MUST be ✅

- [ ] Phase 11 ENV vars set (SECOPS_ENABLE_HEALTHCHECKS, SECOPS_ENABLE_AUTOBACKUP, SECOPS_ENFORCE_MODERATION)
- [ ] Health checks running (every 5 min or manual trigger works)
- [ ] Rate limiting blocks spam (3+ rapid commands blocked)
- [ ] Permission guards block non-admin `/admin` commands
- [ ] Admin actions logged in `audit_log` table
- [ ] Content moderation flags toxic messages
- [ ] Warning system tested (strike 1 minimum)
- [ ] Manual backup creates `.sql` file in `backups/`
- [ ] GDPR export generates JSON with user data
- [ ] All 5 Phase 11 security tables exist
- [ ] Health check command displays system status
- [ ] No Phase 11 service initialization errors

**If ANY fail**: Resolve security/ops issue before proceeding to M4

---

### Gate 4: M4 → LAUNCH

**Required**: ALL of the following MUST be ✅

- [ ] `bot-v3.js` exists (promoted from candidate)
- [ ] Main bot runs stably for 24+ hours
- [ ] Tensey Bot runs as separate process
- [ ] Both bots connected to same PostgreSQL database
- [ ] Tensey XP syncs to main bot (`social_freedom_exercises_tenseys` increments)
- [ ] PM2 (or equivalent) manages both processes with auto-restart
- [ ] Health checks run every 5 minutes
- [ ] Automated backups scheduled at 03:00
- [ ] All 12 canonical docs exist in `docs/`
- [ ] `.gitignore` protects `.env` for both bots
- [ ] Production smoke test passes (8 commands execute)
- [ ] Deployment runbook validated

**If ANY fail**: Resolve production blocker before public launch

═══════════════════════════════════════════════════════════════════════════════

## WHAT WE WILL NOT DO (SCOPE EXCLUSIONS)

**Out of Scope for MVP Launch** (post-launch features):

### Missing Command Implementations
- **CTJ Commands** (`/journal`, `/breakthroughs`)
  - **Status**: `src/commands/ctj/` exists, only `index.js` present
  - **Reason**: Backend services exist (`CTJMonitor`, `CTJAnalyzer`), but command files not implemented
  - **Future**: Implement after launch, no blocker

- **Duel Commands** (`/duel`)
  - **Status**: `src/commands/duels/` exists, only `index.js` present
  - **Reason**: Backend `DuelManager` exists, migration 006 run, but command file not implemented
  - **Future**: Implement after launch, no blocker

- **Texting Simulator Commands** (`/texting-practice`, `/texting-send`, `/texting-finish`)
  - **Status**: `src/commands/texting/` exists, only `index.js` present
  - **Reason**: Backend `TextingSimulator` exists, migration 004 run, but command files not implemented
  - **Future**: Implement after launch, no blocker

### Incomplete Services
- **FactionService**
  - **Status**: Stub file exists (`src/services/factions/FactionService.js`)
  - **Note**: Logs warning on startup "FactionService is a TEMP STUB - no logic implemented"
  - **Impact**: Faction assignment may be basic (auto-assign or random)
  - **Future**: Replace stub with real faction war logic

### Aesthetic Enhancements
- **Discord Embed Polish** (from `docs/BIG_BEAUTIFUL_EMBED_GUIDE_Post_Project_Launch.md`)
  - **Status**: Planning document created, 32 surfaces identified
  - **Reason**: Core functionality prioritized, aesthetics post-launch
  - **Future**: Phase 1 (high-impact embeds) after stable launch

- **External HTML/CSS Shells**
  - **Status**: Optional web views for deep-dive analytics
  - **Reason**: Not required for Discord bot MVP
  - **Future**: Admin dashboards, scorecard web view (P2-P3 priority)

### Phase 12 Features (AI Client Brain)
- **Automation Webhooks** (Zapier, Typeform, sales call analysis)
  - **Status**: Backend services exist (`ClaudeAnalyzer`, `ElevenLabsVoice`, `AirtableClient`), migration 015 run
  - **Reason**: External integrations require API keys and testing beyond bot scope
  - **Future**: Enable if client brain needed post-launch

### Monitoring Enhancements
- **External Uptime Monitoring** (UptimeRobot, Pingdom)
  - **Status**: Health checks enabled (Phase 11), but no external service integrated
  - **Reason**: Optional, not required for launch
  - **Future**: Recommended for production monitoring

### Testing
- **Automated Test Suite**
  - **Status**: `package.json` has `"test": "echo \"No tests yet\" && exit 0"`
  - **Reason**: Manual testing via milestones sufficient for MVP
  - **Future**: Unit/integration tests for regression prevention

═══════════════════════════════════════════════════════════════════════════════

## MILESTONE DETAILS

### M1: LOCAL FOUNDATION
- **File**: [`milestones/M1_LOCAL_FOUNDATION.md`](./milestones/M1_LOCAL_FOUNDATION.md)
- **Duration**: Day 1
- **Checklist Items**: 8
- **Owner**: Developer
- **Key Tasks**: Install dependencies, create database, run migrations, configure `.env`, create `.gitignore`
- **Exit**: Bot can start locally, migrations complete

---

### M2: CORE FEATURES VALIDATION
- **File**: [`milestones/M2_CORE_FEATURES_VALIDATION.md`](./milestones/M2_CORE_FEATURES_VALIDATION.md)
- **Duration**: Day 2-3
- **Checklist Items**: 13
- **Owner**: Developer + QA
- **Key Tasks**: Start bot, test commands (`/submit-stats`, `/scorecard`, `/leaderboard`, `/raid-status`, `/barbie`, `/course`, `/help`), verify XP awards
- **Exit**: All core commands functional, gameplay loops working

---

### M3: OPERATIONS & HARDENING
- **File**: [`milestones/M3_OPERATIONS_HARDENING.md`](./milestones/M3_OPERATIONS_HARDENING.md)
- **Duration**: Day 4-5
- **Checklist Items**: 12
- **Owner**: DevOps + Security Lead
- **Key Tasks**: Enable Phase 11 features (rate limiting, permissions, audits, health checks, backups), test security controls
- **Exit**: Rate limiting works, permissions enforced, health checks active, backups scheduled

---

### M4: PRODUCTION READINESS
- **File**: [`milestones/M4_PRODUCTION_READINESS.md`](./milestones/M4_PRODUCTION_READINESS.md)
- **Duration**: Day 6-7
- **Checklist Items**: 12
- **Owner**: Release Manager + DevOps
- **Key Tasks**: Promote entry point (`bot-v3.candidate.js` → `bot-v3.js`), deploy Tensey Bot, verify docs, set up PM2, run smoke test
- **Exit**: Both bots running stably, docs complete, ready for public launch

═══════════════════════════════════════════════════════════════════════════════

## EVIDENCE COLLECTION

**Suggested Structure** (external to repo):
```
evidence/
├── M1/
│   ├── npm-install.txt
│   ├── psql-list.txt
│   ├── migrations.txt
│   ├── tables.txt
│   ├── gitignore-check.txt
│   └── node-version.txt
├── M2/
│   ├── bot-startup-log.txt
│   ├── discord-commands-screenshot.png
│   ├── submit-stats-screenshot.png
│   ├── xp-check.txt
│   ├── scorecard-screenshot.png
│   ├── leaderboard-screenshot.png
│   ├── faction-stats-screenshot.png
│   ├── raid-screenshot.png
│   ├── barbie-screenshot.png
│   ├── course-screenshot.png
│   └── help-screenshot.png
├── M3/
│   ├── health-log.txt
│   ├── backup-log.txt
│   ├── rate-limit-screenshot.png
│   ├── permission-denied-screenshot.png
│   ├── audit-log.txt
│   ├── content-flags.txt
│   ├── warning-dm-screenshot.png
│   ├── health-check-screenshot.png
│   ├── backup-file-list.txt
│   ├── gdpr-export-screenshot.png
│   └── security-tables.txt
└── M4/
    ├── entry-file.txt
    ├── process-list.txt
    ├── tensey-deps.txt
    ├── pm2-list.txt
    ├── tensey-sync.txt
    ├── docs-list.txt
    ├── gitignore-test.txt
    ├── health-log.txt
    ├── backup-log.txt
    ├── pm2-startup.txt
    └── smoke-test-screenshots/
        ├── submit-stats.png
        ├── scorecard.png
        ├── leaderboard.png
        ├── help.png
        ├── raid.png
        ├── security-health.png
        ├── tenseylist.png
        └── tenseyleaderboard.png
```

**Total Evidence Files**: 45+ (8 + 13 + 12 + 12)

**Storage**: Keep outside git repository (screenshots, redacted logs). Never commit secrets.

═══════════════════════════════════════════════════════════════════════════════

## ROLLBACK STRATEGY

**Per Milestone**:
- **M1**: Drop database, remove `.env`, reinstall dependencies
- **M2**: Stop bot, truncate test data, re-run migrations, restart
- **M3**: Disable Phase 11 ENV flags, truncate security tables, restart
- **M4**: Revert `bot-v3.js` to candidate, stop Tensey Bot, switch to dev database

**Critical Rollback** (worst case):
```bash
# 1. Stop all processes
pm2 stop all

# 2. Backup current state
pg_dump embodied_dating_bot > backups/emergency-backup-$(date +%F-%H%M).sql

# 3. Drop and recreate database
dropdb embodied_dating_bot
createdb embodied_dating_bot

# 4. Re-run migrations
npm run migrate

# 5. Restart from M2
```

**Data Loss**: All user data (acceptable pre-launch, unacceptable post-launch)

═══════════════════════════════════════════════════════════════════════════════

## DERIVED FROM (REPO FACTS)

**Primary Sources**:
- `package.json` (scripts, dependencies, entry point)
- `src/events/ready.js` (initialization orchestration, log strings)
- `src/commands/index.js` (7 command groups)
- `src/services/index.js` (40+ services, Phase 11 initialization)
- `src/config/environment.js` (required/optional ENV vars)
- `src/database/migrations/*.sql` (14 migration files)
- `tensey-bot/` (separate app structure, 40 files)
- `docs/` (12 canonical docs post-cleanup)

**Log Strings Sourced From**:
- `src/events/ready.js:24-55` (ready event logs)
- `src/database/runMigrations.js:20-43` (migration logs)
- `src/services/index.js:170-190` (Phase 11 service logs)

**Commands Verified From**:
- `src/commands/stats/` (3 commands)
- `src/commands/leaderboard/` (2 commands)
- `src/commands/admin/` (9 commands)
- `src/commands/barbie/` (1 command)
- `src/commands/course/` (1 command)
- `src/commands/help/` (1 command)
- `src/commands/raids/` (1 command)

**Total**: ~18 commands registered (verified via live directory structure)

═══════════════════════════════════════════════════════════════════════════════

## QUICK LINKS

- [M1: LOCAL FOUNDATION](./M1_LOCAL_FOUNDATION.md)
- [M2: CORE FEATURES VALIDATION](./M2_CORE_FEATURES_VALIDATION.md)
- [M3: OPERATIONS & HARDENING](./M3_OPERATIONS_HARDENING.md)
- [M4: PRODUCTION READINESS](./M4_PRODUCTION_READINESS.md)
- [CHECKLISTS AT A GLANCE](./CHECKLISTS_AT_A_GLANCE.md)

**Back to Main Docs**: [README](../../README.md)

═══════════════════════════════════════════════════════════════════════════════
**END OF MILESTONES INDEX**

