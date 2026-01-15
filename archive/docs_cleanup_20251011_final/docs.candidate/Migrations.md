# Database Migrations

Database migration system for Embodied Dating Mastermind Bot v3.

## Migration System

**Runner**: `src/database/runMigrations.js`  
**Location**: `src/database/migrations/`  
**Format**: SQL files (`.sql`)  
**Execution**: Alphabetical order  

═══════════════════════════════════════════════════════════════════════════════

## Running Migrations

### Command

```bash
npm run migrate
```

**What it does**:
1. Connects to PostgreSQL (using DATABASE_URL from .env)
2. Reads all `.sql` files from `src/database/migrations/`
3. Sorts alphabetically
4. Executes each migration in sequence
5. Logs progress
6. Closes database connection

**Expected output**:
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

---

### Manual Execution

Alternatively, run migrations manually:

```bash
for migration in src/database/migrations/*.sql; do
  psql -U $DB_USER -d $DB_NAME -f $migration
done
```

═══════════════════════════════════════════════════════════════════════════════

## Migration Sequence

**Total Migrations**: 14 SQL files

| # | Filename | Tables Created | Phase |
|---|----------|----------------|-------|
| 000 | `000_initial_schema.sql` | users, users_stats, daily_records | Core |
| 001 | `001_add_tensey_tables.sql` | tensey_completions, tensey_ledger | Phase 1 |
| 002 | `002_add_raid_system.sql` | raid_events, raid_contributions | Phase 4 |
| 003 | `003_add_barbie_list.sql` | barbie_list, barbie_interactions | Phase 4 |
| 004 | `004_add_texting_simulator.sql` | texting_scenarios, texting_attempts, texting_messages | Phase 4 |
| 005 | `005_add_secondary_xp_system.sql` | secondary_xp_log, active_multiplier_boosts | Phase 5 |
| 006 | `006_add_dueling_system.sql` | duels, duel_stats | Phase 5 |
| 007 | `007_add_double_xp_events.sql` | double_xp_events, double_xp_notifications | Phase 5 |
| 008 | `008_add_ctj_analysis.sql` | ctj_entries, ctj_analysis, breakthrough_posts | Phase 6 |
| 009 | `009_add_course_system.sql` | course_modules, course_videos, user_module_progress, user_video_progress, course_questions | Phase 7 |
| 010 | `010_add_security_audit.sql` | audit_log, user_warnings, user_moderation, rate_limit_violations, content_flags | Phase 11 |
| 011 | `011_add_coaching_analytics.sql` | (analytics tables) | Phase 10 |
| 012 | `012_analytics_tracking.sql` | (tracking tables) | Phase 8 |
| 015 | `015_add_automation_logging.sql` | automation_logs, airtable_sync_cache, webhook_requests | Phase 12 |

**Gaps**: Migrations 013 and 014 are missing from the sequence (may be intentional).

═══════════════════════════════════════════════════════════════════════════════

## Core Tables (000_initial_schema.sql)

### users
**Purpose**: User profiles, XP, factions, archetypes

**Columns**:
- `user_id` VARCHAR(255) PRIMARY KEY
- `xp` INTEGER DEFAULT 0
- `level` INTEGER DEFAULT 1
- `faction` VARCHAR(50)
- `archetype` VARCHAR(50)
- `created_at` TIMESTAMP DEFAULT NOW()
- `updated_at` TIMESTAMP DEFAULT NOW()

**Note**: Migration 001 adds `social_freedom_exercises_tenseys` column (Tensey integration)

---

### users_stats
**Purpose**: Individual stat tracking (approaches, dates, gym sessions, etc.)

**Columns**:
- `user_id` VARCHAR(255) REFERENCES users(user_id)
- `stat_name` VARCHAR(100) NOT NULL
- `total_count` INTEGER DEFAULT 0
- `created_at` TIMESTAMP DEFAULT NOW()
- `updated_at` TIMESTAMP DEFAULT NOW()

**Primary Key**: (user_id, stat_name)

---

### daily_records
**Purpose**: Daily stat submissions for streak tracking

**Columns**:
- `user_id` VARCHAR(255) REFERENCES users(user_id)
- `date` DATE NOT NULL
- `stat_name` VARCHAR(100) NOT NULL
- `count` INTEGER DEFAULT 0
- `created_at` TIMESTAMP DEFAULT NOW()

**Primary Key**: (user_id, date, stat_name)

═══════════════════════════════════════════════════════════════════════════════

## Migration Safety

**Idempotent**: All migrations use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`

**No Destructive Operations**: No DROP, ALTER (data loss), or TRUNCATE statements

**Transaction Wrapped**: 000_initial_schema.sql uses BEGIN/COMMIT

**Rollback**: Migrations create tables but do not modify existing data

═══════════════════════════════════════════════════════════════════════════════

## Troubleshooting

### "Relation 'users' does not exist"

**Cause**: Migrations not run or 000_initial_schema.sql incomplete

**Fix**:
1. Verify `src/database/migrations/000_initial_schema.sql` contains CREATE TABLE statements (not comments)
2. Run: `npm run migrate`

---

### "Missing required environment variable: DATABASE_URL"

**Cause**: .env file missing or DATABASE_URL not set

**Fix**: Create `.env` with DATABASE_URL (see [Environment.md](./Environment.md))

---

### "Migration failed"

**Cause**: SQL syntax error or database connection failed

**Fix**:
1. Check migration runner logs for specific error
2. Verify PostgreSQL is running
3. Test connection manually: `psql -U user -d database`
4. Check migration file for syntax errors

═══════════════════════════════════════════════════════════════════════════════

## Migration Tracker

**Note**: Current migration runner does NOT track which migrations have been applied.

**Behavior**: All migrations use `IF NOT EXISTS` so safe to re-run.

**Future Enhancement**: Add migrations table to track applied migrations and prevent re-runs.

