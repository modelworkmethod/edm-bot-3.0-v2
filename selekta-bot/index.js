/**
 * SELEKTA v3.1 — 3-Tier Onboarding (29CLUB / EPIC / LEGENDS)
 * discord.js v14
 *
 * ✅ Detect used invite (29club/epic/legends)
 * ✅ Assign tier "NEW" role immediately on join
 * ✅ Post unlock button in correct enter-* channel
 * ✅ On click: swap NEW → MEMBER
 * ✅ After unlock: DM tier-specific onboarding + announce in #general
 *
 * Notes:
 * - Invite detection can occasionally fail (Discord timing). Fallback to DEFAULT_TIER.
 * - Ensure role hierarchy: Bot role ABOVE all NEW/MEMBER roles it manages.
 * - Bot needs: Manage Roles, Manage Guild (to read invites), View Channels, Send Messages, Read Message History.
 */

// #region agent log
fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:17',message:'Script entry point',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
// #endregion

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });



// #region agent log
fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:20',message:'After dotenv.config',data:{hasBotToken:!!process.env.BOT_TOKEN,hasGuildId:!!process.env.GUILD_ID},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
// #endregion

const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

// ============================================================================
// CONFIG
// ============================================================================

const BOT_TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

// Invite codes (short code after discord.gg/)
const INVITES = {
  EPIC: process.env.EPIC_INVITE_CODE,
  LEGENDS: process.env.LEGENDS_INVITE_CODE,
  CLUB29: process.env.CLUB29_INVITE_CODE,
};

// Roles
const ROLES = {
  EPIC: { NEW: process.env.EPIC_NEW_ROLE_ID, MEMBER: process.env.EPIC_MEMBER_ROLE_ID },
  LEGENDS: { NEW: process.env.LEGENDS_NEW_ROLE_ID, MEMBER: process.env.LEGENDS_MEMBER_ROLE_ID },
  CLUB29: { NEW: process.env.CLUB29_NEW_ROLE_ID, MEMBER: process.env.CLUB29_MEMBER_ROLE_ID },
};

// Enter channels (where NEW role can see onboarding + unlock button)
const ENTER_CHANNELS = {
  EPIC: process.env.ENTER_EPIC_CHANNEL_ID,
  LEGENDS: process.env.ENTER_LEGENDS_CHANNEL_ID,
  CLUB29: process.env.ENTER_CLUB29_CHANNEL_ID,
};

// #region agent log
fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:58',message:'ENTER_CHANNELS config',data:{epic:ENTER_CHANNELS.EPIC,legends:ENTER_CHANNELS.LEGENDS,club29:ENTER_CHANNELS.CLUB29},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
// #endregion

// Optional: where to announce unlocks / intros
const GENERAL_CHANNEL_ID = process.env.GENERAL_CHANNEL_ID || null;

// Behavior toggles
const POST_UNLOCK_PROMPT_ON_JOIN = (process.env.POST_UNLOCK_PROMPT_ON_JOIN ?? 'true') === 'true';
const ENSURE_UNLOCK_PROMPTS_ON_READY = (process.env.ENSURE_UNLOCK_PROMPTS_ON_READY ?? 'true') === 'true';

// Invite detection fallback
const DEFAULT_TIER = (process.env.DEFAULT_TIER || 'CLUB29').toUpperCase(); // CLUB29 | EPIC | LEGENDS
const LEGENDS_GETS_EPIC_MEMBER_TOO = (process.env.LEGENDS_GETS_EPIC_MEMBER_TOO ?? 'false') === 'true';

// Links (used in DM content)
// #region agent log
fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:68',message:'Before LINKS initialization',data:{hasMustString:typeof mustString==='function'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
// #endregion
const LINKS = (() => {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:71',message:'LINKS init start',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    const result = {
      SKOOL: mustString(process.env.SKOOL_LINK, 'SKOOL_LINK'),
      LEGENDS_FORM: mustString(process.env.LEGENDS_EMBODIMENT_MAPPING_FORM_LINK, 'LEGENDS_EMBODIMENT_MAPPING_FORM_LINK'),
      LEGENDS_BOOK: mustString(process.env.LEGENDS_EMBODIMENT_MAPPING_CALL_LINK, 'LEGENDS_EMBODIMENT_MAPPING_CALL_LINK'),
      CALLS_LEGENDS: mustString(process.env.LEGENDS_CALLS_LINK, 'LEGENDS_CALLS_LINK'),
      CALLS_EPIC: mustString(process.env.EPIC_CALLS_LINK, 'EPIC_CALLS_LINK'),
      CALLS_CLUB29: mustString(process.env.CLUB29_CALLS_LINK, 'CLUB29_CALLS_LINK'),
    };
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:80',message:'LINKS init success',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    return result;
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:83',message:'LINKS init error',data:{error:err.message,stack:err.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    throw err;
  }
})();

