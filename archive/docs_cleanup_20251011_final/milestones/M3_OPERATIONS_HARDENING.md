# M3: OPERATIONS & HARDENING
**Embodied Dating Mastermind Bot v3 - Milestone 3**

═══════════════════════════════════════════════════════════════════════════════

## OBJECTIVE

Enable and validate Phase 11 security/operations features: rate limiting, permission guards, content moderation, warning system, audit logging, health checks, and automated backups. Verify bot handles abuse, bad actors, and operational failures gracefully.

**Binary Definition of Done**: Rate limiting blocks spam, warnings escalate to bans, audit logs capture admin actions, health checks report status, backups run automatically, all Phase 11 services initialize without errors.

═══════════════════════════════════════════════════════════════════════════════

## GATES & OWNERSHIP

| Field | Value |
|-------|-------|
| **Owner** | DevOps + Security Lead |
| **Reviewer** | Technical Lead |
| **Due** | Day 4-5 |
| **Dependencies** | M2 complete (core features validated) |

═══════════════════════════════════════════════════════════════════════════════

## ENTRY CRITERIA

- [x] **M2 Complete**: All M2 acceptance criteria pass
- [x] Bot running stably with core commands functional
- [x] Phase 11 migration `010_add_security_audit.sql` already run (verified in M1)
- [x] Security tables exist: `audit_log`, `user_warnings`, `user_moderation`, `rate_limit_violations`, `content_flags`

═══════════════════════════════════════════════════════════════════════════════

## TASKS

### Task 3.1: Enable Phase 11 Security Features

**Add to `.env`**:
```bash
# Phase 11 Security & Operations
SECOPS_ENABLE_HEALTHCHECKS=true
SECOPS_HEALTHCHECK_INTERVAL_MIN=5
SECOPS_ENABLE_AUTOBACKUP=true
SECOPS_BACKUP_TIME=03:00
SECOPS_ENFORCE_MODERATION=true
```

**Restart bot**:
```bash
npm run dev
```

**Verify in logs**:
```bash
npm run dev 2>&1 | grep -E "Health checks enabled|Backup schedule|ContentModerator"
```

**Expected substrings**:
- `Health checks enabled` (or similar from `src/services/monitoring/HealthCheck.js`)
- `Backup scheduled` (from `src/services/backup/BackupManager.js`)
- `ContentModerator initialized` (from `src/services/security/ContentModerator.js`)

**Derived from**: `src/services/index.js` lines 170-190 (Phase 11 service initialization)

---

### Task 3.2: Test Rate Limiting

**In Discord** (as regular user):

1. Rapidly spam `/leaderboard` 10 times within 5 seconds

**Expected**:
- First 2-3 commands execute normally
- Subsequent commands blocked with ephemeral message: `"You're doing that too fast. Please wait X seconds."`

**Database verification**:
```bash
psql embodied_dating_bot -c "SELECT COUNT(*) FROM rate_limit_violations WHERE user_id='<test-user-id>';"
```

**Expected**: `>=1` (violation logged)

**Screenshot**: Rate limit error message

**Derived from**: `src/middleware/RateLimiter.js`, `src/events/interactionCreate/commandHandler.js`

---

### Task 3.3: Test Permission Guards (Admin Commands)

**In Discord** (as regular non-admin user):

Run: `/admin adjust-xp`

**Expected**:
- Command blocked with ephemeral message: `"You don't have permission to use this command."`
- No XP changes made

**Then as admin user** (user ID matches `ADMIN_USER_ID` in .env):

Run: `/admin adjust-xp user:@TestUser amount:100`

**Expected**:
- Command executes successfully
- XP adjusted
- Audit log entry created

**Database verification**:
```bash
psql embodied_dating_bot -c "SELECT action, admin_user_id FROM audit_log WHERE action='ADJUST_XP' LIMIT 1;"
```

**Expected**: Audit row exists

**Screenshot**: Permission denied message (non-admin) + successful execution (admin)

**Derived from**: `src/middleware/PermissionGuard.js`, `src/services/security/AuditLogger.js`

---

### Task 3.4: Test Content Moderation

**In Discord** (as test user):

1. Post message with toxic language: `"This is fu**ing stupid, you idiot"`

**Expected**:
- Message flagged for review
- Entry created in `content_flags` table
- Admin notification sent (if configured)

**Database verification**:
```bash
psql embodied_dating_bot -c "SELECT flag_reason, severity FROM content_flags WHERE user_id='<test-user-id>' LIMIT 1;"
```

**Expected**: Flag row with reason `TOXIC_LANGUAGE` or similar

