/**
 * Modal Handler
 * Handles all modal submissions for stats, Barbie contacts, and course questions
 */

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  PermissionsBitField,
} = require('discord.js');

const config = require('../../config/settings'); // ✅ FIX: faltaba (se usa en Barbie embeds)
const { createLogger } = require('../../utils/logger');
const StatsProcessor = require('../../services/stats/StatsProcessor');
const { AFFINITY_WEIGHTS, STAT_ALIASES, STAT_WEIGHTS } = require('../../config/constants');
const BarbieListManager = require('../../services/barbie/BarbieListManager');
const { query, queryRow } = require('../../database/postgres');
const { getLocalDayString } = require('../../utils/timeUtils');

const logger = createLogger('ModalHandler');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * ✅ Resolve general channel id (for "Printed in General")
 * Priority:
 * 1) WINGMAN_GENERAL_CHANNEL_ID (some setups already use it)
 * 2) CHANNEL_GENERAL_ID
 * 3) GENERAL_CHANNEL_ID
 * 4) config.channels.* fallbacks
 */
function resolveGeneralChannelId() {
  return (
    process.env.WINGMAN_GENERAL_CHANNEL_ID ||
    process.env.CHANNEL_GENERAL_ID ||
    process.env.GENERAL_CHANNEL_ID ||
    config?.channels?.general ||
    config?.channels?.generalId ||
    config?.channels?.generalChannelId ||
    null
  );
}


/**
 * ✅ Get general channel safely
 */
