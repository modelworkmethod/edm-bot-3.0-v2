# 🧩 FIX PROMPT — ai

**Status:** WARN • **Confidence:** 0.3

**Primary Flow:** Service-only feature → 4 service(s): ClaudeAnalyzer, ElevenLabsVoice...

**Evidence**
- Commands: —
- Services: src\services\ai\ClaudeAnalyzer.js, src\services\ai\ElevenLabsVoice.js, src\services\ai\InstagramAnalyzerStub.js, src\services\ai\InstagramVisionStub.js
- Tables: —
- Events: —
- Jobs: —
- Candidates: —
- Markers: 0 (TODO: 0, STUB: 0)

---

## 🎯 Targeted Tasks

### Create user-facing command shell
- Create a minimal plain-text slash command:
- - Path: `src/commands/ai/ai.js` (or similar)
- - Register in `src/commands/index.js`
- Add rate limiting entry in `src/middleware/RateLimiter.js`
- - Wire to existing service(s): src\services\ai\ClaudeAnalyzer.js, src\services\ai\ElevenLabsVoice.js, src\services\ai\InstagramAnalyzerStub.js …

---

## 📝 Counts Summary
- Commands: 0
- Services: 4
- Tables: 0
- Events: 0
- Jobs: 0
- ENV keys: 0
- Candidates: 0
