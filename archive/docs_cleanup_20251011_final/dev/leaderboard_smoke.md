# 🏆 Leaderboard Smoke Test Guide

**Purpose:** Manual QA for enhanced leaderboard system  
**Date:** October 8, 2025  
**Tester:** Copy/paste commands into Discord

---

## ✅ PREFLIGHT CHECK

**Before testing, run:**
```
/preflight section:leaderboards
```

**Expected Output:**
```
Leaderboards:
✅ Cache working (XP: 15ms → 2ms, Stat: 45ms → 1ms)
```

**Pass Criteria:**
- Warm time < Cold time (cache is working)
- No errors

---

## 🧪 TEST SUITE

### Test 1: All-Time XP (Default)
**Command:**
```
/leaderboard
```

**Expected:**
- Plain text output (no embed)
- Shows top 10 users by XP
- Format: `🥇 Username 🦸 - Lv25 (45,200 XP)`
- Pagination hint if >10 users exist

**Pass Criteria:**
- ✅ Returns within 2 seconds
- ✅ Plain text format
- ✅ Shows rank emojis (🥇🥈🥉)
- ✅ Shows faction emojis (🦸🥷) if set
- ✅ XP values formatted with commas

---

### Test 2: This Week XP
**Command:**
```
/leaderboard range:week
```

**Expected:**
- Shows "Range: **This Week**"
- Only includes XP from current week (Sunday-start)
- Users who didn't submit this week may not appear

**Pass Criteria:**
- ✅ Range label shows "This Week"
- ✅ Results differ from all-time (if week just started)
- ✅ Plain text format maintained

---

### Test 3: This Month XP
**Command:**
```
/leaderboard range:month
```

**Expected:**
- Shows "Range: **This Month**"
- Only includes XP from current calendar month

**Pass Criteria:**
- ✅ Range label shows "This Month"
- ✅ Plain text format

---

### Test 4: Stat-Specific (All-Time)
**Command:**
```
/leaderboard stat:Approaches
```

**Expected:**
- Title: "🏆 Approaches Leaderboard"
- Shows total approaches per user
- Format: `🥇 Username 🦸 - 342 Approaches`

**Pass Criteria:**
- ✅ Stat name in title
- ✅ Shows stat totals (not XP)
- ✅ Plain text format

---

### Test 5: Stat-Specific + Time Range
**Command:**
```
/leaderboard stat:Approaches range:week
```

**Expected:**
- Title: "🏆 Approaches Leaderboard"
- Range: "This Week"
- Shows approaches from current week only

**Pass Criteria:**
- ✅ Both stat filter and time filter applied
- ✅ Values are lower than all-time (usually)
- ✅ Plain text format

---

### Test 6: Case-Insensitive Stat
**Command:**
```
/leaderboard stat:approaches
```

**Expected:**
- Works same as `stat:Approaches`
- Normalized to canonical key

**Pass Criteria:**
- ✅ No error
- ✅ Shows Approaches leaderboard
- ✅ Case doesn't matter

---

### Test 7: Alias Support
**Command:**
```
/leaderboard stat:approach
```

**Expected:**
- Alias "approach" resolves to "Approaches"
- Works same as canonical name

**Pass Criteria:**
- ✅ No error
- ✅ Shows Approaches leaderboard
- ✅ Alias resolution working

---

### Test 8: Pagination (Page 2)
**Command:**
```
/leaderboard page:2 limit:10
```

**Expected:**
- Shows ranks 11-20
- Footer: "Page 2 • Use `/leaderboard page:3` for more"

**Pass Criteria:**
- ✅ Ranks start at #11
- ✅ Pagination hint shown
- ✅ Plain text format

---

### Test 9: Large Limit
**Command:**
```
/leaderboard limit:25
```

**Expected:**
- Shows top 25 users
- Footer: "Showing top 25"

**Pass Criteria:**
- ✅ Up to 25 results shown
- ✅ No pagination hint (all on one page)

---

### Test 10: Unknown Stat (Error Handling)
**Command:**
```
/leaderboard stat:InvalidStat
```

**Expected:**
```
❌ Unknown stat: InvalidStat

Valid stats:
• Approaches
• Numbers
• New Contact Response
... (15 shown)
... and 4 more
```

**Pass Criteria:**
- ✅ Clear error message
- ✅ Shows valid stat list
- ✅ Helpful for user

---

### Test 11: Empty Range
**Command:**
```
/leaderboard range:week
```
(On a fresh week with no submissions)

**Expected:**
```
No data found for this range.
```

**Pass Criteria:**
- ✅ Graceful empty state
- ✅ No errors

---

### Test 12: Cache Performance
**Commands (run in sequence):**
```
1. /leaderboard
   → First call (cold)

2. /leaderboard
   → Second call within 60s (should be faster - cached)

3. Wait 61 seconds

4. /leaderboard
   → Third call (cold again - cache expired)
```

**Pass Criteria:**
- ✅ Call #2 returns instantly (~1s vs ~2-3s)
- ✅ Call #3 takes normal time (cache expired)

---

### Test 13: Rate Limiting
**Commands (run rapidly):**
```
/leaderboard
/leaderboard
/leaderboard
/leaderboard
/leaderboard
/leaderboard
/leaderboard  ← 7th call
```

**Expected (7th call):**
```
⏱️ Slow down a bit and try again shortly.
```

**Pass Criteria:**
- ✅ 7th call in 60s is throttled
- ✅ Ephemeral message
- ✅ Can try again after ~10s

---

## 🎯 EDGE CASES

### Test 14: Multiple Stat Types
```
/leaderboard stat:Numbers range:month
/leaderboard stat:Gym Hours
/leaderboard stat:SBMM Meditation range:week
```

**Pass Criteria:**
- ✅ All stat types work
- ✅ Each shows correct stat totals

---

### Test 15: Faction Display
**Command:**
```
/leaderboard
```

**Verify:**
- Users with factions show emoji (🦸 or 🥷)
- Users without factions show no emoji

**Pass Criteria:**
- ✅ Faction emojis display correctly
- ✅ No errors for null factions

---

## 📊 SUMMARY CHECKLIST

After completing all tests, verify:

- [ ] All 15 tests passed
- [ ] Plain text output everywhere (no embeds)
- [ ] Pagination works correctly
- [ ] Cache provides performance boost
- [ ] Rate limiting enforced
- [ ] Error messages are helpful
- [ ] No crashes or unhandled errors

---

## 🐛 KNOWN LIMITATIONS

1. **Week/Month XP:** Approximation using daily_records (not exact XP per day)
2. **Cache:** 60s TTL means some lag for real-time updates
3. **Pagination:** Total page count is estimated (not exact)

---

## 📝 NOTES

- Cache can be cleared by restarting bot
- Admin can use `/preflight section:leaderboards` to check cache performance
- All queries use existing indexes (no new migrations needed)

---

**Ready for QA!**