async function getGeneralChannel(interaction) {
  try {
    const id = resolveGeneralChannelId();
    if (!id) return null;
    if (!interaction?.guild) return null;

    // Try cache first
    let ch = interaction.guild.channels.cache.get(id);
    if (ch) return ch;

    // Fetch if not cached
    try {
      ch = await interaction.guild.channels.fetch(id);
      return ch || null;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * ✅ Post stats submission into General channel (non-blocking)
 * - NO embed card
 * - One plain-text message "Keeper style"
 * - Keeps /submit-stats reply intact (ephemeral editReply elsewhere)
 */
async function postStatsSubmissionToGeneral(interaction, displayStats, xpGained, targetDate = null) {
  try {
    const ch = await getGeneralChannel(interaction);
    if (!ch || !ch.isTextBased?.()) return;

    const msg = buildKeeperStyleGeneralMessage({
      userId: interaction.user.id,
      stats: displayStats || {},
      xpGained,
      targetDate,
    });

    if (!msg) return;

    await ch.send({ content: msg });
  } catch (e) {
    logger.warn('Failed to post stats submission to General (non-critical)', { error: e?.message });
  }
}


function buildKeeperStyleGeneralMessage({ userId, stats, xpGained, targetDate }) {
  const mention = `<@${userId}>`;

  // Solo anunciamos stats “importantes” (ajústalo a gusto)
  const announceKeys = [
    'Approaches',
    'Numbers',
    'Dates Booked',
    'Dates Had',
    'Instant Date',
    'Same Night Pull From Instant Date',
    'Got Laid',
    'Confidence Tension Journal Entry',
  ];

  const templates = {
    Approaches: [
      `🚀 ${mention} just logged approaches. Courage stacked. What did you feel walking up?`,
      `🔥 ${mention} put in reps. Approaches like this shrink fear. Drop the play-by-play.`,
      `⚔️ ${mention} leveled up. Approaches logged. What was different this time?`,
    ],
    Numbers: [
      `💯 ${mention} secured numbers. What flipped the vibe?`,
      `🔗 ${mention} turned a stranger into a connection. What line landed?`,
      `🎯 ${mention} closed. Share the moment you knew it was locked.`,
    ],
    'Dates Booked': [`🗓️ ${mention} booked a date. Fantasy → reality. What sealed it?`],
    'Dates Had': [`🍷 ${mention} had a date. Biggest insight from the night?`],
    'Instant Date': [`⚡ ${mention} pulled an instant date. How did you flow into it?`],
    'Same Night Pull From Instant Date': [`🔥 ${mention} logged a same-night pull. Break down the sequence for the crew.`],
    'Got Laid': [`💎 ${mention} got laid. What lesson are you taking forward?`],
    'Confidence Tension Journal Entry': [`✍️ ${mention} logged a journal entry. What truth did you uncover today?`],
  };

  // Resumen compacto (solo los que > 0)
  const summaryParts = [];
  for (const k of announceKeys) {
    const v = Number(stats?.[k] ?? 0);
    if (v > 0) summaryParts.push(`**${k}**: ${v}`);
  }

  // Si no hay nada “anunciable”, no mandamos mensaje a General
  if (summaryParts.length === 0) return null;

  // Stat principal para elegir el texto (por prioridad)
  const mainKey = announceKeys.find(k => Number(stats?.[k] ?? 0) > 0);
  const options = templates[mainKey] || [];
  const keeperLine = options.length
    ? options[Math.floor(Math.random() * options.length)]
    : `✅ Solid work, ${mention}. Keep stacking reps.`;

  // Contexto de fecha si soportas past-stats
  let dateContext = '';
  if (targetDate) {
    const d = new Date(targetDate);
    if (!Number.isNaN(d.getTime())) {
      dateContext = ` (for ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
    }
  }

  return [
    `${keeperLine}${dateContext}`,
    `⭐ XP earned: **${xpGained}**`,
    `📌 ${summaryParts.join(' • ')}`,
  ].join('\n');
}


/**
 * ✅ Post level up into General channel (non-blocking)
 */
async function postLevelUpToGeneral(interaction, beforeLevel, afterLevel) {
  try {
    const ch = await getGeneralChannel(interaction);
    if (!ch) return;

    const embed = new EmbedBuilder()
      .setTitle('🎉 Level Up!')
      .setDescription(`🔥 <@${interaction.user.id}> leveled up!`)
      .addFields(
        { name: 'Before', value: String(beforeLevel ?? '—'), inline: true },
        { name: 'After', value: String(afterLevel ?? '—'), inline: true }
      )
      .setTimestamp(new Date());

    await ch.send({ embeds: [embed] });
  } catch (e) {
    logger.warn('Failed to post level up to General (non-critical)', { error: e?.message });
  }
}

/**
 * Format stat name with M/W weights
 */
function formatStatWithWeights(statName) {
  const weights = AFFINITY_WEIGHTS[statName];
  if (weights) {
    const w = weights.w || 0;
    const m = weights.m || 0;
    return `${statName} (W:${w} M:${m})`;
  }
  return statName;
}

/**
 * Extra aliases (local, safe) to avoid missing stats in submit-stats modals
 * NOTE: We keep existing STAT_ALIASES, but add crucial fallbacks here.
 */
const LOCAL_STAT_ALIASES = {
  // Dating
  same_night_pull: 'Same Night Pull From Instant Date',

  // Inner work (based on your modal IDs)
  courage_welcoming: 'Welcome Courage Upon Awakening',
  sbmm_meditation: 'Sexy Bastard Morning Meditation',
  grounding: 'Grounding Practice',
  releasing_sesh: 'Releasing Session',

  // Learning
  course_module: 'Finished 1 Undoing.U Module',
  course_experiment: 'Undoing.U Module Experiment',
  attending_group_call: 'Attending Group Calls',


  // Daily state
  overall_state_today_1_10: 'Overall State Today (1-10)',
  retention_streak: 'Semen Retention Streak',
};

function mapFieldIdToStatName(fieldId) {
  const keyLower = (fieldId || '').toLowerCase();

  // 1) Try config aliases (lower)
  if (STAT_ALIASES && STAT_ALIASES[keyLower]) return STAT_ALIASES[keyLower];
  // 2) Try config aliases (raw)
  if (STAT_ALIASES && STAT_ALIASES[fieldId]) return STAT_ALIASES[fieldId];
  // 3) Try local fallbacks
  if (LOCAL_STAT_ALIASES[keyLower]) return LOCAL_STAT_ALIASES[keyLower];

  return fieldId;
}

/**
 * ✅ Normalize stat key for admin edit modals
 */
function normalizeStatKey(input) {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();

  // aliases
  if (STAT_ALIASES && STAT_ALIASES[lower]) return STAT_ALIASES[lower];
  if (STAT_ALIASES && STAT_ALIASES[raw]) return STAT_ALIASES[raw];

  // local fallbacks
  if (LOCAL_STAT_ALIASES[lower]) return LOCAL_STAT_ALIASES[lower];

  // direct STAT_WEIGHTS
  if (STAT_WEIGHTS && STAT_WEIGHTS[raw] !== undefined) return raw;

  // case-insensitive scan
  if (STAT_WEIGHTS) {
    for (const k of Object.keys(STAT_WEIGHTS)) {
      if (k.toLowerCase() === lower) return k;
    }
  }

  // fallback (stat might exist in DB even if not in STAT_WEIGHTS)
  return raw;
}

/**
 * String or number to ≥ 1 (existing behavior for normal submissions)
 */
function toNumber(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  const n = parseFloat(trimmed);
  if (Number.isNaN(n) || n <= 0) return null;
  return n;
}

/**
 * ✅ allow 0 (for admin edits)
 */
function toNumberAllowZero(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  const n = parseFloat(trimmed);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

/**
 * Parse Yes/No style input into 1/0
 */
function parseYesNoTo01(value) {
  const v = (value || '').trim().toLowerCase();
  if (!v) return null;

  if (['yes', 'y', 'true', 't', '1'].includes(v)) return 1;
  if (['no', 'n', 'false', 'f', '0'].includes(v)) return 0;

  return null;
}

/**
 * Try to block "Daily State" submissions to once per day.
 * (Opción B: no usamos user_daily.data porque no existe en tu schema)
 * Safe fail if query fails.
 */
async function enforceDailyState24hLimit(userId) {
  try {
    const row = await queryRow(
      `
      SELECT created_at
      FROM user_daily
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [userId]
    );

    if (!row?.created_at) return { allowed: true };

    const last = new Date(row.created_at).getTime();
    const now = Date.now();
    const diffMs = now - last;

    const windowMs = 24 * 60 * 60 * 1000;
    if (diffMs >= windowMs) return { allowed: true };

    const remainingMs = windowMs - diffMs;
    return {
      allowed: false,
      remainingMin: Math.ceil(remainingMs / 60000),
      nextTs: Math.floor((now + remainingMs) / 1000),
    };
  } catch (e) {
    logger.warn('DailyState 24h limit check skipped (query failed)', { error: e?.message });
    return { allowed: true };
  }
}


async function markUserDailySubmission(userId, dayStr = null) {
  // Si dayStr viene null, usa CURRENT_DATE. Si viene YYYY-MM-DD lo guarda como DATE.
  if (dayStr) {
    await queryRow(
      `
      INSERT INTO user_daily (user_id, day)
      VALUES ($1, $2::date)
      ON CONFLICT (user_id, day)
      DO UPDATE SET updated_at = NOW()
      `,
      [userId, dayStr]
    );
    return;
  }

  await queryRow(
    `
    INSERT INTO user_daily (user_id, day)
    VALUES ($1, CURRENT_DATE)
    ON CONFLICT (user_id, day)
    DO UPDATE SET updated_at = NOW()
    `,
    [userId]
  );
}


/**
 * ✅ Determine admin status consistently
 */
function isAdminUser(interaction, services) {
  const envAdminId = process.env.ADMIN_USER_ID;
  if (envAdminId && interaction.user?.id === envAdminId) return true;

  if (services?.permissionGuard?.isAdmin) {
    try {
      return !!services.permissionGuard.isAdmin(interaction.user.id);
    } catch {}
  }

  // Guild permission fallback
  try {
    const perms = interaction.member?.permissions;
    if (!perms?.has) return false;
    // v14
    if (PermissionsBitField?.Flags?.Administrator) {
      return perms.has(PermissionsBitField.Flags.Administrator);
    }
    // ultra-fallback
    return perms.has('Administrator');
  } catch {
    return false;
  }
}

function safeDecodeURIComponent(v) {
  try { return decodeURIComponent(v); } catch { return v; }
}

/**
 * Handle modal submissions (router)
 */
async function handleModalSubmit(interaction, services) {
  const customId = interaction.customId;

  // ✅ ACK inmediato para que no expire el modal
if (!interaction.deferred && !interaction.replied) {
  try {
    await interaction.deferReply({ ephemeral: true });
  } catch (e) {
    // si ya fue acknowledged por otro lado, seguimos
  }
}


  try {
    logger.debug('Modal submitted', { customId, userId: interaction.user.id });

    if (customId.startsWith('stats_modal_')) {
      await handleStatsModal(interaction, services);
    } else if (customId.startsWith('stats_edit:')) {
      await handleStatsEditModal(interaction, services);


    } else if (customId.startsWith('submit-past-stats-modal:')) {
      await handlePastStatsModal(interaction, services);

    // ✅ Admin edit single stat modal
    } else if (customId.startsWith('admin_stats_edit_modal:')) {
      await handleAdminStatsEditModal(interaction, services);

    } else if (customId === 'barbie-add-modal') {
      await handleBarbieAddModal(interaction, services);
    } else if (customId === 'barbie-view-modal') {
      await handleBarbieViewModal(interaction, services);
    } else if (customId === 'course-question-modal') {
      await handleCourseQuestionModal(interaction, services);
    } else if (customId === 'ctj:add-entry') {
      await handleCtjEntryModal(interaction, services);
    } else {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ content: 'Modal not recognized.', ephemeral: true });
      }
    }
  } catch (error) {
    const msg = error?.message || '';
    const code = error?.code;

    logger.error('Modal submission error', { error: msg, customId });

    const isInteractionStateError =
      code === 10062 ||
      code === 40060 ||
      msg.includes('Unknown interaction') ||
      msg.includes('already been acknowledged');

    if (isInteractionStateError) {
      logger.warn('Skipping modal error reply because interaction is no longer valid', {
        customId, code,
      });
      return;
    }

    try {
      const payload = {
        content: '❌ Failed to process your submission. Please try again.',
        ephemeral: true,
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch (replyError) {
      logger.error('Failed to send modal error reply', { error: replyError.message });
    }
  }
}

/**
 * Handle Barbie view contact modal
 * customId: barbie-view-modal
 * input: barbie_view_id
 */
async function handleBarbieViewModal(interaction, services) {
  try {
    const raw = interaction.fields.getTextInputValue('barbie_view_id')?.trim();
    const id = parseInt(raw, 10);

    if (!raw || Number.isNaN(id) || id <= 0) {
      await interaction.editReply({ content: '❌ Invalid Contact ID. Use a number like `12`.' });
      return;
    }

    const manager = new BarbieListManager();

    // ✅ Importante: tu manager ya usa (contactId, userId) en otros handlers
    const contact = await manager.getContact(id, interaction.user.id);

    if (!contact) {
      await interaction.editReply({ content: `❌ Contact not found (ID: ${id}).` });
      return;
    }

    const vibe = contact.vibe_rating ? `${contact.vibe_rating}/10` : 'N/A';
    const ig = contact.instagram_handle ? `@${contact.instagram_handle}` : (contact.instagram_url || 'N/A');
    const phone = contact.phone_number || 'N/A';
    const notes = contact.notes ? contact.notes : '—';

    const embed = new EmbedBuilder()
      .setColor(config.branding.colorHex || 0xff69b4)
      .setTitle(`💖 ${contact.contact_name}`)
      .setDescription(`**ID:** ${contact.id}`)
      .addFields(
        { name: 'Vibe', value: vibe, inline: true },
        { name: 'Instagram', value: ig, inline: true },
        { name: 'Phone', value: phone, inline: true },
        { name: 'Notes', value: notes.length > 1024 ? notes.slice(0, 1021) + '...' : notes, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    logger.error('Failed to view Barbie contact from modal', {
      userId: interaction.user.id,
      error: error.message,
    });

    await interaction.editReply({ content: '❌ Failed to load contact. Please try again.' }).catch(() => {});
  }
}


/**
 * Build nice summary embed for stats submissions
 */
function buildStatsSummaryEmbed({ title, description, stats, xpGained }) {
  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle(title)
    .setDescription(description)
    .addFields({ name: 'XP Gained', value: `${xpGained} ⭐`, inline: false });

  for (const [statName, value] of Object.entries(stats)) {
    embed.addFields({ name: statName, value: value.toString(), inline: true });
  }

  return embed;
}

/**
 * Handle stats modal submissions (today)
 */
async function handleStatsModal(interaction, services) {
  // ✅ ACK inmediato (evita Unknown interaction 10062)
  if (!interaction.deferred && !interaction.replied) {
    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (e) {
      return;
    }
  }

  const customId = interaction.customId;

  // Daily state 24h limit
    if (customId === 'stats_modal_daily_state') {
      const limit = await enforceDailyState24hLimit(interaction.user.id);
      if (!limit.allowed) {
        await interaction.editReply({
          content: `⏳ You can submit **Daily State** once every 24 hours.\nTry again <t:${limit.nextTs}:R>.`,
        });
        return;
      }

      // ✅ Mark daily activity (so scorecard / streak / “has activity” logic can work)
      // Usa tu day local si ya lo manejas así en el resto del bot.
      const dayStr = getLocalDayString(); // "YYYY-MM-DD"
      await markUserDailySubmission(interaction.user.id, dayStr).catch(() => {});
    }


  const stats = {};
  const fields = interaction.fields.fields;

  for (const [fieldId, field] of fields) {
    const raw = field.value;

    if ((fieldId || '').toLowerCase() === 'retention_streak') {
      const parsed01 = parseYesNoTo01(raw);
      if (parsed01 !== null) {
        const statName = mapFieldIdToStatName(fieldId);
        stats[statName] = (stats[statName] || 0) + parsed01;
      }
      continue;
    }

    const num = toNumber(raw);
    if (num !== null) {
      const statName = mapFieldIdToStatName(fieldId);
      stats[statName] = (stats[statName] || 0) + num;
    }
  }

  if (Object.keys(stats).length === 0) {
    await interaction.editReply({
      content: '❌ No valid stats entered. Please enter at least one number > 0 (or Yes/No for retention).',
    });
    return;
  }

  // ✅ Usa el StatsProcessor del services si existe
  // ✅ Si lo creas aquí, pásale userService para que ensureUserExists pueda crear el user
  const statsProcessor =
    services?.statsProcessor ||
    new StatsProcessor(
      services.repositories,
      services.userService || null,
      services.duelManager || null
    );

  // ✅ Pasa username para que ensureUserExists pueda crear el user por repo o service
  const result = await statsProcessor.processSubmission(interaction.user.id, stats, null, {
    username: interaction.user.username,
  });

  if (!result.success) {
    await interaction.editReply({ content: `❌ Failed to submit stats: ${result.error}` });
    return;
  }

  const displayStats = result.validatedStats || stats;

  let xpGained = 0;
  if (typeof result.xpAwarded === 'number') {
    xpGained = result.xpAwarded;
  } else {
    for (const [name, value] of Object.entries(displayStats)) {
      const weight = STAT_WEIGHTS[name] || 0;
      xpGained += weight * value;
    }
  }

  const embed = buildStatsSummaryEmbed({
    title: '✅ Primary Stats Added!',
    description: "Your stats have been added to today's total.",
    stats: displayStats,
    xpGained,
  });

  await interaction.editReply({ embeds: [embed] });

  // ✅ Printed in General: on submit stats (non-blocking)
  await postStatsSubmissionToGeneral(interaction, displayStats, xpGained);

  // ✅ Printed in General: on level up (non-blocking)
  // Support multiple result shapes (for compatibility with your current StatsProcessor)
  const leveledUp =
    result.leveledUp === true ||
    result.levelUp === true ||
    result.didLevelUp === true ||
    (result.level && result.beforeLevel && Number(result.level) > Number(result.beforeLevel));

  if (leveledUp) {
    const beforeLevel =
      result.beforeLevel ??
      result.prevLevel ??
      result.oldLevel ??
      result.levelBefore ??
      null;

    const afterLevel =
      result.level ??
      result.newLevel ??
      result.afterLevel ??
      result.levelAfter ??
      null;

    await postLevelUpToGeneral(interaction, beforeLevel, afterLevel);
  }
}

/**
 * ✅ Handle stats-edit category modals (date-specific edit UI)
 * customId: stats_edit:<categoryKey>:<targetUserId>:<YYYY-MM-DD>
 *
 * This reuses the same modal fields as submit-stats,
 * but instead of "adding to today", it edits a specific day via statsEditService.editDay()
 */
async function handleStatsEditModal(interaction, services) {
  // IMPORTANT: modal submit must be acknowledged quickly
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }

  const parts = (interaction.customId || '').split(':');
  // [ "stats_edit", "<categoryKey>", "<targetUserId>", "<YYYY-MM-DD>" ]
  const categoryKey = parts[1];
  const targetUserId = parts[2];
  const dateStr = parts[3];

  // Validate payload
  if (
    !categoryKey ||
    !targetUserId ||
    !dateStr ||
    !DATE_RE.test(dateStr) ||
    Number.isNaN(Date.parse(dateStr))
  ) {
    await interaction.editReply({ content: '❌ Invalid edit payload (category/user/date).' });
    return;
  }

  // Inner Work disabled (client removed it)
  if (categoryKey === 'inner_work') {
    await interaction.editReply({ content: 'ℹ️ Inner Work is currently disabled.' });
    return;
  }

  // ✅ Permission: user can edit self; editing other users requires admin
  if (targetUserId !== interaction.user.id) {
    if (!isAdminUser(interaction, services)) {
      await interaction.editReply({ content: '❌ Admin only.' });
      return;
    }
  }

  if (!services?.statsEditService?.editDay || !services?.statsEditService?.getDay) {
    await interaction.editReply({ content: '❌ StatsEdit service unavailable.' });
    return;
  }

  // Build patch from modal inputs
  const patch = {};
  const fields = interaction.fields.fields;

  for (const [fieldId, field] of fields) {
    const raw = field?.value ?? '';
    const keyLower = (fieldId || '').toLowerCase();

    // Skip empty
    if (!raw || !raw.trim()) continue;

    // Special: retention is Yes/No -> 1/0
    if (keyLower === 'retention_streak') {
      const parsed01 = parseYesNoTo01(raw);
      if (parsed01 !== null) {
        const statName = mapFieldIdToStatName(fieldId);
        patch[statName] = parsed01; // set absolute value for that day
      }
      continue;
    }

    // Special: attending group call can be Yes/No OR number
    if (keyLower === 'attending_group_call' || keyLower === 'attending_group_calls') {
      const parsed01 = parseYesNoTo01(raw);
      const statName = mapFieldIdToStatName(fieldId);

      if (parsed01 !== null) {
        patch[statName] = parsed01;
        continue;
      }

      const n = toNumberAllowZero(raw);
      if (n !== null) {
        patch[statName] = Math.floor(n);
      }
      continue;
    }

    // Default: number >= 0 (edits allow 0)
    const n = toNumberAllowZero(raw);
    if (n !== null) {
      const statName = mapFieldIdToStatName(fieldId);
      patch[statName] = Math.floor(n);
    }
  }

  if (Object.keys(patch).length === 0) {
    await interaction.editReply({
      content: '❌ No valid values entered. Enter a number ≥ 0 (or Yes/No for retention/group call).',
    });
    return;
  }

  // Guardrails (match your admin single-stat rule)
  for (const [k, v] of Object.entries(patch)) {
    if (typeof v === 'number' && v > 500) {
      await interaction.editReply({
        content: `❌ Value too high for **${k}**. Max 500.`,
      });
      return;
    }
  }

  // Load "before" snapshot for delta reporting
  let beforeStats = {};
  try {
    const day = await services.statsEditService.getDay(targetUserId, dateStr);
    if (day?.success && day?.stats) beforeStats = day.stats;
  } catch (e) {
    logger.warn('StatsEdit modal: failed to load before day', { error: e?.message });
  }

  // Apply patch (audit logged inside service)
  const result = await services.statsEditService.editDay(
    targetUserId,
    dateStr,
    patch,
    interaction.user.id
  );

  if (!result?.success) {
    await interaction.editReply({
      content: `❌ Failed to edit stats: ${result?.error || 'Unknown error'}`,
    });
    return;
  }

  // Build a nice summary with deltas
  const changes = [];
  for (const [statName, afterVal] of Object.entries(patch)) {
    const beforeValRaw = Object.prototype.hasOwnProperty.call(beforeStats, statName)
      ? beforeStats[statName]
      : 0;

    const beforeVal = parseInt(beforeValRaw, 10) || 0;
    const afterValNum = parseInt(afterVal, 10) || 0;
    const delta = afterValNum - beforeVal;

    changes.push({ statName, beforeVal, afterValNum, delta });
  }

  const embed = new EmbedBuilder()
    .setColor(0x00d4aa)
    .setTitle('✅ Stats Updated')
    .setDescription(
      [
        `**Date:** ${dateStr}`,
        `**User:** <@${targetUserId}>`,
        `**Category:** ${categoryKey}`,
      ].join('\n')
    )
    .setTimestamp(new Date());

  // Show up to 25 fields safely
  for (const c of changes.slice(0, 25)) {
    embed.addFields({
      name: c.statName,
      value: `${c.beforeVal} → ${c.afterValNum} (${c.delta >= 0 ? '+' : ''}${c.delta})`,
      inline: true,
    });
  }

  if (changes.length > 25) {
    embed.addFields({
      name: '…more',
      value: `Showing first 25 changes. Total: ${changes.length}`,
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });

  logger.info('Stats edited via stats_edit modal', {
    editorId: interaction.user.id,
    targetUserId,
    date: dateStr,
    categoryKey,
    patchKeys: Object.keys(patch),
  });
}


/**
 * Handle past stats modal submissions
 * customId: submit-past-stats-modal:YYYY-MM-DD
 */
async function handlePastStatsModal(interaction, services) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: 1 << 6 });
  }

  const dateStr = interaction.customId.split(':')[1];

  const stats = {};
  const fields = interaction.fields.fields;

  for (const [fieldId, field] of fields) {
    const raw = field.value;

    if ((fieldId || '').toLowerCase() === 'retention_streak') {
      const parsed01 = parseYesNoTo01(raw);
      if (parsed01 !== null) {
        const statName = mapFieldIdToStatName(fieldId);
        stats[statName] = (stats[statName] || 0) + parsed01;
      }
      continue;
    }

    const num = toNumber(raw);
    if (num !== null) {
      const statName = mapFieldIdToStatName(fieldId);
      stats[statName] = (stats[statName] || 0) + num;
    }
  }

  if (Object.keys(stats).length === 0) {
    await interaction.editReply({
      content: '❌ No valid stats entered. Please enter at least one number > 0 (or Yes/No for retention).',
    });
    return;
  }

  const statsProcessor =
    services?.statsProcessor || new StatsProcessor(services.repositories, services.duelManager);

  const result = await statsProcessor.processSubmission(interaction.user.id, stats, dateStr);

  if (!result.success) {
    await interaction.editReply({ content: `❌ Failed to submit past stats: ${result.error}` });
    return;
  }

  const displayStats = result.validatedStats || stats;

  let xpGained = 0;
  if (typeof result.xpAwarded === 'number') {
    xpGained = result.xpAwarded;
  } else {
    for (const [name, value] of Object.entries(displayStats)) {
      const weight = STAT_WEIGHTS[name] || 0;
      xpGained += weight * value;
    }
  }

  const embed = buildStatsSummaryEmbed({
    title: `✅ Past Stats Added (${dateStr})`,
    description: 'Your stats have been added to that day.',
    stats: displayStats,
    xpGained,
  });

  await interaction.editReply({ embeds: [embed] });
}

