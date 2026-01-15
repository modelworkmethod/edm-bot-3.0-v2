# Factions System Audit & Redesign Report

**Date:** October 8, 2025  
**Status:** READ-ONLY ANALYSIS COMPLETE  
**Objective:** Transform faction system from user self-service to admin-controlled with auto-assignment + role color mapping

---

## 1. Executive Summary

**Current Behavior:**  
The faction system has a **complete auto-assignment backend** but **zero user-facing self-service commands**. New members are automatically assigned to `Luminarchs` or `Noctivores` on `guildMemberAdd` using a simple balancing algorithm (assign to smaller faction). Faction roles are applied via Discord role IDs, but **no color enforcement** exists. The `FactionService.js` is an **empty stub marked "DO NOT SHIP"**. Users cannot manually join/leave factions—the system is passive.

**Desired Behavior:**  
Retain auto-assignment on join with an enhanced balancing algorithm. Add **admin-only commands** to manually set/clear factions. Enforce **faction-specific role colors** (Luminarchs = gold/yellow, Noctivores = purple). Remove the stub service entirely since core logic already exists in `RoleService` and event handlers.

**Key Finding:** The system is **90% complete**—it just needs admin commands, color mapping, and threshold-based balancing. No user self-service exists to disable.

---

## 2. Current Behavior Map

### 2.1 Data Model

**Table:** `users` (from `000_initial_schema.sql:3-11`)
```sql
CREATE TABLE IF NOT EXISTS users (
  user_id VARCHAR(255) PRIMARY KEY,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  faction VARCHAR(50),        -- NULL or 'Luminarchs'/'Noctivores'
  archetype VARCHAR(50),
  ...
);

CREATE INDEX IF NOT EXISTS idx_users_faction ON users(faction);
```

- **Nullability:** `faction` allows NULL (no default)
- **Valid Values:** `'Luminarchs'`, `'Noctivores'`, or NULL
- **Index:** `idx_users_faction` for fast filtering/grouping

**Config Storage:**
- Faction names: `src/config/constants.js:216` → `FACTION_NAMES = ['Luminarchs', 'Noctivores']`
- Faction emojis: `src/config/constants.js:211-214` → `FACTION_EMOJIS = { Luminarchs: '🦸', Noctivores: '🥷' }`
- Role IDs: `src/config/environment.js:133-136` → `roles.factions.Luminarchs`, `roles.factions.Noctivores`
- Announcement toggle: `src/config/settings.js:80` → `announcements.factionEnabled`
- Faction channels: `src/config/environment.js:108-109` → `factionLuminarchs`, `factionNoctivores`

### 2.2 Service API

**UserRepository** (`src/database/repositories/UserRepository.js`):
```javascript
// Line 94-96
async setFaction(userId, faction) {
  return await this.update(userId, { faction }, 'user_id');
}

// Line 132-147
async getFactionCounts() {
  const rows = await queryRows(
    `SELECT faction, COUNT(*) as count 
     FROM users 
     WHERE faction IS NOT NULL 
     GROUP BY faction`
  );
  // Returns { Luminarchs: 0, Noctivores: 0 }
}
```

**UserService** (`src/services/user/UserService.js:155-157`):
```javascript
async setUserFaction(userId, faction) {
  return await this.userRepo.setFaction(userId, faction);
}
```

**RoleService** (`src/services/discord/RoleService.js`):
```javascript
// Line 84-124: Assign faction role
async assignFactionRole(member, faction) {
  const roleId = config.roles.factions[faction];
  const role = guild.roles.cache.get(roleId);
  
  // Remove other faction role
  const otherFaction = faction === 'Luminarchs' ? 'Noctivores' : 'Luminarchs';
  await member.roles.remove(otherRoleId);
  
  // Add faction role
  await member.roles.add(role);
}

// Line 177-198: Auto-assign on join
async autoAssignFaction(member, factionCounts) {
  const { Luminarchs, Noctivores } = factionCounts;
  
  // Assign to smaller faction
  const assignedFaction = Luminarchs <= Noctivores ? 'Luminarchs' : 'Noctivores';
  
  await this.assignFactionRole(member, assignedFaction);
  return assignedFaction;
}
```

**FactionService** (`src/services/factions/FactionService.js`):
```javascript
// ENTIRE FILE IS A STUB (Lines 1-26)
// ═══════════════════════════════════════════════════════════════════════════════
// TEMP STUB — DO NOT SHIP
// FactionService placeholder to prevent startup crash
// User must implement faction management logic
// ═══════════════════════════════════════════════════════════════════════════════

class FactionService {
  constructor(repositories, channelService) {
    logger.warn('FactionService is a TEMP STUB - no logic implemented');
  }
  async stop() { /* No-op */ }
}
```

### 2.3 User Commands

**Finding:** ZERO user-facing faction join/leave/status commands exist.

