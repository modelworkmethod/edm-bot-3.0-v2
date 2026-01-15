# M2: CORE FEATURES VALIDATION
**Embodied Dating Mastermind Bot v3 - Milestone 2**

═══════════════════════════════════════════════════════════════════════════════

## OBJECTIVE

Validate that the bot starts successfully, connects to Discord, initializes all services, registers commands, and core gameplay loops function end-to-end (stats submission, XP calculation, leaderboards, roles, raids).

**Binary Definition of Done**: Bot logs `Bot is ready and operational`, responds to `/leaderboard`, `/scorecard`, `/submit-stats`, raid commands, and awards XP correctly with all multipliers applied.

═══════════════════════════════════════════════════════════════════════════════

## GATES & OWNERSHIP

| Field | Value |
|-------|-------|
| **Owner** | Developer + QA |
| **Reviewer** | Product Owner |
| **Due** | Day 2-3 |
| **Dependencies** | M1 complete (database + .env configured) |

═══════════════════════════════════════════════════════════════════════════════

## ENTRY CRITERIA

- [x] **M1 Complete**: All M1 acceptance criteria pass
- [x] Database tables exist (14 migrations run)
- [x] `.env` file configured with valid Discord token
- [x] Bot invited to test Discord server with admin permissions
- [x] At least 2 test users in the server (for leaderboard, duels, comparison)

═══════════════════════════════════════════════════════════════════════════════

## TASKS

### Task 2.1: Start Bot and Verify Logs

```bash
npm run dev
```

**Expected log substrings** (from `src/events/ready.js` lines 24-55):
- `Bot logged in as <BotName>#<discriminator>`
- `Serving 1 guild(s)`
- `Repositories initialized`
- `Services initialized`
- `commands loaded` (should show ~18 commands)
- `Bot is ready and operational`

**Verify services initialized** (from `src/services/index.js`):
```bash
npm run dev 2>&1 | grep "Services initialized"
```

**Expected**: `Services initialized` logged

**Keep bot running for remaining tasks.**

---

### Task 2.2: Verify Commands Registered with Discord

**In Discord test server**:
1. Type `/` in any channel
2. Verify bot commands appear in autocomplete

**Commands to verify** (from `src/commands/index.js` lines 7-13):
- `/submit-stats`
- `/scorecard`
- `/submit-past-stats`
- `/leaderboard`
- `/faction-stats`
- `/barbie`
- `/course`
- `/help`
- `/raid-status`
- `/admin` (admin-only commands)

**Screenshot**: Command autocomplete showing bot commands

**Expected count**: ~18 commands registered

**Check log** for:
```bash
npm run dev 2>&1 | grep "commands loaded"
```

**Expected substring**: `18 commands loaded` (or similar count)

---

### Task 2.3: Test Stats Submission (Core Gameplay Loop)

**In Discord #general channel** (or configured INPUT channel):

1. Run: `/submit-stats`
2. Fill modal with test data:
   - Approaches: 5
   - Dates Had: 1
   - Gym Days: 1
   - SBMM Meditation: 1
   - Overall State Today: 7
3. Submit

**Expected**:
- Bot replies with confirmation (ephemeral or public)
- XP awarded (check database)

**Database verification**:
```bash
psql embodied_dating_bot -c "SELECT user_id, xp, level FROM users LIMIT 5;"
```

**Expected**: User row exists with `xp > 0`

**Screenshot**: Stats submission confirmation message

---

### Task 2.4: Test Scorecard Display

**In Discord**:

Run: `/scorecard`

**Expected**:
- Embed displays user's stats
- Shows: Level, XP, Rank, Archetype, Faction
- Lists all stats submitted so far
- No errors

**Screenshot**: Scorecard embed

**Derived from**: `src/commands/stats/scorecard.js`

---

### Task 2.5: Test Leaderboard

**In Discord**:

Run: `/leaderboard`

**Expected**:
- Embed shows top users by XP
- User who submitted stats appears in leaderboard
- Ranking correct (highest XP first)

**Screenshot**: Leaderboard embed

**Database verification**:
```bash
psql embodied_dating_bot -c "SELECT user_id, xp, level FROM users ORDER BY xp DESC LIMIT 10;"
```

**Expected**: Results match leaderboard display