/**
 * ✅ Admin single-stat edit modal submit handler
 *
 * Supports BOTH formats:
 * - New:  admin_stats_edit_modal:<targetUserId>:<YYYY-MM-DD>:<statNameEncoded>
 * - Old:  admin_stats_edit_modal:<targetUserId>:<YYYY-MM-DD>:<categoryKey>:<statNameEncoded>
 *
 * Modal input: customId "value"
 */
async function handleAdminStatsEditModal(interaction, services) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: 1 << 6 });
  }

  if (!isAdminUser(interaction, services)) {
    await interaction.editReply({ content: '❌ Admin only.' });
    return;
  }

  const parts = (interaction.customId || '').split(':');
  // parts[0] = admin_stats_edit_modal
  const targetUserId = parts[1];
  const dateStr = parts[2];

  if (!targetUserId || !dateStr || !DATE_RE.test(dateStr) || Number.isNaN(Date.parse(dateStr))) {
    await interaction.editReply({ content: '❌ Invalid admin edit modal payload (date/user).' });
    return;
  }

  // Determine whether it is new or old format
  // new: parts.length === 4 => statEncoded at parts[3]
  // old: parts.length >= 5 => category at parts[3], statEncoded at parts.slice(4).join(':')
  let categoryKey = 'all';
  let statEncoded = '';

  if (parts.length === 4) {
    statEncoded = parts[3];
  } else if (parts.length >= 5) {
    categoryKey = parts[3] || 'all';
    statEncoded = parts.slice(4).join(':');
  } else {
    await interaction.editReply({ content: '❌ Invalid admin edit modal payload (stat).' });
    return;
  }

  const statKeyRaw = safeDecodeURIComponent(statEncoded);
  const statName = normalizeStatKey(statKeyRaw);

  if (!statName) {
    await interaction.editReply({ content: `❌ Unknown stat: ${statKeyRaw}` });
    return;
  }

  // Read input
  let rawValue = '';
  try {
    rawValue = interaction.fields.getTextInputValue('value');
  } catch {
    rawValue = '';
  }

  // Parse new value
  let newValue = null;

  // retention accepts Yes/No too
  const statLower = (statKeyRaw || '').toLowerCase();
  if (statLower.includes('retention') || statName.toLowerCase().includes('retention')) {
    const parsed01 = parseYesNoTo01(rawValue);
    if (parsed01 !== null) newValue = parsed01;
  }

  if (newValue === null) {
    const n = toNumberAllowZero(rawValue);
    if (n === null) {
      await interaction.editReply({
        content: '❌ Invalid value. Enter a number ≥ 0 (or Yes/No for retention).',
      });
      return;
    }
    newValue = Math.floor(n);
  }

  // Guardrails
  if (newValue > 500) {
    await interaction.editReply({ content: '❌ Value too high. Max 500.' });
    return;
  }

  if (!services?.statsEditService?.editDay || !services?.statsEditService?.getDay) {
    await interaction.editReply({ content: '❌ StatsEdit service unavailable.' });
    return;
  }

  // Load before value via getDay
  let beforeValue = 0;
  try {
    const day = await services.statsEditService.getDay(targetUserId, dateStr);
    if (day?.success && day?.stats && Object.prototype.hasOwnProperty.call(day.stats, statName)) {
      beforeValue = parseInt(day.stats[statName], 10) || 0;
    }
  } catch (e) {
    logger.warn('Admin edit modal: failed to load before value', { error: e?.message });
  }

  // Apply patch
  const patch = { [statName]: newValue };
  const result = await services.statsEditService.editDay(
    targetUserId,
    dateStr,
    patch,
    interaction.user.id
  );

  if (!result?.success) {
    await interaction.editReply({
      content: `❌ Failed to edit stat: ${result?.error || 'Unknown error'}`,
    });
    return;
  }

  const delta = newValue - (beforeValue || 0);

  const embed = new EmbedBuilder()
    .setColor(0x00d4aa)
    .setTitle('✅ Stat Updated')
    .setDescription(`Updated **${statName}** for **${dateStr}**`)
    .addFields(
      { name: 'User', value: `<@${targetUserId}>`, inline: true },
      { name: 'Category', value: `${categoryKey}`, inline: true },
      { name: 'Before', value: `${beforeValue || 0}`, inline: true },
      { name: 'After', value: `${newValue}`, inline: true },
      { name: 'Δ', value: `${delta >= 0 ? '+' : ''}${delta}`, inline: true }
    )
    .setFooter({ text: 'Admin stat edit' })
    .setTimestamp(new Date());

  await interaction.editReply({ embeds: [embed] });

  logger.info('Admin edited single stat via modal', {
    editorId: interaction.user.id,
    targetUserId,
    date: dateStr,
    categoryKey,
    stat: statName,
    before: beforeValue || 0,
    after: newValue,
    delta,
  });
}

