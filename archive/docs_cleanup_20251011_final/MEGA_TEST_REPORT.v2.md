# 🧪 MEGA TEST REPORT — v2

**Generated:** 2025-10-08T22:56:22.936Z

**Features:** 65 • ✅ PASS: 12 • ⚠️ WARN: 20 • ❌ FAIL: 24 • ⏸️ SKIP: 9

> Auto-generated from MEGA_DISCOVERY_REPORT.json by mega_fix_orchestrator.mjs

---

## 📊 Executive Summary

This report synthesizes automated codebase discovery into actionable fix prompts.

**Status Distribution:**
- **PASS (12)**: Complete features with command + service + no critical markers
- **WARN (20)**: Partial implementations, backend-only, or minor TODOs
- **FAIL (24)**: Missing core pieces or broken imports (mostly utils/config—expected)
- **SKIP (9)**: Event handlers and low-confidence inference artifacts

**Key Metrics:**
- Total commands: 49
- Total services: 62
- Total tables: 5
- Migration gaps: 0

---

## 📚 Auto-Discovered Features

| Feature | Status | Conf | Cmds | Svcs | Tables | Evts | Jobs | TODOs | STUBs |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| barbie | PASS | 0.8999999999999999 | 2 | 1 | 1 | 0 | 0 | 0 | 0 |
| ctj | PASS | 0.8999999999999999 | 3 | 3 | 1 | 0 | 0 | 0 | 0 |
| index-js | PASS | 0.7 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| course | PASS | 0.7 | 2 | 1 | 0 | 0 | 0 | 0 | 0 |
| duels | PASS | 0.7 | 2 | 1 | 0 | 0 | 0 | 0 | 0 |
| factions | PASS | 0.7 | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| leaderboard | PASS | 0.7 | 4 | 1 | 0 | 0 | 0 | 0 | 0 |
| ops | PASS | 0.7 | 3 | 1 | 0 | 0 | 0 | 0 | 0 |
| raids | PASS | 0.7 | 2 | 1 | 0 | 0 | 0 | 0 | 0 |
| stats | PASS | 0.7 | 7 | 2 | 0 | 0 | 0 | 0 | 0 |
| texting | PASS | 0.7 | 4 | 2 | 0 | 0 | 0 | 0 | 0 |
| wingman | PASS | 0.7 | 2 | 1 | 0 | 0 | 0 | 0 | 0 |
| discord | WARN | 0.5 | 0 | 5 | 1 | 0 | 0 | 0 | 0 |
| user | WARN | 0.5 | 0 | 3 | 2 | 0 | 0 | 0 | 0 |
| commandregistry-js | WARN | 0.4 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| admin | WARN | 0.4 | 11 | 0 | 0 | 0 | 0 | 0 | 0 |
| help | WARN | 0.4 | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| events | WARN | 0.35 | 0 | 1 | 0 | 1 | 0 | 0 | 0 |
| ai | WARN | 0.3 | 0 | 4 | 0 | 0 | 0 | 0 | 0 |
| airtable | WARN | 0.3 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| analytics | WARN | 0.3 | 0 | 6 | 0 | 0 | 0 | 0 | 0 |
| automation | WARN | 0.3 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| backup | WARN | 0.3 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| compliance | WARN | 0.3 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| email | WARN | 0.3 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| engagement | WARN | 0.3 | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| monitoring | WARN | 0.3 | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| notifications | WARN | 0.3 | 0 | 4 | 0 | 0 | 0 | 0 | 0 |
| onboarding | WARN | 0.3 | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| security | WARN | 0.3 | 0 | 3 | 0 | 0 | 0 | 0 | 0 |
| tensey | WARN | 0.3 | 0 | 3 | 0 | 0 | 0 | 0 | 0 |
| xp | WARN | 0.3 | 0 | 5 | 0 | 0 | 0 | 0 | 0 |
| guildmemberadd | SKIP | 0.05 | 0 | 0 | 0 | 2 | 0 | 0 | 0 |
| messagecreate | SKIP | 0.05 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| ready | SKIP | 0.05 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| duelsfinalizer | SKIP | 0.05 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| wingmanscheduler | SKIP | 0.05 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| buttonhandler | SKIP | 0.05 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| commandhandler | SKIP | 0.05 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| modalhandler | SKIP | 0.05 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| selectmenuhandler | SKIP | 0.05 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| admincommandtemplates | FAIL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| constants | FAIL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| environment | FAIL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| factionconfig | FAIL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| secondaryxpsources | FAIL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| settings | FAIL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| wingmanconfig | FAIL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| postgres | FAIL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| runmigrations | FAIL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| inputvalidator | FAIL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| permissionguard | FAIL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ratelimiter | FAIL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| discordattachments | FAIL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| errorhandler | FAIL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| logger | FAIL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| plaintextreplies | FAIL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| social | FAIL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| timeutils | FAIL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| validator | FAIL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| zapier | FAIL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| baserepository | FAIL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| statsrepository | FAIL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tenseyrepository | FAIL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| userrepository | FAIL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