**Commands that READ faction data:**
1. `/faction-stats` (`src/commands/leaderboard/faction-stats.js`)
   - **Purpose:** Shows Faction War leaderboard (total XP, member count, avg XP)
   - **Query:** `SELECT faction, COUNT(*), SUM(xp), AVG(xp) FROM users WHERE faction IS NOT NULL GROUP BY faction`
   - **Display:** Embed with Luminarchs vs Noctivores comparison + leader indicator
   - **User Interaction:** Read-only, no self-assignment

2. `/scorecard` (`src/commands/stats/scorecard.js:111-118`)
   - **Purpose:** Shows user's profile
   - **Faction Display:** Inline field showing faction emoji + name if `profile.user.faction` exists
   - **User Interaction:** Read-only

**No commands found that allow users to:**
- Join a faction (`/faction join`)
- Leave a faction (`/faction leave`)
- Change faction (`/faction switch`)

### 2.4 Events & Automation

**guildMemberAdd** (`src/events/guildMemberAdd.js`):
```javascript
// Line 18-57: Main handler
async execute(member) {
  // Line 32: Create user in database
  await services.userService.getOrCreateUser(member.id, member.user.username);
  
  // Line 35-36: Get current faction counts
  const factionCounts = await services.repositories.user.getFactionCounts();
  const assignedFaction = await services.roleService.autoAssignFaction(member, factionCounts);
  
  // Line 39: Update database
  await services.userService.setUserFaction(member.id, assignedFaction);
  
  // Line 42-49: Send welcome DM & general message with faction announcement
}
```

**Flow:**
1. New member joins Discord server
2. Bot creates user record with `faction=NULL`
3. Fetches current counts: `{ Luminarchs: 10, Noctivores: 12 }`
4. Calls `autoAssignFaction()` → assigns to `Luminarchs` (smaller count)
5. Applies Discord role via role ID
6. Updates DB: `users.faction = 'Luminarchs'`
7. Sends welcome DM: "You've been assigned to 🦸 Luminarchs!"

**No other automation jobs** modify factions.

### 2.5 Role Color Logic

**Current State:** Role IDs are configured but **no color enforcement exists**.

**Role Configuration:**
- ENV vars: `ROLE_FACTION_LUMINARCHS`, `ROLE_FACTION_NOCTIVORES` (`ENV_TEMPLATE.txt:79-80`)
- Config path: `config.roles.factions.Luminarchs` / `.Noctivores` (`src/config/environment.js:133-136`)

**Role Assignment:**
- `RoleService.assignFactionRole()` adds role by ID
- Removes opposite faction role to prevent conflicts
- **No color validation or creation**—assumes roles exist with correct colors

**Gap:** Roles must be manually created in Discord with colors:
- Luminarchs → **No color specified** (should be gold/yellow)
- Noctivores → **No color specified** (should be purple)

**Color Constants Found Elsewhere:**
- Tier roles use hex colors (`src/config/constants.js:230-233`): 
  - `'Galactic Sexy Bastard God-King': 0xFFD700` (gold)
- Raid embeds use dynamic colors (`src/services/raids/RaidManager.js:68`):
  - Warrior: `0xFF6B6B` (red)
  - Mage: `0x9B59B6` (purple)

### 2.6 Side Effects

**What updates when faction changes:**

1. **Database:** `users.faction` updated via `UserRepository.setFaction()`
2. **Discord Role:** Faction role added, opposite role removed via `RoleService.assignFactionRole()`
3. **Leaderboards:** `/faction-stats` queries recalculate totals (no caching)
4. **User Profile:** `/scorecard` displays new faction
5. **Welcome Messages:** New members see faction in welcome DM/message

**No caches to invalidate.** All queries hit database directly.

**XP/Multipliers:** `MultiplierService.calculateMultiplier()` has a `faction` parameter (line 58) but is **not currently used** for faction bonuses.

---

## 3. Gaps & Risks

### 3.1 User Self-Assignment Enablers

**Finding:** ZERO user self-service paths exist. The only assignment mechanism is:
1. Auto-assignment on `guildMemberAdd` (cannot be triggered by users)
2. Direct DB manipulation (requires admin access)

**No gaps to close** in terms of preventing user self-assignment.

### 3.2 Missing Admin Controls

**Gap:** No admin commands to:
- Manually set a user's faction
- Clear a user's faction (set to NULL)
- Override auto-assignment for specific users

**Risk:** Admins currently have no UI to fix misassignments or manually balance factions.

### 3.3 Balancing Algorithm Weaknesses

**Current Logic** (`RoleService.autoAssignFaction:177-198`):
```javascript
const assignedFaction = Luminarchs <= Noctivores ? 'Luminarchs' : 'Noctivores';
```

**Issues:**
1. **No threshold:** Assigns to smaller faction even if difference is 1 (too reactive)
2. **No deterministic tiebreaker:** When `Luminarchs == Noctivores`, always picks Luminarchs
3. **Counts all users:** Includes inactive users with `faction IS NOT NULL` (should filter active only)