/**
 * Handle Barbie add contact modal
 */
async function handleBarbieAddModal(interaction, services) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }

  const safeGet = (idList) => {
    for (const id of idList) {
      try {
        if (interaction.fields.fields.has(id)) {
          const val = interaction.fields.getTextInputValue(id);
          if (typeof val === 'string') return val;
        }
      } catch {}
    }
    return '';
  };

  try {
    const nameRaw = safeGet(['name', 'barbie_name']);
    const phoneRaw = safeGet(['phone', 'barbie_phone']);
    const instagramRaw = safeGet(['instagram', 'barbie_instagram']);
    const vibeRaw = safeGet(['vibe', 'barbie_vibe']);
    const notesRaw = safeGet(['notes', 'barbie_notes']);

    const name = nameRaw.trim();
    const phone = phoneRaw.trim();
    const instagram = instagramRaw.trim();
    const notes = notesRaw.trim();

    if (!name) {
      await interaction.editReply({
        content: '❌ Name is required. Please fill in the Name field in the modal.',
      });
      return;
    }

    let vibeRating = null;
    if (vibeRaw) {
      const v = parseInt(vibeRaw.trim(), 10);
      if (!Number.isNaN(v) && v >= 1 && v <= 10) vibeRating = v;
    }

    const manager = new BarbieListManager();

    const contactData = {
      name,
      metLocation: null,
      metDate: null,
      phoneNumber: phone || null,
      instagramHandle: instagram ? instagram.replace(/^@/, '') : null,
      instagramUrl: null,
      notes: notes || null,
      vibeRating,
      tags: [],
      isPrivate: false,
    };

    const { contact, xpAwarded } = await manager.addContact(interaction.user.id, contactData);

    const xpText =
      xpAwarded && xpAwarded > 0
        ? `\n⭐ You also earned **${xpAwarded} XP** for keeping your list updated.`
        : '';

    await interaction.editReply({
      content: `💖 Contact **${contact.contact_name}** added to your Barbie List! (ID: ${contact.id})${xpText}`,
    });

    logger.info('Barbie contact created from modal', {
      userId: interaction.user.id,
      contactId: contact.id,
    });
  } catch (error) {
    logger.error('Failed to create Barbie contact from modal', {
      userId: interaction.user.id,
      error: error.message,
    });

    try {
      await interaction.editReply({ content: '❌ Failed to save contact. Please try again.' });
    } catch {}
  }
}

