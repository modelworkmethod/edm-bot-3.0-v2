# BIG BEAUTIFUL EMBED GUIDE (Post Project Launch)

**Purpose**: This is an itemized aesthetics-upgrade map for Discord embeds and optional external HTML/CSS shells within the Embodied Dating Mastermind ecosystem. No art or code today—just a blueprint identifying every surface where polish can elevate user experience post-launch.

**Status**: Planning document for future UX/UI enhancements  
**Scope**: Main Bot (bot-v3.js) + Tensey Bot (separate app)  
**Target**: Discord embeds (primary) + External web views (optional)

═══════════════════════════════════════════════════════════════════════════════

## PRINCIPLES & GUARDRAILS

### Design Constraints (Discord Embeds)

**Discord Embed Components**:
- Title (256 chars)
- Description (4096 chars)
- Fields (max 25, name 256 chars, value 1024 chars)
- Footer (2048 chars)
- Color bar (hex integer)
- Thumbnail (small image, top-right)
- Image (large image, bottom)
- Author (name + icon)
- Timestamp (auto or custom)

**Best Practices**:
- ✅ Non-intrusive upgrades (fast first paint)
- ✅ Accessible color contrast (WCAG AA minimum)
- ✅ Dark-mode ready (test against Discord dark theme)
- ✅ Emoji restraint (enhance, don't clutter)
- ✅ Mobile-first (Discord mobile has narrow embeds)
- ✅ Field inline=true for compact 2-column layouts
- ✅ Use footer for metadata (timestamps, version, source)

---

### External Shell Constraints (Optional)

**When to Use External HTML/CSS**:
- Complex multi-column layouts (beyond Discord embed limits)
- Rich data visualizations (charts, graphs, heat maps)
- Admin-only dashboards (not for general users)
- Deep-dive analytics (weekly reports, trend analysis)

**Implementation Notes**:
- Static HTML/CSS pages or server-generated image cards
- Hosted separately, linked via embed buttons or URLs
- No art direction here—just structure and data sources
- Accessibility: semantic HTML, ARIA labels, keyboard nav

═══════════════════════════════════════════════════════════════════════════════

## BRAND TOKEN PLACEHOLDERS

**Note**: Actual values to be defined by brand system later. Use these placeholders in implementation.

### Color Palette

- `BRAND_PRIMARY` - Primary brand color (action buttons, headers)
- `BRAND_ACCENT` - Accent color (highlights, success states)
- `BRAND_DANGER` - Error/warning color
- `BRAND_SUCCESS` - Success/completion color
- `NEUTRAL_BG` - Background color (cards, panels)
- `NEUTRAL_TEXT` - Default text color
- `NEUTRAL_MUTED` - Muted text (meta info, timestamps)

### Typography

- `FONT_STACK_UI` - Sans-serif stack (headings, UI elements)
- `FONT_STACK_MONO` - Monospace stack (code, stats, numbers)
- `FONT_SIZE_BASE` - Base font size (16px equivalent)

### Spacing

- `SPACING_SCALE` - Spacing scale (e.g., 4px base, 8/12/16/24/32/48/64)

### Effects

- `RADIUS_SM` - Small border radius (buttons, tags)
- `RADIUS_LG` - Large border radius (cards, panels)
- `SHADOW_S` - Small shadow (hover states)
- `SHADOW_M` - Medium shadow (cards)
- `SHADOW_L` - Large shadow (modals, overlays)

**Current Brand Hints** (from codebase):
- Primary: `0xFF1E27` (red) - src/config/settings.js:88
- Faction emojis exist - src/config/constants.js (Warrior/Mage/Templar)
- Tier colors defined - src/config/constants.js

═══════════════════════════════════════════════════════════════════════════════

## SURFACES INVENTORY — DISCORD EMBEDS

### 1. LEADERBOARD (/leaderboard)

**Trigger**: User runs `/leaderboard [limit]`  
**File**: `src/commands/leaderboard/leaderboard.js`

**Primary Data**:
- Top users by XP (ranked 1-50)
- Username, level, XP total
- Current rank position

**Current Implementation**: Basic embed with user list

**Aesthetic Opportunities**:
- ✅ Medal emojis for top 3 (🥇🥈🥉)
- ✅ Color bar varies by user's own rank (gold/silver/bronze tiers)
- ✅ Thumbnail: Guild icon or leaderboard trophy badge
- ✅ Footer: "Updated" timestamp + total users tracked
- ✅ Fields: Inline for compact 2-column layout (mobile-friendly)
- ✅ Author: "XP Leaderboard" with icon
- ⚠️ Image: Optional full leaderboard chart (top 25 bars)
- ⚠️ Progress bars: Unicode bars showing XP to next level (▓▓▓░░)

**Dependencies**: UserRepository.getTopByXP()

**Priority**: **P1** (high-traffic command)

---

### 2. FACTION STATS (/faction-stats)

**Trigger**: User runs `/faction-stats`  
**File**: `src/commands/leaderboard/faction-stats.js`

**Primary Data**:
- Faction XP totals (Warrior/Mage/Templar)
- User counts per faction
- Top users per faction

**Current Implementation**: Faction war leaderboard embed

**Aesthetic Opportunities**:
- ✅ Color bar matches winning faction theme
- ✅ Faction emojis from constants (FACTION_EMOJIS)
- ✅ Side-by-side faction comparison (inline fields)
- ✅ Thumbnail: Winning faction icon/badge
- ⚠️ Image: Faction war battle visualization (bar chart comparison)
- ✅ Footer: War status, time remaining (if event-based)
- ⚠️ Animated GIF: Optional "faction war" animated badge

**Dependencies**: UserRepository, FactionService (stub)

**Priority**: **P2** (engagement feature)

---

### 3. SCORECARD (/scorecard)

**Trigger**: User runs `/scorecard [user]`  
**File**: `src/commands/stats/scorecard.js`

**Primary Data**:
- User XP, level, rank
- All stats (approaches, dates, gym, etc.)
- K/D ratios
- Archetype affinity
- Faction
- Comparison mode (self vs other user)

**Current Implementation**: Comprehensive stats embed

**Aesthetic Opportunities**:
- ✅ Color bar by archetype (Warrior/Mage/Templar theme)
- ✅ Thumbnail: User avatar
- ✅ Archetype badge in author line
- ✅ Faction icon in footer
- ✅ Stats fields: Inline 2-column layout
- ⚠️ Progress bars: Unicode bars for stats (▓▓▓▓░░░░ 50/100)
- ⚠️ Image: Mini radar chart (6-axis affinity wheel)
- ✅ Comparison mode: Side-by-side fields with delta indicators (↑↓)
- ⚠️ Tier badges: Visual tier indicator (Bronze/Silver/Gold/Platinum)

**Dependencies**: UserRepository, StatsRepository, ArchetypeService

**Priority**: **P1** (core user engagement)

---

### 4. STATS SUBMISSION CONFIRMATION (submit-stats, submit-past-stats)

**Trigger**: After modal submit, confirmation reply  
**Files**: `src/commands/stats/submit-stats.js`, `src/commands/stats/submit-past-stats.js`

**Primary Data**:
- Stats submitted (list)
- XP earned
- Level up notification (if applicable)
- Streak status
- Multipliers applied

**Current Implementation**: Text reply or basic embed

**Aesthetic Opportunities**:
- ✅ Color bar: Success green
- ✅ Title: "📊 Stats Submitted!" with checkmark
- ✅ Fields: Stats submitted (inline), XP earned (prominent), Multipliers (stacked)
- ✅ Footer: Streak count (🔥 X day streak)
- ⚠️ Thumbnail: Archetype badge or streak fire icon
- ⚠️ Image: Optional level-up celebration graphic (if leveled up)
- ⚠️ Confetti animation via GIF (level-up milestone)

**Dependencies**: StatsProcessor, XPCalculator, MultiplierService

**Priority**: **P1** (daily user touchpoint)

---

### 5. LEVEL-UP ANNOUNCEMENT (auto-triggered)

**Trigger**: User levels up after stat submission  
**File**: Triggered from stats processing logic

**Primary Data**:
- User mention
- Old level → New level
- XP total
- Next level threshold
- Unlocks (if any at this level)

**Current Implementation**: Announcement to channel

**Aesthetic Opportunities**:
- ✅ Color bar: Gold for major milestones (10/25/50), tier color otherwise
- ✅ Title: "🎉 LEVEL UP!" with celebration emoji
- ✅ Description: "@User reached Level X!"
- ✅ Fields: XP Total, Next Milestone, Unlocks (if any)
- ✅ Thumbnail: Level badge or tier icon
- ⚠️ Image: Level-up celebration banner (varies by tier)
- ✅ Footer: Archetype + faction
- ⚠️ Special callout: **LEVEL 50: FREE EVENT UNLOCK** (banner image)

**Dependencies**: AnnouncementQueue, LevelCalculator

**Priority**: **P1** (social motivation)

---

### 6. ADMIN ANNOUNCEMENTS (general announcements)

**Trigger**: Various announcement triggers (raids, events, milestones)  
**File**: `src/services/notifications/AnnouncementQueue.js`

**Primary Data**: Varies by announcement type

**Aesthetic Opportunities**:
- ✅ Color bar by urgency/type (info/success/warning)
- ✅ Title with contextual emoji (🎯🔥⚡🎉)
- ✅ Author: Bot name + icon
- ⚠️ Thumbnail: Event-specific icon
- ⚠️ Image: Optional banner for major events
- ✅ Footer: Event duration (if time-limited)

**Dependencies**: AnnouncementQueue, ChannelService

**Priority**: **P2** (engagement amplifier)

---

### 7. DOUBLE XP EVENTS (/set-double-xp, auto-announcements)

**Trigger**: Admin creates event, start/end announcements  
**Files**: `src/commands/admin/set-double-xp.js`, `src/services/events/DoubleXPManager.js`

**Primary Data**:
- Event name
- Multiplier (e.g., 2x, 3x)
- Start/end times
- Countdown timer
- Affected users (if targeted)

**Aesthetic Opportunities**:
- ✅ Color bar: Vibrant accent (yellow/gold for 2x+)
- ✅ Title: "⚡ DOUBLE XP EVENT LIVE!"
- ✅ Description: Event details with countdown
- ✅ Fields: Multiplier, Duration, Ends In (countdown)
- ⚠️ Thumbnail: Lightning bolt badge or multiplier icon
- ⚠️ Image: Event banner with multiplier callout
- ✅ Footer: "Check back often for bonus XP!"
- ⚠️ Animated GIF: Optional pulse/glow effect

**Dependencies**: DoubleXPManager, ChannelService

**Priority**: **P2** (limited-time engagement)

---

### 8. BOSS RAIDS (start-raid, raid-status)

**Trigger**: `/start-raid`, `/raid-status`, auto-updates  
**Files**: `src/commands/admin/start-raid.js`, `src/commands/raids/raid-status.js`, `src/services/raids/RaidManager.js`

**Primary Data**:
- Raid type (Warrior/Mage)
- Boss HP (current/total)
- Progress bar
- Top contributors
- Time remaining
- Bonus points multiplier

**Aesthetic Opportunities**:
- ✅ Color bar: Faction color (Warrior red, Mage blue)
- ✅ Title: "⚔️ WARRIOR RAID IN PROGRESS" with faction emoji
- ✅ Description: Boss HP bar (Unicode: ▓▓▓▓▓░░░░░ 5000/10000)
- ✅ Fields: Top Contributors (inline), Time Remaining, Bonus Multiplier
- ⚠️ Thumbnail: Boss icon or raid banner
- ⚠️ Image: Raid progress visualization (damage dealt over time)
- ✅ Footer: "Contribute now! Points doubled for raid completions"
- ⚠️ Live Updates: Edit embed every 30s with updated progress

**Dependencies**: RaidManager, repositories

**Priority**: **P2** (community event)

---

### 9. BARBIE LIST (/barbie actions)

**Trigger**: `/barbie add/list/view`, opener generation  
**File**: `src/commands/barbie/barbie.js`, `src/services/barbie/BarbieListManager.js`

**Primary Data**:
- Contact list (names, notes, last interaction)
- Generated openers (AI-powered)
- Follow-up reminders

**Aesthetic Opportunities**:
- ✅ Color bar: Soft pink/purple (contact management theme)
- ✅ Title: "📇 Your Barbie List" with contact icon
- ✅ Fields: Each contact as field (name, notes, last contact)
- ✅ Thumbnail: Contact icon or heart badge
- ⚠️ Generated opener: Boxed quote style (Discord quote markdown: `> `)
- ✅ Footer: Total contacts, XP earned from interactions
- ⚠️ Button actions: Generate opener, log follow-up (already implemented)

**Dependencies**: BarbieListManager, SecondaryXPProcessor

**Priority**: **P2** (utility feature)

---

### 10. COURSE MODULE (/course, course progress)

**Trigger**: `/course [module]`, progress tracking  
**Files**: `src/commands/course/course.js`, `src/services/course/CourseManager.js`

**Primary Data**:
- Module title
- Video list
- User progress (videos watched, module completion %)
- Q&A history

**Aesthetic Opportunities**:
- ✅ Color bar: Teal/purple (learning theme)
- ✅ Title: "📚 Module X: [Title]"
- ✅ Description: Module overview
- ✅ Fields: Videos (checkmark if watched), Progress (inline)
- ⚠️ Progress bar: Unicode bar (▓▓▓▓▓░░░░░ 60%)
- ✅ Thumbnail: Module icon or completion badge
- ⚠️ Image: Module cover art or certificate (100% complete)
- ✅ Footer: "X/Y videos watched | Asked Z questions"
- ⚠️ Button: "Start Next Video" (if available)

**Dependencies**: CourseManager, SecondaryXPProcessor

**Priority**: **P2** (educational pillar)

---

### 11. HELP SYSTEM (/help)

**Trigger**: `/help [topic]`, AI chatbot responses  
**Files**: `src/commands/help/help.js`, `src/services/onboarding/OnboardingChatbot.js`

**Primary Data**:
- Question asked
- AI-generated response
- Related topics
- Next steps

**Aesthetic Opportunities**:
- ✅ Color bar: Friendly blue (help theme)
- ✅ Title: "💡 Help: [Topic]"
- ✅ Description: AI response (formatted, use quote blocks for emphasis)
- ✅ Fields: Related Topics (links to other help), Quick Actions
- ✅ Thumbnail: Lightbulb or guide icon
- ⚠️ Image: Optional topic-specific visual guide
- ✅ Footer: "Ask another question anytime!"
- ⚠️ Expandable sections: Use spoiler tags for detailed explanations

**Dependencies**: OnboardingChatbot, OnboardingTemplate

**Priority**: **P2** (new user onboarding)

---

### 12. SECURITY ALERTS (/security subcommands)

**Trigger**: `/security warn/warnings/flags/audit/backup`  
**File**: `src/commands/admin/security.js`, `src/services/security/`

**Primary Data**:
- Warning issued (user, reason, severity)
- Warning history (strikes)
- Content flags (toxic messages)
- Audit log (admin actions)
- Backup status

**Aesthetic Opportunities**:

#### Warning Issued:
- ✅ Color bar: Yellow/orange/red by severity (low/medium/high/critical)
- ✅ Title: "⚠️ Warning Issued - Strike X/3"
- ✅ Fields: User, Reason, Severity, Total Strikes, Action Taken
- ✅ Footer: "Review with /security warnings @user"

#### Audit Log:
- ✅ Color bar: Neutral gray (audit theme)
- ✅ Title: "🔍 Audit Log"
- ✅ Description: Paginated log entries
- ✅ Fields: Each entry (timestamp, admin, action, target)
- ✅ Footer: Showing X-Y of Z entries

#### Backup Status:
- ✅ Color bar: Green (success) or red (failure)
- ✅ Title: "💾 Backup Complete" or "❌ Backup Failed"
- ✅ Fields: Filename, Size, Duration
- ✅ Footer: Next scheduled backup time

**Dependencies**: WarningSystem, ContentModerator, AuditLogger, BackupManager

**Priority**: **P2** (admin operations)

---

### 13. COACHING DASHBOARD (/coaching-dashboard, /coaching-insights)

**Trigger**: Admin runs coaching commands  
**Files**: `src/commands/admin/coaching-dashboard.js`, `src/commands/admin/coaching-insights.js`

**Primary Data**:
- Inactive users (last activity, days inactive)
- Engagement metrics (chat, wins, stats submissions)
- Risk scores (RiskScorer)
- Behavioral patterns (PatternDetector)
- Suggested interventions (InterventionGenerator)

**Aesthetic Opportunities**:

#### Dashboard:
- ✅ Color bar: Professional blue/gray
- ✅ Title: "📊 Coaching Dashboard"
- ✅ Fields: Inactive Users (table), Engagement Summary, At-Risk Count
- ✅ Thumbnail: Dashboard icon
- ⚠️ Buttons: Send Reminders, Export List (already implemented)

#### Insights:
- ✅ Color bar: By risk level (green/yellow/red)
- ✅ Title: "🎯 Coaching Insights: @User"
- ✅ Fields: Risk Score, Pattern Detected, Suggested Intervention, Recent Activity
- ⚠️ Mini chart: Activity trend (last 30 days, Unicode sparkline)
- ✅ Footer: Last updated timestamp

**Dependencies**: RiskScorer, PatternDetector, InterventionGenerator, EngagementTracker

**Priority**: **P2** (admin/coach tool)

---

### 14. COURSE ADMIN (/course-admin)

**Trigger**: Admin manages course content  
**File**: `src/commands/admin/course-admin.js`

**Primary Data**:
- Module management (add/edit)
- Video management
- Q&A queue (unanswered questions)

**Aesthetic Opportunities**:
- ✅ Color bar: Teal (admin theme)
- ✅ Title: "🎓 Course Admin Panel"
- ✅ Fields: Module list, Pending Questions (count), Recent Activity
- ✅ Thumbnail: Admin badge
- ✅ Footer: Total modules, total videos

**Dependencies**: CourseManager

**Priority**: **P3** (admin utility)

---

### 15. WELCOME MESSAGE (guildMemberAdd event)

**Trigger**: New user joins server  
**File**: `src/events/guildMemberAdd.js`

**Primary Data**:
- User mention
- Welcome message
- Getting started instructions
- Faction assignment

**Current Implementation**: Welcome DM + general channel message

**Aesthetic Opportunities**:
- ✅ Color bar: Bright, welcoming (brand primary)
- ✅ Title: "👋 Welcome to Embodied Dating Mastermind!"
- ✅ Description: Warm welcome text + quick start guide
- ✅ Fields: Your Faction, First Steps, Get Help (/help)
- ✅ Thumbnail: Server icon or welcome badge
- ⚠️ Image: Welcome banner with brand visuals
- ✅ Footer: "You've been assigned to [Faction]!"

**Dependencies**: guildMemberAdd event, FactionService

**Priority**: **P1** (first impression)

---

### 16. NIGHTLY REMINDERS (auto-DM)

**Trigger**: 5pm EST daily (if enabled)  
**File**: `src/services/notifications/ReminderService.js`

**Primary Data**:
- User mention
- Reminder to submit stats
- Current streak status
- XP earned today (if any)

**Aesthetic Opportunities**:
- ✅ Color bar: Warm reminder color (orange/amber)
- ✅ Title: "⏰ Time to Submit Your Daily Stats!"
- ✅ Description: Friendly reminder text
- ✅ Fields: Your Streak (🔥 X days), Today's XP, Submit Now (button)
- ✅ Thumbnail: Clock or reminder icon
- ⚠️ Image: Optional motivational quote or daily challenge banner
- ✅ Footer: "Keep your streak alive!"

**Dependencies**: ReminderService, StatsRepository

**Priority**: **P2** (engagement retention)

---

### 17. CTJ BREAKTHROUGH DETECTION (auto-triggered)

**Trigger**: AI detects breakthrough in journal entry  
**Files**: `src/services/ctj/CTJAnalyzer.js`, `src/commands/ctj/breakthroughs.js` (not implemented)

**Primary Data**:
- User mention
- Journal excerpt (breakthrough moment)
- Sentiment analysis
- Themes detected
- Recommended actions

**Aesthetic Opportunities**:
- ✅ Color bar: Bright gold (breakthrough theme)
- ✅ Title: "✨ BREAKTHROUGH DETECTED!"
- ✅ Description: Journal excerpt (quoted)
- ✅ Fields: Themes, Sentiment, Coach Feedback
- ⚠️ Thumbnail: Trophy or star badge
- ⚠️ Image: Breakthrough celebration graphic
- ✅ Footer: "Celebrate this win in #wins!"

**Dependencies**: CTJAnalyzer, SecondaryXPProcessor

**Priority**: **P2** (emotional milestones)

**Status**: ⚠️ Command implementation pending (journal.js, breakthroughs.js)

---

### 18. DUEL CHALLENGE (duel lifecycle)

**Trigger**: `/duel challenge/accept`, auto-updates, winner announcement  
**Files**: `src/commands/duels/duel.js` (not implemented), `src/services/duels/DuelManager.js`

**Primary Data**:
- Challenger vs Opponent
- XP wagered
- Time remaining
- Stats comparison
- Winner declaration

**Aesthetic Opportunities**:

#### Challenge Issued:
- ✅ Color bar: Battle red
- ✅ Title: "⚔️ DUEL CHALLENGE!"
- ✅ Description: "@Challenger challenges @Opponent to a duel!"
- ✅ Fields: Wager (XP), Challenger Stats, Opponent Stats, Accept/Decline buttons
- ⚠️ Thumbnail: Crossed swords icon
- ⚠️ Image: VS card (Challenger vs Opponent)

#### Winner Announcement:
- ✅ Color bar: Gold
- ✅ Title: "🏆 DUEL WINNER: @Winner!"
- ✅ Description: Match summary
- ✅ Fields: Final Stats, XP Won/Lost, New Rankings
- ⚠️ Image: Victory banner

**Dependencies**: DuelManager, StatsProcessor

**Priority**: **P2** (PvP engagement)

**Status**: ⚠️ Command implementation pending (duel.js)

---

### 19. TEXTING SIMULATOR (practice/send/finish)

**Trigger**: `/texting-practice`, message exchange, scoring  
**Files**: `src/commands/texting/*.js` (not implemented), `src/services/texting/TextingSimulator.js`

**Primary Data**:
- Scenario name
- User's messages
- AI responses
- Score breakdown
- Feedback

**Aesthetic Opportunities**:

#### Scenario Start:
- ✅ Color bar: Purple (practice theme)
- ✅ Title: "💬 Texting Practice: [Scenario]"
- ✅ Description: Scenario setup
- ✅ Fields: Your Goal, Character Info

#### Scoring:
- ✅ Color bar: By score (green >80, yellow 60-80, red <60)
- ✅ Title: "📊 Practice Complete - Score: X/100"
- ✅ Fields: Tone, Flirtation, Timing, Breakdown
- ⚠️ Progress bars: Each scoring dimension (▓▓▓▓▓░░░░░)
- ✅ Footer: "XP Earned: +50"

**Dependencies**: TextingSimulator, SecondaryXPProcessor

**Priority**: **P2** (skill building)

**Status**: ⚠️ Command implementation pending (texting-*.js)

---

### 20. AUTOMATED WARNINGS (ContentModerator auto-flag)

**Trigger**: Toxic content detected in user message  
**File**: `src/services/security/ContentModerator.js`

**Primary Data**:
- Flagged message excerpt
- Flag reason (toxic language, spam, red flag ideology)
- User mention
- Admin review link

**Aesthetic Opportunities**:
- ✅ Color bar: Red (warning)
- ✅ Title: "🚨 Content Flagged for Review"
- ✅ Fields: User, Reason, Message Excerpt (truncated), Severity
- ✅ Thumbnail: Warning icon
- ✅ Footer: "Review with /security flags"
- ⚠️ Admin-only channel (not public)

**Dependencies**: ContentModerator, ChannelService

**Priority**: **P3** (admin utility)

---

### 21. HEALTH CHECK STATUS (if enabled)

**Trigger**: Scheduled health checks (every 5 min if enabled)  
**File**: `src/services/monitoring/HealthCheck.js`

**Primary Data**:
- Discord connection status
- Database connection status
- Memory usage
- Uptime
- Last check timestamp

**Aesthetic Opportunities**:
- ✅ Color bar: Green (healthy) or red (unhealthy)
- ✅ Title: "🏥 System Health Check"
- ✅ Fields: Discord (PASS/FAIL), Database (PASS/FAIL), Memory, Uptime
- ⚠️ Memory gauge: Unicode bar (▓▓░░░░░░░░ 45 MB / 120 MB)
- ✅ Footer: Last check timestamp
- ⚠️ Admin-only channel

**Dependencies**: HealthCheck (env-gated: SECOPS_ENABLE_HEALTHCHECKS)

**Priority**: **P3** (ops monitoring)

---

### 22. BACKUP CONFIRMATION (manual or auto)

**Trigger**: `/security backup` or auto-backup (3 AM)  
**File**: `src/services/backup/BackupManager.js`

**Primary Data**:
- Backup filename
- File size
- Duration
- Success/failure status

**Aesthetic Opportunities**:
- ✅ Color bar: Green (success) or red (failure)
- ✅ Title: "💾 Database Backup Complete"
- ✅ Fields: Filename, Size, Duration, Next Scheduled
- ✅ Footer: Backup location path
- ⚠️ Admin-only channel

**Dependencies**: BackupManager (env-gated: SECOPS_ENABLE_AUTOBACKUP)

**Priority**: **P3** (ops utility)

---

### 23. GDPR EXPORT (/security export-data)

**Trigger**: Admin exports user data  
**File**: `src/services/compliance/GDPRExporter.js`

**Primary Data**:
- Export complete confirmation
- Filename
- Data categories included
- File attachment

**Aesthetic Opportunities**:
- ✅ Color bar: Neutral gray (compliance theme)
- ✅ Title: "📄 GDPR Data Export Complete"
- ✅ Description: "User data exported successfully"
- ✅ Fields: User, Export Date, Categories, File Size
- ✅ Footer: "Attachment contains complete user data"
- ⚠️ Admin-only, ephemeral reply

**Dependencies**: GDPRExporter

**Priority**: **P3** (compliance utility)

---

### 24. AUTOMATION MONITOR (/automation-monitor)

**Trigger**: Admin checks automation health  
**File**: `src/commands/admin/automation-monitor.js` (Phase 12, may not be in index)

**Primary Data**:
- Webhook status
- Recent automation logs
- Success/failure rates
- Airtable sync status
- Email delivery status

**Aesthetic Opportunities**:
- ✅ Color bar: By health (green/yellow/red)
- ✅ Title: "🤖 Automation Health Monitor"
- ✅ Fields: Webhooks (status), Airtable Sync (last sync), Email Queue, Error Rate
- ⚠️ Status indicators: ✅❌⚠️ for each automation
- ✅ Footer: Last checked timestamp

**Dependencies**: AutomationLogger, phase 12 services

**Priority**: **P3** (admin monitoring)

**Status**: ⚠️ Phase 12 partial integration

═══════════════════════════════════════════════════════════════════════════════

## SURFACES INVENTORY — EXTERNAL HTML/CSS SHELLS

**Note**: Optional web views for deep-dive analytics and admin dashboards. Not required for MVP.

### 1. PERSONAL SCORECARD WEB VIEW

**Linked From**: `/scorecard` button "View Full Report"

**Purpose**: Comprehensive user stats deep-dive beyond Discord embed limits

**Key Sections**:
- Hero: User avatar, level, XP, rank (large display)
- Stats Grid: All stats with icons (approaches, dates, gym, etc.)
- Progress Charts: Line charts (XP over time, stats trends)
- Archetype Radar: 6-axis radar chart (Warrior/Mage/Templar affinities)
- Achievements: Unlock badges, milestones, streaks
- Faction Standing: Position within faction

**Layout Notes**:
- Grid layout (3-4 columns desktop, 1 column mobile)
- Card-based sections (stats, charts, achievements)
- Progress bars for each stat (horizontal bars with labels)
- Color-coded by archetype dominance

**Data Sources**: UserRepository, StatsRepository, ArchetypeService

**Priority**: **P2** (engagement retention)

---

### 2. COACHING COMMAND CENTER

**Linked From**: `/coaching-dashboard` button "Open Full Dashboard"

**Purpose**: Admin-only comprehensive coaching analytics

**Key Sections**:
- Overview: Total users, active/inactive breakdown, risk distribution
- At-Risk Users: Table with risk scores, patterns, last activity
- Engagement Heatmap: Weekly activity grid (chat, wins, stats)
- Intervention Queue: Suggested actions, priority, target users
- Analytics Charts: XP velocity trends, stat correlations, dropout prediction

**Layout Notes**:
- Admin dashboard layout (sidebar nav, main panel)
- Sortable tables (by risk, last activity, XP)
- Filter controls (by faction, archetype, risk level)
- Export buttons (CSV download)

**Data Sources**: RiskScorer, PatternDetector, InterventionGenerator, EngagementTracker

**Priority**: **P3** (admin tool)

---

### 3. ANALYTICS & TRENDS HUB

**Linked From**: `/admin analytics` or dedicated analytics command

**Purpose**: Community-wide analytics and trend visualization

**Key Sections**:
- XP Trends: Line chart (community XP over time)
- Stat Distribution: Bar charts (approaches, dates, gym)
- Faction War Timeline: Historical faction standings
- Milestone Tracker: Community achievements (total approaches, total dates)
- Engagement Pulse: Active users per day (area chart)
- Correlation Matrix: Stat relationships (heat map)

**Layout Notes**:
- Dashboard grid (2x3 chart panels)
- Date range selector (7/30/90 days)
- Download charts as PNG
- Responsive breakpoints

**Data Sources**: EngagementTracker, ChartGenerator (Phase 8), repositories

**Priority**: **P3** (analytics deep-dive)

---

### 4. FACTIONS OVERVIEW & WAR ROOM

**Linked From**: `/faction-stats` button "War Room"

**Purpose**: Faction war status, history, and pride

**Key Sections**:
- Current Standings: Large faction comparison (XP, users, active members)
- War History: Timeline of faction dominance (line chart)
- Top Contributors: Per-faction leaderboards
- Faction Buffs: Active bonuses, upcoming events
- Faction Lore: Brief faction descriptions (Warrior/Mage/Templar)

**Layout Notes**:
- Split-screen or tabbed by faction
- Hero section with current war leader
- Timeline scroll (historical war results)
- Color-coded by faction theme

**Data Sources**: UserRepository, FactionService (stub), raid_events

**Priority**: **P3** (community pride)

---

### 5. DUELS & RAIDS MATCH PAGES

**Linked From**: Duel/raid announcement embeds

**Purpose**: Live match tracking and history

**Key Sections** (Duel):
- Duel Card: Challenger vs Opponent (head-to-head)
- Live Stats: Real-time stat comparison
- Match Timer: Countdown to finalization
- Betting Pool: (future feature placeholder)
- Match History: Previous duel results

**Key Sections** (Raid):
- Boss HP Bar: Large progress visualization
- Damage Leaderboard: Top contributors (live updates)
- Faction Breakdown: Contribution by faction
- Timeline: Damage dealt over time (area chart)
- Loot Preview: Rewards for completion

**Layout Notes**:
- Live refresh (WebSocket or polling)
- Dramatic hero sections (boss image, VS card)
- Leaderboard tables with avatars

**Data Sources**: DuelManager, RaidManager, raid_contributions, duels

**Priority**: **P3** (engagement spectacle)

**Status**: ⚠️ Duel commands pending implementation

---

### 6. COURSE MODULE BROWSER

**Linked From**: `/course` button "Open Course Portal"

**Purpose**: Rich course content viewer beyond Discord embeds

**Key Sections**:
- Module Grid: All 7 modules with progress indicators
- Video Player: Embedded video with progress tracking
- Q&A Section: Ask questions, view answered questions
- Progress Tracker: Overall course completion %
- Certificate: Completion certificate (100% modules)

**Layout Notes**:
- Card grid (module tiles)
- Video embed with native controls
- Collapsible Q&A threads
- Progress ring or bar (prominent)

**Data Sources**: CourseManager, course_modules, course_videos, user_module_progress

**Priority**: **P3** (educational enhancement)

---

### 7. TENSEY CHECKLIST WEB SHELL

**Linked From**: Tensey Bot `/tenseylist` button "Open Web Checklist"

**Purpose**: Pretty wrapper for 303 challenges (desktop-friendly)

**Key Sections**:
- Challenge Grid: All 303 challenges organized by level (25 levels)
- Filters: By level, by completion status, by difficulty
- Challenge Detail: Hover/click for full description
- Progress Stats: X/303 completed, level breakdown
- Leaderboard: Top completers

**Layout Notes**:
- Grid or list view toggle
- Sticky level navigation (sidebar or tabs)
- Checkboxes or toggle buttons (✅⬜)
- Search/filter bar
- Color-coded by level difficulty

**Data Sources**: Tensey Bot SQLite (user_progress), challenges.js (303 challenges)

**Priority**: **P3** (Tensey Bot enhancement)

**Note**: Separate Tensey Bot app, shares PostgreSQL with main bot

---

### 8. LIVE EVENT UNLOCK PAGE (Level 50+)

**Linked From**: Level-up announcement for Level 50

**Purpose**: Exclusive content gateway (gated by level)

**Key Sections**:
- Unlock Announcement: "You've reached Level 50!"
- Event Details: Free event invitation, upcoming dates
- Elite Perks: What Level 50+ users get
- Next Milestones: Level 75, 100 unlocks

**Layout Notes**:
- Hero section (large unlock banner)
- Benefits grid (icon + text cards)
- CTA button (register for event)

**Data Sources**: UserRepository (level check), events calendar

**Priority**: **P3** (premium engagement)

**Status**: Greenfield (event system exists, unlock page is new concept)

═══════════════════════════════════════════════════════════════════════════════

## SPECIAL MOMENTS & MICRO-STATES

### First Join (Welcome)

**Current**: Text welcome in #general + DM  
**Upgrade**:
- ✅ Rich welcome embed (see #15 above)
- ✅ Faction assignment celebration
- ⚠️ Welcome GIF or image (brand mascot)
- ✅ Interactive buttons: "Get Started", "View Help"

**Priority**: **P1**

---

### First XP Earned

**Trigger**: User's first stat submission  
**Upgrade**:
- ✅ Special "🎊 First XP!" embed
- ✅ Color bar: Celebratory gold
- ✅ Description: "You just earned your first XP! Keep going!"
- ✅ Fields: XP Earned, Next Milestone (Level 2)
- ⚠️ Confetti GIF or celebration image

**Priority**: **P2**

**Status**: Needs detection logic (UserRepository: check if xp == first earned amount)

---

### Streak Milestones (7, 14, 30, 60, 100 days)

**Trigger**: Daily record check (StatsRepository)  
**Upgrade**:
- ✅ Streak milestone embed
- ✅ Title: "🔥 X-DAY STREAK MILESTONE!"
- ✅ Color bar: Intensifies with streak length (orange → red → gold)
- ✅ Fields: Streak Length, Streak Bonus (multiplier), Keep It Going!
- ⚠️ Thumbnail: Fire badge (intensity increases)
- ⚠️ Image: Streak celebration (varies by milestone)

**Priority**: **P2**

**Status**: Needs detection logic in StatsProcessor

---

### Prestige Ascension (if implemented)

**Trigger**: User reaches max level or prestige threshold  
**Upgrade**:
- ✅ Prestige announcement embed
- ✅ Title: "👑 PRESTIGE ASCENSION!"
- ✅ Color bar: Platinum/diamond
- ✅ Description: Major achievement callout
- ✅ Fields: New Prestige Level, Perks Unlocked, Legacy XP
- ⚠️ Image: Prestige badge or crown graphic

**Priority**: **P3**

**Status**: Greenfield (prestige system not detected in codebase)

---

### Risk Interventions (PatternDetector → coaching nudge)

**Trigger**: RiskScorer detects at-risk user  
**File**: `src/services/analytics/InterventionGenerator.js`

**Upgrade**:
- ✅ Private DM embed (not public)
- ✅ Color bar: Warm, supportive (amber/orange)
- ✅ Title: "💪 We've Got Your Back"
- ✅ Description: Personalized coaching message based on pattern
- ✅ Fields: What We Noticed, Suggested Action, You're Not Alone
- ✅ Thumbnail: Supportive icon (not alarm)
- ✅ Footer: "Reply anytime to chat with a coach"

**Priority**: **P2** (retention critical)

**Dependencies**: RiskScorer, PatternDetector, InterventionGenerator

---

### Nightly Reminder Variations

**Trigger**: 5pm EST daily  
**File**: `src/services/notifications/ReminderService.js`

**Upgrade**: Vary embed style by user state
- **On Streak**: 🔥 Fire theme, streak count prominent
- **Streak Broken**: 🌱 Restart theme, encouraging tone
- **High XP Week**: ⚡ Momentum theme, celebrate progress
- **Inactive**: 🌊 Gentle nudge, low-pressure invitation

**Priority**: **P2**

**Status**: Needs reminder variation logic

═══════════════════════════════════════════════════════════════════════════════

## DATA-DRIVEN VISUAL ENHANCEMENTS

### In-Embed Lightweight Visuals (Discord Native)

**Unicode Progress Bars**:
```
▓▓▓▓▓▓▓▓░░ 80%
███████░░░ 70%
■■■■■□□□□□ 50%
●●●●●○○○○○ 50%
```

**Emoji Badges**:
- Tier: 🥉🥈🥇🏆👑 (Bronze → King)
- Archetype: ⚔️🧙🛡️ (Warrior/Mage/Templar)
- Faction: 🦸🥷 (from FACTION_EMOJIS in constants.js)
- Stats: 💪📱📅🏋️ (approaches, dates, gym)

**Sparklines** (Compact Trend):
```
▁▂▃▅▆▇█ (7-day activity)
```

**Color State Indicators**:
- 🟢 Success/healthy
- 🟡 Warning/attention
- 🔴 Error/critical
- ⚪ Neutral/inactive

**Accessibility**: Always include text equivalent (e.g., "Progress: 80%" alongside bar)

---

### External Shell Visualizations (Future)

**Chart Types** (Phase 8: ChartGenerator.js):
- Line charts: XP over time, stat trends
- Bar charts: Stat comparison, faction standings
- Radar charts: Archetype affinity wheel
- Heat maps: Activity calendar, habit correlation
- Area charts: Community engagement pulse
- Funnel charts: Conversion funnel (approaches → dates → outcomes)

**Implementation**: Puppeteer + Chart.js (already in ChartGenerator service)

**Accessibility**: Alt text, SVG with ARIA labels, data tables as fallback

**Priority**: **P3** (Phase 8 completion)

═══════════════════════════════════════════════════════════════════════════════

## ADMIN & OPS EMBEDS

### Health Check Status (SECOPS_ENABLE_HEALTHCHECKS=true)

**Color States**:
- All checks pass: 🟢 Green
- Warning (1 check fails): 🟡 Yellow
- Critical (2+ checks fail): 🔴 Red

**Fields**:
- Discord: ✅ Connected / ❌ Disconnected
- Database: ✅ Connected / ❌ Failed
- Memory: 45 MB / 120 MB (▓▓▓░░░░░░░ 37%)
- Uptime: 3 days 14 hours

**Priority**: **P3**

---

### Backup Status (SECOPS_ENABLE_AUTOBACKUP=true)

**Success Embed**:
- Color: 🟢 Green
- Title: "💾 Backup Complete"
- Fields: Filename, Size (MB), Duration (seconds), Next Backup
- Footer: Backup #X (sequence count)

**Failure Embed**:
- Color: 🔴 Red
- Title: "❌ Backup Failed"
- Fields: Error Message, Retry Count, Next Attempt
- Footer: Alert admin if 3+ consecutive failures

**Priority**: **P3**

---

### Security Warnings (3-Strike System)

**Strike 1 (Warning)**:
- Color: 🟡 Yellow
- Title: "⚠️ Warning - Strike 1/3"
- Emoji: Warning triangle
- Tone: Informative

**Strike 2 (Timeout)**:
- Color: 🟠 Orange
- Title: "🚨 Strike 2/3 - 24 Hour Timeout"
- Emoji: Stop sign
- Tone: Serious

**Strike 3 (Ban)**:
- Color: 🔴 Red
- Title: "🔨 Strike 3/3 - Banned"
- Emoji: Ban hammer
- Tone: Final

**Implementation**: Already in WarningSystem.js (lines 150-172)

**Priority**: **P2** (existing, enhancement opportunity)

---

### Automation Logs (Phase 12)

**Webhook Success**:
- Color: 🟢 Green
- Title: "✅ Automation Complete: [Type]"
- Fields: Webhook, Duration, Data Processed, Next Steps

**Webhook Failure**:
- Color: 🔴 Red
- Title: "❌ Automation Failed: [Type]"
- Fields: Webhook, Error, Retry Count, Admin Alert

**Priority**: **P3**

**Status**: ⚠️ Phase 12 partial integration

═══════════════════════════════════════════════════════════════════════════════

## TENSEY BOT SURFACES (Separate App)

### Checklist Open (/tenseylist)

**Current**: Basic checklist embed (pagination)  
**File**: `tensey-bot/src/commands/tenseylist.js`

**Aesthetic Opportunities**:
- ✅ Color bar: Tensey brand color (0xFF1E27 from constants)
- ✅ Title: "🔥 Your Tensey Checklist - Level [X]"
- ✅ Description: Level title from LEVEL_TITLES array
- ✅ Fields: Challenges (10 per page)
  - Format: `✅ 5. Challenge text (x2)` or `⬜ 6. Challenge text`
- ✅ Thumbnail: Level badge or fire icon
- ✅ Footer: "Page X/Y | Z/303 completed"
- ⚠️ Image: Level-specific banner image
- ✅ Buttons: ◀ Previous, ↩️ Undo Last, Next ▶

**Priority**: **P1** (Tensey Bot core UX)

---

### Tensey Leaderboard (/tenseyleaderboard)

**Current**: Basic leaderboard embed  
**File**: `tensey-bot/src/commands/tenseyleaderboard.js`

**Aesthetic Opportunities**:
- ✅ Color bar: Accent blue (0x1D44F7 from Tensey constants)
- ✅ Title: "🏆 Tensey Challenge Leaderboard"
- ✅ Fields: Top Users (medal emojis), Faction Breakdown, Most Completed Challenges
- ✅ Thumbnail: Trophy icon
- ⚠️ Image: Full leaderboard visualization (top 25)
- ✅ Footer: Total completions community-wide

**Priority**: **P1** (Tensey Bot social proof)

---

### Challenge Completion Announcement (auto-triggered)

**Trigger**: User completes challenge, 60s after XP award  
**File**: `tensey-bot/src/embeds/AnnouncementEmbedBuilder.js`

**Aesthetic Opportunities**:
- ✅ Color bar: Tensey primary (red)
- ✅ Title: "🎉 Challenge Completed!"
- ✅ Description: "@User completed #42: [Challenge text]"
- ✅ Fields: XP Awarded (+100), Total Tenseys (count), Encouragement
- ✅ Thumbnail: Completion badge
- ⚠️ Image: Challenge-specific illustration (optional)
- ✅ Footer: "Share your experience!"

**Priority**: **P2** (social celebration)

**Status**: ⚠️ AnnouncementEmbedBuilder is stub

---

### Tensey Persistent Buttons

**Current**: Button embeds in channels (pinned)  
**File**: `tensey-bot/src/jobs/ensureButtonsJob.js`

**Buttons**:
1. "🔥 OPEN MY TENSEY LIST 🔥" (TENSEYLIST_CHANNEL_ID)
2. "🏆 VIEW LEADERBOARD 🏆" (LEADERBOARD_CHANNEL_ID)

**Aesthetic Opportunities**:
- ✅ Color bars: Primary red (checklist), Accent blue (leaderboard)
- ✅ Titles: Eye-catching, action-oriented
- ⚠️ Banner images: BANNER_URL_OPEN_BUTTON, BANNER_URL_LEADERBOARD (env vars)
- ✅ Descriptions: Brief explainer, call to action
- ✅ Buttons: Large, prominent (Danger style for checklist, Primary for leaderboard)

**Priority**: **P1** (Tensey Bot entry points)

═══════════════════════════════════════════════════════════════════════════════

## PRIORITIZED BACKLOG

| Surface | Type | Priority | Effort | Dependencies | Owner |
|---------|------|----------|--------|--------------|-------|
| **Scorecard** | Discord | **P1** | M | UserRepo, StatsRepo | Main Bot |
| **Leaderboard** | Discord | **P1** | S | UserRepo | Main Bot |
| **Stats Confirmation** | Discord | **P1** | S | StatsProcessor | Main Bot |
| **Level-Up Announcement** | Discord | **P1** | M | AnnouncementQueue | Main Bot |
| **Welcome Message** | Discord | **P1** | S | guildMemberAdd | Main Bot |
| **Tensey Checklist** | Discord | **P1** | M | Tensey services | Tensey Bot |
| **Tensey Leaderboard** | Discord | **P1** | S | MainBotRepository | Tensey Bot |
| Faction Stats | Discord | P2 | M | FactionService | Main Bot |
| Double XP Events | Discord | P2 | S | DoubleXPManager | Main Bot |
| Boss Raids | Discord | P2 | M | RaidManager | Main Bot |
| Barbie List | Discord | P2 | S | BarbieListManager | Main Bot |
| Course Module | Discord | P2 | M | CourseManager | Main Bot |
| Help System | Discord | P2 | S | OnboardingChatbot | Main Bot |
| Security Alerts | Discord | P2 | S | WarningSystem | Main Bot |
| Coaching Dashboard | Discord | P2 | M | RiskScorer, PatternDetector | Main Bot |
| Nightly Reminders | Discord | P2 | S | ReminderService | Main Bot |
| CTJ Breakthrough | Discord | P2 | M | CTJAnalyzer | Main Bot |
| Tensey Completion | Discord | P2 | S | AnnouncementBuilder | Tensey Bot |
| Duel Challenge | Discord | P2 | L | DuelManager | Main Bot |
| Texting Simulator | Discord | P2 | L | TextingSimulator | Main Bot |
| Streak Milestones | Discord | P2 | M | StatsProcessor | Main Bot |
| Intervention Nudges | Discord | P2 | M | InterventionGenerator | Main Bot |
| Personal Scorecard Web | Web | P2 | L | UserRepo, ChartGenerator | Main Bot |
| Health Checks | Discord | P3 | S | HealthCheck | Main Bot |
| Backup Status | Discord | P3 | S | BackupManager | Main Bot |
| GDPR Export | Discord | P3 | S | GDPRExporter | Main Bot |
| Course Admin | Discord | P3 | M | CourseManager | Main Bot |
| Automation Monitor | Discord | P3 | M | AutomationLogger | Main Bot |
| Coaching Command Center | Web | P3 | XL | Analytics services | Main Bot |
| Analytics & Trends Hub | Web | P3 | XL | ChartGenerator | Main Bot |
| Factions War Room | Web | P3 | L | FactionService | Main Bot |
| Duels Match Page | Web | P3 | L | DuelManager | Main Bot |
| Raids Match Page | Web | P3 | L | RaidManager | Main Bot |
| Course Browser | Web | P3 | XL | CourseManager | Main Bot |
| Tensey Web Shell | Web | P3 | XL | Tensey services | Tensey Bot |
| Live Event Unlock | Web | P3 | L | Events calendar | Main Bot |

**Effort Scale**: S (1-2 hours), M (4-8 hours), L (1-2 days), XL (3-5 days)

**Legend**:
- **P1** (bold): High-traffic, core user experience
- P2: Engagement/retention features
- P3: Admin utilities, advanced features

**Pending Implementation** (command files missing):
- ⚠️ CTJ commands (journal.js, breakthroughs.js)
- ⚠️ Duel command (duel.js)
- ⚠️ Texting commands (texting-*.js)

═══════════════════════════════════════════════════════════════════════════════

## ROLLOUT PLAN (Zero Downtime)

### Phase 1: High-Impact Embeds (Week 1-2)

**Focus**: Core user touchpoints, daily interactions

**Surfaces**:
1. Scorecard enhancement (progress bars, archetype badges)
2. Leaderboard polish (medals, tier colors, thumbnails)
3. Stats confirmation (celebration, streak fire, level-up callout)
4. Welcome message (rich onboarding embed)
5. Tensey checklist (level badges, better pagination UX)

**Deliverables**:
- Embed enhancement PRs for 5 commands
- Brand token system defined (colors, emojis)
- Mobile testing on Discord iOS/Android

**QA Gates**:
- [ ] Accessibility: Color contrast WCAG AA
- [ ] Mobile: Readable on narrow screens
- [ ] Dark mode: Tested against Discord dark theme
- [ ] Performance: Embeds render <100ms
- [ ] A/B test: User engagement metrics before/after

---

### Phase 2: Events & Milestones (Week 3-4)

**Focus**: Social amplification, celebration moments

**Surfaces**:
1. Level-up announcements (tier-specific banners)
2. Double XP events (countdown timers, vibrant colors)
3. Boss raids (live progress bars, leaderboard updates)
4. Faction stats (war room theme, side-by-side comparison)
5. Tensey completion announcements (social proof)

**Deliverables**:
- Event embed templates
- Animated GIFs for milestones (optional)
- Auto-update logic for live events (raids, duels)

**QA Gates**:
- [ ] Live update performance (no spam)
- [ ] Countdown accuracy (timezone handling)
- [ ] Celebration timing (not intrusive)

---

### Phase 3: Coaching & Analytics (Week 5-6)

**Focus**: Admin tools, retention, insights

**Surfaces**:
1. Coaching dashboard (at-risk users, patterns)
2. Coaching insights (individual user deep-dive)
3. Intervention nudges (private DMs, supportive tone)
4. Risk alerts (admin channel, actionable)
5. Optional: Personal scorecard web view (charts)

**Deliverables**:
- Admin embed polish
- Optional web dashboard (HTML/CSS static page)
- Chart generation integration (ChartGenerator service)

**QA Gates**:
- [ ] Admin-only visibility (no public leaks)
- [ ] Actionable insights (not just data dumps)
- [ ] Privacy: User data properly scoped

---

### Phase 4: Advanced Features (Week 7-8)

**Focus**: Duels, texting, course enhancements

**Surfaces**:
1. Duel challenges (VS cards, live stats)
2. Texting simulator (scenario embeds, scoring)
3. Course module viewer (rich content, progress tracking)
4. Breakthrough detection (CTJ highlights)
5. Optional: Duels/raids match pages (web)

**Deliverables**:
- Complete missing command implementations (duel.js, texting-*.js, journal.js, breakthroughs.js)
- Embed templates for new features
- Optional web shells for complex UX

**QA Gates**:
- [ ] Command implementations complete
- [ ] Embeds tested with real scenarios
- [ ] Web shells responsive (if implemented)

═══════════════════════════════════════════════════════════════════════════════

## APPENDIX

### Discord Embed Field Cheatsheet

**Basic Structure**:
```javascript
const embed = new EmbedBuilder()
  .setColor(0xFF1E27)                    // Hex color (integer)
  .setTitle('Title Text')                 // Max 256 chars
  .setDescription('Description text')     // Max 4096 chars
  .setThumbnail('https://url/image.png')  // Small image (top-right)
  .setImage('https://url/banner.png')     // Large image (bottom)
  .setAuthor({ name: 'Author', iconURL: 'https://...' })
  .addFields(
    { name: 'Field 1', value: 'Value 1', inline: true },
    { name: 'Field 2', value: 'Value 2', inline: true }
  )
  .setFooter({ text: 'Footer text', iconURL: 'https://...' })
  .setTimestamp();                       // Current time or custom
```

**Limits**:
- Total fields: 25 max
- Field name: 256 chars
- Field value: 1024 chars
- Total embed: 6000 chars

**Tips**:
- `inline: true` creates 2-column layout (up to 3 fields per row)
- Use `\n` for line breaks within fields
- Use Discord markdown: `**bold**`, `*italic*`, `__underline__`, `~~strikethrough~~`, `\`code\``
- Blockquotes: `> Quoted text`
- Spoilers: `||Hidden text||`

---

### Brand Token Stubs (Reference)

**Colors** (Placeholders):
```javascript
const BRAND_TOKENS = {
  colors: {
    PRIMARY: 0xFF1E27,        // Brand primary (detected from settings.js:88)
    ACCENT: 0x1D44F7,         // Placeholder accent
    SUCCESS: 0x00D26A,        // Success green
    WARNING: 0xFFAA00,        // Warning amber
    DANGER: 0xFF0000,         // Error red
    NEUTRAL_BG: 0x2F3136,     // Discord dark background
    NEUTRAL_TEXT: 0xDCDDDE,   // Discord light text
  },
  
  emojis: {
    // From constants.js (verified):
    WARRIOR: '⚔️',
    MAGE: '🧙',
    TEMPLAR: '🛡️',
    // Faction emojis exist in FACTION_EMOJIS constant
  },
  
  spacing: {
    XS: 4,
    SM: 8,
    MD: 16,
    LG: 24,
    XL: 32,
  },
  
  radius: {
    SM: 4,
    MD: 8,
    LG: 16,
  }
};
```

**Tier Colors** (Detected in constants.js):
```javascript
const TIER_COLORS = {
  'Unranked': 0x95A5A6,
  'Bronze': 0xCD7F32,
  'Silver': 0xC0C0C0,
  'Gold': 0xFFD700,
  'Platinum': 0xE5E4E2,
  'Diamond': 0xB9F2FF,
  'King': 0x9B59B6
};
```

---

### Link Map (Commands → Services)

**Commands with Embed Opportunities**:
- `/submit-stats` → StatsProcessor → Embed: Confirmation
- `/scorecard` → UserService, StatsRepository → Embed: Scorecard
- `/leaderboard` → UserRepository.getTopByXP() → Embed: Leaderboard
- `/faction-stats` → FactionService → Embed: Faction war
- `/barbie` → BarbieListManager → Embed: Contact list
- `/course` → CourseManager → Embed: Module viewer
- `/help` → OnboardingChatbot → Embed: AI response
- `/raid-status` → RaidManager → Embed: Raid progress
- `/coaching-dashboard` → RiskScorer, PatternDetector → Embed: Dashboard
- `/security` → WarningSystem, AuditLogger → Embed: Security actions
- `/set-double-xp` → DoubleXPManager → Embed: Event announcement

**Event Handlers with Embed Opportunities**:
- `guildMemberAdd` → Embed: Welcome message
- `messageCreate` (CTJ monitoring) → Embed: Breakthrough detection
- `messageCreate` (wins tracking) → Embed: Win celebration
- Level-up trigger → Embed: Level-up announcement

**Services with Embed Opportunities**:
- AnnouncementQueue → All public announcements
- ChannelService.sendEmbed() → Centralized embed sender
- WarningSystem.notifyUser() → Warning DMs (already has embeds)
- AutoReminderService → Inactivity nudges
- HealthCheck → Health status embeds
- BackupManager → Backup confirmations

═══════════════════════════════════════════════════════════════════════════════

## IMPLEMENTATION NOTES

### Discord Embed Best Practices (Technical)

**Performance**:
- Thumbnail URLs should be CDN-hosted (fast load)
- Avoid large images (>1MB) in embeds
- Use Discord's image proxy (auto-resizes)
- Cache embed builder instances where possible

**Accessibility**:
- Always include alt text for images (via description)
- Use semantic field names (not just icons)
- Ensure text contrast meets WCAG AA (4.5:1 minimum)
- Provide text equivalents for Unicode bars

**Mobile Considerations**:
- Inline fields max 2 per row on mobile
- Long field values wrap poorly (keep concise)
- Images full-width on mobile (test aspect ratios)
- Buttons stack vertically (max 5 per row)

---

### External Shell Integration (Future)

**When to Build**:
- User requests "more details" beyond embed limits
- Admin needs complex dashboards (coaching, analytics)
- Data visualization requires charts/graphs
- Multi-step workflows (course modules, texting simulator)

**Tech Stack Suggestions** (No Implementation Here):
- Static site generator (HTML/CSS/JS)
- Chart library (Chart.js already in ChartGenerator)
- Hosted on CDN or simple web server
- Linked from Discord via embed buttons or URLs

**Data Flow**:
- Discord command → Generate static page → Upload to CDN → Reply with link
- Or: Discord button → Open existing dashboard URL (auth-gated)

---

### Brand Assets to Create (Post-Launch)

**Icon Set** (SVG or PNG):
- Archetype badges (Warrior/Mage/Templar) - 3 icons
- Tier badges (Bronze → King) - 7 icons
- Faction icons (from FACTION_EMOJIS) - faction-specific
- Level milestones (10/25/50/75/100) - 5 icons
- Stat icons (approaches, dates, gym, etc.) - 15+ icons
- Achievement badges (streaks, completions, wins) - 20+ icons

**Banner Images** (1200x400 or 16:9):
- Welcome banner (guild branding)
- Level-up banners (tier-specific) - 7 variants
- Event banners (Double XP, raids) - 3-5 variants
- Tensey level banners (25 levels) - optional
- Course module covers (7 modules) - optional

**GIFs/Animations** (Optional):
- Level-up celebration (confetti, sparkles)
- Raid boss battle (damage animations)
- Streak fire (intensity by streak length)

**None of these assets are created now—just listed for future art direction.**

═══════════════════════════════════════════════════════════════════════════════

## DISCOVERED CONSTANTS (Codebase Facts)

**From src/config/constants.js**:

- `TIER_COLORS` - 7 tier colors defined (Unranked → King)
- `ARCHETYPE_ICONS` - Warrior/Mage/Templar emojis
- `FACTION_EMOJIS` - Faction-specific emojis
- `STAT_WEIGHTS` - 20+ stats with XP values
- `AFFINITY_WEIGHTS` - Archetype affinity per stat
- `LEVEL_THRESHOLDS` - XP required per level

**From src/config/settings.js**:

- `branding.colorHex` - Primary brand color (default: 0xFF1E27)
- `branding.logoUrl` - Brand logo URL (env var)
- `branding.bannerUrl` - Event banner URL (env var)

**From tensey-bot/src/config/constants.js**:

- `BRAND.primary` - 0xFF1E27 (red)
- `BRAND.accent` - 0x1D44F7 (blue)
- `BRAND.ink` - 0x050E1D (dark)
- `BRAND.soft` - 0xEAF1F7 (light)
- `LEVEL_TITLES` - 25 level titles (Warm-Up → Grandmaster)

All color values are hex integers (Discord format).

═══════════════════════════════════════════════════════════════════════════════

## ACCESSIBILITY REQUIREMENTS

### Color Contrast (WCAG AA)

**Minimum Ratios**:
- Normal text: 4.5:1
- Large text (18pt+): 3:1
- UI components: 3:1

**Testing**:
- Test all embed colors against Discord dark theme (#2F3136)
- Test against Discord light theme (if users use it)
- Use contrast checker tools before deploying colors

---

### Text Alternatives

**For All Visual Elements**:
- Unicode bars: Always include text percentage (e.g., "Progress: 80%")
- Emoji: Followed by text label (e.g., "🔥 Streak: 7 days")
- Images: Described in embed description or field
- Charts (external): Data table as alternative view

---

### Keyboard Navigation (External Shells)

**If Building Web Views**:
- Tab order logical (top to bottom, left to right)
- Focus indicators visible
- Skip links for long pages
- ARIA labels for interactive elements

═══════════════════════════════════════════════════════════════════════════════

## PERFORMANCE BUDGETS

### Discord Embeds

**Target**: <100ms render time
- Thumbnail: <50KB
- Image: <200KB
- Total embed: <6000 chars
- Avoid excessive fields (>10 becomes slow on mobile)

---

### External Web Shells (If Implemented)

**Target**: <2s first paint
- HTML/CSS: <100KB gzipped
- Charts (Chart.js): Lazy load, <500KB bundle
- Images: Lazy load, WebP format, <100KB each
- Mobile: <3s on 3G

═══════════════════════════════════════════════════════════════════════════════

## CROSS-REFERENCES

### Commands with Embed Enhancement Opportunity

**Verified** (files exist, embeds detected):
- ✅ src/commands/leaderboard/leaderboard.js
- ✅ src/commands/leaderboard/faction-stats.js
- ✅ src/commands/stats/scorecard.js
- ✅ src/commands/barbie/barbie.js
- ✅ src/commands/course/course.js
- ✅ src/commands/help/help.js
- ✅ src/commands/raids/raid-status.js
- ✅ src/commands/admin/coaching-dashboard.js
- ✅ src/commands/admin/coaching-insights.js
- ✅ src/commands/admin/security.js
- ✅ src/commands/admin/course-admin.js
- ✅ src/commands/admin/set-double-xp.js

**Pending Implementation** (files missing):
- ⚠️ src/commands/ctj/journal.js (CTJ entry submission)
- ⚠️ src/commands/ctj/breakthroughs.js (Breakthrough viewer)
- ⚠️ src/commands/duels/duel.js (Duel challenge)
- ⚠️ src/commands/texting/texting-practice.js (Texting scenarios)
- ⚠️ src/commands/texting/texting-send.js (Send message)
- ⚠️ src/commands/texting/texting-finish.js (Finish practice)

---

### Services with Embed Generation

**Active**:
- src/services/security/WarningSystem.js (lines 150-172: warning embeds)
- src/services/notifications/AutoReminderService.js (reminder embeds)
- src/services/discord/ChannelService.js (sendEmbed method)
- src/services/onboarding/OnboardingChatbot.js (help embeds)
- src/services/events/DoubleXPManager.js (event embeds)
- src/events/guildMemberAdd.js (welcome embeds)

**Stubs**:
- tensey-bot/src/embeds/ChecklistEmbedBuilder.js (stub)
- tensey-bot/src/embeds/LeaderboardEmbedBuilder.js (stub)
- tensey-bot/src/embeds/AnnouncementEmbedBuilder.js (stub)

---

### External HTML/CSS Shell Candidates

**Priority Order**:
1. Personal Scorecard Web View (P2) - High user value
2. Coaching Command Center (P3) - Admin retention tool
3. Tensey Web Shell (P3) - 303 challenges browser
4. Analytics & Trends Hub (P3) - Community insights
5. Course Browser (P3) - Rich learning experience

**Implementation**: After Discord embeds mature (Phase 3+)

═══════════════════════════════════════════════════════════════════════════════

## SUMMARY

**Total Surfaces Identified**: 24 Discord embeds + 8 web shells = 32 upgrade opportunities

**Discord Embeds**:
- P1 (High-Impact): 7 surfaces
- P2 (Engagement): 13 surfaces
- P3 (Admin/Ops): 4 surfaces

**External Web Shells** (Optional):
- P2: 1 shell (Personal Scorecard)
- P3: 7 shells (Admin dashboards, browsers)

**Implementation Status**:
- ✅ Ready to enhance: 18 commands with embeds
- ⚠️ Pending command files: 6 commands (CTJ, duels, texting)
- ⚠️ Tensey Bot stubs: 3 embed builders (functional but basic)

**Estimated Effort**:
- Phase 1 (High-Impact): 40-60 hours
- Phase 2 (Events): 40-60 hours
- Phase 3 (Coaching): 60-80 hours
- Phase 4 (Advanced): 80-120 hours

**Total**: 220-320 hours for complete aesthetic overhaul (all phases)

**Quick Wins** (P1 only): 40-60 hours (Week 1-2)

═══════════════════════════════════════════════════════════════════════════════
END OF BIG BEAUTIFUL EMBED GUIDE
═══════════════════════════════════════════════════════════════════════════════

**This is a planning document only**. No art, no code, no assets created. All suggestions are based on verified codebase facts. Implementation to begin post-launch once core functionality is stable.

**Next Steps**: Review this guide with UX/UI team, prioritize based on user feedback, implement Phase 1 embeds first (highest ROI).

═══════════════════════════════════════════════════════════════════════════════

