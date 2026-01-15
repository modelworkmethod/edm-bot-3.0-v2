# Embodied Dating Mastermind Bot v3

Gamified dating improvement Discord bot with XP system, raids, duels, course hosting, and auto-engagement tracking.

## Quick Links

- [Getting Started](./docs/Getting_Started.md) - Installation and setup
- [Architecture](./docs/Architecture.md) - System design and components
- [Commands](./docs/Commands.md) - Available Discord commands
- [Environment](./docs/Environment.md) - Configuration variables
- [Migrations](./docs/Migrations.md) - Database setup
- [Tensey Bot Integration](./docs/Tensey_Bot_Integration.md) - Separate Tensey challenge bot
- [Deployment](./docs/Deployment.md) - Production deployment guide

## Features

### Core Systems
- **XP & Leveling** - Experience points with level progression
- **Archetype System** - Warrior/Mage/Templar classifications
- **Stats Tracking** - Daily stat submissions with multipliers
- **Leaderboard** - XP rankings and faction standings

### Advanced Features
- **Boss Raids** - Time-limited community events
- **Barbie List** - Contact manager with AI-generated openers
- **Texting Simulator** - Practice scenarios with scoring
- **Dueling System** - Player-vs-player XP battles
- **Double XP Events** - Scheduled XP multipliers
- **CTJ Analysis** - Confidence Tension Journal with breakthrough detection
- **Course Housing** - 7-module course system with progress tracking
- **Chat Engagement** - Auto-XP for activity and wins

### Operations
- **Security** - Rate limiting, permissions, content moderation
- **Moderation** - 3-strike warning system
- **Analytics** - Risk scoring, pattern detection, coaching interventions
- **Backups** - Automated daily database backups
- **Health Monitoring** - System health checks

## Architecture

**Initialization Model**: Option A (ready.js orchestrates)
- Entry point: `bot-v3.js` (client creation, event registration, login)
- Orchestrator: `src/events/ready.js` (initializes repos, services, commands)
- Services: 40+ services initialized automatically
- Commands: 18 commands registered (see [Commands.md](./docs/Commands.md))

## Technology Stack

- **Runtime**: Node.js >= 18.0.0
- **Framework**: Discord.js v14
- **Database**: PostgreSQL (shared with Tensey Bot)
- **Logging**: Winston

## Current Status

- ✅ Core systems: Complete (Phases 1-12)
- ✅ Commands: 18 commands registered
- ✅ Security: Phase 11 integrated (audit, warnings, backups)
- ⚠️ Schema: Executable SQL ready (000_initial_schema.sql promoted)
- ⏳ Deployment: Awaiting .env file creation

## Related Projects

- **Tensey Bot** - Separate process for social freedom challenges (see [Tensey_Bot_Integration.md](./docs/Tensey_Bot_Integration.md))