**Derived from**: `src/commands/leaderboard/leaderboard.js`

---

### Task 2.6: Test Faction Stats

**In Discord**:

Run: `/faction-stats`

**Expected**:
- Embed shows faction XP totals (Warrior/Mage/Templar)
- User counts per faction
- No errors

**Screenshot**: Faction stats embed

**Derived from**: `src/commands/leaderboard/faction-stats.js`

---

### Task 2.7: Test Admin Raid Start

**In Discord** (as admin user):

Run: `/start-raid type:Warrior duration:60`

**Expected**:
- Raid event created
- Announcement posted to #general
- Raid boss HP bar displayed

**Then verify raid status**:

Run: `/raid-status`

**Expected**:
- Shows active raid progress
- Boss HP, time remaining, top contributors

**Screenshot**: Raid announcement + raid status embed

**Database verification**:
```bash
psql embodied_dating_bot -c "SELECT * FROM raid_events WHERE status='ACTIVE' LIMIT 1;"
```

**Expected**: Active raid row exists

**Derived from**: `src/commands/admin/start-raid.js`, `src/commands/raids/raid-status.js`

---

### Task 2.8: Test Barbie List

**In Discord**:

Run: `/barbie add`

**Fill modal**:
- Name: Test Contact
- Notes: Met at coffee shop

**Expected**:
- Contact added
- XP awarded (secondary XP for barbie list)

**Then verify list**:

Run: `/barbie list`

**Expected**: Shows added contact

**Screenshot**: Barbie list embed

**Derived from**: `src/commands/barbie/barbie.js`, `src/services/barbie/BarbieListManager.js`

---

### Task 2.9: Test Course Module

**In Discord**:

Run: `/course`

**Expected**:
- Embed shows available modules
- Module 1 unlocked by default
- Can start module

**Screenshot**: Course modules embed

**Database verification**:
```bash
psql embodied_dating_bot -c "SELECT * FROM course_modules LIMIT 3;"
```

**Expected**: Modules exist (may need seeding first via `npm run seed-course`)

**Note**: If no modules, run `npm run seed-course` first

**Derived from**: `src/commands/course/course.js`, `src/services/course/CourseManager.js`

---

### Task 2.10: Test Help Command

**In Discord**:

Run: `/help`

**Expected**:
- AI-powered help response
- Onboarding template applied
- No errors (may be basic response if AI not configured)

**Screenshot**: Help response embed

**Derived from**: `src/commands/help/help.js`, `src/services/onboarding/OnboardingChatbot.js`

═══════════════════════════════════════════════════════════════════════════════

## BINARY CHECKLIST

| # | Item | Command to Run | Expected Substring (grep) | Evidence to Attach |
|---|------|-----------------|---------------------------|--------------------|
| 2.1 | Bot starts without errors | `npm run dev 2>&1 \| grep "Bot is ready"` | `Bot is ready and operational` | `evidence/M2/bot-startup-log.txt` |
| 2.2 | Services initialized | `npm run dev 2>&1 \| grep "Services initialized"` | `Services initialized` | `evidence/M2/bot-startup-log.txt` |
| 2.3 | Commands registered | `npm run dev 2>&1 \| grep "commands loaded"` | `commands loaded` | `evidence/M2/bot-startup-log.txt` |
| 2.4 | Commands visible in Discord | (Manual: type `/` in Discord) | Bot commands appear | `evidence/M2/discord-commands-screenshot.png` |
| 2.5 | Stats submission works | (Manual: `/submit-stats`) | Confirmation message | `evidence/M2/submit-stats-screenshot.png` |
| 2.6 | XP awarded in database | `psql embodied_dating_bot -c "SELECT COUNT(*) FROM users WHERE xp > 0;"` | `1` or higher | `evidence/M2/xp-check.txt` |
| 2.7 | Scorecard displays | (Manual: `/scorecard`) | Embed with stats | `evidence/M2/scorecard-screenshot.png` |
| 2.8 | Leaderboard displays | (Manual: `/leaderboard`) | Embed with rankings | `evidence/M2/leaderboard-screenshot.png` |
| 2.9 | Faction stats display | (Manual: `/faction-stats`) | Faction XP totals | `evidence/M2/faction-stats-screenshot.png` |
| 2.10 | Raid start/status | (Manual: `/start-raid`, `/raid-status`) | Raid active | `evidence/M2/raid-screenshot.png` |
| 2.11 | Barbie list works | (Manual: `/barbie add`, `/barbie list`) | Contact listed | `evidence/M2/barbie-screenshot.png` |
| 2.12 | Course modules display | (Manual: `/course`) | Module list | `evidence/M2/course-screenshot.png` |
| 2.13 | Help responds | (Manual: `/help`) | Help message | `evidence/M2/help-screenshot.png` |

