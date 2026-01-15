# 🚀 PHASE 11 ROLLOUT GUIDE

**Security & Operations Layer Deployment**

---

## 🌍 ENVIRONMENT CONFIGURATION

### **DEVELOPMENT** (Local Testing)
```env
# Phase 11 Security & Operations
SECOPS_ENABLE_HEALTHCHECKS=false       # Disable in dev to avoid spam
SECOPS_HEALTHCHECK_INTERVAL_MIN=5      # (Only if enabled)
SECOPS_ENABLE_AUTOBACKUP=false         # Disable in dev
SECOPS_BACKUP_CRON="0 3 * * *"         # (Only if enabled)
SECOPS_ENFORCE_MODERATION=false        # SAFE MODE: Warnings only, no bans

# Admin Access
ADMIN_USER_ID=YOUR_DISCORD_ID          # Required for Owner permissions

# Database (for backups)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=embodied_dating_bot_dev
DB_USER=botuser
DB_PASSWORD=dev_password
```

**Behavior in Dev**:
- ✅ Rate limiting active (prevents spam during testing)
- ✅ Permission checks active (validates access control)
- ✅ Audit logging active (tracks admin actions)
- ✅ Content moderation active (flags toxic content)
- ⚠️ Warning system in SAFE MODE (warns but doesn't timeout/ban)
- ❌ Health checks DISABLED (no background noise)
- ❌ Auto-backups DISABLED (don't fill disk during dev)

---

### **STAGING** (Pre-Production)
```env
# Phase 11 Security & Operations
SECOPS_ENABLE_HEALTHCHECKS=true        # Enable for soak testing
SECOPS_HEALTHCHECK_INTERVAL_MIN=5      # Check every 5 minutes
SECOPS_ENABLE_AUTOBACKUP=true          # Enable for backup testing
SECOPS_BACKUP_CRON="0 3 * * *"         # Daily at 3 AM
SECOPS_ENFORCE_MODERATION=false        # Still in SAFE MODE

# Admin Access
ADMIN_USER_ID=YOUR_DISCORD_ID

# Database
DB_HOST=staging_host
DB_PORT=5432
DB_NAME=embodied_dating_bot_staging
DB_USER=botuser
DB_PASSWORD=staging_password
```

**Behavior in Staging**:
- ✅ ALL security features active
- ✅ Health checks run every 5 minutes (monitor logs)
- ✅ Backup runs daily at 3 AM (verify next morning)
- ⚠️ Warning system still in SAFE MODE (no real bans)
- 🎯 **24-hour soak test**: Monitor for issues before production

---

### **PRODUCTION** (Live Deployment)
```env
# Phase 11 Security & Operations
SECOPS_ENABLE_HEALTHCHECKS=true        # ACTIVE
SECOPS_HEALTHCHECK_INTERVAL_MIN=5      # Every 5 minutes
SECOPS_ENABLE_AUTOBACKUP=true          # ACTIVE
SECOPS_BACKUP_CRON="0 3 * * *"         # 3:00 AM server time
SECOPS_ENFORCE_MODERATION=true         # ⚠️ ENFORCEMENT ON

# Admin Access
ADMIN_USER_ID=YOUR_DISCORD_ID

# Database
DB_HOST=production_host
DB_PORT=5432
DB_NAME=embodied_dating_bot
DB_USER=botuser
DB_PASSWORD=secure_production_password
```

**Behavior in Production**:
- ✅ ALL security features FULLY ACTIVE
- ✅ Health checks monitored
- ✅ Daily backups at 3 AM
- 🔴 **WARNING SYSTEM ENFORCES**: Strike 2 = 24h timeout, Strike 3 = BAN
- 🛡️ Full production hardening

**⚠️ CRITICAL**: Only flip `SECOPS_ENFORCE_MODERATION=true` after successful staging soak!

---

## 📋 DEPLOYMENT CHECKLIST

### **Step 1: DEV Testing**
```bash
# 1. Set dev environment variables
export SECOPS_ENABLE_HEALTHCHECKS=false
export SECOPS_ENABLE_AUTOBACKUP=false
export SECOPS_ENFORCE_MODERATION=false

# 2. Run migration
psql -U botuser -d embodied_dating_bot_dev \
  -f src/database/migrations/010_add_security_audit.sql

# 3. Start bot
npm run dev

# 4. Run smoke tests (see below)
```

---

### **Step 2: Staging Deployment**
```bash
# 1. Set staging environment variables
export SECOPS_ENABLE_HEALTHCHECKS=true
export SECOPS_HEALTHCHECK_INTERVAL_MIN=5
export SECOPS_ENABLE_AUTOBACKUP=true
export SECOPS_ENFORCE_MODERATION=false  # Still safe mode!

# 2. Backup staging database
pg_dump -h staging_host -U botuser -d embodied_dating_bot_staging \
  > backups/backup-pre-phase11-staging.sql
gzip backups/backup-pre-phase11-staging.sql

# 3. Deploy code
git checkout chore/phase-11-audit-hardening
npm install  # If package.json exists

# 4. Run migration
psql -h staging_host -U botuser -d embodied_dating_bot_staging \
  -f src/database/migrations/010_add_security_audit.sql

# 5. Start bot
npm start

# 6. Monitor for 24 hours
# - Check logs for health check output (every 5 min)
# - Wait until 3 AM next day to verify backup runs
# - Test all smoke scenarios
# - Review audit logs

# 7. Verify backup created
ls -lah backups/ | grep backup-
```

---

### **Step 3: Production Deployment** (After Staging Soak)
```bash
# ⚠️ SCHEDULE MAINTENANCE WINDOW (Low Traffic Period)

# 1. Set production environment variables
export SECOPS_ENABLE_HEALTHCHECKS=true
export SECOPS_HEALTHCHECK_INTERVAL_MIN=5
export SECOPS_ENABLE_AUTOBACKUP=true
export SECOPS_ENFORCE_MODERATION=true   # ⚠️ ENFORCEMENT ON

# 2. Backup production database
BACKUP_FILE="backups/backup-pre-phase11-prod-$(date +%F-%H%M).sql"
pg_dump -h prod_host -U botuser -d embodied_dating_bot > $BACKUP_FILE
gzip $BACKUP_FILE
echo "✅ Backup created: $BACKUP_FILE.gz"

# 3. Deploy code
git checkout chore/phase-11-audit-hardening
npm install

# 4. Run migration (< 1 second execution)
psql -h prod_host -U botuser -d embodied_dating_bot \
  -f src/database/migrations/010_add_security_audit.sql

# Expected output:
# NOTICE: Migration 010_add_security_audit.sql completed successfully

# 5. Verify tables created
psql -h prod_host -U botuser -d embodied_dating_bot \
  -c "\d audit_log; \d user_warnings; \d user_moderation; \d rate_limit_violations; \d content_flags;"

# 6. Restart bot
pm2 restart embodied-dating-bot  # Or your process manager

# 7. Monitor for 1 hour
# - Check health status every 5 minutes
# - Test /security audit command
# - Monitor error logs
# - Verify no user disruption

# 8. Verify backup next morning (after 3 AM)
ls -lah backups/ | head -5
```

---

## 🧪 SMOKE TEST PROTOCOL

**Run these in order with dev/staging env vars:**

### **Test 1: Rate Limiting** ✅
```
Discord Commands:
/submit-stats
[wait 5 seconds]
/submit-stats
[wait 5 seconds]
/submit-stats
[IMMEDIATELY]
/submit-stats

Expected Result:
✅ Requests 1-3: Execute normally
❌ Request 4: "⏳ Rate limited. Try again in XXXX s."

Logs:
[RateLimiter] Rate limit exceeded { userId: '123...', commandName: 'submit-stats' }
```

---

### **Test 2: Permission Denied** ✅
```
User: Non-admin account
Command: /security audit

Expected Result:
❌ "❌ You do not have permission to use this command."

Logs:
[PermissionGuard] Permission denied { userId: '123...', command: 'security' }
```

---

### **Test 3: Content Moderation** ✅
```
Command: /barbie add
Name: "Test Contact"
Notes: "This bitch deserves to be ignored"

Expected Result:
⚠️ Submission may be flagged (depending on integration)
Check: /security flags

Expected in Database:
INSERT INTO content_flags 
(user_id, content_type, flag_reason) 
VALUES ('123...', 'barbie_note', 'toxic_language')

Logs:
[ContentModerator] Content flagged { userId, contentType: 'barbie_note', flagReason: 'toxic_language' }
```

---

### **Test 4: Audit Logging** ✅
```
Command (as admin): /admin adjust-xp @testuser 100
Then: /security audit

Expected Result:
Embed showing:
  "adjust-xp - 2025-10-07 14:30:15"
  Admin: <@YOUR_ID>
  Target: <@testuser>

Expected in Database:
SELECT * FROM audit_log WHERE action_type = 'adjust-xp'
```

---

### **Test 5: Warning System (Safe Mode)** ✅
```
Environment: SECOPS_ENFORCE_MODERATION=false

Command: /security warn @testuser "Test warning" medium

Expected Result:
✅ Reply: "User warned. Total warnings: 1. Action: warning"
✅ TestUser receives DM: "⚠️ Warning - Strike 1/3"
❌ NO actual timeout/ban (safe mode)

Command: /security warnings @testuser

Expected Result:
Embed showing:
  "MEDIUM - 2025-10-07"
  Reason: "Test warning"

Logs:
[WarningSystem] User warned { userId, totalWarnings: 1 }
[WarningSystem] Moderation enforcement DISABLED (dev/staging mode)
```

---

### **Test 6: Manual Backup** ✅
```
Environment: SECOPS_ENABLE_AUTOBACKUP=true (temporarily)

Command: /security backup

Expected Result:
Initial: "Starting database backup..."
Final: "Backup completed!
        File: backup-2025-10-07T14-30-15.sql.gz
        Size: 2.34 MB"

Verify File:
ls -lah backups/backup-*.sql.gz
# Should see new file with recent timestamp

Reset Environment:
export SECOPS_ENABLE_AUTOBACKUP=false
```

---

### **Test 7: GDPR Export** ✅
```
Command: /security export-data @testuser

Expected Result:
JSON file attachment: user-data-123456789-timestamp.json

Contents should include:
{
  "exportDate": "2025-10-07...",
  "userId": "123456789",
  "profile": { ... },
  "stats": [ ... ],
  "dailyRecords": [ ... ],
  "tenseys": [ ... ],
  "barbieList": [ ... ],
  "journalEntries": [ ... ],
  "courseProgress": [ ... ],
  "duels": [ ... ],
  "warnings": [ ... ],
  "auditLog": [ ... ]
}

Expected in Database:
SELECT * FROM audit_log WHERE action_type = 'gdpr_export'
```

---

### **Test 8: Health Check Monitoring** ✅
```
Environment: SECOPS_ENABLE_HEALTHCHECKS=true

Action: Start bot, wait 5 minutes

Expected Logs:
[HealthCheck] Health checks scheduled { intervalMinutes: 5 }
[5 minutes later]
[HealthCheck] Discord connection check: PASS
[HealthCheck] Database connection check: PASS
[HealthCheck] Memory: { heapUsed: '45 MB', heapTotal: '120 MB', ... }

Expected: NO errors, checks repeat every 5 minutes
```

---

## 📊 ENVIRONMENT VARIABLE MATRIX

| Variable | Dev | Staging | Production | Purpose |
|----------|-----|---------|------------|---------|
| `SECOPS_ENABLE_HEALTHCHECKS` | `false` | `true` | `true` | System monitoring |
| `SECOPS_HEALTHCHECK_INTERVAL_MIN` | `5` | `5` | `5` | Check frequency |
| `SECOPS_ENABLE_AUTOBACKUP` | `false` | `true` | `true` | Daily backups |
| `SECOPS_BACKUP_CRON` | N/A | `0 3 * * *` | `0 3 * * *` | Backup schedule |
| `SECOPS_ENFORCE_MODERATION` | `false` | `false` | `true` | Ban/timeout enforcement |
| `ADMIN_USER_ID` | Required | Required | Required | Owner permissions |

---

## 🚨 CRITICAL WARNINGS

### ⚠️ **Before Setting `SECOPS_ENFORCE_MODERATION=true`**:

1. ✅ Staging soak complete (24+ hours)
2. ✅ All smoke tests passing
3. ✅ Warning system tested with real users
4. ✅ DM delivery confirmed working
5. ✅ Admin team trained on `/security` commands
6. ✅ Appeal/removal process documented

**Consequences When Enabled**:
- Strike 2 = Automatic 24-hour timeout
- Strike 3 = Automatic permanent ban
- User data written to `user_moderation` table
- Requires manual admin intervention to reverse

---

## 🔄 ROLLBACK PROCEDURES

### **Scenario A: Code Rollback** (Phase 11 causing issues)
```bash
# Revert the integration commit
git revert <commit-sha>

# Restart bot
pm2 restart embodied-dating-bot

# Database tables persist (harmless)
# Can optionally drop if completely reverting:
# psql -c "DROP TABLE audit_log, user_warnings, user_moderation, rate_limit_violations, content_flags CASCADE;"
```

---

### **Scenario B: Disable Enforcement** (Hotfix)
```bash
# In production, emergency disable of bans/timeouts:
export SECOPS_ENFORCE_MODERATION=false
pm2 restart embodied-dating-bot

# Warnings still logged, but no actual bans
# Gives time to investigate issues
```

---

### **Scenario C: Disable Background Jobs** (Reduce Load)
```bash
# If health checks or backups causing issues:
export SECOPS_ENABLE_HEALTHCHECKS=false
export SECOPS_ENABLE_AUTOBACKUP=false
pm2 restart embodied-dating-bot

# Manual backups still work via /security backup
```

---

## 📞 SUPPORT & MONITORING

### **Health Dashboard** (After Deployment)
```bash
# Check health status
# In Discord: /security audit

# Check system logs
tail -f logs/bot.log | grep HealthCheck

# Check backup directory
ls -lah backups/

# Check database table sizes
psql -c "SELECT 
  schemaname, tablename, 
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE tablename IN ('audit_log', 'user_warnings', 'user_moderation', 'rate_limit_violations', 'content_flags')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

---

### **Alert Thresholds** (Monitor These)

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| **Audit Log Size** | > 10K rows | > 50K rows | Archive old entries |
| **Content Flags** | > 10 unreviewed | > 50 unreviewed | Review queue |
| **Rate Violations** | > 5 flagged users | > 20 flagged | Investigate spam |
| **Backup File Size** | > 100 MB | > 500 MB | Consider retention policy |
| **Health Check Fails** | 2 consecutive | 5 consecutive | Investigate immediately |

---

## 🎯 FEATURE FLAGS (Quick Reference)

```env
# Disable all Phase 11 background jobs (dev/test)
SECOPS_ENABLE_HEALTHCHECKS=false
SECOPS_ENABLE_AUTOBACKUP=false
SECOPS_ENFORCE_MODERATION=false

# Enable monitoring only (staging)
SECOPS_ENABLE_HEALTHCHECKS=true
SECOPS_ENABLE_AUTOBACKUP=true
SECOPS_ENFORCE_MODERATION=false

# Full production mode
SECOPS_ENABLE_HEALTHCHECKS=true
SECOPS_ENABLE_AUTOBACKUP=true
SECOPS_ENFORCE_MODERATION=true
```

---

## 📝 POST-DEPLOYMENT VERIFICATION

### **Within 1 Hour of Production Deploy**:
- [ ] Health check logs appearing every 5 minutes
- [ ] `/security audit` command works
- [ ] Users can submit stats (no rate limit issues)
- [ ] No error spikes in logs
- [ ] Database connections stable

### **Next Morning (After 3 AM)**:
- [ ] Backup file created in `/backups`
- [ ] Backup file compressed (.gz)
- [ ] Old backups auto-deleted (if > 30 days)
- [ ] No backup errors in logs

### **Within 1 Week**:
- [ ] Review all content flags: `/security flags`
- [ ] Review audit log: `/security audit 100`
- [ ] Verify GDPR export works: `/security export-data @testuser`
- [ ] Check rate limit violations (should be minimal)

---

## 🛡️ SECURITY BEST PRACTICES

### **Admin Command Usage**:
```
✅ DO: Use /security warn for policy violations
✅ DO: Review /security flags daily
✅ DO: Export user data on request (/security export-data)
✅ DO: Run manual backups before major changes

❌ DON'T: Warn users without clear reason
❌ DON'T: Skip reviewing content flags
❌ DON'T: Ignore rate limit violations
❌ DON'T: Run backups during peak hours (use auto-backup)
```

---

## 📖 REFERENCE

### **Full Command List**:
- `/security warn @user <reason> [severity]`
- `/security warnings @user`
- `/security flags`
- `/security audit [limit]`
- `/security export-data @user`
- `/security backup`

### **Severity Levels**:
- `low` - Minor guideline violation
- `medium` - Clear policy breach
- `high` - Serious misconduct
- `critical` - Severe violation (harassment, threats)

### **Strike Thresholds**:
- **Strike 1**: Warning + DM
- **Strike 2**: Warning + 24h timeout (if enforcement ON)
- **Strike 3**: Permanent ban (if enforcement ON)
- **Reset**: 30-day rolling window

---

**Document Version**: 1.0  
**Last Updated**: October 7, 2025  
**Maintainer**: Apex Engineering Team