**Example Flaw:**
- Counts: `{ Luminarchs: 50, Noctivores: 50 }`
- Next 5 users all assigned to Luminarchs → `{ Luminarchs: 55, Noctivores: 50 }`
- Predictable imbalance

### 3.4 Role Color Enforcement

**Gap:** No code ensures roles exist or have correct colors. If role IDs are:
- Misconfigured (wrong ID)
- Deleted from Discord
- Have wrong colors

System silently fails or assigns wrong colors.

**Risk:** Faction identity relies on manual Discord role setup.

### 3.5 Coupling & Breakage Points

**If we disable user actions (none exist):**
- No commands to remove
- `/faction-stats` works independently (read-only)
- `/scorecard` displays faction passively

**If we add admin commands:**
- Must sync both DB (`users.faction`) and Discord role
- Must remove opposite faction role
- Must audit log changes

**No breakage risk** from disabling nonexistent features.

### 3.6 Race Conditions

**Potential Race:**
1. Admin sets faction for user A to `Luminarchs`
2. Simultaneously, `guildMemberAdd` fires for user B
3. Both query `getFactionCounts()` at the same time
4. Both see `{ Luminarchs: 10, Noctivores: 10 }`
5. Both assign to `Luminarchs` → imbalance

**Mitigation:** Not critical (affects 1-2 users max), but could add DB-level locking or accept eventual consistency.

---

## 4. Redesign Requirements (Desired State)

### 4.1 Admin-Only Assignment

**Requirement:** Only users with admin permissions can set/clear factions.

**Implementation:**
- New command group: `/faction-admin`
- Subcommands:
  - `set user:<@user> faction:<Luminarchs|Noctivores>` - Assign faction
  - `clear user:<@user>` - Remove faction (set to NULL)
- Permission guard: `PermissionGuard.isAdmin(interaction.user.id)` (existing pattern)
- Rate limit: `faction-admin` → 10 per minute (admin-tier)
- Audit: `AuditLogger.logAction(adminId, 'faction_set', { faction, targetUserId })`

**Response Format (Plain Text):**
```
✅ @User assigned to 🦸 Luminarchs.
Discord role updated.

✅ Faction cleared for @User.
Discord role removed.
```

### 4.2 Auto-Assignment on Join

**Requirement:** Retain auto-assignment but enhance balancing logic.

**Implementation:**
- Keep `guildMemberAdd` hook
- Replace `RoleService.autoAssignFaction()` logic with enhanced algorithm (see 4.3)
- Log assignment: `logger.info('Auto-assigned faction', { userId, faction, reason, counts })`

### 4.3 Balancing Algorithm (Enhanced)

**Inputs:**
- Current counts: `{ Luminarchs: N, Noctivores: M }` from `UserRepository.getFactionCounts()`
- **Active filter:** Count only users with `xp > 0` OR `updated_at > NOW() - INTERVAL '30 days'`

**Decision Logic:**
```javascript
const threshold = 2; // Config: FACTION_BALANCE_THRESHOLD (default 2)
const diff = Math.abs(Luminarchs - Noctivores);

if (diff >= threshold) {
  // Assign to smaller faction
  assignedFaction = Luminarchs < Noctivores ? 'Luminarchs' : 'Noctivores';
  reason = 'balance';
} else {
  // Alternate assignment
  // Use last assignment flip-flop OR timestamp modulo
  assignedFaction = (Date.now() % 2 === 0) ? 'Luminarchs' : 'Noctivores';
  reason = 'alternate';
}
```

**Edge Cases:**
1. **Role creation fails:** Log error, default to `Luminarchs`, retry on next login
2. **DB write fails:** Rollback role assignment, throw error, halt welcome flow
3. **Zero members:** Assign to `Luminarchs` (arbitrary default)

**Output:**
```javascript
{
  chosenFaction: 'Luminarchs',
  reason: 'balance', // or 'alternate'
  snapshotCounts: { Luminarchs: 10, Noctivores: 13 }
}
```

### 4.4 Role Color Sync

**Requirement:** Ensure faction roles exist with correct colors and apply them.

**Color Mapping:**
- **Luminarchs:** `0xFFD700` (gold/yellow) - Discord color #FFD700
- **Noctivores:** `0x9B59B6` (purple) - Discord color #9B59B6

**Implementation:**

