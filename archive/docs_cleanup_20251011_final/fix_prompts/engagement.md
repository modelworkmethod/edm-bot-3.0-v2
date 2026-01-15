# 🧩 FIX PROMPT — engagement

**Status:** WARN • **Confidence:** 0.3

**Primary Flow:** Service-only feature → 2 service(s): ChatEngagementMonitor, WinsMonitor

**Evidence**
- Commands: —
- Services: src\services\engagement\ChatEngagementMonitor.js, src\services\engagement\WinsMonitor.js
- Tables: —
- Events: —
- Jobs: —
- Candidates: —
- Markers: 0 (TODO: 0, STUB: 0)

---

## 🎯 Targeted Tasks

### Create user-facing command shell
- Create a minimal plain-text slash command:
- - Path: `src/commands/engagement/engagement.js` (or similar)
- - Register in `src/commands/index.js`
- Add rate limiting entry in `src/middleware/RateLimiter.js`
- - Wire to existing service(s): src\services\engagement\ChatEngagementMonitor.js, src\services\engagement\WinsMonitor.js

---

## 📝 Counts Summary
- Commands: 0
- Services: 2
- Tables: 0
- Events: 0
- Jobs: 0
- ENV keys: 0
- Candidates: 0
