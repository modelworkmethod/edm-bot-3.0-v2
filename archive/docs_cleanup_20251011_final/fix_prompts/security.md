# 🧩 FIX PROMPT — security

**Status:** WARN • **Confidence:** 0.3

**Primary Flow:** Service-only feature → 3 service(s): AuditLogger, ContentModerator...

**Evidence**
- Commands: —
- Services: src\services\security\AuditLogger.js, src\services\security\ContentModerator.js, src\services\security\WarningSystem.js
- Tables: —
- Events: —
- Jobs: —
- Candidates: —
- Markers: 0 (TODO: 0, STUB: 0)

---

## 🎯 Targeted Tasks

### Create user-facing command shell
- Create a minimal plain-text slash command:
- - Path: `src/commands/security/security.js` (or similar)
- - Register in `src/commands/index.js`
- Add rate limiting entry in `src/middleware/RateLimiter.js`
- - Wire to existing service(s): src\services\security\AuditLogger.js, src\services\security\ContentModerator.js, src\services\security\WarningSystem.js

---

## 📝 Counts Summary
- Commands: 0
- Services: 3
- Tables: 0
- Events: 0
- Jobs: 0
- ENV keys: 0
- Candidates: 0
