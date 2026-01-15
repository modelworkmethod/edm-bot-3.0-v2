# 🔧 Archetype Auto-Flagging Threshold Update

**Date:** October 10, 2025  
**Change:** Reduced flagging threshold from 14+ days to 7+ days  
**Status:** ✅ COMPLETE

---

## 📊 THRESHOLD CHANGES SUMMARY

### Before (Old Thresholds):
- **Minimum to trigger alert:** 14 days
- 🟡 **Medium:** 14-20 days
- ⚠️ **High:** 21-29 days
- 🔴 **Critical:** 30+ days

### After (New Thresholds):
- **Minimum to trigger alert:** 7 days
- 🟡 **Medium:** 7-13 days
- ⚠️ **High:** 14-20 days
- 🔴 **Critical:** 21+ days

---

## ✅ FILES MODIFIED

### 1. `src/jobs/archetypeAutoFlagging.js`
**Changes:**
- Line 72: Query threshold 14 → 7 days
- Line 112: Embed description "14+ days" → "7+ days"
- Lines 116-118: Severity grouping updated
  - Critical: 30+ → 21+
  - High: 21-29 → 14-20
  - Medium: 14-20 → 7-13
- Lines 128, 142, 158: Severity labels updated

### 2. `src/commands/admin/coaching-dashboard.js`
**Changes:**
- Line 97: Added `criticalArchetypeUsers` calculation (21+ days)
- Lines 111-112: Updated archetype summary to show both 7+ and 21+ stats
- Line 141: Critical indicator threshold 14 → 21 days
- Line 183: Archetype attention filter 14 → 7 days
- Line 195: Section title "14+ days" → "7+ days"

### 3. `reports/PHASE1_IMPLEMENTATION_STATUS.md`
**Changes:**
- Line 25: Documentation updated to reflect 7+ days

### 4. `reports/PHASE1_COMPLETE.md`
**Changes:**
- Lines 111-112: Feature description updated
- Lines 121-123: Alert format updated
- Lines 376-377: Defaults section updated

---

## 🎯 RATIONALE

### Why This Change?
**More Proactive Coaching**
- Catches balance issues earlier
- Prevents users from drifting too far
- Enables earlier intervention
- Reduces likelihood of prolonged imbalance

### Impact:
- ✅ More users will be flagged initially (expected)
- ✅ Coaches get earlier warning signals
- ✅ Prevents small issues from becoming big problems
- ✅ 21+ days (old "critical") is still flagged as critical

---

## 🔔 ALERT EXAMPLES

### Example 1: User out of balance for 10 days
**Old System:** No alert (below 14-day threshold)  
**New System:** 🟡 MEDIUM alert - User needs attention

### Example 2: User out of balance for 18 days
**Old System:** 🟡 MEDIUM alert  
**New System:** ⚠️ HIGH PRIORITY alert

### Example 3: User out of balance for 25 days
**Old System:** ⚠️ HIGH PRIORITY alert  
**New System:** 🔴 CRITICAL alert

---

## 📋 COACHING DASHBOARD UPDATES

### New Summary Section Shows:
```
⚖️ Archetype Balance Summary
✅ Balanced (Templar): 15 (45.5%)
⚠️ Needs Attention (7+ days): 8
🔴 Critical (21+ days): 2
```

### Visual Indicators:
- ✅ - Balanced (Templar)
- ⚠️ - Out of balance 7-20 days
- 🔴 - Out of balance 21+ days (CRITICAL)

---

## 🧪 TESTING RECOMMENDATIONS

### 1. Test Auto-Flagging
```
/trigger-archetype-check
```
**Expected:** More users may appear in alerts now (7+ vs 14+)

### 2. Test Dashboard
```
/coaching-dashboard
```
**Expected:** 
- Summary shows both 7+ and 21+ day counts
- Users out 7+ days show in attention section
- Critical indicator (🔴) for users 21+ days

### 3. Monitor Initial Results
- Check if alert volume is manageable
- Verify coaches can action all flagged users
- Adjust if needed (can tune thresholds based on data)

---

## ⚙️ CONFIGURATION

### Current Thresholds (Can be adjusted):
```javascript
// In archetypeAutoFlagging.js
const MINIMUM_DAYS = 7;        // Minimum to trigger alert
const MEDIUM_THRESHOLD = 7;     // 7-13 days
const HIGH_THRESHOLD = 14;      // 14-20 days
const CRITICAL_THRESHOLD = 21;  // 21+ days
```

### To Change Thresholds:
If you need to adjust these later:
1. Update `getUsersOutOfBalance()` call parameter
2. Update severity grouping logic
3. Update embed field names
4. Update coaching dashboard thresholds

---

## 📈 EXPECTED OUTCOMES

### Short Term (First Week):
- 📈 Increase in flagged users (expected)
- 📊 Better visibility of early imbalance
- ⚡ Faster coaching response time

### Long Term (After 2-4 Weeks):
- 📉 Decrease in users reaching critical (21+ days)
- ✅ More users maintaining Templar balance
- 🎯 Improved overall balance metrics
- ⏱️ Reduced coaching workload (early intervention = less crisis management)

---

## 🔄 ROLLBACK PLAN

If thresholds prove too aggressive:

### Quick Rollback:
1. Change `getUsersOutOfBalance(7)` back to `getUsersOutOfBalance(14)`
2. Revert severity groupings:
   - Critical: 21+ → 30+
   - High: 14-20 → 21-29
   - Medium: 7-13 → 14-20
3. Update field labels back to original
4. Restart bot

**Estimated rollback time:** < 5 minutes

---

## ✅ VERIFICATION CHECKLIST

- [x] Auto-flagging system updated (7 days threshold)
- [x] Severity groupings updated (7-13, 14-20, 21+)
- [x] Coaching dashboard updated
- [x] Dashboard shows both 7+ and 21+ counts
- [x] Critical indicator uses 21+ days
- [x] Documentation updated
- [x] Alert embed labels updated
- [x] No code syntax errors introduced

---

## 📝 NOTES

### Consistency Maintained:
- ✅ All threshold references updated consistently
- ✅ Both auto-flagging and dashboard use same thresholds
- ✅ Documentation matches implementation
- ✅ Severity levels align across all systems

### Backward Compatibility:
- ✅ Database schema unchanged
- ✅ Repository methods unchanged
- ✅ API unchanged
- ✅ Only threshold values modified

---

## 🎓 LESSONS FOR FUTURE THRESHOLD TUNING

### What to Monitor:
1. **Alert Volume:** Are coaches overwhelmed?
2. **User Coverage:** Are we catching everyone who needs help?
3. **False Positives:** Are alerts too sensitive?
4. **Intervention Success:** Does earlier flagging = better outcomes?

### Adjustment Indicators:
- If alert volume too high → increase minimum threshold
- If missing users who need help → decrease threshold
- If critical users increasing → threshold may be too high
- If most flagged users don't need intervention → threshold too low

### Recommended Review Schedule:
- Week 1: Daily monitoring
- Week 2-4: Weekly review
- Month 2+: Monthly threshold analysis

---

## 🚀 DEPLOYMENT STATUS

**Status:** ✅ **READY FOR PRODUCTION**

All code changes complete. Changes will take effect when:
1. Bot is restarted (picks up new code)
2. Next auto-flagging run (9 AM EST daily)
3. Next `/coaching-dashboard` command run
4. Next `/trigger-archetype-check` manual run

**No database migration required for this change.**

---

*Threshold update completed: October 10, 2025*  
*More proactive = Better outcomes! 🎯*

