# M1: LOCAL FOUNDATION
**Embodied Dating Mastermind Bot v3 - Milestone 1**

═══════════════════════════════════════════════════════════════════════════════

## OBJECTIVE

Establish a working local development environment with database connectivity, environment configuration, and successful bot authentication to Discord. Bot must log in, initialize repositories and services, and register commands without errors.

**Binary Definition of Done**: Bot starts, logs `Bot is ready and operational`, all 14 migrations run, ~18 commands register.

═══════════════════════════════════════════════════════════════════════════════

## GATES & OWNERSHIP

| Field | Value |
|-------|-------|
| **Owner** | Developer |
| **Reviewer** | Technical Lead |
| **Due** | Day 1 |
| **Dependencies** | PostgreSQL instance, Discord bot token |

═══════════════════════════════════════════════════════════════════════════════

## ENTRY CRITERIA

- [ ] PostgreSQL 14+ installed and running (`psql --version`)
- [ ] Node.js >=18.0.0 installed (`node --version`)
- [ ] Discord bot created in Discord Developer Portal (token available)
- [ ] Repository cloned to local machine (verified: `package.json` exists)
- [ ] No `.env` file exists yet (clean slate)

═══════════════════════════════════════════════════════════════════════════════

## TASKS

### Task 1.1: Install Dependencies

```bash
npm install
```

**Expected**: `added X packages` (where X ≥ 4: discord.js, dotenv, pg, winston)

**Derived from**: `package.json` lines 24-28

---

### Task 1.2: Create Database

```bash
createdb embodied_dating_bot
# OR: psql -c "CREATE DATABASE embodied_dating_bot;"
```

**Expected**: Database `embodied_dating_bot` created (verify: `psql -l | grep embodied_dating_bot`)

**Derived from**: Standard PostgreSQL naming convention for `DATABASE_URL`

---

### Task 1.3: Create .env File

```bash
# Copy template
cp ENV_TEMPLATE.txt .env
```

**Then manually edit `.env` to fill in real values**:
```
DISCORD_TOKEN=<your-bot-token>
DISCORD_CLIENT_ID=<your-application-id>
DISCORD_GUILD_ID=<your-server-id>
DATABASE_URL=postgresql://botuser:password@localhost:5432/embodied_dating_bot
CHANNEL_GENERAL_ID=<channel-id>
ADMIN_USER_ID=<your-discord-user-id>
```

**Required ENV vars derived from**: `src/config/environment.js` lines 10-16

**Verify**:
```bash
cat .env | grep -E "DISCORD_TOKEN|DATABASE_URL"
```

**Expected**: Lines present (values redacted from evidence)

---

### Task 1.4: Run Database Migrations

```bash
npm run migrate
```

**Expected output substrings** (from `src/database/runMigrations.js` lines 20-43):
- `Starting database migrations...`
- `Found 14 migration files`
- `Running migration: 000_initial_schema.sql`
- `✓ 000_initial_schema.sql completed`
- `Running migration: 015_add_automation_logging.sql`
- `✓ 015_add_automation_logging.sql completed`
- `✅ All migrations completed successfully`

**Migrations derived from**: `src/database/migrations/` directory listing (14 .sql files)

**Verify tables created**:
```bash
psql embodied_dating_bot -c "\dt" | grep -E "users|daily_records|users_stats"
```

**Expected**: 3 core tables exist

---

### Task 1.5: Verify Bot Candidate File Ready

```bash
ls -la bot-v3.candidate.js
```

**Expected**: File exists (staged entry point)

**Derived from**: `glob_file_search` result

---

### Task 1.6: Create .gitignore (Prevent Secret Leaks)

```bash
cat > .gitignore << 'EOF'
# Environment secrets
.env
.env.*
!.env.example

# Dependencies
node_modules/

# Logs
logs/
*.log
npm-debug.log*

# Backups
backups/
*.sql.gz

# Temporary
tmp/
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
EOF
```

**Verify**:
```bash
git status .env
```

**Expected**: `No matches found` or `.env` shown as ignored (not untracked)

═══════════════════════════════════════════════════════════════════════════════

## BINARY CHECKLIST

