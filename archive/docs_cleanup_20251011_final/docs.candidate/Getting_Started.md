# Getting Started

Complete setup guide for Embodied Dating Mastermind Bot v3.

## Prerequisites

- Node.js >= 18.0.0
- PostgreSQL database
- Discord bot token (from Discord Developer Portal)

## Installation

### 1. Install Dependencies

```bash
npm install
```

**Installs**:
- discord.js (v14)
- pg (PostgreSQL client)
- dotenv (environment loader)
- winston (logging)

---

### 2. Configure Environment

Create a `.env` file in the workspace root:

```bash
# Copy template
cp ENV_TEMPLATE.txt .env
```

Edit `.env` with your values:

```env
# Discord Configuration (REQUIRED)
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_id
DISCORD_GUILD_ID=your_server_id

# Database Configuration (REQUIRED)
DATABASE_URL=postgresql://user:password@host:port/database

# Channels (REQUIRED)
CHANNEL_GENERAL_ID=your_general_channel_id

# Admin (REQUIRED)
ADMIN_USER_ID=your_discord_user_id
```

See [Environment.md](./Environment.md) for complete variable reference.

**⚠️ IMPORTANT**: Do NOT commit `.env` to version control (contains secrets).

---

### 3. Set Up Database

**Run migrations** to create all database tables:

```bash
npm run migrate
```

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

See [Migrations.md](./Migrations.md) for details on migration system.

---

### 4. (Optional) Seed Data

**Seed course modules**:
```bash
npm run seed-course
```

**Seed texting scenarios**:
```bash
npm run seed-texting
```

---

### 5. Start the Bot

**Production mode**:
```bash
npm start
```

**Development mode** (with auto-restart):
```bash
npm run dev
```

**Expected startup logs**:
```
Environment validation passed
Starting Embodied Dating Mastermind Bot v3...
Registering event handlers...
✓ Event handlers registered
Bot login initiated...
Bot logged in as YourBot#1234
Serving 1 guild(s)
Repositories initialized
Initializing all services...
✓ All services initialized
Services initialized
18 commands loaded
Successfully registered 18 commands
Bot is ready and operational
✅ Bot is fully operational
```

---

## Verification

### Check Bot is Online

1. Open Discord
2. Bot should appear online in your server
3. Type `/` and verify commands appear (submit-stats, leaderboard, admin, etc.)

### Test a Command

```
/help
```

Should display the onboarding chatbot help system.

---

## Troubleshooting

### "Missing required environment variables"

**Cause**: `.env` file missing or incomplete

**Fix**: Verify `.env` contains all 6 required variables (see [Environment.md](./Environment.md))

---

### "Database connection failed"

**Cause**: Incorrect `DATABASE_URL` or PostgreSQL not running

**Fix**: 
1. Verify PostgreSQL is running
2. Test connection: `psql -U user -d database -h host -p port`
3. Check `DATABASE_URL` format: `postgresql://user:password@host:port/database`

---

### "Relation 'users' does not exist"

**Cause**: Migrations not run or 000_initial_schema.sql incomplete

**Fix**: 
1. Verify `src/database/migrations/000_initial_schema.sql` contains CREATE TABLE statements (not comments)
2. Run: `npm run migrate`

---

### "Cannot find module 'X'"

**Cause**: Dependencies not installed

**Fix**: Run `npm install`

---

## Next Steps

- See [Commands.md](./Commands.md) for available commands
- See [Architecture.md](./Architecture.md) for system design
- See [Deployment.md](./Deployment.md) for production deployment

