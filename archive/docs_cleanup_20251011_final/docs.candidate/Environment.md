# Environment Variables

Configuration reference for Embodied Dating Mastermind Bot v3.

**Source**: `src/config/environment.js`, `src/config/settings.js`

═══════════════════════════════════════════════════════════════════════════════

## REQUIRED Variables

Bot will NOT start without these (validated in `src/config/environment.js:10-17`):

```env
# Discord Configuration
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id
DISCORD_GUILD_ID=your_server_id

# Database Configuration
DATABASE_URL=postgresql://user:password@host:port/database

# Channels
CHANNEL_GENERAL_ID=your_general_channel_id

# Admin
ADMIN_USER_ID=your_discord_user_id
```

═══════════════════════════════════════════════════════════════════════════════

## RECOMMENDED Variables

Bot will start but warn if these are missing (from `src/config/environment.js:20-25`):

```env
# Additional Channels
CHANNEL_INPUT_ID=stats_input_channel_id
CHANNEL_LEADERBOARD_ID=leaderboard_channel_id
CHANNEL_SCORECARD_ID=scorecard_channel_id
JOURNAL_CHANNEL_ID=ctj_journal_channel_id
```

═══════════════════════════════════════════════════════════════════════════════

## OPTIONAL Variables (With Defaults)

### Database Credentials (Alternative to DATABASE_URL)

If `DATABASE_URL` is not set, use individual credentials:

```env
DATABASE_HOST=localhost               # Default: from DATABASE_URL
DATABASE_PORT=5432                    # Default: 25060
DATABASE_NAME=embodied_dating_bot     # Default: 'defaultdb'
DATABASE_USER=botuser                 # Default: from DATABASE_URL
DATABASE_PASSWORD=your_password       # Default: from DATABASE_URL
DATABASE_SSL=true                     # Default: true
CA_CERT_PATH=path/to/cert.pem         # Default: none
```

**Source**: `src/config/settings.js:33-40`

---

### XP Configuration

```env
XP_BASE_AMOUNT=300                    # Default: 300
XP_PER_LEVEL=50                       # Default: 50
```

**Source**: `src/config/settings.js:56-57`

---

### Features

```env
ENABLE_NICKNAME_SYNC=true             # Default: true
SEND_WELCOME_DM=true                  # Default: true
SEND_WELCOME_IN_GENERAL=true          # Default: true
```

**Source**: `src/config/settings.js:71-73`

---

### Announcements

```env
NIGHTLY_REMINDER_ENABLED=true         # Default: true
NIGHTLY_REMINDER_HOUR_ET=21           # Default: 21 (9 PM Eastern)
FACTION_ANNOUNCEMENTS_ENABLED=true    # Default: true
ARCHETYPE_ANNOUNCEMENTS_ENABLED=true  # Default: true
LEVEL_UP_ANNOUNCEMENTS_ENABLED=true   # Default: true
```

**Source**: `src/config/settings.js:78-82`

---

### Branding

```env
BRAND_COLOR_HEX=FF1E27                # Default: FF1E27 (red)
BRAND_LOGO_URL=https://...            # Default: none
FREE_EVENT_BANNER_URL=https://...     # Default: none
```

**Source**: `src/config/settings.js:88-90`

---

### Advanced

```env
TIMEZONE=America/New_York             # Default: America/New_York
RANK_SAMPLE_SIZE=60                   # Default: 60
FREE_EVENT_LEVEL=60                   # Default: 60
BOSS_START_HOUR=20                    # Default: 20 (8 PM)
BOSS_DURATION_MINUTES=120             # Default: 120 (2 hours)
```

**Source**: `src/config/settings.js:95-99`

═══════════════════════════════════════════════════════════════════════════════

## Phase 11: Security & Operations (OPTIONAL)

```env
# Health Monitoring
SECOPS_ENABLE_HEALTHCHECKS=false      # Default: false (disabled)
SECOPS_HEALTHCHECK_INTERVAL_MIN=5     # Default: 5 minutes

# Automated Backups
SECOPS_ENABLE_AUTOBACKUP=false        # Default: false (disabled)

# Moderation Enforcement
SECOPS_ENFORCE_MODERATION=false       # Default: false (safe mode)
```

**Source**: `src/services/index.js:170-177`, `src/services/security/WarningSystem.js:92`

**Behavior**:
- `SECOPS_ENABLE_HEALTHCHECKS=false` - No background health checks (quiet dev mode)
- `SECOPS_ENABLE_HEALTHCHECKS=true` - Health checks every 5 minutes (staging/prod)
- `SECOPS_ENFORCE_MODERATION=false` - Warnings logged but no bans/timeouts (dev/staging)
- `SECOPS_ENFORCE_MODERATION=true` - Full enforcement: Strike 2 = timeout, Strike 3 = ban (prod only)

See `README_PHASE11_ROLLOUT.md` for Phase 11 deployment details.

═══════════════════════════════════════════════════════════════════════════════

## Tensey Bot Variables (SEPARATE APP)

**Note**: Tensey Bot has its own `.env` file in `tensey-bot/` directory.

**⚠️ CRITICAL**: Tensey Bot PostgreSQL credentials MUST MATCH main bot:

```env
# Main Bot .env:
DATABASE_URL=postgresql://user:pass@host:port/embodied_dating_bot

# Tensey Bot .env:
DB_HOST=host          # ← MUST MATCH main bot
DB_PORT=port          # ← MUST MATCH main bot
DB_NAME=embodied_dating_bot  # ← MUST MATCH main bot
DB_USER=user          # ← MUST MATCH main bot
DB_PASSWORD=pass      # ← MUST MATCH main bot
```

Both bots write to the same PostgreSQL database for XP sync.

═══════════════════════════════════════════════════════════════════════════════

## Environment Template

**File**: `ENV_TEMPLATE.txt` (workspace root)

**Usage**:
```bash
cp ENV_TEMPLATE.txt .env
# Edit .env with real values
```

**Minimum viable .env**:
```env
DISCORD_TOKEN=your_token
DISCORD_CLIENT_ID=your_app_id
DISCORD_GUILD_ID=your_server_id
DATABASE_URL=postgresql://user:pass@localhost:5432/embodied_dating_bot
CHANNEL_GENERAL_ID=channel_id
ADMIN_USER_ID=your_discord_id
```

**⚠️ DO NOT COMMIT** `.env` to version control (contains secrets).

═══════════════════════════════════════════════════════════════════════════════

## Validation

Environment validation runs automatically on bot startup (`src/config/environment.js:31-58`).

**Success**:
```
Environment validation passed
```

**Failure** (example):
```
Missing required environment variables:
   - DISCORD_TOKEN
   - DATABASE_URL
Check your .env file and ensure all required variables are set.
```

**Warnings** (non-fatal):
```
Missing recommended environment variables:
   - CHANNEL_INPUT_ID
   - CHANNEL_LEADERBOARD_ID
```