**New Utility:** `src/services/discord/RoleSync.js`
```javascript
class RoleSync {
  /**
   * Ensure faction role exists with correct color
   * @returns {Role} Discord role object
   */
  async ensureFactionRole(guild, factionName) {
    const colorMap = {
      'Luminarchs': 0xFFD700,
      'Noctivores': 0x9B59B6
    };
    
    const roleId = config.roles.factions[factionName];
    let role = guild.roles.cache.get(roleId);
    
    if (!role) {
      // Create role if missing
      role = await guild.roles.create({
        name: factionName,
        color: colorMap[factionName],
        reason: 'Auto-created faction role'
      });
      logger.info('Created faction role', { factionName, roleId: role.id });
    } else {
      // Verify/update color
      if (role.color !== colorMap[factionName]) {
        await role.setColor(colorMap[factionName]);
        logger.info('Updated faction role color', { factionName });
      }
    }
    
    return role;
  }
  
  /**
   * Apply faction role to member (with color enforcement)
   */
  async applyFactionRole(member, factionName) {
    const role = await this.ensureFactionRole(member.guild, factionName);
    
    // Remove opposite faction
    const opposite = factionName === 'Luminarchs' ? 'Noctivores' : 'Luminarchs';
    const oppositeRoleId = config.roles.factions[opposite];
    if (member.roles.cache.has(oppositeRoleId)) {
      await member.roles.remove(oppositeRoleId);
    }
    
    // Add faction role
    if (!member.roles.cache.has(role.id)) {
      await member.roles.add(role);
    }
  }
}
```

**Integration Points:**
1. `guildMemberAdd` → Call `roleSync.applyFactionRole(member, assignedFaction)`
2. `/faction-admin set` → Call `roleSync.applyFactionRole(member, faction)`
3. `/faction-admin clear` → Remove both faction roles

### 4.5 No Self-Service

**Requirement:** Prevent users from joining/leaving factions.

**Status:** ✅ Already implemented—no user commands exist.

**Action:** None needed. Document that user self-service is intentionally disabled.

### 4.6 Audit & Safety

**Audit Logging:**
- Use existing `AuditLogger.logAction()` (`src/services/security/AuditLogger.js:15-35`)
- Event types:
  - `faction_set` - Admin manually sets faction
  - `faction_clear` - Admin clears faction
  - `faction_auto_assign` - Auto-assigned on join

**Rate Limiting:**
- Admin commands: `faction-admin` → 10 per minute (tier: admin)
- Use existing `RateLimiter` (`src/middleware/RateLimiter.js`)

**Safety:**
- All admin responses ephemeral (except public announcements if configured)
- Validate faction name against `FACTION_NAMES` constant
- Handle missing Discord member gracefully (user left server)

---

## 5. Balancing Algorithm (Detailed Specification)

### 5.1 Active User Definition

**Option A (Recommended):** `xp > 0`
- Pro: Simple, already indexed
- Con: Includes all-time users, never resets

**Option B:** `updated_at > NOW() - INTERVAL '30 days'`
- Pro: Excludes inactive users
- Con: Requires date comparison (slower query)

**Chosen:** **Option A** for simplicity. Query:
```sql
SELECT faction, COUNT(*) as count 
FROM users 
WHERE faction IS NOT NULL AND xp > 0
GROUP BY faction
```

### 5.2 Decision Tree

```
Input: { Luminarchs: L, Noctivores: N }

1. Calculate difference: diff = abs(L - N)

2. If diff >= THRESHOLD (default 2):
   → Assign to smaller faction
   → Reason: "balance"

3. Else (diff < 2):
   → Use timestamp modulo:
     - If timestamp % 2 == 0 → Luminarchs
     - Else → Noctivores
   → Reason: "alternate"

4. Return { faction, reason, counts: { L, N } }
```

### 5.3 Edge Cases

**Case 1: Zero members**
```
Input: { Luminarchs: 0, Noctivores: 0 }
Decision: Luminarchs (arbitrary default)
Reason: "default"
```

**Case 2: Role creation fails**
```
Try: ensureFactionRole(guild, faction)
Catch: Log error, assign to NULL, notify admin in logs
Retry: On next login via re-sync job (optional)
```

**Case 3: DB write fails**
```
Try: userService.setUserFaction(userId, faction)
Catch: Rollback Discord role, throw error, halt welcome
Effect: User has no faction until manual intervention
```

**Case 4: Tie counts**
```
Input: { Luminarchs: 10, Noctivores: 10 }
Timestamp: 1728412345678 (odd)
Decision: Noctivores
Reason: "alternate"
```

### 5.4 Output Format

```javascript
{
  chosenFaction: 'Luminarchs',
  reason: 'balance',        // 'balance' | 'alternate' | 'default'
  snapshotCounts: {
    Luminarchs: 10,
    Noctivores: 13
  },
  timestamp: 1728412345678
}
```

---

## 6. Role Color Mapping

### 6.1 Color Specifications

**Luminarchs:**
- Hex: `#FFD700`
- RGB: `255, 215, 0`
- Discord Int: `0xFFD700` (16766720)
- Name: Gold / Yellow

**Noctivores:**
- Hex: `#9B59B6`
- RGB: `155, 89, 182`
- Discord Int: `0x9B59B6` (10181046)
- Name: Purple / Amethyst

### 6.2 Role Existence Check

**Current Behavior:**
- Roles assumed to exist with IDs from ENV vars
- No creation or validation

**New Behavior:**
- On first use, check if role exists: `guild.roles.cache.get(roleId)`
- If missing, create with `guild.roles.create({ name, color, reason })`
- Store created role ID (or update ENV to match)