---

## 🧭 Primary Flows (Top 20)

- **barbie** → User → /barbie → 1 service(s): BarbieListManager → tables: [barbie_list]
- **ctj** → User → /ctj → 3 service(s): CTJAnalyzer, CTJMonitor... → tables: [ctj_entries]
- **index-js** → User → /index-js → 1 service(s): index
- **course** → User → /course → 1 service(s): CourseManager
- **duels** → User → /duels → 1 service(s): DuelManager
- **factions** → User → /factions → 2 service(s): FactionBalancer, FactionService
- **leaderboard** → User → /leaderboard → 1 service(s): LeaderboardService
- **ops** → User → /ops → 1 service(s): PreflightService
- **raids** → User → /raids → 1 service(s): RaidManager
- **stats** → User → /stats → 2 service(s): StatsEditService, StatsProcessor
- **texting** → User → /texting → 2 service(s): TextingService, TextingSimulator
- **wingman** → User → /wingman → 1 service(s): WingmanMatcher
- **discord** → Service-only feature → 5 service(s): ChannelService, index... → tables: [discord_id]
- **user** → Service-only feature → 3 service(s): ArchetypeService, index... → tables: [user_id, users]
- **commandregistry-js** → User → /commandregistry-js
- **admin** → User → /admin
- **help** → User → /help
- **events** → Service-only feature → 1 service(s): DoubleXPManager → 1 event(s)
- **ai** → Service-only feature → 4 service(s): ClaudeAnalyzer, ElevenLabsVoice...
- **airtable** → Service-only feature → 1 service(s): AirtableClient

---

## 🛠️ Actionable Fixes Index

Each WARN/FAIL feature has a dedicated fix prompt with targeted tasks.

