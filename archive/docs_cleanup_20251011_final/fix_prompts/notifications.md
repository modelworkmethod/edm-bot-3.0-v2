# 🧩 FIX PROMPT — notifications

**Status:** WARN • **Confidence:** 0.3

**Primary Flow:** Service-only feature → 4 service(s): AnnouncementQueue, AutoReminderService...

**Evidence**
- Commands: —
- Services: src\services\notifications\AnnouncementQueue.js, src\services\notifications\AutoReminderService.js, src\services\notifications\index.js, src\services\notifications\ReminderService.js
- Tables: —
- Events: —
- Jobs: —
- Candidates: —
- Markers: 0 (TODO: 0, STUB: 0)

---

## 🎯 Targeted Tasks

### Create user-facing command shell
- Create a minimal plain-text slash command:
- - Path: `src/commands/notifications/notifications.js` (or similar)
- - Register in `src/commands/index.js`
- Add rate limiting entry in `src/middleware/RateLimiter.js`
- - Wire to existing service(s): src\services\notifications\AnnouncementQueue.js, src\services\notifications\AutoReminderService.js, src\services\notifications\index.js …

---

## 📝 Counts Summary
- Commands: 0
- Services: 4
- Tables: 0
- Events: 0
- Jobs: 0
- ENV keys: 0
- Candidates: 0