/**
 * Handle Course Question modal (course-question-modal)
 */
async function handleCourseQuestionModal(interaction, services) {
  let deferred = interaction.deferred || interaction.replied;

  if (!deferred) {
    try {
      await interaction.deferReply({ ephemeral: true });
      deferred = true;
    } catch (err) {
      const msg = err?.message || '';
      const code = err?.code;

      const isInteractionStateError =
        code === 10062 ||
        code === 40060 ||
        msg.includes('Unknown interaction') ||
        msg.includes('already been acknowledged');

      if (isInteractionStateError) {
        logger.warn('CourseQuestionModal: interaction invalid while deferring', {
          code, message: msg,
        });
        return;
      }
      throw err;
    }
  }

  try {
    const moduleRaw = interaction.fields.getTextInputValue('module')?.trim();
    const questionText = interaction.fields.getTextInputValue('question')?.trim();

    if (!questionText || questionText.length < 5) {
      await interaction.editReply({
        content: '❌ Please provide a more detailed question (at least 5 characters).',
      });
      return;
    }

    let moduleNumber = null;
    if (moduleRaw) {
      const parsed = parseInt(moduleRaw, 10);
      if (!Number.isNaN(parsed) && parsed > 0) moduleNumber = parsed;
    }

    let moduleRow = null;
    if (moduleNumber !== null) {
      moduleRow = await queryRow(
        'SELECT id, module_number, title FROM course_modules WHERE module_number = $1',
        [moduleNumber]
      );

      if (!moduleRow) {
        await interaction.editReply({ content: `❌ Module ${moduleNumber} not found.` });
        return;
      }
    }

    await query(
      `
      INSERT INTO course_questions (user_id, module_id, video_id, question)
      VALUES ($1, $2, $3, $4)
      `,
      [interaction.user.id, moduleRow ? moduleRow.id : null, null, questionText]
    );

    logger.info('Course question submitted via modal', {
      userId: interaction.user.id,
      moduleNumber: moduleRow?.module_number || null,
    });

    const successText = moduleRow
      ? `✅ Your question for **Module ${moduleRow.module_number} - ${moduleRow.title}** has been submitted!`
      : '✅ Your question has been submitted! The coaching team will review it soon.';

    await interaction.editReply({ content: successText });
  } catch (error) {
    logger.error('CourseQuestionModal: error while handling course-question-modal', {
      error: error.message,
    });

    const msg = error?.message || '';
    const code = error?.code;
    const isInteractionStateError =
      code === 10062 ||
      code === 40060 ||
      msg.includes('Unknown interaction') ||
      msg.includes('already been acknowledged');

    if (isInteractionStateError) {
      logger.warn('CourseQuestionModal: interaction no longer valid when sending error', {
        code, message: msg,
      });
      return;
    }

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: '❌ Failed to submit your question. Please try again.',
        });
      } else {
        await interaction.reply({
          content: '❌ Failed to submit your question. Please try again.',
          ephemeral: true,
        });
      }
    } catch (replyErr) {
      logger.error('CourseQuestionModal: failed to send error reply', {
        error: replyErr.message,
      });
    }
  }
}

