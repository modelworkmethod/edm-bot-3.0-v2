# 🧩 FIX PROMPT — analytics

**Status:** WARN • **Confidence:** 0.3

**Primary Flow:** Service-only feature → 6 service(s): ChartGenerator, EngagementTracker...

**Evidence**
- Commands: —
- Services: src\services\analytics\ChartGenerator.js, src\services\analytics\EngagementTracker.js, src\services\analytics\InterventionGenerator.js, src\services\analytics\PatternDetector.js, src\services\analytics\ProgressTracker.js …
- Tables: —
- Events: —
- Jobs: —
- Candidates: —
- Markers: 0 (TODO: 0, STUB: 0)

---

## 🎯 Targeted Tasks

### Create user-facing command shell
- Create a minimal plain-text slash command:
- - Path: `src/commands/analytics/analytics.js` (or similar)
- - Register in `src/commands/index.js`
- Add rate limiting entry in `src/middleware/RateLimiter.js`
- - Wire to existing service(s): src\services\analytics\ChartGenerator.js, src\services\analytics\EngagementTracker.js, src\services\analytics\InterventionGenerator.js …

---

## 📝 Counts Summary
- Commands: 0
- Services: 6
- Tables: 0
- Events: 0
- Jobs: 0
- ENV keys: 0
- Candidates: 0
