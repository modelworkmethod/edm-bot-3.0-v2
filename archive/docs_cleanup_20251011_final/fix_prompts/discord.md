# 🧩 FIX PROMPT — discord

**Status:** WARN • **Confidence:** 0.5

**Primary Flow:** Service-only feature → 5 service(s): ChannelService, index... → tables: [discord_id]

**Evidence**
- Commands: —
- Services: src\services\discord\ChannelService.js, src\services\discord\index.js, src\services\discord\MessageService.js, src\services\discord\RoleService.js, src\services\discord\RoleSync.js
- Tables: discord_id
- Events: —
- Jobs: —
- Candidates: —
- Markers: 0 (TODO: 0, STUB: 0)

---

## 🎯 Targeted Tasks

### Create user-facing command shell
- Create a minimal plain-text slash command:
- - Path: `src/commands/discord/discord.js` (or similar)
- - Register in `src/commands/index.js`
- Add rate limiting entry in `src/middleware/RateLimiter.js`
- - Wire to existing service(s): src\services\discord\ChannelService.js, src\services\discord\index.js, src\services\discord\MessageService.js …

---

## 📝 Counts Summary
- Commands: 0
- Services: 5
- Tables: 1
- Events: 0
- Jobs: 0
- ENV keys: 0
- Candidates: 0