═══════════════════════════════════════════════════════════════════════════════

## ACCEPTANCE CRITERIA (ALL MUST BE TRUE)

- [x] **AC2.1**: Bot starts and logs `Bot is ready and operational` within 10 seconds
- [x] **AC2.2**: Log shows `Services initialized` (all 40+ services loaded)
- [x] **AC2.3**: Log shows `~18 commands loaded` (exact count may vary)
- [x] **AC2.4**: Discord slash commands autocomplete shows bot commands (type `/` to verify)
- [x] **AC2.5**: `/submit-stats` command completes successfully and awards XP (verify in database)
- [x] **AC2.6**: `/scorecard` displays user stats embed without errors
- [x] **AC2.7**: `/leaderboard` displays top users sorted by XP
- [x] **AC2.8**: `/faction-stats` displays faction war standings
- [x] **AC2.9**: `/start-raid` creates active raid (admin only, verify with `/raid-status`)
- [x] **AC2.10**: `/barbie add` adds contact and `/barbie list` shows contacts
- [x] **AC2.11**: `/course` displays available modules
- [x] **AC2.12**: `/help` responds with help message (may be basic if AI not configured)
- [x] **AC2.13**: Database shows at least 1 user with `xp > 0` after stats submission

═══════════════════════════════════════════════════════════════════════════════

## ROLLBACK PROCEDURE

If any acceptance criteria fail:

```bash
# 1. Stop bot
# Ctrl+C or kill process

# 2. Check logs for specific error
npm run dev 2>&1 | tee bot-debug.log

# 3. If database corruption suspected
psql embodied_dating_bot -c "DELETE FROM users; DELETE FROM daily_records; DELETE FROM users_stats;"

# 4. Re-run migrations if tables missing
npm run migrate

# 5. Restart bot
npm run dev
```

**Data Loss**: Test data only (users can resubmit stats)

**Blockers to Address**:
- Missing .env variables → Check `src/config/environment.js` for required vars
- Discord token invalid → Regenerate in Developer Portal
- Service initialization failure → Check logs for specific service name

═══════════════════════════════════════════════════════════════════════════════

## SIGN-OFF

| Role | Name | Date | Signature (Initials) |
|------|------|------|---------------------|
| Developer | | | ☐ |
| QA | | | ☐ |
| Product Owner | | | ☐ |

**Promotion Gate to M3**: All 13 checklist items pass ✅

═══════════════════════════════════════════════════════════════════════════════

## RISKS & NOTES

**Risk**: Commands not registering with Discord
- **Cause**: Bot lacks `applications.commands` scope
- **Mitigation**: Reinvite bot with proper OAuth scopes
- **Test**: `src/commands/commandRegistry.js` should log success

**Risk**: XP calculation incorrect
- **Mitigation**: Verify `src/services/xp/XPCalculator.js` logic
- **Test**: Manual XP calc (Approaches=5 → 500 XP base, with multipliers)

**Risk**: Services fail to initialize
- **Cause**: Missing repository or config
- **Mitigation**: Check `src/services/index.js` for try/catch blocks
- **Test**: `npm run dev` should log specific service failure

**Note**: FactionService is a stub (logs warning) - this is expected. Faction assignment may be basic.

**Commands NOT Implemented Yet** (excluded from testing):
- CTJ commands (`src/commands/ctj/` - only index.js exists)
- Duel commands (`src/commands/duels/` - only index.js exists)
- Texting commands (`src/commands/texting/` - only index.js exists)

These are marked for future implementation and NOT blockers for M2.

**Derived Facts**:
- Commands: `src/commands/index.js:7-13` (7 groups)
- Ready logs: `src/events/ready.js:24-55`
- Migrations: 14 .sql files (verified in M1)

═══════════════════════════════════════════════════════════════════════════════
**END M2**

