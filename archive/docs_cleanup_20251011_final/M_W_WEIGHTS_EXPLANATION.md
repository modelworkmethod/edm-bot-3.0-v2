# ⚖️ M/W WEIGHTS EXPLANATION - HOW THE NUMBERS ACTUALLY WORK

**Date:** October 11, 2025  
**Purpose:** Clear explanation of what M/W numbers mean and how archetype calculation works

---

## 🤔 THE CONFUSION

You're absolutely right to be confused! The numbers like:
- `Approaches (W:3 M:0)` - I said "100% Warrior" 
- `SBMM Meditation (W:0 M:3)` - I said "100% Mage"

**These are NOT percentages!** They are **weight multipliers** that get added up.

---

## ⚙️ HOW IT ACTUALLY WORKS

### **Step 1: Weight Multiplication**
Each stat gets multiplied by its W/M weights:

```javascript
// If you do 5 approaches:
warrior_points += 5 * 3 = 15 warrior points
mage_points += 5 * 0 = 0 mage points

// If you do 2 SBMM sessions:
warrior_points += 2 * 0 = 0 warrior points  
mage_points += 2 * 3 = 6 mage points
```

### **Step 2: Total Calculation**
Your total points get calculated:
```javascript
total_warrior_points = 15 + 0 + other_stats...
total_mage_points = 0 + 6 + other_stats...
total = total_warrior_points + total_mage_points
```

### **Step 3: Percentage Calculation**
Your archetype percentage is calculated:
```javascript
mage_percentage = (total_mage_points / total) * 100
warrior_percentage = (total_warrior_points / total) * 100
```

---

## 📊 REAL EXAMPLES

### **Example 1: Heavy Warrior Day**
```
Stats submitted:
- 5 Approaches (W:3 M:0) → 15 warrior, 0 mage
- 3 Numbers (W:3 M:0) → 9 warrior, 0 mage  
- 2 Dates Booked (W:3 M:0) → 6 warrior, 0 mage

Totals:
- Warrior: 30 points
- Mage: 0 points
- Total: 30 points

Result: 0% Mage, 100% Warrior → WARRIOR archetype
```

### **Example 2: Heavy Mage Day**
```
Stats submitted:
- 3 SBMM Meditation (W:0 M:3) → 0 warrior, 9 mage
- 2 Grounding (W:0 M:2) → 0 warrior, 4 mage
- 1 In Action Release (W:0 M:9) → 0 warrior, 9 mage

Totals:
- Warrior: 0 points
- Mage: 22 points  
- Total: 22 points

Result: 100% Mage, 0% Warrior → MAGE archetype
```

### **Example 3: Balanced Templar Day**
```
Stats submitted:
- 2 Approaches (W:3 M:0) → 6 warrior, 0 mage
- 1 SBMM Meditation (W:0 M:3) → 0 warrior, 3 mage
- 1 Grounding (W:0 M:2) → 0 warrior, 2 mage
- 1 Courage Welcoming (W:2 M:1) → 2 warrior, 1 mage

Totals:
- Warrior: 8 points
- Mage: 6 points
- Total: 14 points

Result: 43% Mage, 57% Warrior → TEMPLAR archetype (40-60% range)
```

---

## 🎯 WHY THE WEIGHTS ARE DIFFERENT

### **High W Values (Warrior Actions):**
- `Same Night Pull (W:6 M:0)` - Very aggressive action
- `Instant Date (W:4 M:0)` - Bold action
- `Approaches (W:3 M:0)` - Direct action

### **High M Values (Mage Actions):**
- `In Action Release (W:0 M:9)` - Deep inner work
- `SBMM Meditation (W:0 M:3)` - Spiritual practice
- `Grounding (W:0 M:2)` - Inner connection

### **Mixed Values (Balanced):**
- `Got Laid (W:0.7 M:0.3)` - Physical + emotional connection
- `Courage Welcoming (W:2 M:1)` - Action + reflection

---

## 🧮 THE MATH BEHIND IT

The weights are designed so that:

1. **High-frequency, low-intensity stats** have smaller weights
   - `Hellos To Strangers (W:2 M:1)` - Easy to do many

2. **Low-frequency, high-intensity stats** have larger weights  
   - `Same Night Pull (W:6 M:0)` - Rare but very bold
   - `In Action Release (W:0 M:9)` - Deep but impactful

3. **The system balances** based on what you actually do, not just the weights

---

## 💡 WHY "Got Laid" MAKES SENSE

`Got Laid (W:0.7 M:0.3)` totals to 1.0 because:
- It's a **single event** (not repeated)
- It has **both physical (warrior) and emotional (mage) components**
- The weights are **normalized** for single occurrences

Most other stats are **activities you can do multiple times**, so they have higher total weights.

---

## 🎯 ARCHETYPE THRESHOLDS

- **Warrior:** <40% Mage (more warrior points than mage)
- **Templar:** 40-60% Mage (balanced)  
- **Mage:** >60% Mage (more mage points than warrior)

The percentages are calculated from your **cumulative totals**, not individual stat weights.

---

## 🔍 BETTER DISPLAY SUGGESTION

Instead of showing `(W:3 M:0)`, we could show:
- `Approaches (Warrior +3 per unit)`
- `SBMM Meditation (Mage +3 per unit)`  
- `Got Laid (Warrior +0.7, Mage +0.3 per unit)`

This would make it clearer that these are **additive values**, not percentages.

---

## ✅ SUMMARY

**The M/W numbers are weight multipliers that get added to your total archetype points. Your final archetype is determined by the ratio of your total warrior points vs total mage points.**

- `W:3 M:0` means "adds 3 warrior points per unit, 0 mage points per unit"
- `W:0 M:9` means "adds 0 warrior points per unit, 9 mage points per unit"  
- `W:0.7 M:0.3` means "adds 0.7 warrior points per unit, 0.3 mage points per unit"

**The higher the number, the more impact that stat has on your archetype balance!** ⚖️