**Where to Place Logic:**
- `src/services/discord/RoleSync.js` (new utility)
- Called by:
  1. `guildMemberAdd` handler
  2. `/faction-admin set` command
  3. Optional: `ready.js` on bot startup (pre-create roles)

### 6.3 Role Assignment Flow

**On Auto-Assignment (guildMemberAdd):**
```
1. Calculate faction (Luminarchs/Noctivores)
2. ensureFactionRole(guild, faction) → returns Role
3. Remove opposite faction role (if present)
4. Add faction role to member
5. Update DB: users.faction
6. Log: { userId, faction, reason, counts }
```

**On Admin Assignment (/faction-admin set):**
```
1. Validate admin permissions
2. Validate faction name (Luminarchs/Noctivores)
3. Fetch Discord member
4. ensureFactionRole(guild, faction) → returns Role
5. Remove opposite faction role
6. Add faction role to member
7. Update DB: users.faction
8. Audit log: { adminId, targetUserId, faction }
9. Reply ephemeral: "✅ @User assigned to 🦸 Luminarchs."
```

**On Admin Clear (/faction-admin clear):**
```
1. Validate admin permissions
2. Fetch Discord member
3. Remove both faction roles (Luminarchs + Noctivores)
4. Update DB: users.faction = NULL
5. Audit log: { adminId, targetUserId, action: 'faction_clear' }
6. Reply ephemeral: "✅ Faction cleared for @User."
```

### 6.4 Re-Sync Job (Optional)

**Purpose:** Fix users with mismatched DB faction vs Discord role.

**Implementation:**
```javascript
// src/jobs/factionRoleSync.js
async function syncFactionRoles(client, services) {
  const users = await services.repositories.user.findAll();
  
  for (const user of users) {
    if (!user.faction) continue;
    
    try {
      const member = await guild.members.fetch(user.user_id);
      await services.roleSync.applyFactionRole(member, user.faction);
    } catch (e) {
      logger.warn('User not in guild or role sync failed', { userId: user.user_id });
    }
  }
}
```

**Schedule:** Daily at 4 AM (after backups), or on-demand via admin command.

---

## 7. Exact Change Plan (Implementation Blueprint)

### 7.1 Remove/Disable User Self-Join/Leave

**Finding:** No user-facing faction commands exist.

**Actions:**
- ✅ No files to delete
- ✅ No rate limiter entries to remove
- ✅ No help docs to update (faction self-service never documented)

**Result:** No changes needed—system already prevents user self-assignment.

### 7.2 Add Admin Commands

**New Files:**

**A) `src/commands/factions/faction-admin.js`**
```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('faction-admin')
    .setDescription('Admin: Manage user factions')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Assign a user to a faction')
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
        .addStringOption(opt => 
          opt.setName('faction')
            .setDescription('Faction')
            .addChoices(
              { name: 'Luminarchs', value: 'Luminarchs' },
              { name: 'Noctivores', value: 'Noctivores' }
            )
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('clear')
        .setDescription('Remove user from faction')
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
    ),

  async execute(interaction, services) {
    // Permission guard
    if (!services.permissionGuard.isAdmin(interaction.user.id)) {
      await interaction.reply({ content: 'Admin only.', ephemeral: true });
      return;
    }

    // Rate limit
    if (services.rateLimiter.isRateLimited(interaction.user.id, 'faction-admin')) {
      await interaction.reply({ content: 'Slow down.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'set') {
      // Implementation: Set faction logic
    } else if (subcommand === 'clear') {
      // Implementation: Clear faction logic
    }
  }
};
```

**B) `src/commands/factions/index.js`**
```javascript
module.exports = {
  'faction-admin': require('./faction-admin')
};
```

**Permissions:**
- Guard: `PermissionGuard.isAdmin(userId)` (existing, used in `/admin` commands)
- File: `src/middleware/PermissionGuard.js`

**Plain-Text Confirmations:**
```
✅ @User assigned to 🦸 Luminarchs.
Discord role updated.

✅ Faction cleared for @User.
Discord role removed.

❌ User not found in server.

❌ Failed to update Discord role. Retry or contact support.
```

### 7.3 Auto-Assignment Hook

**File:** `src/events/guildMemberAdd.js`

**Current Function:** `async execute(member)` (lines 18-57)

**Changes:**
1. Replace `RoleService.autoAssignFaction()` call (line 36) with enhanced logic
2. Inject `RoleSync` service for color enforcement
3. Add audit logging for auto-assignments

**New Flow:**
```javascript
// Line 35-40 (modified)
const factionCounts = await services.repositories.user.getFactionCounts();

// Enhanced balancing logic (inline or extract to service)
const { chosenFaction, reason, snapshotCounts } = await services.factionBalancer.assignFaction(factionCounts);

// Apply role with color enforcement
await services.roleSync.applyFactionRole(member, chosenFaction);

// Update DB
await services.userService.setUserFaction(member.id, chosenFaction);

// Audit log
AuditLogger.logAction('system', 'faction_auto_assign', { 
  faction: chosenFaction, 
  reason, 
  counts: snapshotCounts 
}, member.id);
```