**Derived from**: `src/services/security/ContentModerator.js`, `src/events/messageCreate.js`

---

### Task 3.5: Test Warning System (3-Strike Model)

**In Discord** (as admin):

**Strike 1**:
Run: `/security warn user:@TestUser reason:"Spam"`

**Expected**:
- Warning issued
- User receives DM: `"⚠️ Warning - Strike 1/3"`
- Entry in `user_warnings` table

**Strike 2**:
Run: `/security warn user:@TestUser reason:"Continued spam"`

**Expected**:
- User receives DM: `"🚨 Strike 2/3 - 24 Hour Timeout"`
- User timed out for 24 hours (or shorter for testing)

**Strike 3** (if testing to completion):
Run: `/security warn user:@TestUser reason:"Third offense"`

**Expected**:
- User receives DM: `"🔨 Strike 3/3 - Banned"`
- User banned from server

**Database verification**:
```bash
psql embodied_dating_bot -c "SELECT strike_count, action_taken FROM user_warnings WHERE user_id='<test-user-id>' ORDER BY created_at DESC LIMIT 1;"
```

**Expected**: Row with `strike_count=3`, `action_taken='BAN'` (if tested to strike 3)

**Screenshot**: Warning DMs

**Note**: Use test user, remove after testing

**Derived from**: `src/services/security/WarningSystem.js`, `src/commands/admin/security.js`

---

### Task 3.6: Test Health Check (Manual Trigger)

**In Discord** (as admin):

Run: `/security health`

**Expected**:
- Embed displays system health
- Discord: ✅ Connected
- Database: ✅ Connected
- Memory: Shows current usage
- Uptime: Shows bot uptime

**Database verification** (health check logs to console):
```bash
npm run dev 2>&1 | grep -E "Health check|Discord.*connected|Database.*connected"
```

**Expected**: Health check passes

**Screenshot**: Health check embed

**Derived from**: `src/services/monitoring/HealthCheck.js`, scheduled checks every 5 min (from SECOPS_HEALTHCHECK_INTERVAL_MIN)

---

### Task 3.7: Test Manual Backup

**In Discord** (as admin):

Run: `/security backup`

**Expected**:
- Backup initiated
- Confirmation message: `"💾 Database Backup Complete"`
- Backup file created in `backups/` directory

**Filesystem verification**:
```bash
ls -la backups/ | grep "backup-.*\.sql"
```

**Expected**: Recent `.sql` file (or `.sql.gz` if compressed)

**Check backup content** (first 10 lines):
```bash
head -10 backups/<latest-backup-file>.sql | grep -E "PostgreSQL|CREATE TABLE"
```

**Expected**: Valid SQL content

**Screenshot**: Backup confirmation + file listing

**Derived from**: `src/services/backup/BackupManager.js`, `src/commands/admin/security.js`

---

### Task 3.8: Test GDPR Data Export

**In Discord** (as admin):

Run: `/security export-data user:@TestUser`

**Expected**:
- Data export job initiated
- JSON file attachment sent via DM (or ephemeral reply)
- Contains user data: stats, XP, warnings, barbie list, etc.

**Verify export includes**:
- User profile (xp, level, faction)
- Stats history
- Warnings (if any)
- Barbie list entries
- Course progress

**Screenshot**: Export confirmation + sample JSON content (redacted sensitive fields)

**Derived from**: `src/services/compliance/GDPRExporter.js`, `src/commands/admin/security.js`

---

### Task 3.9: Verify Audit Log Entries

**Database query**:
```bash
psql embodied_dating_bot -c "SELECT action, admin_user_id, details, created_at FROM audit_log ORDER BY created_at DESC LIMIT 10;"
```

**Expected entries**:
- `ADJUST_XP` (from Task 3.3)
- `WARN_USER` (from Task 3.5)
- `BACKUP_DATABASE` (from Task 3.7)
- `EXPORT_USER_DATA` (from Task 3.8)

**Screenshot**: Audit log query results

**Derived from**: `src/services/security/AuditLogger.js`

---

### Task 3.10: Verify Security Tables Exist

**Database verification**:
```bash
psql embodied_dating_bot -c "\dt" | grep -E "audit_log|user_warnings|user_moderation|rate_limit_violations|content_flags"
```

**Expected**: All 5 Phase 11 security tables present

**Count table**: `wc -l` should return `5`

═══════════════════════════════════════════════════════════════════════════════

## BINARY CHECKLIST

