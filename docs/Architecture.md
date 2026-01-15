# Architecture

System design and component overview for Embodied Dating Mastermind Bot v3.

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                      EMBODIED DATING MASTERMIND                       │
│                         (Main Bot Process)                            │
├──────────────────────────────────────────────────────────────────────┤
│  Entry Point: bot-v3.js                                              │
│    ↓                                                                  │
│  Event Registration (src/events/index.js)                            │
│    ↓                                                                  │
│  Ready Event (src/events/ready.js) ← ORCHESTRATOR                    │
│    ├─> Initialize Repositories (UserRepository, StatsRepository)     │
│    ├─> Initialize Services (40+ services)                            │
│    ├─> Load Commands (18 commands)                                   │
│    ├─> Register Commands (Discord API)                               │
│    └─> Set Presence                                                  │
└──────────────────────────────────────────────────────────────────────┘
                                 │
                                 ↓
                    ┌────────────────────────┐
                    │  POSTGRESQL DATABASE   │
                    │  (Shared with Tensey)  │
                    └────────────────────────┘
                                 │
                                 ↑
┌──────────────────────────────────────────────────────────────────────┐
│                          TENSEY BOT                                   │
│                     (Separate Bot Process)                            │
├──────────────────────────────────────────────────────────────────────┤
│  Entry Point: tensey-bot/bot.js                                      │
│    ↓                                                                  │
│  SQLite (Local Progress Tracking)                                    │
│    ↓                                                                  │
│  Background Jobs (Every 10s: Award pending XP)                       │
│    ↓                                                                  │
│  PostgreSQL Write (users.xp, users.social_freedom_exercises_tenseys) │
└──────────────────────────────────────────────────────────────────────┘
```

## Initialization Model: Option A

**Option A** (Current): ready.js orchestrates all initialization

**Entry Point** (`bot-v3.js`):
1. Load environment (dotenv)
2. Create Discord client
3. Register event handlers
4. Login to Discord
5. Start scheduled jobs (after ready event)
6. Graceful shutdown handlers

**Orchestrator** (`src/events/ready.js`):
1. Initialize repositories
2. Initialize services (40+ services)
3. Store services on client
4. Load commands
5. Register commands with Discord
6. Set bot presence

**Benefit**: Clean separation - entry point is minimal, ready.js handles complexity

## Directory Structure

```
src/
├── config/           # Environment, constants, settings
├── database/         # PostgreSQL connection, migrations, repositories
├── services/         # Business logic (40+ service files)
│   ├── xp/          # XP calculation, multipliers, secondary XP
│   ├── user/        # User management, archetypes
│   ├── stats/       # Stats processing
│   ├── discord/     # Channel, message, role services
│   ├── notifications/ # Reminders, announcements
│   ├── tensey/      # Tensey backend (separate from Tensey Bot)
│   ├── raids/       # Boss raid events
│   ├── barbie/      # Contact list management
│   ├── onboarding/  # AI-powered help
│   ├── texting/     # Texting simulator
│   ├── duels/       # Player duels
│   ├── events/      # Double XP events
│   ├── ctj/         # CTJ analysis
│   ├── engagement/  # Chat engagement, wins tracking
│   ├── course/      # Course housing
│   ├── analytics/   # Chart generation, risk scoring, patterns
│   ├── security/    # Audit, moderation, warnings
│   ├── backup/      # Database backups
│   ├── monitoring/  # Health checks, automation logging
│   └── compliance/  # GDPR export
├── commands/         # Slash commands (18 commands in 7 groups)
├── events/           # Discord event handlers (ready, interaction, message, memberAdd)
├── middleware/       # Rate limiting, permissions, input validation
├── utils/            # Logger, error handler, validator, time utils
└── ai/webhooks/      # Zapier webhooks (sales calls, coaching sessions)

tensey-bot/           # Separate Tensey Bot application
├── bot.js            # Tensey Bot entry point
├── src/              # Tensey Bot source (40 files)
└── data/             # SQLite database (local progress tracking)
```

## Component Layers

### Layer 1: Configuration
- `src/config/environment.js` - Env validation
- `src/config/constants.js` - Game constants (XP, levels, factions)
- `src/config/settings.js` - Unified config object
- `src/config/discord.js` - Discord client options

### Layer 2: Database
- `src/database/postgres.js` - Connection pool, query wrappers
- `src/database/repositories/` - Data access (User, Stats, Tensey)
- `src/database/migrations/` - 14 SQL migration files

### Layer 3: Services (40+ services)
- **Core**: XP, User, Stats, Archetype
- **Discord**: Channel, Message, Role
- **Features**: Raids, Barbie, Texting, Duels, Course, CTJ
- **Security**: Rate Limiter, Permissions, Content Moderation, Warnings
- **Operations**: Backups, Health Checks, Audit Logging
- **Analytics**: Risk Scoring, Pattern Detection, Interventions

### Layer 4: Commands & Events
- **Commands**: 18 slash commands across 7 groups
- **Events**: ready, interactionCreate, messageCreate, guildMemberAdd
- **Handlers**: Command, button, modal handlers with security middleware

## Database Architecture

**PostgreSQL Tables** (14 migrations):
- Core: `users`, `users_stats`, `daily_records`
- Tensey: `tensey_completions`, `tensey_ledger`
- Features: `raid_events`, `barbie_list`, `texting_scenarios`, `duels`, `course_modules`
- Analytics: `ctj_entries`, `secondary_xp_log`
- Security: `audit_log`, `user_warnings`, `user_moderation`
- Operations: `automation_logs`, `webhook_requests`

## Tensey Bot Integration

**Architecture**: Separate process sharing PostgreSQL

- **Main Bot**: Manages XP, leaderboards, stats
- **Tensey Bot**: Manages 303 social freedom challenges
- **Integration**: Direct database writes (no API)
- **Columns Used**: `users.xp`, `users.social_freedom_exercises_tenseys`
- **Main Bot Changes**: ZERO (XP syncs via shared database)

See [Tensey_Bot_Integration.md](./Tensey_Bot_Integration.md) for details.

## Development

### Commands
- `npm start` - Start bot (production)
- `npm run dev` - Start bot (development, auto-restart)
- `npm run migrate` - Run database migrations
- `npm run seed-course` - Seed course modules
- `npm run seed-texting` - Seed texting scenarios

### Key Files
- `bot-v3.js` - Main entry point
- `src/events/ready.js` - Initialization orchestrator
- `src/services/index.js` - Service initializer (40+ services)
- `src/commands/index.js` - Command aggregator

## Phase Integration

**Completed Phases**: 12 phases integrated
- Phase 1: Config layer
- Phase 2: Core services
- Phase 3: Commands & events
- Phase 3.5: Supplementary features
- Phase 4: Advanced features
- Phase 5: XP expansions
- Phase 6: CTJ analysis
- Phase 6.5: Auto XP engine
- Phase 7: Course system
- Phase 8: Client analytics (partial)
- Phase 10: Predictive coaching analytics
- Phase 11: Security & operations
- Phase 12: AI client brain (partial)

**Note**: Phase numbering changed during development (original Phase 9 → Phase 11, Phase 12 → Phase 10).

See [Phases_Map.md](./Phases_Map.md) for detailed phase breakdown.