// ============================================================================
// CLIENT
// ============================================================================

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildInvites],
  partials: [Partials.GuildMember, Partials.User],
});

let inviteCache = new Map(); // code -> uses
let joinProcessingQueue = Promise.resolve();

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function mustEnv(name, value) {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function mustString(value, envName) {
  // For optional vars, caller should not use this.
  if (!value || typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required env var: ${envName}`);
  }
  return value.trim();
}

function validateConfig() {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:106',message:'validateConfig entry',data:{botTokenExists:!!BOT_TOKEN,guildIdExists:!!GUILD_ID},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  mustEnv('BOT_TOKEN', BOT_TOKEN);
  mustEnv('GUILD_ID', GUILD_ID);

  for (const tier of ['CLUB29', 'EPIC', 'LEGENDS']) {
    if (!INVITES[tier]) console.warn(`SELEKTA WARNING: ${tier}_INVITE_CODE is empty (invite detection may fail)`);
    if (!ROLES[tier]?.NEW) console.warn(`SELEKTA WARNING: ${tier}_NEW_ROLE_ID is empty`);
    if (!ROLES[tier]?.MEMBER) console.warn(`SELEKTA WARNING: ${tier}_MEMBER_ROLE_ID is empty`);
    if (!ENTER_CHANNELS[tier]) console.warn(`SELEKTA WARNING: ENTER_${tier}_CHANNEL_ID is empty`);
  }

  if (!['CLUB29', 'EPIC', 'LEGENDS'].includes(DEFAULT_TIER)) {
    throw new Error(`DEFAULT_TIER must be CLUB29, EPIC, or LEGENDS. Got: ${DEFAULT_TIER}`);
  }
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:120',message:'validateConfig exit',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
}

// ============================================================================
// DISCORD HELPERS
// ============================================================================

async function fetchGuild() {
  return client.guilds.fetch(GUILD_ID).catch(() => null);
}

async function cacheInvites() {
  const guild = await fetchGuild();
  if (!guild) {
    console.error('SELEKTA ERROR: Guild not found for cacheInvites()');
    return;
  }

  const invites = await guild.invites.fetch().catch(() => null);
  if (!invites) {
    console.error('SELEKTA ERROR: Failed to fetch invites (missing Manage Guild permission?)');
    return;
  }

  inviteCache.clear();
  invites.forEach((inv) => inviteCache.set(inv.code, inv.uses ?? 0));
  console.log(`SELEKTA: Cached ${inviteCache.size} invite(s)`);
}

async function detectUsedInviteCode() {
  const guild = await fetchGuild();
  if (!guild) return null;

  const currentInvites = await guild.invites.fetch().catch(() => null);
  if (!currentInvites) return null;

  for (const [code, inv] of currentInvites) {
    const cachedUses = inviteCache.get(code);
    const currentUses = inv.uses ?? 0;
    if (typeof cachedUses === 'number' && currentUses > cachedUses) return code;
  }

  return null;
}

function tierFromInviteCode(code) {
  if (!code) return null;
  if (code === INVITES.LEGENDS) return 'LEGENDS';
  if (code === INVITES.EPIC) return 'EPIC';
  if (code === INVITES.CLUB29) return 'CLUB29';
  return null;
}

async function safeAddRole(member, roleId) {
  if (!roleId) return false;
  if (member.roles.cache.has(roleId)) return true;
  await member.roles.add(roleId);
  return true;
}

async function safeRemoveRole(member, roleId) {
  if (!roleId) return false;
  if (!member.roles.cache.has(roleId)) return true;
  await member.roles.remove(roleId);
  return true;
}

async function safeSendDM(member, content) {
  try {
    await member.send(content);
    return true;
  } catch (err) {
    if (err?.code === 50007) {
      console.warn(`SELEKTA WARNING: Cannot DM ${member.user.tag} (DMs closed)`);
      return false;
    }
    console.error(`SELEKTA ERROR: DM failed to ${member.user.tag} - ${err?.message || err}`);
    return false;
  }
}

async function safeSendChannel(channelId, payload) {
  if (!channelId) return false;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return false;

  try {
    await channel.send(payload);
    return true;
  } catch (err) {
    if (err?.code === 50013) {
      console.error(`SELEKTA ERROR: Missing permission to send messages in ${channelId}`);
    } else {
      console.error(`SELEKTA ERROR: Channel send failed (${channelId}) - ${err?.message || err}`);
    }
    return false;
  }
}

// ============================================================================
// BUTTON UI
// ============================================================================

function buttonCustomId(tier) {
  return `unlock_${tier.toLowerCase()}`; // unlock_club29 / unlock_epic / unlock_legends
}

function buildUnlockRow(tier) {
  const label =
    tier === 'LEGENDS' ? '✅ I’ve read it — Enter Legends' :
    tier === 'EPIC' ? '✅ I’ve read it — Enter Epic' :
    '✅ I’ve read it — Enter $29 Club';

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(buttonCustomId(tier))
      .setLabel(label)
      .setStyle(ButtonStyle.Success)
  );
}

function unlockMessage(tier) {
  if (tier === 'LEGENDS') {
    return [
      '⚡ **LEGENDS Onboarding — Unlock Access**',
      '',
      'Read the pinned messages above.',
      'When you’re done, click the button below to unlock the server.',
      '',
      '_This swaps your role from **Legends - New** → **Legends - Member**._',
      '_Then SELEKTA will DM you your exact next steps._',
    ].join('\n');
  }

  if (tier === 'EPIC') {
    return [
      '🎯 **EPIC Onboarding — Unlock Access**',
      '',
      'Read the pinned messages above.',
      'When you’re done, click the button below to unlock the server.',
      '',
      '_This swaps your role from **Epic - New** → **Epic - Member**._',
      '_Then SELEKTA will DM you your exact next steps._',
    ].join('\n');
  }

  return [
    '📞 **$29 Club Onboarding — Unlock Access**',
    '',
    'Read the pinned messages above.',
    'When you’re done, click the button below to unlock your member access.',
    '',
    '_This swaps your role from **$29 Club - New** → **$29 Club - Member**._',
    '_Then SELEKTA will DM you your exact next steps._',
  ].join('\n');
}

async function postUnlockPrompt(tier) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:309',message:'postUnlockPrompt entry',data:{tier},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
  // #endregion
  const channelId = ENTER_CHANNELS[tier];
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:313',message:'postUnlockPrompt channelId check',data:{tier,channelId,hasChannelId:!!channelId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
  // #endregion
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch((err) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:318',message:'postUnlockPrompt channel fetch error',data:{tier,channelId,error:err?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    return null;
  });
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:322',message:'postUnlockPrompt channel fetch result',data:{tier,channelId,hasChannel:!!channel,isTextBased:channel?.isTextBased?.()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
  // #endregion
  if (!channel || !channel.isTextBased()) return;

  // prevent duplicates (last 25 messages)
  const recent = await channel.messages.fetch({ limit: 25 }).catch((err) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:330',message:'postUnlockPrompt messages fetch error',data:{tier,channelId,error:err?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    return null;
  });
  if (recent) {
    const already = recent.find(m =>
      m.author?.id === client.user.id &&
      m.components?.some(row =>
        row.components?.some(c => c.customId === buttonCustomId(tier))
      )
    );
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:340',message:'postUnlockPrompt duplicate check',data:{tier,channelId,hasRecent:!!recent,alreadyExists:!!already},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    if (already) return;
  }

  try {
    await channel.send({ content: unlockMessage(tier), components: [buildUnlockRow(tier)] });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:347',message:'postUnlockPrompt send success',data:{tier,channelId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:350',message:'postUnlockPrompt send error',data:{tier,channelId,error:err?.message,code:err?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    throw err;
  }
}

// ============================================================================
// DM CONTENT (SENT AFTER UNLOCK)
// ============================================================================

function dmOnUnlock(tier) {
  if (tier === 'LEGENDS') {
    return [
      '⚡ **LEGENDS ACCESS UNLOCKED**',
      '',
      'You\'re in.',
      '',
      'Follow these steps in order.',
      'A few are intentionally repeated elsewhere -- that\'s how integration actually sticks.',
      '',
      '**Step 1 -- Read #rules**',
      '',
      'This keeps the space clean, focused, and effective.',
      'Skipping this is how people create friction for themselves fast.',
      '',
      '**Step 2 -- Watch #the-edm-game-tutorial**',
      '',
      'This gives context for:',
      '',
      '- stats',
      '- calls',
      '- structure',
      '- how the system actually works',
      '',
      'Everything else lands better after this.',
      '',
      '**Step 3 -- Submit your first Daily State**',
      '',
      'Go to #submit-your-stats',
      'Log your Daily State (1-10) based on how you feel right now.',
      '',
      'From here on out:',
      'Log your Daily State + other stats every day.',
      'This is how momentum compounds.',
      '',
      '**Step 4 -- Introduce yourself in #general**',
      '',
      'Share:',
      '',
      '- who you are',
      '- why you\'re here',
      '- your #1 goal',
      '',
      'This creates accountability and forward motion immediately.',
      '',
      '**Step 5 -- Join Skool (required for Undoing.U access)**',
      '',
      `👉 ${LINKS.SKOOL}`,
      '',
      'After you join, DM Jules Bia on Discord with the email you used on Skool so your course access can be opened.',
      '',
      '**Step 6 -- LEGENDS ONLY: Embodiment Mapping (required)**',
      '',
      'This is how your work gets customized -- not cookie-cutter.',
      '',
      `- Form: ${LINKS.LEGENDS_FORM}`,
      `- Book your call: ${LINKS.LEGENDS_BOOK}`,
      '',
      'This is foundational. Don\'t delay it.',
      '',
      '**Calls (bookmark this)**',
      '',
      `👉 ${LINKS.CALLS_LEGENDS}`,
      '',
      'Take your time. Follow the order.',
      'This system works when you let it.',
    ].join('\n');
  }

  if (tier === 'EPIC') {
    return [
      '🎯 **EPIC ACCESS UNLOCKED**',
      '',
      'Epic is a full, robust system -- not a stripped-down version.',
      '',
      'Follow these steps in order.',
      '',
      '**Step 1 -- Read #rules**',
      '',
      'Keeps the environment sharp and useful.',
      '',
      '**Step 2 -- Watch #the-edm-game-tutorial**',
      '',
      'This makes the stats, calls, and structure click immediately.',
      '',
      '**Step 3 -- Submit your first Daily State**',
      '',
      'Go to #submit-your-stats',
      'Log your Daily State (1-10) based on how you feel right now.',
      '',
      'From here on out:',
      'Log your Daily State + other stats every day.',
      '',
      '**Step 4 -- Introduce yourself in #general**',
      '',
      'Share:',
      '',
      '- who you are',
      '- why you\'re here',
      '- your #1 goal',
      '',
      'This creates momentum fast.',
      '',
      '**Step 5 -- Join Skool (required for Undoing.U access)**',
      '',
      `👉 ${LINKS.SKOOL}`,
      '',
      'After you join, DM Jules Bia on Discord with the email you used on Skool so access can be opened.',
      '',
      '**Calls (bookmark this)**',
      '',
      `👉 ${LINKS.CALLS_EPIC}`,
      '',
      'Epic compounds through consistency.',
      'Don\'t rush. Just stay engaged.',
    ].join('\n');
  }

  // CLUB29
  return [
    '📞 **$29 CLUB ACCESS UNLOCKED**',
    '',
    'Welcome in. Keep it simple.',
    '',
    '**Step 1 — Read #rules**',
    '',
    'This avoids unnecessary friction.',
    '',
    '**Step 2 — Introduce yourself in #general**',
    '',
    'Share:',
    '',
    '- who you are',
    '- why you\'re here',
    '- your #1 goal',
    '',
    'This puts you on the map.',
    '',
    '**Calls (bookmark this)**',
    '',
    `👉 ${LINKS.CALLS_CLUB29}`,
    '',
    'Show up. Ask questions. Stay connected.',
      'That\'s how this tier delivers value.',
  ].join('\n');
}

// ============================================================================
// GENERAL ANNOUNCE (AFTER UNLOCK)
// ============================================================================

function buildTierWelcomeMessage(memberId, tier) {
  if (tier === 'LEGENDS') {
    return `@everyone

🟣🟣🟣 **🚨 LEGENDS INNER CIRCLE MEMBER HAS ARRIVED 🚨** 🟣🟣🟣  

STOP SCROLLING.

Everyone welcome **<@${memberId}>** 👑🔥  

This man was **screened, selected, and accepted** into **LEGENDS** — the highest-touch, highest-precision container in this ecosystem.

This is the room where:
• resistance gets confronted in real time  
• patterns get dismantled fast  
• embodiment becomes unavoidable  
• reality starts responding differently  

No spectators.  
No dabbling.  
No hiding.

🟣 **EVERYONE — SHOW RESPECT** 🟣  
Drop 🔥👑⚡ in the chat and welcome him into the inner circle.

<@${memberId}> — when you're ready:
• introduce yourself  
• name your edge  
• say what you're here to break through  

THIS IS WHERE MEN GET BUILT.`;
  }

  if (tier === 'EPIC') {
    return `@everyone

🔵🔵🔵 **NEW EPIC MEMBER UNLOCKED** 🔵🔵🔵  

MAKE SOME NOISE FOR **<@${memberId}>** 🚨🔥  

This man just entered **EPIC** — the **full flagship system**, not a teaser, not a watered-down version.

This is where:
• nervous systems get trained  
• self-image gets rewritten  
• avoidance gets exposed  
• momentum becomes automatic  

He now has access to the **ENTIRE CORE UNDOING.U SYSTEM**, the gamification engine, and the live monthly call.

This is where most men *actually* change.

🔥 **EVERYONE — WELCOME HIM PROPERLY** 🔥  
Flood the chat. Let him feel the room.

<@${memberId}> — introduce yourself:
• where you're at right now  
• what made you step in  
• what you're here to transform  

EPIC IS PLAYED — NOT CONSUMED.  
LET'S GO.`;
  }

  // CLUB29 (displayed as "29 CLUB")
  return `@everyone

🟢🟢🟢 **NEW 29 CLUB MEMBER HAS ENTERED THE ARENA** 🟢🟢🟢  

Everyone welcome **<@${memberId}>** 👋  

This man just stepped into the **29 CLUB** — the entry point where momentum begins and isolation ends.

No more watching from the sidelines.  
No more "I'll start next week."  

This is where reps start stacking and confidence starts getting trained **in the real world**.

🔥 **EVERYONE — GIVE HIM A WARM WELCOME** 🔥  
Drop a 👊 / 🔥 / 🟢 in the chat and let him know he's in the right room.

<@${memberId}> — introduce yourself:
• who you are  
• why you're here  
• your #1 goal  

LET'S GET MOVING.`;
}

async function nudgeGeneral(member, tier) {
  if (!GENERAL_CHANNEL_ID) return;

  const message = buildTierWelcomeMessage(member.id, tier);
  await safeSendChannel(GENERAL_CHANNEL_ID, {
    content: message,
  });
}

// ============================================================================
// JOIN HANDLER
// ============================================================================

async function processMemberJoin(member) {
  if (member.guild.id !== GUILD_ID) return;

  // let invite counts settle
  await new Promise(r => setTimeout(r, 900));

  const usedInviteCode = await detectUsedInviteCode();
  const detectedTier = tierFromInviteCode(usedInviteCode);
  const tier = detectedTier || DEFAULT_TIER;

  if (!detectedTier) {
    console.warn(`SELEKTA WARNING: Invite tier not detected for ${member.user.tag}. Falling back to DEFAULT_TIER=${DEFAULT_TIER}`);
  } else {
    console.log(`SELEKTA: Detected join tier ${tier} for ${member.user.tag} via invite ${usedInviteCode}`);
  }

  try {
    const newRole = ROLES[tier]?.NEW;
    await safeAddRole(member, newRole);
    console.log(`SELEKTA: Assigned ${tier} - New to ${member.user.tag}`);

    if (POST_UNLOCK_PROMPT_ON_JOIN) await postUnlockPrompt(tier);
  } catch (err) {
    if (err?.code === 50013) {
      console.error('SELEKTA ERROR: Missing permissions to manage roles (check role hierarchy + Manage Roles)');
    } else {
      console.error(`SELEKTA ERROR: Role assignment failed - ${err?.message || err}`);
    }
  } finally {
    await cacheInvites();
  }
}

client.on('guildMemberAdd', async (member) => {
  joinProcessingQueue = joinProcessingQueue
    .then(() => processMemberJoin(member))
    .catch((err) => console.error(`SELEKTA ERROR: Join queue failed - ${err?.message || err}`));
});

client.on('inviteCreate', cacheInvites);
client.on('inviteDelete', cacheInvites);

// ============================================================================
// BUTTON INTERACTIONS
// ============================================================================

async function handleUnlock(interaction, tier) {
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) return;

  const newRoleId = ROLES[tier]?.NEW;
  const memberRoleId = ROLES[tier]?.MEMBER;

  const hasNew = newRoleId && member.roles.cache.has(newRoleId);
  if (!hasNew) {
    return interaction.reply({ content: 'You’re already unlocked (or you joined via a different tier).', ephemeral: true });
  }

  try {
    await safeRemoveRole(member, newRoleId);
    await safeAddRole(member, memberRoleId);

    // Optional: Legends also gets Epic member
    if (tier === 'LEGENDS' && LEGENDS_GETS_EPIC_MEMBER_TOO) {
      await safeAddRole(member, ROLES.EPIC.MEMBER);
    }

    const okMsg =
      tier === 'LEGENDS' ? '✅ Legends unlocked. Welcome to the inner circle.' :
      tier === 'EPIC' ? '✅ Epic unlocked. Welcome in.' :
      '✅ $29 Club unlocked. Welcome in.';

    await interaction.reply({ content: okMsg, ephemeral: true });

    // DM onboarding AFTER unlock
    await safeSendDM(member, dmOnUnlock(tier));

    // Announce in general
    await nudgeGeneral(member, tier);
  } catch (err) {
    if (err?.code === 50013) {
      return interaction.reply({ content: 'I’m missing permissions to swap roles. (Check role hierarchy + Manage Roles.)', ephemeral: true });
    }
    return interaction.reply({ content: `Something broke: ${err?.message || err}`, ephemeral: true });
  }
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  if (!interaction.guild || interaction.guild.id !== GUILD_ID) return;

  const id = interaction.customId;

  if (id === buttonCustomId('CLUB29')) return handleUnlock(interaction, 'CLUB29');
  if (id === buttonCustomId('EPIC')) return handleUnlock(interaction, 'EPIC');
  if (id === buttonCustomId('LEGENDS')) return handleUnlock(interaction, 'LEGENDS');
});