| # | Item | Command to Run | Expected Substring (grep) | Evidence to Attach |
|---|------|-----------------|---------------------------|--------------------|
| 3.1 | Phase 11 ENV vars set | `cat .env \| grep SECOPS_ENABLE` | `SECOPS_ENABLE_HEALTHCHECKS=true` | (redacted, confirm exists) |
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

═══════════════════════════════════════════════════════════════════════════════

## ACCEPTANCE CRITERIA (ALL MUST BE TRUE)

- [x] **AC3.1**: Phase 11 ENV vars set (SECOPS_ENABLE_HEALTHCHECKS, SECOPS_ENABLE_AUTOBACKUP, SECOPS_ENFORCE_MODERATION)
- [x] **AC3.2**: Health checks run every 5 minutes (verify in logs or manual trigger works)
- [x] **AC3.3**: Rate limiting blocks spam after 2-3 rapid commands
- [x] **AC3.4**: Permission guards block non-admin users from `/admin` commands
- [x] **AC3.5**: Admin actions logged in `audit_log` table (ADJUST_XP, WARN_USER, BACKUP_DATABASE, EXPORT_USER_DATA)
- [x] **AC3.6**: Content moderation flags toxic messages in `content_flags` table
- [x] **AC3.7**: Warning system escalates from warn → timeout → ban (tested to strike 1 minimum)
- [x] **AC3.8**: Manual backup (`/security backup`) creates `.sql` file in `backups/` directory
- [x] **AC3.9**: GDPR export (`/security export-data`) generates JSON with user data
- [x] **AC3.10**: All 5 Phase 11 security tables exist (audit_log, user_warnings, user_moderation, rate_limit_violations, content_flags)
- [x] **AC3.11**: Health check command (`/security health`) displays system status
- [x] **AC3.12**: No Phase 11 service initialization errors in logs

═══════════════════════════════════════════════════════════════════════════════

## ROLLBACK PROCEDURE

If any acceptance criteria fail:

```bash
# 1. Disable Phase 11 features in .env
SECOPS_ENABLE_HEALTHCHECKS=false
SECOPS_ENABLE_AUTOBACKUP=false
SECOPS_ENFORCE_MODERATION=false

# 2. Restart bot
npm run dev

# 3. If security tables corrupted
psql embodied_dating_bot -c "TRUNCATE TABLE audit_log, user_warnings, user_moderation, rate_limit_violations, content_flags CASCADE;"

# 4. Re-run migration 010 if tables missing
psql embodied_dating_bot -f src/database/migrations/010_add_security_audit.sql

# 5. Re-enable features one by one for debugging
```

**Data Loss**: Security logs only (no user XP/stats affected)

**Blockers to Address**:
- Rate limiting too aggressive → Adjust limits in `src/middleware/RateLimiter.js`
- Health checks fail → Check DATABASE_URL connection
- Backups fail → Verify `backups/` directory writable

═══════════════════════════════════════════════════════════════════════════════

## SIGN-OFF

| Role | Name | Date | Signature (Initials) |
|------|------|------|---------------------|
| DevOps | | | ☐ |
| Security Lead | | | ☐ |
| Technical Lead | | | ☐ |

**Promotion Gate to M4**: All 12 checklist items pass ✅

═══════════════════════════════════════════════════════════════════════════════

## RISKS & NOTES

**Risk**: DM notifications fail (user has DMs disabled)
- **Mitigation**: WarningSystem has soft-fail (logs warning but continues)
- **Verify**: `src/services/security/WarningSystem.js` lines 150-172 (DM error handling)

**Risk**: Backup fills disk space
- **Mitigation**: Implement backup rotation (keep only last N backups)
- **Manual cleanup**: `rm backups/backup-*.sql` (keep only recent)

**Risk**: False positives in content moderation
- **Mitigation**: Review `content_flags` table regularly
- **Adjust**: Toxicity thresholds in `src/services/security/ContentModerator.js`

**Note**: Automated backups run at 03:00 server time (from SECOPS_BACKUP_TIME). Manual testing uses `/security backup` command.

**Note**: WarningSystem requires ADMIN_USER_ID allowlist for `/security` commands (env-gated, see `src/middleware/PermissionGuard.js`).

**Derived Facts**:
- Phase 11 services: `src/services/index.js:170-190`
- Migration 010: `src/database/migrations/010_add_security_audit.sql`
- Security commands: `src/commands/admin/security.js`
- Rate limiter: `src/middleware/RateLimiter.js`
- Permission guard: `src/middleware/PermissionGuard.js`

═══════════════════════════════════════════════════════════════════════════════
**END M3**