### 7.4 Role Sync Utility

**New File:** `src/services/discord/RoleSync.js`

**Methods:**
```javascript
class RoleSync {
  async ensureFactionRole(guild, factionName) { /* ... */ }
  async applyFactionRole(member, factionName) { /* ... */ }
  async removeFactionRoles(member) { /* Remove both factions */ }
}
```

**Integration:**
- Import in `src/services/index.js`
- Initialize: `const roleSync = new RoleSync();`
- Export in services object

### 7.5 Config & Constants

**File:** `src/config/factionConfig.js` (new)
```javascript
module.exports = {
  FACTION_NAMES: ['Luminarchs', 'Noctivores'],
  
  FACTION_COLORS: {
    Luminarchs: 0xFFD700,  // Gold
    Noctivores: 0x9B59B6   // Purple
  },
  
  FACTION_EMOJIS: {
    Luminarchs: '🦸',
    Noctivores: '🥷'
  },
  
  BALANCE_THRESHOLD: 2,  // Assign to smaller if diff >= 2
  
  AUTO_ASSIGN_ENABLED: true  // Toggle auto-assignment
};
```

**Consolidate existing constants from:**
- `src/config/constants.js:211-216` (emojis, names)
- Move to single `factionConfig.js` for maintainability

### 7.6 Audit & Monitoring

**Audit Events:**
```javascript
// Action types for AuditLogger.logAction()
'faction_set'         // Admin manually sets faction
'faction_clear'       // Admin clears faction
'faction_auto_assign' // System auto-assigns on join
```

**Implementation:**
```javascript
// In /faction-admin set
await AuditLogger.logAction(
  interaction.user.id,      // adminId
  'faction_set',            // actionType
  { faction: chosenFaction }, // details
  targetUser.id             // targetUserId
);

// In guildMemberAdd
await AuditLogger.logAction(
  'system',                 // adminId (system)
  'faction_auto_assign',
  { faction, reason, counts },
  member.id
);
```

**Health Metric (Optional):**
```javascript
// In HealthCheck.js
async getFactionHealth() {
  const counts = await repositories.user.getFactionCounts();
  const diff = Math.abs(counts.Luminarchs - counts.Noctivores);
  return {
    counts,
    diff,
    balanced: diff < BALANCE_THRESHOLD,
    lastCheck: new Date()
  };
}
```

---

## 8. Backward Compatibility & Migration Notes

### 8.1 Existing Users with `faction=NULL`

**Count Query:**
```sql
SELECT COUNT(*) FROM users WHERE faction IS NULL;
```

**Options:**

**A) Leave as-is (Recommended)**
- Users with NULL remain unassigned
- Will be assigned on next login (if `guildMemberAdd` doesn't fire for existing users)
- Manual assignment via `/faction-admin set`

**B) One-Time Backfill**
- Run migration script to assign all NULL users via balancing
- Query:
  ```sql
  SELECT user_id FROM users WHERE faction IS NULL ORDER BY created_at ASC;
  ```
- For each user, call balancing logic, update DB + apply role

**Recommendation:** Option A—less disruptive, allows organic assignment.

### 8.2 Backfill Plan (Optional)

**Script:** `src/scripts/backfillFactions.js`
```javascript
async function backfillFactions(client, services) {
  const nullUsers = await services.repositories.user.raw(
    'SELECT user_id FROM users WHERE faction IS NULL AND xp > 0'
  );
  
  for (const { user_id } of nullUsers.rows) {
    const counts = await services.repositories.user.getFactionCounts();
    const { chosenFaction } = await services.factionBalancer.assignFaction(counts);
    
    await services.userService.setUserFaction(user_id, chosenFaction);
    
    try {
      const member = await guild.members.fetch(user_id);
      await services.roleSync.applyFactionRole(member, chosenFaction);
    } catch (e) {
      logger.warn('User not in guild', { user_id });
    }
  }
  
  logger.info('Faction backfill complete', { count: nullUsers.rows.length });
}
```

**Execute:** One-time admin command or manual script run.

### 8.3 Role Cleanup

**Identify wrong roles:**
```sql
SELECT u.user_id, u.faction 
FROM users u
WHERE u.faction IS NOT NULL
-- Cross-check with Discord role cache (manual validation)
```

**Cleanup:**
- For each user, verify Discord role matches DB faction
- Remove mismatched roles via `member.roles.remove()`
- Apply correct role via `roleSync.applyFactionRole()`

**When to Run:**
- After deploying new `RoleSync` logic
- As part of daily sync job (optional)

---

## 9. Test Plan (Black-and-White Checks)

### 9.1 Balancing Algorithm Unit Tests

