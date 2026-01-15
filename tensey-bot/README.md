# Tensey Bot

Tensey social freedom challenges bot - integrates with Embodied Dating Bot v3

## Architecture

This bot operates as a **separate process** that shares the main bot's PostgreSQL database for XP tracking, while maintaining its own SQLite database for local progress tracking.

### Databases

- **PostgreSQL (Shared)**: Source of truth for user XP and Tensey completion counts
- **SQLite (Local)**: Tracks individual challenge completions and pending XP awards

### Integration Flow

1. User completes challenge → Saves to local SQLite
2. Pending XP award scheduled (60 second delay)
3. Background job processes award → Writes directly to shared PostgreSQL
4. Main bot leaderboard automatically reflects changes

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your bot token and database credentials
```

3. **Important**: Use the SAME database credentials as the main bot:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=embodied_dating_bot  # Same as main bot
DB_USER=botuser              # Same as main bot
DB_PASSWORD=your_password    # Same as main bot
```

4. Run the bot:
```bash
npm start        # Production
npm run dev      # Development (with nodemon)
```

## Commands

- `/tenseylist` - View your challenge checklist
- `/tenseyleaderboard` - View the leaderboard

## XP Flow

- **XP per challenge**: 100
- **Award delay**: 60 seconds (configurable via `XP_AWARD_DELAY_SECONDS`)
- **Stat column**: `social_freedom_exercises_tenseys`

## Background Jobs

- **Pending Awards Processor**: Runs every 10 seconds to award XP
- **Button Ensurer**: Runs every 4 hours to maintain UI buttons
- **Leaderboard Refresh**: Runs every 5 minutes to update leaderboard

## Features

- ✅ No XP lost on restart (pending awards persist in SQLite)
- ✅ Retry mechanism (up to 5 attempts for failed awards)
- ✅ Undo functionality (cancels pending awards or removes XP)
- ✅ Shared PostgreSQL database with main bot
- ✅ Fast local SQLite for UI operations