// ============================================================================
// READY
// ============================================================================

client.once('ready', async () => {
  console.log(`SELEKTA online as ${client.user.tag}`);
  await cacheInvites();

  if (ENSURE_UNLOCK_PROMPTS_ON_READY) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:536',message:'ready: posting unlock prompts',data:{ensurePrompts:ENSURE_UNLOCK_PROMPTS_ON_READY},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    await postUnlockPrompt('CLUB29');
    await postUnlockPrompt('EPIC');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:541',message:'ready: before Legends prompt',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    await postUnlockPrompt('LEGENDS');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:544',message:'ready: after Legends prompt',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
  }
});

// ============================================================================
// START
// ============================================================================

// #region agent log
process.on('uncaughtException', (err) => {
  fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:516',message:'Uncaught exception',data:{error:err.message,stack:err.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:523',message:'Unhandled rejection',data:{reason:String(reason)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  console.error('UNHANDLED REJECTION:', reason);
  process.exit(1);
});
// #endregion

// #region agent log
fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:530',message:'Before validateConfig',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
// #endregion

try {
  validateConfig();
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:535',message:'validateConfig success',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
} catch (e) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:538',message:'validateConfig error',data:{error:e.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  console.error(`SELEKTA FATAL: ${e.message}`);
  process.exit(1);
}

// #region agent log
fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:544',message:'Before client.login',data:{hasBotToken:!!BOT_TOKEN},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
// #endregion

client.login(BOT_TOKEN).then(() => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:548',message:'client.login success',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
}).catch((err) => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/d05a6ced-4644-4a84-a289-eb52989847be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:551',message:'client.login error',data:{error:err.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  console.error(`SELEKTA FATAL: Failed to login - ${err?.message || err}`);
  process.exit(1);
});