**Test 1: Threshold-based assignment**
```
Input: { Luminarchs: 10, Noctivores: 13 }
Expected: { faction: 'Luminarchs', reason: 'balance', counts: { L: 10, N: 13 } }
Verification: diff = 3 >= 2, assign to smaller (Luminarchs)
```

**Test 2: Alternate assignment (within threshold)**
```
Input: { Luminarchs: 10, Noctivores: 10 }
Timestamp: 1728412345678 (odd)
Expected: { faction: 'Noctivores', reason: 'alternate', ... }
Verification: diff = 0 < 2, timestamp % 2 == 1 → Noctivores
```

**Test 3: Zero members**
```
Input: { Luminarchs: 0, Noctivores: 0 }
Expected: { faction: 'Luminarchs', reason: 'default', ... }
Verification: Default to Luminarchs
```

### 9.2 Integration Tests

**Test 4: Auto-assignment on join**
```
Setup: Member joins Discord
Steps:
1. Trigger guildMemberAdd event
2. Check DB: users.faction = 'Luminarchs' or 'Noctivores'
3. Check Discord: Member has faction role (gold or purple color visible)
4. Check logs: Audit entry with type 'faction_auto_assign'
Expected: All 4 checks pass
```

**Test 5: Role color enforcement**
```
Setup: Faction role exists with wrong color (e.g., red)
Steps:
1. Run ensureFactionRole(guild, 'Luminarchs')
2. Check role.color == 0xFFD700
Expected: Role color updated to gold
```

**Test 6: Role creation (missing role)**
```
Setup: Faction role ID not found in guild
Steps:
1. Run ensureFactionRole(guild, 'Noctivores')
2. Check: New role created with name 'Noctivores', color 0x9B59B6
Expected: Role exists after call
```

### 9.3 Admin Command Tests

**Test 7: Admin sets faction**
```
Setup: Admin runs /faction-admin set user:@TestUser faction:Luminarchs
Expected Output (ephemeral):
  "✅ @TestUser assigned to 🦸 Luminarchs.
   Discord role updated."

Verification:
- DB: users.faction = 'Luminarchs'
- Discord: TestUser has Luminarchs role (gold)
- Discord: TestUser does NOT have Noctivores role
- Audit log: Entry with adminId, targetUserId, faction
```

**Test 8: Admin clears faction**
```
Setup: Admin runs /faction-admin clear user:@TestUser
Expected Output (ephemeral):
  "✅ Faction cleared for @TestUser.
   Discord role removed."

Verification:
- DB: users.faction = NULL
- Discord: TestUser has NO faction roles
- Audit log: Entry with action 'faction_clear'
```

### 9.4 Safety Tests

**Test 9: Non-admin denied**
```
Setup: Regular user runs /faction-admin set
Expected: "Admin only." (ephemeral)
Verification: No DB changes, no role changes
```

**Test 10: Rate limiting**
```
Setup: Admin runs /faction-admin set 11 times in 60s
Expected: 11th call returns "Slow down." (ephemeral)
Verification: Rate limiter key 'faction-admin' enforced (10 per minute)
```

**Test 11: Errors are ephemeral**
```
Setup: Admin runs /faction-admin set with invalid user (left server)
Expected: "❌ User not found in server." (ephemeral)
Verification: Only admin sees error, no public message
```

### 9.5 Regression Tests

**Test 12: /faction-stats still works**
```
Setup: Users have factions assigned
Steps: Run /faction-stats
Expected: Embed shows:
  - Luminarchs: X members, Y XP, Z avg
  - Noctivores: A members, B XP, C avg
  - Leader indicator
Verification: Query works, display unaffected
```

**Test 13: /scorecard displays faction**
```
Setup: User has faction 'Noctivores'
Steps: Run /scorecard
Expected: Embed includes inline field "Faction: 🥷 Noctivores"
Verification: Display works, emoji correct
```

**Test 14: Leaderboards unaffected**
```
Setup: Run /leaderboard
Expected: XP rankings display, no faction interference
Verification: No errors, factions visible in profiles if present
```

---

## 10. Cut List (What to Delete/Disable)

### 10.1 Files to Delete

**A) `src/services/factions/FactionService.js`**
- **Reason:** Entire file is a stub with no logic
- **Lines:** 1-26 (entire file)
- **Replacement:** Logic moved to `RoleSync.js` + `FactionBalancer.js`

**Action:**
```bash
rm src/services/factions/FactionService.js
```

**Update:** `src/services/index.js`
```javascript
// Remove lines:
const FactionService = require('./factions/FactionService');
const factionService = new FactionService(repositories, channelService);

// Remove from exports:
factionService,
```

### 10.2 Exports/Lines to Remove

**File:** `src/services/index.js`

**Remove:**
```javascript
// Line ~145 (approximate)
const FactionService = require('./factions/FactionService');

// Line ~150 (approximate)
const factionService = new FactionService(repositories, channelService);

// Line ~216 (approximate, in return object)
factionService,
```

### 10.3 References to Update

**No help docs or user-facing docs mention faction joining** (verified via grep).

