# 🧩 FIX PROMPT — events

**Status:** WARN • **Confidence:** 0.35

**Primary Flow:** Service-only feature → 1 service(s): DoubleXPManager → 1 event(s)

**Evidence**
- Commands: —
- Services: src\services\events\DoubleXPManager.js
- Tables: —
- Events: src\services\events\DoubleXPManager.js
- Jobs: —
- Candidates: —
- Markers: 0 (TODO: 0, STUB: 0)

---

## 🎯 Targeted Tasks

### Create user-facing command shell
- Create a minimal plain-text slash command:
- - Path: `src/commands/events/events.js` (or similar)
- - Register in `src/commands/index.js`
- Add rate limiting entry in `src/middleware/RateLimiter.js`
- - Wire to existing service(s): src\services\events\DoubleXPManager.js

---

## 📝 Counts Summary
- Commands: 0
- Services: 1
- Tables: 0
- Events: 1
- Jobs: 0
- ENV keys: 0
- Candidates: 0