/**
 * Create Core Social Stats modal
 */
function createCoreSocialModal() {
  const modal = new ModalBuilder()
    .setCustomId('stats_modal_core_social')
    .setTitle('🎯 Core Social Stats');

  const approachesInput = new TextInputBuilder()
    .setCustomId('approaches')
    .setLabel(formatStatWithWeights('Approaches'))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 5')
    .setRequired(false);

  const numbersInput = new TextInputBuilder()
    .setCustomId('numbers')
    .setLabel(formatStatWithWeights('Numbers'))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 3')
    .setRequired(false);

  const contactResponseInput = new TextInputBuilder()
    .setCustomId('new_contact_response')
    .setLabel(formatStatWithWeights('New Contact Response'))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 1')
    .setRequired(false);

  const hellosInput = new TextInputBuilder()
    .setCustomId('hellos_to_strangers')
    .setLabel(formatStatWithWeights('Hellos To Strangers'))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 10')
    .setRequired(false);

  const inActionReleaseInput = new TextInputBuilder()
    .setCustomId('in_action_release')
    .setLabel(formatStatWithWeights('In Action Release'))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 1')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(approachesInput),
    new ActionRowBuilder().addComponents(numbersInput),
    new ActionRowBuilder().addComponents(contactResponseInput),
    new ActionRowBuilder().addComponents(hellosInput),
    new ActionRowBuilder().addComponents(inActionReleaseInput)
  );

  return modal;
}