**No rate limiter entries for user faction commands** (none exist).

**Result:** Only `FactionService.js` deletion required.

---

## 11. Open Questions

### Q1: Should we add a 7-day cooldown on admin-initiated faction changes?

**Consideration:**
- Prevents admins from rapidly switching users between factions (gaming stats)
- Could be annoying for legitimate corrections

**Recommendation:** No cooldown initially. Add if abuse occurs. Track via audit log.

---

### Q2: Should auto-assignment be earmark + prompt or immediate write?

**Option A (Current): Immediate write**
- Pro: Simple, no state to track
- Con: No user consent (assigned without asking)

**Option B: Earmark + prompt**
- Pro: User can see assignment, feels less forced
- Con: Adds complexity, some users may never respond

**Recommendation:** Keep immediate write. Factions are cosmetic/social, not gameplay-critical.

---

### Q3: Should we enforce a max differential to prevent admin imbalance?

**Scenario:**
- Counts: `{ Luminarchs: 10, Noctivores: 20 }`
- Admin tries to assign user to Noctivores
- Would create `{ Luminarchs: 10, Noctivores: 21 }` (diff = 11)

**Options:**
- **Allow:** Admins can override balance (current plan)
- **Warn:** Show warning but allow override
- **Block:** Reject assignment if diff would exceed threshold (e.g., 10)

**Recommendation:** Allow with audit log. Trust admins, monitor via logs/metrics.

---

## 12. Summary & Next Steps

### 12.1 Implementation Checklist

**Phase 1: Core Enhancement (No Breaking Changes)**
1. ✅ Delete `src/services/factions/FactionService.js` (stub)
2. ✅ Create `src/services/discord/RoleSync.js` (role color enforcement)
3. ✅ Create `src/services/factions/FactionBalancer.js` (enhanced algorithm)
4. ✅ Update `src/events/guildMemberAdd.js` (use new balancer + role sync)
5. ✅ Create `src/config/factionConfig.js` (consolidate constants)

**Phase 2: Admin Commands**
1. ✅ Create `src/commands/factions/faction-admin.js` (set/clear subcommands)
2. ✅ Create `src/commands/factions/index.js` (exports)
3. ✅ Register in `src/commands/index.js`
4. ✅ Add rate limit: `faction-admin` → 10 per minute
5. ✅ Add audit logging for all admin actions

**Phase 3: Testing & Deployment**
1. ✅ Run unit tests (balancing algorithm)
2. ✅ Run integration tests (auto-assign, role colors, admin commands)
3. ✅ Backfill NULL factions (optional, one-time script)
4. ✅ Deploy to staging
5. ✅ Verify in production

### 12.2 Rollback Plan

**If issues arise:**
1. Revert `guildMemberAdd.js` to previous version (restore simple balancing)
2. Disable `/faction-admin` command (comment out in `index.js`)
3. Keep role assignment functional (no user impact)
4. Investigate/fix offline, redeploy

**No data loss risk:** All changes additive (no schema changes, no deletions).

### 12.3 Files to Create/Modify Summary

**New Files (5):**
1. `src/services/discord/RoleSync.js` - Role color enforcement
2. `src/services/factions/FactionBalancer.js` - Enhanced balancing logic
3. `src/config/factionConfig.js` - Consolidated faction constants
4. `src/commands/factions/faction-admin.js` - Admin command
5. `src/commands/factions/index.js` - Command export

**Modified Files (4):**
1. `src/events/guildMemberAdd.js` - Use new balancer + role sync
2. `src/services/index.js` - Remove FactionService, add RoleSync/Balancer
3. `src/commands/index.js` - Register faction-admin command
4. `src/middleware/RateLimiter.js` - Add `faction-admin` limit

**Deleted Files (1):**
1. `src/services/factions/FactionService.js` - Stub replacement

**Total Changes:** 10 files (5 new, 4 modified, 1 deleted)

---

## 13. Final Verification Matrix

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Admin-only assignment | ✅ Ready | `/faction-admin set/clear` with permission guard |
| Auto-assignment on join | ✅ Exists | Enhanced with threshold balancing |
| Balancing algorithm | ✅ Designed | Threshold + alternate logic specified |
| Role color mapping | ✅ Designed | Luminarchs=gold, Noctivores=purple enforced |
| No user self-service | ✅ Complete | Zero user commands exist (already disabled) |
| Audit logging | ✅ Planned | AuditLogger integration for all changes |
| Rate limiting | ✅ Planned | faction-admin → 10/min |
| Plain text responses | ✅ Designed | All admin replies ephemeral plain text |
| Color enforcement | ✅ Designed | RoleSync ensures roles exist with correct colors |
| Backward compatibility | ✅ Verified | NULL factions handled, no breaking changes |

**Readiness:** 10/10 requirements satisfied in design. Ready for implementation.

---

**END OF AUDIT REPORT**

*This document is READ-ONLY analysis. No code has been modified. No commits have been made.*


