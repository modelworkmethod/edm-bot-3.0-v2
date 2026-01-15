# 🧩 FIX PROMPT — xp

**Status:** WARN • **Confidence:** 0.3

**Primary Flow:** Service-only feature → 5 service(s): index, LevelCalculator...

**Evidence**
- Commands: —
- Services: src\services\xp\index.js, src\services\xp\LevelCalculator.js, src\services\xp\MultiplierService.js, src\services\xp\SecondaryXPProcessor.js, src\services\xp\XPCalculator.js
- Tables: —
- Events: —
- Jobs: —
- Candidates: —
- Markers: 0 (TODO: 0, STUB: 0)

---

## 🎯 Targeted Tasks

### Create user-facing command shell
- Create a minimal plain-text slash command:
- - Path: `src/commands/xp/xp.js` (or similar)
- - Register in `src/commands/index.js`
- Add rate limiting entry in `src/middleware/RateLimiter.js`
- - Wire to existing service(s): src\services\xp\index.js, src\services\xp\LevelCalculator.js, src\services\xp\MultiplierService.js …

---

## 📝 Counts Summary
- Commands: 0
- Services: 5
- Tables: 0
- Events: 0
- Jobs: 0
- ENV keys: 0
- Candidates: 0