/**
 * Create Dating & Results modal
 */
function createDatingModal() {
  const modal = new ModalBuilder()
    .setCustomId('stats_modal_dating')
    .setTitle('❤️ Dating & Results');

  const datesBookedInput = new TextInputBuilder()
    .setCustomId('dates_booked')
    .setLabel(formatStatWithWeights('Dates Booked'))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 2')
    .setRequired(false);

  const datesHadInput = new TextInputBuilder()
    .setCustomId('dates_had')
    .setLabel(formatStatWithWeights('Dates Had'))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 1')
    .setRequired(false);

  const instantDateInput = new TextInputBuilder()
    .setCustomId('instant_date')
    .setLabel(formatStatWithWeights('Instant Date'))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 0')
    .setRequired(false);

  const gotLaidInput = new TextInputBuilder()
    .setCustomId('got_laid')
    .setLabel(formatStatWithWeights('Got Laid'))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 1')
    .setRequired(false);

  const sameNightPullInput = new TextInputBuilder()
    .setCustomId('same_night_pull')
    .setLabel(formatStatWithWeights('Same Night Pull'))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 0')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(datesBookedInput),
    new ActionRowBuilder().addComponents(datesHadInput),
    new ActionRowBuilder().addComponents(gotLaidInput),
    new ActionRowBuilder().addComponents(instantDateInput),
    new ActionRowBuilder().addComponents(sameNightPullInput)
  );

  return modal;
}

/**
 * Create Inner Work modal
 */