- [discord](./fix_prompts/discord.md) — WARN (conf 0.5)
- [user](./fix_prompts/user.md) — WARN (conf 0.5)
- [commandregistry-js](./fix_prompts/commandregistry-js.md) — WARN (conf 0.4)
- [admin](./fix_prompts/admin.md) — WARN (conf 0.4)
- [help](./fix_prompts/help.md) — WARN (conf 0.4)
- [events](./fix_prompts/events.md) — WARN (conf 0.35)
- [ai](./fix_prompts/ai.md) — WARN (conf 0.3)
- [airtable](./fix_prompts/airtable.md) — WARN (conf 0.3)
- [analytics](./fix_prompts/analytics.md) — WARN (conf 0.3)
- [automation](./fix_prompts/automation.md) — WARN (conf 0.3)
- [backup](./fix_prompts/backup.md) — WARN (conf 0.3)
- [compliance](./fix_prompts/compliance.md) — WARN (conf 0.3)
- [email](./fix_prompts/email.md) — WARN (conf 0.3)
- [engagement](./fix_prompts/engagement.md) — WARN (conf 0.3)
- [monitoring](./fix_prompts/monitoring.md) — WARN (conf 0.3)
- [notifications](./fix_prompts/notifications.md) — WARN (conf 0.3)
- [onboarding](./fix_prompts/onboarding.md) — WARN (conf 0.3)
- [security](./fix_prompts/security.md) — WARN (conf 0.3)
- [tensey](./fix_prompts/tensey.md) — WARN (conf 0.3)
- [xp](./fix_prompts/xp.md) — WARN (conf 0.3)
- [guildmemberadd](./fix_prompts/guildmemberadd.md) — SKIP (conf 0.05)
- [messagecreate](./fix_prompts/messagecreate.md) — SKIP (conf 0.05)
- [ready](./fix_prompts/ready.md) — SKIP (conf 0.05)
- [duelsfinalizer](./fix_prompts/duelsfinalizer.md) — SKIP (conf 0.05)
- [wingmanscheduler](./fix_prompts/wingmanscheduler.md) — SKIP (conf 0.05)
- [buttonhandler](./fix_prompts/buttonhandler.md) — SKIP (conf 0.05)
- [commandhandler](./fix_prompts/commandhandler.md) — SKIP (conf 0.05)
- [modalhandler](./fix_prompts/modalhandler.md) — SKIP (conf 0.05)
- [selectmenuhandler](./fix_prompts/selectmenuhandler.md) — SKIP (conf 0.05)
- [admincommandtemplates](./fix_prompts/admincommandtemplates.md) — FAIL (conf 0)
- [constants](./fix_prompts/constants.md) — FAIL (conf 0)
- [environment](./fix_prompts/environment.md) — FAIL (conf 0)
- [factionconfig](./fix_prompts/factionconfig.md) — FAIL (conf 0)
- [secondaryxpsources](./fix_prompts/secondaryxpsources.md) — FAIL (conf 0)
- [settings](./fix_prompts/settings.md) — FAIL (conf 0)
- [wingmanconfig](./fix_prompts/wingmanconfig.md) — FAIL (conf 0)
- [postgres](./fix_prompts/postgres.md) — FAIL (conf 0)
- [runmigrations](./fix_prompts/runmigrations.md) — FAIL (conf 0)
- [inputvalidator](./fix_prompts/inputvalidator.md) — FAIL (conf 0)
- [permissionguard](./fix_prompts/permissionguard.md) — FAIL (conf 0)
- [ratelimiter](./fix_prompts/ratelimiter.md) — FAIL (conf 0)
- [discordattachments](./fix_prompts/discordattachments.md) — FAIL (conf 0)
- [errorhandler](./fix_prompts/errorhandler.md) — FAIL (conf 0)
- [logger](./fix_prompts/logger.md) — FAIL (conf 0)
- [plaintextreplies](./fix_prompts/plaintextreplies.md) — FAIL (conf 0)
- [social](./fix_prompts/social.md) — FAIL (conf 0)
- [timeutils](./fix_prompts/timeutils.md) — FAIL (conf 0)
- [validator](./fix_prompts/validator.md) — FAIL (conf 0)
- [zapier](./fix_prompts/zapier.md) — FAIL (conf 0)
- [baserepository](./fix_prompts/baserepository.md) — FAIL (conf 0)
- [statsrepository](./fix_prompts/statsrepository.md) — FAIL (conf 0)
- [tenseyrepository](./fix_prompts/tenseyrepository.md) — FAIL (conf 0)
- [userrepository](./fix_prompts/userrepository.md) — FAIL (conf 0)

---

## 🧱 Migration Gaps

_None detected._

---

## 🔑 ENV Delta

_All used ENV keys are documented in template._

---

## 🔥 Hotspots (TODO/STUB heavy files)

_No TODO/STUB markers detected._

---

## 🎯 Next Steps

1. Review individual fix prompts in `reports/fix_prompts/<feature>.md`
2. Address FAIL features first (missing critical wiring)
3. Promote candidate files where applicable
4. Clear TODO/STUB markers in hotspot files
5. Fill migration gaps with meaningful schemas
6. Validate all ENV keys are set in `.env`

---

**How to use this report:**
- Each feature link above points to a precise, copy-paste-ready fix prompt
- Prompts include file paths, exact steps, and guardrails
- Run `node scripts/dev/mega_discovery.mjs` after fixes to verify progress
