# 🧩 FIX PROMPT — user

**Status:** WARN • **Confidence:** 0.5

**Primary Flow:** Service-only feature → 3 service(s): ArchetypeService, index... → tables: [user_id, users]

**Evidence**
- Commands: —
- Services: src\services\user\ArchetypeService.js, src\services\user\index.js, src\services\user\UserService.js
- Tables: user_id, users
- Events: —
- Jobs: —
- Candidates: —
- Markers: 0 (TODO: 0, STUB: 0)

---

## 🎯 Targeted Tasks

### Create user-facing command shell
- Create a minimal plain-text slash command:
- - Path: `src/commands/user/user.js` (or similar)
- - Register in `src/commands/index.js`
- Add rate limiting entry in `src/middleware/RateLimiter.js`
- - Wire to existing service(s): src\services\user\ArchetypeService.js, src\services\user\index.js, src\services\user\UserService.js

---

## 📝 Counts Summary
- Commands: 0
- Services: 3
- Tables: 2
- Events: 0
- Jobs: 0
- ENV keys: 0
- Candidates: 0