function createInnerWorkModal() {
  const modal = new ModalBuilder()
    .setCustomId('stats_modal_inner_work')
    .setTitle('🧘 Inner Work');

  const courageInput = new TextInputBuilder()
    .setCustomId('courage_welcoming')
    .setLabel(formatStatWithWeights('Courage Welcoming'))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 1')
    .setRequired(false);

  const sbmmInput = new TextInputBuilder()
    .setCustomId('sbmm_meditation')
    .setLabel(formatStatWithWeights('SBMM Meditation'))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 1')
    .setRequired(false);

  const groundingInput = new TextInputBuilder()
    .setCustomId('grounding')
    .setLabel(formatStatWithWeights('Grounding'))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 1')
    .setRequired(false);

  const releasingInput = new TextInputBuilder()
    .setCustomId('releasing_sesh')
    .setLabel(formatStatWithWeights('Releasing Sesh'))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 1')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(courageInput),
    new ActionRowBuilder().addComponents(sbmmInput),
    new ActionRowBuilder().addComponents(groundingInput),
    new ActionRowBuilder().addComponents(releasingInput)
  );

  return modal;
}

/**
 * Create Learning modal
 */
function createLearningModal() {
  const modal = new ModalBuilder()
    .setCustomId('stats_modal_learning')
    .setTitle('📚 Learning');

  const moduleInput = new TextInputBuilder()
    .setCustomId('course_module')
    .setLabel(formatStatWithWeights('Course Module'))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 1')
    .setRequired(false);

  const experimentInput = new TextInputBuilder()
    .setCustomId('course_experiment')
    .setLabel(formatStatWithWeights('Course Experiment'))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 1')
    .setRequired(false);

  // ✅ NEW FIELD
  const groupCallInput = new TextInputBuilder()
    .setCustomId('attending_group_call')
    .setLabel('Attended Group Call')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 1/0')
    .setRequired(false);

  const row1 = new ActionRowBuilder().addComponents(moduleInput);
  const row2 = new ActionRowBuilder().addComponents(experimentInput);
  const row3 = new ActionRowBuilder().addComponents(groupCallInput);

  modal.addComponents(row1, row2, row3);
  return modal;
}


/**
 * Create Daily State modal
 */
function createDailyStateModal() {
  const modal = new ModalBuilder()
    .setCustomId('stats_modal_daily_state')
    .setTitle('🎭 Daily State');

  const stateInput = new TextInputBuilder()
    .setCustomId('overall_state_today_1_10')
    .setLabel(formatStatWithWeights('Overall State Today (1-10)'))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 8')
    .setRequired(false);

  const retentionInput = new TextInputBuilder()
    .setCustomId('retention_streak')
    .setLabel(formatStatWithWeights('Retention Streak (Yes/No)'))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Yes or No')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(stateInput),
    new ActionRowBuilder().addComponents(retentionInput)
  );

  return modal;
}

/**
 * Handle Confidence-Tension Journal modal (ctj:add-entry)
 */
async function handleCtjEntryModal(interaction, services) {
  if (!interaction.deferred && !interaction.replied) {
    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (err) {
      const msg = err?.message || '';
      const code = err?.code;

      const isInteractionStateError =
        code === 10062 ||
        code === 40060 ||
        msg.includes('Unknown interaction') ||
        msg.includes('already been acknowledged');

      if (isInteractionStateError) {
        logger.warn('CTJ modal: interaction invalid while deferring', { code, message: msg });
        return;
      }
      throw err;
    }
  }

  try {
    const dateRaw = interaction.fields.getTextInputValue('date')?.trim();
    const confidenceRaw = interaction.fields.getTextInputValue('confidence')?.trim();
    const tensionRaw = interaction.fields.getTextInputValue('tension')?.trim();
    const notesRaw = interaction.fields.getTextInputValue('notes')?.trim();

    const errors = [];

    const confidence = parseInt(confidenceRaw, 10);
    if (Number.isNaN(confidence) || confidence < 1 || confidence > 10) {
      errors.push('Confidence must be a number between 1 and 10.');
    }

    const tension = parseInt(tensionRaw, 10);
    if (Number.isNaN(tension) || tension < 1 || tension > 10) {
      errors.push('Tension must be a number between 1 and 10.');
    }

    let date = null;
    if (dateRaw) {
      const isValidFormat = DATE_RE.test(dateRaw);
      if (!isValidFormat || Number.isNaN(Date.parse(dateRaw))) {
        errors.push('Date must be in YYYY-MM-DD format.');
      } else {
        date = dateRaw;
      }
    }

    if (errors.length > 0) {
      await interaction.editReply({
        content: '❌ There were problems with your entry:\n• ' + errors.join('\n• '),
      });
      return;
    }

    if (services?.ctjService) {
      try {
        const payload = {
          userId: interaction.user.id,
          date,
          confidence,
          tension,
          notes: notesRaw || null,
        };

        if (typeof services.ctjService.addEntry === 'function') {
          await services.ctjService.addEntry(payload);
        } else if (typeof services.ctjService.saveEntry === 'function') {
          await services.ctjService.saveEntry(payload);
        } else {
          logger.warn('CTJ modal: ctjService has no addEntry/saveEntry; skipping DB persist');
        }
      } catch (svcError) {
        logger.error('CTJ modal: error while saving entry', { error: svcError.message });
        await interaction.editReply({
          content: '⚠️ Your entry was received but there was an error saving it. Please tell an admin.',
        });
        return;
      }
    } else {
      logger.warn('CTJ modal: services.ctjService not available; skipping DB persist');
    }

    await interaction.editReply({
      content:
        `✅ Journal entry saved.\n` +
        `• Confidence: **${confidence}**\n` +
        `• Tension: **${tension}**` +
        (notesRaw ? '\n• Notes recorded.' : ''),
    });

    logger.info('CTJ entry submitted via modal', {
      userId: interaction.user.id,
      date,
      confidence,
      tension,
      hasNotes: Boolean(notesRaw),
    });
  } catch (error) {
    logger.error('Failed to handle ctj:add-entry modal', { error: error.message });
    try {
      await interaction.editReply({
        content: '❌ Failed to save your journal entry. Please try again later.',
      });
    } catch (replyError) {
      logger.error('CTJ modal: failed to send error reply', { error: replyError.message });
    }
  }
}

module.exports = {
  handleModal: handleModalSubmit,
  handleModalSubmit,
  createCoreSocialModal,
  createDatingModal,
  createInnerWorkModal,
  createLearningModal,
  createDailyStateModal,
};