| # | Item | Command to Run | Expected Substring (grep) | Evidence to Attach |
|---|------|-----------------|---------------------------|--------------------|
| 1.1 | Dependencies installed | `npm install` | `added` | `evidence/M1/npm-install.txt` |
| 1.2 | Database created | `psql -l \| grep embodied_dating_bot` | `embodied_dating_bot` | `evidence/M1/psql-list.txt` |
| 1.3 | .env file created | `ls .env` | `.env` | (redacted, confirm file exists) |
| 1.4 | 6 required ENV vars set | `cat .env \| grep -cE "DISCORD_TOKEN\|DISCORD_CLIENT_ID\|DISCORD_GUILD_ID\|DATABASE_URL\|CHANNEL_GENERAL_ID\|ADMIN_USER_ID"` | `6` | (redacted, confirm count) |
| 1.5 | Migrations run successfully | `npm run migrate 2>&1 \| grep "All migrations"` | `✅ All migrations completed successfully` | `evidence/M1/migrations.txt` |
| 1.6 | Core tables exist | `psql embodied_dating_bot -c "\\dt" \| grep -cE "users\|daily_records\|users_stats"` | `3` | `evidence/M1/tables.txt` |
| 1.7 | .gitignore protects .env | `git check-ignore .env` | `.env` | `evidence/M1/gitignore-check.txt` |
| 1.8 | Node version check | `node --version` | `v18` or higher | `evidence/M1/node-version.txt` |

═══════════════════════════════════════════════════════════════════════════════

## ACCEPTANCE CRITERIA (ALL MUST BE TRUE)

- [x] **AC1.1**: `npm install` completes without errors (exit code 0)
- [x] **AC1.2**: PostgreSQL database `embodied_dating_bot` exists
- [x] **AC1.3**: `.env` file exists with 6 required variables (DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID, DATABASE_URL, CHANNEL_GENERAL_ID, ADMIN_USER_ID)
- [x] **AC1.4**: `npm run migrate` logs `✅ All migrations completed successfully`
- [x] **AC1.5**: Database contains at minimum: `users`, `users_stats`, `daily_records` tables (verify: `\dt` in psql)
- [x] **AC1.6**: `.gitignore` file exists and includes `.env` (verify: `git check-ignore .env` returns `.env`)
- [x] **AC1.7**: `bot-v3.candidate.js` file exists (entry point staged)
- [x] **AC1.8**: No migration errors logged (check for `Migration failed` substring - must be absent)

═══════════════════════════════════════════════════════════════════════════════

## ROLLBACK PROCEDURE

If any acceptance criteria fail:

```bash
# 1. Drop database (safe - no production data yet)
dropdb embodied_dating_bot

# 2. Remove .env (contains test values)
rm .env

# 3. Remove node_modules (if corrupted)
rm -rf node_modules package-lock.json
npm install

# 4. Start fresh from Task 1.2
```

**Data Loss**: None (local setup only, no user data exists yet)

═══════════════════════════════════════════════════════════════════════════════

## SIGN-OFF

| Role | Name | Date | Signature (Initials) |
|------|------|------|---------------------|
| Developer | | | ☐ |
| Reviewer | | | ☐ |

**Promotion Gate to M2**: All 8 checklist items pass ✅

═══════════════════════════════════════════════════════════════════════════════

## RISKS & NOTES

**Risk**: PostgreSQL connection refused
- **Mitigation**: Verify `DATABASE_URL` credentials match actual PostgreSQL user/password
- **Test**: `psql <DATABASE_URL>` should connect

**Risk**: Discord token invalid
- **Mitigation**: Regenerate token in Discord Developer Portal if needed
- **Test**: Token starts with `M` (bot token), `N` (user token), or `O` (OAuth token)

**Risk**: Migration 000_initial_schema.sql missing executable SQL
- **Status**: RESOLVED (schema promoted with CREATE TABLE statements)
- **Verify**: `cat src/database/migrations/000_initial_schema.sql | grep "CREATE TABLE"` returns 3+ lines

**Note**: Entry point is `bot-v3.candidate.js` (staged), not yet `bot-v3.js`. Promotion happens in M4.

**Derived Facts**:
- Required ENV vars: `src/config/environment.js:10-16`
- Migrations: `src/database/migrations/` (14 .sql files)
- Package scripts: `package.json:6-13`

═══════════════════════════════════════════════════════════════════════════════
**END M1**

