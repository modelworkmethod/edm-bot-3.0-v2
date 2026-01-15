/**
 * Button Handler
 * Handles button click interactions
 */

const { createLogger } = require('../../utils/logger');
const { handleError, handleDiscordError } = require('../../utils/errorHandler');
const { getLocalDayString } = require('../../utils/timeUtils');
const {
  createCoreSocialModal,
  createDatingModal,
  createInnerWorkModal,
  createLearningModal,
  createDailyStateModal
} = require('./modalHandler');
const raidEndButton = require('../../interactions/raidEndButton');

// ✅ NEW: Barbie menu button router
const barbieMenuButton = require('../../interactions/buttons/barbieMenuButton');

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder: DiscordActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
} = require('discord.js');

const logger = createLogger('ButtonHandler');
const scorecardCmd = require('../../commands/stats/scorecard');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ✅ Tensey checklist button handlers (delegate from main bot)
let checklistNavigationButton = null;
let checklistToggleButton = null;
let checklistUndoButton = null;
let checklistInfoButton = null;

// ✅ NEW: Tensey Lists HOME UI (all lists UI)
let openTenseyListsButton = null;

try { checklistNavigationButton = require('../../../tensey-bot/src/interactions/buttons/checklistNavigationButton'); } catch {}
try { checklistToggleButton = require('../../../tensey-bot/src/interactions/buttons/checklistToggleButton'); } catch {}
try { checklistUndoButton = require('../../../tensey-bot/src/interactions/buttons/checklistUndoButton'); } catch {}
try { checklistInfoButton = require('../../../tensey-bot/src/interactions/buttons/checklistInfoButton'); } catch {}
try { openTenseyListsButton = require('../../../tensey-bot/src/interactions/buttons/openTenseyListsButton'); } catch {}

/**
 * ✅ Safe responder for buttons
 */
async function safeButtonReply(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.followUp(payload);
    }
    return await interaction.reply(payload);
  } catch (e) {
    try {
      if (interaction.deferred || interaction.replied) {
        return await interaction.editReply(payload);
      }
    } catch {}
  }
}

/**
 * ✅ Helper: is admin?
 */
function isAdminUser(interaction, services) {
  return (
    services?.permissionGuard?.isAdmin?.(interaction.user.id) ||
    interaction.member?.permissions?.has?.(PermissionsBitField.Flags.Administrator)
  );
}

/**
 * ✅ Double XP Cancel — Prompt confirm (ephemeral)
 * Button customId: doublexp_cancel:<eventId>
 */
async function handleDoubleXPCancelPrompt(interaction, services) {
  const isAdmin = isAdminUser(interaction, services);
  if (!isAdmin) {
    await safeButtonReply(interaction, { content: '❌ Admin only.', flags: 1 << 6 }).catch(() => {});
    return;
  }

  const parts = String(interaction.customId || '').split(':');
  const eventId = parts[1];

  if (!eventId) {
    await safeButtonReply(interaction, { content: '❌ Invalid cancel payload.', flags: 1 << 6 }).catch(() => {});
    return;
  }

  const row = new DiscordActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`doublexp_cancel_confirm:${eventId}`)
      .setLabel('Confirm cancel')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`doublexp_cancel_abort:${eventId}`)
      .setLabel('Keep event')
      .setStyle(ButtonStyle.Secondary),
  );

  await safeButtonReply(interaction, {
    content: `⚠️ Cancel Double XP event **#${eventId}**?\nThis will stop reminders and mark it as cancelled.`,
    components: [row],
    flags: 1 << 6
  }).catch(() => {});
}

/**
 * ✅ Double XP Cancel — Confirm
 * Button customId: doublexp_cancel_confirm:<eventId>
 */
async function handleDoubleXPCancelConfirm(interaction, services) {
  const isAdmin = isAdminUser(interaction, services);
  if (!isAdmin) {
    await safeButtonReply(interaction, { content: '❌ Admin only.', flags: 1 << 6 }).catch(() => {});
    return;
  }

  const parts = String(interaction.customId || '').split(':');
  const eventId = parts[1];

  if (!eventId) {
    await safeButtonReply(interaction, { content: '❌ Invalid cancel payload.', flags: 1 << 6 }).catch(() => {});
    return;
  }

  // ACK quickly (buttons expire fast)
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 1 << 6 });
    }
  } catch {}

  try {
    const DoubleXPManager = require('../../services/events/DoubleXPManager');
    const manager = new DoubleXPManager(services.channelService);

    // ✅ You'll add this method in DoubleXPManager.js
    const result = await manager.cancelEvent(eventId, interaction.user.id);

    if (!result?.success) {
      await interaction.editReply({ content: `❌ Failed to cancel event #${eventId}. Check logs.` }).catch(() => {});
      return;
    }

    await interaction.editReply({ content: `✅ Event #${eventId} cancelled.` }).catch(() => {});

    // ✅ Update the public message that contains the button (remove components)
    try {
      const msg = interaction.message;
      if (msg?.edit) {
        await msg.edit({
          content: `${msg.content}\n\n🚫 **CANCELLED by <@${interaction.user.id}>**`,
          components: []
        });
      }
    } catch {}

    logger.info('Double XP event cancelled via button', {
      eventId,
      cancelledBy: interaction.user.id
    });

  } catch (err) {
    logger.error('Double XP cancel failed', { error: err?.message, eventId });
    await interaction.editReply({ content: `❌ Cancel failed: ${err?.message || err}` }).catch(() => {});
  }
}

/**
 * ✅ Double XP Cancel — Abort
 * Button customId: doublexp_cancel_abort:<eventId>
 */
async function handleDoubleXPCancelAbort(interaction) {
  await safeButtonReply(interaction, {
    content: '✅ Keeping the event as scheduled.',
    flags: 1 << 6,
    components: []
  }).catch(() => {});
}


/**
 * Handle button interaction
 */
async function handleButton(interaction, services) {
  if (!interaction.isButton()) return;
  const customId = interaction.customId;

      // ✅ TENSEY: Open Checklist from "All Lists" UI
    if (customId === 'tensey_open_checklist') {
      // We reuse the checklist navigation handler by forcing the expected customId
      const originalId = interaction.customId;
      interaction.customId = 'checklist_nav_open';

      try {
        if (checklistNavigationButton?.execute) {
          // This will render page 0 checklist
          await checklistNavigationButton.execute(interaction);
          return;
        }

        await safeButtonReply(interaction, {
          content: '⚠️ checklistNavigationButton not available.',
          flags: 1 << 6
        }).catch(() => {});
        return;

      } finally {
        // restore
        interaction.customId = originalId;
      }
    }



  // ───────────────────────────────────────────────────────────────────────────
  // ✅ FIX: The open button MUST open the "Lists Home UI" (NOT checklist)
  // Your EnsureButtonsJob uses: setCustomId('checklist_nav_open')
  // We route that to openTenseyListsButton.
  // ───────────────────────────────────────────────────────────────────────────
  if (customId === 'checklist_nav_open') {
    if (customId === 'checklist_nav_open') {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 1 << 6 }); // ephemeral
    }
  } catch {}

  try {
    if (openTenseyListsButton?.execute) {
      await openTenseyListsButton.execute(interaction);
      return;
    }
    await interaction.editReply({ content: '⚠️ openTenseyListsButton missing.', flags: 1 << 6 });
    return;
  } catch (e) {
    logger.error('[OPEN_LISTS] failed', { error: e?.message, stack: e?.stack });
    try { await interaction.editReply({ content: '❌ Failed to open lists.', flags: 1 << 6 }); } catch {}
    return;
  }
}

    try {
      // Prefer loaded module (no re-require)
      if (openTenseyListsButton?.execute) {
        await openTenseyListsButton.execute(interaction);
        return;
      }
    } catch (e) {
      // fallthrough to safe reply
    }

    await safeButtonReply(interaction, {
      content: '⚠️ Tensey Lists UI handler not available.',
      flags: 1 << 6
    }).catch(() => {});
    return;
  }

  // ✅ TENSEY CHECKLIST ROUTING (MUST BE FIRST)
  // Accept BOTH: "checklist_*" and "checklist-*"
  if (typeof customId === 'string' && (customId.startsWith('checklist_') || customId.startsWith('checklist-'))) {
    // Normalize dashes to underscores so old/new IDs work the same
    const normalizedId = customId.replace(/-/g, '_');

    const isNav =
      normalizedId.startsWith('checklist_nav_') ||
      normalizedId.startsWith('checklist_page_') ||
      normalizedId.startsWith('checklist_level_');

    const isToggle = normalizedId.startsWith('checklist_toggle_');
    const isUndo = normalizedId === 'checklist_undo';
    const isInfo = normalizedId.startsWith('checklist_info_');

    // ✅ attach normalizedId so downstream parser works
    interaction.customId = normalizedId;

    if (isNav && checklistNavigationButton?.execute) {
      await checklistNavigationButton.execute(interaction);
      return;
    }

    if (isToggle && checklistToggleButton?.execute) {
      await checklistToggleButton.execute(interaction);
      return;
    }

    if (isUndo && checklistUndoButton?.execute) {
      await checklistUndoButton.execute(interaction);
      return;
    }

    if (isInfo && checklistInfoButton?.execute) {
      await checklistInfoButton.execute(interaction);
      return;
    }

    // Fallback: ACK safely so we do not fall into "Unknown button"
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
      }
    } catch {}

    await interaction.followUp({
      content: '⚠️ Checklist button handler not wired yet for this action.',
      flags: 1 << 6
    }).catch(() => {});
    return;
  }

  try {
    logger.debug('Button clicked', {
      customId,
      userId: interaction.user.id
    });

    // ✅ NEW: Admin stats clear confirm/cancel
    if (customId.startsWith('admin_stats_clear_confirm:')) {
      await handleAdminStatsClearConfirm(interaction, services);
      return;
    }
    if (customId === 'admin_stats_clear_cancel') {
      await handleAdminStatsClearCancel(interaction);
      return;
    }

    // ✅ Double XP cancel buttons (Admin only)
    // IMPORTANT: check confirm/abort BEFORE the generic prefix
    if (customId.startsWith('doublexp_cancel_confirm:')) {
      await handleDoubleXPCancelConfirm(interaction, services);
      return;
    }
    if (customId.startsWith('doublexp_cancel_abort:')) {
      await handleDoubleXPCancelAbort(interaction);
      return;
    }
    if (customId.startsWith('doublexp_cancel:')) {
      await handleDoubleXPCancelPrompt(interaction, services);
      return;
    }

/*     // ✅ TENSEY LISTS HOME (ALL LISTS UI) — keep this for future/other buttons
    if (customId === 'tensey_open_lists') {
      if (openTenseyListsButton?.execute) {
        await openTenseyListsButton.execute(interaction);
        return;
      }
      await safeButtonReply(interaction, {
        content: '⚠️ Tensey Lists UI handler not available.',
        flags: 1 << 6
      }).catch(() => {});
      return;
    } */

    // 🔹 leaderboard buttons / score / coaching / barbie / duel, etc...
    // ✅ FIX: accept both "refresh-leaderboard" and "refresh-leaderboard:..."
    if (customId === 'refresh-leaderboard' || customId.startsWith('refresh-leaderboard:')) {
      const refreshHandler = require('../../interactions/buttons/refreshLeaderboardButton');
      await refreshHandler.execute(interaction, services);
      return;
    } else if (customId === 'view-my-scorecard') {
      await handleViewScorecard(interaction, services);
    } else if (customId.startsWith('refresh-scorecard:')) {
      await handleRefreshScorecard(interaction, services);
    } else if (customId === 'coaching-send-reminders') {
      await handleSendReminders(interaction, services);
    } else if (customId === 'coaching-export-list') {
      await handleExportList(interaction, services);
    } else if (customId.startsWith('edit_stats_category_')) {
      await handleEditStatsCategoryButton(interaction);

      // ✅ Barbie Menu Buttons
    } else if (customId.startsWith('barbie-menu:')) {
      await barbieMenuButton.execute(interaction, services);
    } else if (customId.startsWith('barbie-opener:')) {
      await handleBarbieOpener(interaction, services);
    } else if (customId.startsWith('barbie-delete:')) {
      await handleBarbieDelete(interaction, services);
    } else if (customId.startsWith('barbie-ig-analyze:')) {
      await handleInstagramAnalyze(interaction, services);
    } else if (customId.startsWith('barbie-ig-vision:')) {
      await handleInstagramVision(interaction, services);

    } else if (customId.startsWith('duel-accept:')) {
      await handleDuelAccept(interaction, services);
    } else if (customId.startsWith('duel-decline:')) {
      await handleDuelDecline(interaction, services);
    } else if (customId.startsWith('duel-status:')) {
      await handleDuelStatus(interaction, services);
    } else if (customId === 'course-ask-open') {
      await handleCourseAskOpen(interaction, services);
    } else if (customId === 'ctj-open-journal') {
      await handleCtjOpenJournal(interaction, services);

      // 🔹 MODAL Buttons for stats (TODAY)
    } else if (customId === 'stats_category_core_social') {
      await interaction.showModal(createCoreSocialModal());
    } else if (customId === 'stats_category_dating') {
      await interaction.showModal(createDatingModal());
    } else if (customId === 'stats_category_inner_work') {
      await interaction.showModal(createInnerWorkModal());
    } else if (customId === 'stats_category_learning') {
      await interaction.showModal(createLearningModal());
    } else if (customId === 'stats_category_daily_state') {
      await interaction.showModal(createDailyStateModal());

      // ✅ NEW: PAST STATS category buttons
    } else if (customId.startsWith('past_stats_category_')) {
      await handlePastStatsCategoryButton(interaction);

    } else if (customId === 'stats_help') {
      await handleStatsHelp(interaction, services);
    } else if (customId === 'group_call_yes') {
      await handleGroupCallYes(interaction, services);
    } else if (customId === 'group_call_no') {
      await handleGroupCallNo(interaction, services);
    } else if (customId.startsWith('stats-')) {
      await handleStatsButton(interaction, services);
    } else if (customId.startsWith('course-start-module:')) {
      await handleCourseStartModule(interaction, services);

      // ✅ Admin Stats Panel buttons
    } else if (customId.startsWith('admin_stats:')) {
      await handleAdminStatsPanelButton(interaction, services);

      // 🔹 End raid button
    } else if (customId.startsWith('raid-end:')) {
      await raidEndButton.execute(interaction, services);
    } else {
      logger.warn('Unknown button', { customId });

      await interaction.reply({
        content: 'This button is not implemented yet.',
        flags: 1 << 6
      }).catch(() => {});
    }

  } catch (error) {
    if (error.code === 10062 || /Unknown interaction/i.test(error.message || '')) {
      logger.warn('Skipping error reply in ButtonHandler because interaction is no longer valid', {
        customId: interaction.customId,
        code: error.code,
        msg: error.message
      });
      return;
    }

    handleError(error, 'ButtonHandler');

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: 'An error occurred processing this button.',
          flags: 1 << 6
        });
      } else {
        await interaction.reply({
          content: 'An error occurred processing this button.',
          flags: 1 << 6
        });
      }
    } catch (replyError) {
      logger.error('Failed to send error message', { error: replyError.message });
    }
  }
}

/**
 * ✅ Admin Clear Confirm
 */
async function handleAdminStatsClearConfirm(interaction, services) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferUpdate().catch(() => {});
  }

  const parts = (interaction.customId || '').split(':');
  const targetUserId = parts[1];
  const dateStr = parts[2];
  const statEncoded = parts.slice(3).join(':');

  let statName = statEncoded;
  try { statName = decodeURIComponent(statEncoded); } catch {}

  if (!targetUserId || !dateStr || !DATE_RE.test(dateStr) || !statName) {
    try {
      await interaction.followUp({ content: '❌ Invalid clear payload.', flags: 1 << 6 });
    } catch {
      await interaction.reply({ content: '❌ Invalid clear payload.', flags: 1 << 6 }).catch(() => {});
    }
    return;
  }

  const isAdmin =
    services?.permissionGuard?.isAdmin?.(interaction.user.id) ||
    interaction.member?.permissions?.has?.(PermissionsBitField.Flags.Administrator);

  if (!isAdmin) {
    try {
      await interaction.followUp({ content: '❌ Admin only.', flags: 1 << 6 });
    } catch {
      await interaction.reply({ content: '❌ Admin only.', flags: 1 << 6 }).catch(() => {});
    }
    return;
  }

  if (!services?.statsEditService?.editDay) {
    try {
      await interaction.followUp({ content: '❌ StatsEdit service unavailable.', flags: 1 << 6 });
    } catch {
      await interaction.reply({ content: '❌ StatsEdit service unavailable.', flags: 1 << 6 }).catch(() => {});
    }
    return;
  }

  const patch = { [statName]: 0 };
  const result = await services.statsEditService.editDay(
    targetUserId,
    dateStr,
    patch,
    interaction.user.id
  );

  if (!result?.success) {
    try {
      await interaction.followUp({
        content: `❌ Failed to clear stat: ${result?.error || 'Unknown error'}`,
        flags: 1 << 6
      });
    } catch {
      await interaction.reply({
        content: `❌ Failed to clear stat: ${result?.error || 'Unknown error'}`,
        flags: 1 << 6
      }).catch(() => {});
    }
    return;
  }

  try {
    await interaction.editReply({
      content: `🗑️ Cleared **${statName}** on **${dateStr}** for <@${targetUserId}> (set to 0).`,
      components: []
    });
  } catch {
    try {
      await interaction.followUp({
        content: `🗑️ Cleared **${statName}** on **${dateStr}** for <@${targetUserId}> (set to 0).`,
        flags: 1 << 6
      });
    } catch {}
  }

  logger.info('Admin cleared stat (set 0)', {
    editorId: interaction.user.id,
    targetUserId,
    date: dateStr,
    stat: statName,
  });
}

/**
 * ✅ Admin Clear Cancel
 */
async function handleAdminStatsClearCancel(interaction) {
  try {
    await interaction.update({
      content: '✅ Cancelled.',
      components: []
    });
  } catch {
    // ✅ FIX: eventId was undefined here; keep a safe message
    await interaction.followUp({ content: `✅ Cancelled.`, flags: 1 << 6 }).catch(() => {});
  }
}

/**
 * ✅ Handle Edit Stats Category Buttons (date-specific edit)
 */
async function handleEditStatsCategoryButton(interaction) {
  const id = interaction.customId || '';
  const [left, editorId, targetUserId, dateStr] = id.split(':');
  const categoryKey = left.replace('edit_stats_category_', '');

  if (!editorId || interaction.user.id !== editorId) {
    await interaction.reply({
      content: '❌ This edit panel is not for you.',
      flags: 1 << 6,
    }).catch(() => {});
    return;
  }

  if (!targetUserId || !dateStr || !DATE_RE.test(dateStr) || Number.isNaN(Date.parse(dateStr))) {
    await interaction.reply({
      content: '❌ Invalid date format. Use YYYY-MM-DD.',
      flags: 1 << 6,
    }).catch(() => {});
    return;
  }

  if (categoryKey === 'inner_work') {
    await interaction.reply({
      content: 'ℹ️ Inner Work is currently disabled.',
      flags: 1 << 6,
    }).catch(() => {});
    return;
  }

  let modal = null;
  let title = '';

  if (categoryKey === 'core_social') {
    modal = createCoreSocialModal();
    title = `🎯 Edit Core Social • ${dateStr}`;
  } else if (categoryKey === 'dating') {
    modal = createDatingModal();
    title = `❤️ Edit Dating • ${dateStr}`;
  } else if (categoryKey === 'learning') {
    modal = createLearningModal();
    title = `📚 Edit Learning • ${dateStr}`;
  } else if (categoryKey === 'daily_state') {
    modal = createDailyStateModal();
    title = `🎭 Edit Daily State • ${dateStr}`;
  }

  if (!modal) {
    await interaction.reply({
      content: `❌ Unknown edit category: ${categoryKey}`,
      flags: 1 << 6,
    }).catch(() => {});
    return;
  }

  modal.setTitle(title.slice(0, 45));
  modal.setCustomId(`stats_edit:${categoryKey}:${targetUserId}:${dateStr}`);

  await interaction.showModal(modal);

  logger.info('Edit-stats modal shown (date-specific)', {
    editorId: interaction.user.id,
    targetUserId,
    categoryKey,
    dateStr,
  });
}

/**
 * ✅ Handle Past Stats Category Buttons
 */
async function handlePastStatsCategoryButton(interaction) {
  const id = interaction.customId;
  const [left, dateStr] = id.split(':');
  const categoryKey = left.replace('past_stats_category_', '');

  if (!dateStr || !DATE_RE.test(dateStr)) {
    await interaction.reply({
      content: '❌ Invalid date format. Use YYYY-MM-DD (e.g., 2025-10-01)',
      flags: 1 << 6,
    });
    return;
  }

  const { modal, title } = buildPastStatsModal(categoryKey, dateStr);

  if (!modal) {
    await interaction.reply({
      content: `❌ Unknown past-stats category: ${categoryKey}`,
      flags: 1 << 6,
    });
    return;
  }

  modal.setTitle(title);
  modal.setCustomId(`stats_past:${categoryKey}:${dateStr}`);

  await interaction.showModal(modal);

  logger.info('Past stats modal shown', {
    userId: interaction.user.id,
    categoryKey,
    dateStr
  });
}

function buildPastStatsModal(categoryKey, dateStr) {
  if (categoryKey === 'core_social') {
    return { modal: createCoreSocialModal(), title: `🎯 Core Social Stats • ${dateStr}` };
  }
  if (categoryKey === 'inner_work') {
    return { modal: createInnerWorkModal(), title: `🧘 Inner Work • ${dateStr}` };
  }
  if (categoryKey === 'dating') {
    return { modal: createDatingModal(), title: `❤️ Dating & Results • ${dateStr}` };
  }
  if (categoryKey === 'learning') {
    return { modal: createLearningModal(), title: `📚 Learning • ${dateStr}` };
  }
  if (categoryKey === 'daily_state') {
    return { modal: createDailyStateModal(), title: `🎭 Daily State • ${dateStr}` };
  }
  return { modal: null, title: '' };
}

/**
 * ✅ Admin Stats Panel Buttons
 */
async function handleAdminStatsPanelButton(interaction, services) {
  const parts = (interaction.customId || '').split(':');
  const action = parts[1];
  const targetUserId = parts[2];
  const dateStr = parts[3];

  const isAdmin =
    services?.permissionGuard?.isAdmin?.(interaction.user.id) ||
    interaction.member?.permissions?.has?.(PermissionsBitField.Flags.Administrator);

  if (!isAdmin) {
    await interaction.reply({ content: '❌ Admin only.', flags: 1 << 6 }).catch(() => {});
    return;
  }

  if (!targetUserId || !dateStr || !DATE_RE.test(dateStr)) {
    await interaction.reply({ content: '❌ Invalid admin stats action payload.', flags: 1 << 6 }).catch(() => {});
    return;
  }

  if (action === 'back') {
    await interaction.reply({ content: '↩️ Back (panel refresh coming next).', flags: 1 << 6 }).catch(() => {});
    return;
  }

  if (action !== 'edit' && action !== 'delete') {
    await interaction.reply({ content: '❌ Unknown admin stats action.', flags: 1 << 6 }).catch(() => {});
    return;
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(`admin_stats_category:${action}:${targetUserId}:${dateStr}`)
    .setPlaceholder('Select a category…')
    .addOptions(
      { label: 'Core Social Stats', value: 'core_social', emoji: '🎯' },
      { label: 'Inner Work', value: 'inner_work', emoji: '🧘' },
      { label: 'Dating & Results', value: 'dating', emoji: '❤️' },
      { label: 'Learning', value: 'learning', emoji: '📚' },
      { label: 'Daily State', value: 'daily_state', emoji: '🎭' }
    );

  const row = new DiscordActionRowBuilder().addComponents(select);

  const backRow = new DiscordActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin_stats:back:${targetUserId}:${dateStr}`)
      .setLabel('Back')
      .setStyle(ButtonStyle.Secondary)
  );

  try {
    await interaction.update({
      content:
        action === 'edit'
          ? `✏️ **Edit Stats** — Select category\nUser: <@${targetUserId}> • Date: **${dateStr}**`
          : `🗑️ **Delete Stats** — Select category\nUser: <@${targetUserId}> • Date: **${dateStr}**`,
      embeds: [],
      components: [row, backRow]
    });
  } catch (e) {
    await interaction.reply({
      content:
        action === 'edit'
          ? `✏️ **Edit Stats** — Select category\nUser: <@${targetUserId}> • Date: **${dateStr}**`
          : `🗑️ **Delete Stats** — Select category\nUser: <@${targetUserId}> • Date: **${dateStr}**`,
      components: [row, backRow],
      flags: 1 << 6
    }).catch(() => {});
  }
}

/**
 * Handle refresh leaderboard button
 * ✅ refreshes the SAME UI (grid 5-wide) used by /leaderboard
 */
async function handleRefreshLeaderboard(interaction, services) {
  await interaction.deferUpdate().catch(() => {});

  try {
    if (!services?.leaderboardService) {
      await interaction.followUp({ content: '⚠️ Leaderboard service not available.', flags: 1 << 6 }).catch(() => {});
      return;
    }

    // ✅ Accept BOTH styles:
    // - "refresh-leaderboard" (legacy)
    // - "refresh-leaderboard:<range>:<page>:<xp|stat>:<limit>" (old new)
    // - "refresh-leaderboard:range=all:stat=xp:page=1:limit=25" (current)
    let range = 'all';
    let page = 1;
    let statKey = null;
    let limit = 25;

    const parts = String(interaction.customId || '').split(':');

    // current style: refresh-leaderboard:range=all:stat=xp:page=1:limit=25
    if (parts[0] === 'refresh-leaderboard' && parts.some(p => p.includes('='))) {
      const kv = {};
      for (const p of parts.slice(1)) {
        const [k, ...rest] = p.split('=');
        if (!k) continue;
        kv[k.trim()] = rest.join('=').trim();
      }

      range = (kv.range || 'all');
      page = Math.max(1, Number(kv.page || 1));
      limit = Math.max(5, Math.min(25, Number(kv.limit || 25)));

      const statRaw = kv.stat || 'xp';
      statKey = (statRaw && statRaw !== 'xp') ? decodeURIComponent(statRaw) : null;
    }
    // old style: refresh-leaderboard:<range>:<page>:<xp|stat>:<limit>
    else if (parts.length >= 5 && parts[0] === 'refresh-leaderboard') {
      range = parts[1] || 'all';
      page = Math.max(1, Number(parts[2] || 1));
      const statRaw = parts[3] || 'xp';
      limit = Math.max(5, Math.min(25, Number(parts[4] || 25)));
      statKey = (statRaw && statRaw !== 'xp') ? decodeURIComponent(statRaw) : null;
    }
    // legacy: infer from embed
    else {
      const currentEmbed = interaction.message?.embeds?.[0];
      const desc = currentEmbed?.description || '';

      if (/Range:\s*\*\*This Week\*\*/i.test(desc)) range = 'week';
      else if (/Range:\s*\*\*This Month\*\*/i.test(desc)) range = 'month';

      const pageMatch = desc.match(/Page:\s*\*\*(\d+)\*\*/i);
      if (pageMatch) page = Math.max(1, Number(pageMatch[1]) || 1);

      const statMatch = desc.match(/Stat:\s*\*\*(.+?)\*\*/i);
      if (statMatch) statKey = String(statMatch[1] || '').trim() || null;

      limit = 25;
    }

    const offset = (page - 1) * limit;

    const result = statKey
      ? await services.leaderboardService.getStatLeaderboard(statKey, { range, limit, offset })
      : await services.leaderboardService.getXPLeaderboard({ range, limit, offset });

    if (!result?.success || !result?.leaderboard?.length) {
      await interaction.followUp({ content: 'No data found for this range.', flags: 1 << 6 }).catch(() => {});
      return;
    }

    const payload = await buildLeaderboardPayload(interaction, result, { range, statKey, page, limit });

    // ✅ Update the message the button belongs to
    if (interaction.message?.edit) {
      await interaction.message.edit(payload);
    } else {
      await interaction.editReply(payload).catch(() => {});
    }

  } catch (error) {
    logger.error('Failed to refresh leaderboard', { error: error?.message });
    await interaction.followUp({ content: '❌ Failed to refresh leaderboard. Check logs.', flags: 1 << 6 }).catch(() => {});
  }
}

/**
 * Refresh Scorecard button
 */
async function handleRefreshScorecard(interaction, services) {
  await interaction.deferUpdate().catch(() => {});

  const parts = String(interaction.customId || '').split(':');
  const viewerId = parts[1];
  const userId1 = parts[2];
  const userId2 = parts[3] || null;

  if (!viewerId || !userId1) return;

  // 🔒 lock
  if (interaction.user.id !== viewerId) {
    await interaction.followUp({
      content: '🔒 Este scorecard no es tuyo.',
      flags: 1 << 6
    }).catch(() => {});
    return;
  }

  // ✅ el path correcto (porque tu archivo es scorecard.js)
  let scorecardCmd = null;
  try {
    scorecardCmd = require('../../commands/stats/scorecard');
  } catch (e) {
    logger.error('Failed to load scorecard module', { error: e?.message });
    await interaction.followUp({
      content: '❌ No pude cargar el módulo de scorecard (ruta incorrecta).',
      flags: 1 << 6
    }).catch(() => {});
    return;
  }

  // Si quieres soportar comparison después, lo conectamos aquí.
  // Por ahora refrescamos solo el SOLO scorecard del userId1:
  if (typeof scorecardCmd?.renderSoloForButton === 'function') {
    await scorecardCmd.renderSoloForButton(interaction, services, userId1);
    return;
  }

  // fallback si por alguna razón no existe ese helper
  if (typeof scorecardCmd?.handleSolo === 'function') {
    const today = getLocalDayString();
    await scorecardCmd.handleSolo(interaction, services, userId1, today);
    return;
  }

  await interaction.followUp({
    content: '❌ El módulo scorecard no expone renderSoloForButton/handleSolo.',
    flags: 1 << 6
  }).catch(() => {});
}

/**
 * Handle view scorecard button
 */
async function handleViewScorecard(interaction, services) {
  const userId = interaction.user.id;

  try {
    // para este botón queremos respuesta ephem al usuario
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 1 << 6 }).catch(() => {});
    }

    let scorecardCmd = null;
    try {
      scorecardCmd = require('../../commands/stats/scorecard');
    } catch (e) {
      logger.error('Failed to load scorecard module', { error: e?.message });
      await interaction.editReply({
        content: '❌ No pude cargar el módulo de scorecard (ruta incorrecta).'
      }).catch(() => {});
      return;
    }

    const today = getLocalDayString();

    // ✅ esto construye el embed y hace editReply => perfecto para ephemeral
    if (typeof scorecardCmd?.handleSolo === 'function') {
      await scorecardCmd.handleSolo(interaction, services, userId, today);
      return;
    }

    // fallback si solo existe el helper de botón
    if (typeof scorecardCmd?.renderScorecardForButton === 'function') {
      await scorecardCmd.renderScorecardForButton(interaction, services, userId);
      return;
    }

    if (typeof scorecardCmd?.renderSoloForButton === 'function') {
      await scorecardCmd.renderSoloForButton(interaction, services, userId);
      return;
    }

    await interaction.editReply({
      content: '❌ El módulo scorecard no expone handleSolo/renderSoloForButton.'
    }).catch(() => {});
  } catch (error) {
    logger.error('Failed to show scorecard from button', { error: error?.message });
    await interaction.editReply({
      content: 'Could not load your scorecard. Submit some stats first!'
    }).catch(() => {});
  }
}

/**
 * Handle send reminders button (coaching dashboard)
 */
async function handleSendReminders(interaction, services) {
  await interaction.deferUpdate();

  try {
    const today = getLocalDayString();
    const inactiveUsers = await getInactiveUsersForReminders(services, today);

    if (inactiveUsers.length === 0) {
      await interaction.followUp({
        content: 'No inactive users to send reminders to.',
        flags: 1 << 6
      });
      return;
    }

    const AutoReminderService = require('../../services/notifications/AutoReminderService');
    const reminderService = new AutoReminderService(interaction.client);

    const results = await reminderService.sendBatchReminders(inactiveUsers);

    await interaction.followUp({
      content: [
        `**Reminders Sent**`,
        `✅ Sent: ${results.sent}`,
        `❌ Failed: ${results.failed}`,
        results.errors.length > 0 ? `\nErrors: ${results.errors.map(e => e.reason).join(', ')}` : ''
      ].join('\n'),
      flags: 1 << 6
    });

  } catch (error) {
    logger.error('Failed to send reminders', { error: error.message });
    await interaction.followUp({
      content: 'Failed to send reminders. Check logs.',
      flags: 1 << 6
    });
  }
}

/**
 * Handle export list button (coaching dashboard)
 */
async function handleExportList(interaction, services) {
  await interaction.deferUpdate();

  try {
    const today = getLocalDayString();
    const inactiveUsers = await getInactiveUsersForReminders(services, today);

    if (inactiveUsers.length === 0) {
      await interaction.followUp({
        content: 'No inactive users to export.',
        flags: 1 << 6
      });
      return;
    }

    const csv = [
      'User ID,Username,Days Inactive,Last Submission',
      ...inactiveUsers.map(u =>
        `${u.userId},${u.username || 'Unknown'},${u.daysInactive},${u.lastSubmission || 'Never'}`
      )
    ].join('\n');

    const { AttachmentBuilder } = require('discord.js');
    const buffer = Buffer.from(csv, 'utf-8');
    const attachment = new AttachmentBuilder(buffer, { name: `inactive-users-${today}.csv` });

    await interaction.followUp({
      content: 'Inactive users list exported:',
      files: [attachment],
      flags: 1 << 6
    });

  } catch (error) {
    logger.error('Failed to export list', { error: error.message });
    await interaction.followUp({
      content: 'Failed to export list. Check logs.',
      flags: 1 << 6
    });
  }
}

/**
 * Handle Barbie opener suggestion button
 */
async function handleBarbieOpener(interaction, services) {
  const contactId = parseInt(interaction.customId.split(':')[1]);

  await interaction.deferReply({ flags: 1 << 6 });

  try {
    const BarbieListManager = require('../../services/barbie/BarbieListManager');
    const manager = new BarbieListManager();

    const contact = await manager.getContact(contactId, interaction.user.id);

    if (!contact) {
      await interaction.editReply('Contact not found.');
      return;
    }

    const suggestions = await manager.generateOpener(contact);

    await interaction.editReply({
      content: [
        `**Opener Suggestions for ${contact.contact_name}:**`,
        '',
        ...suggestions.suggestions.map((s, i) => `${i + 1}. ${s}`),
        '',
        `*${suggestions.note}*`
      ].join('\n')
    });

  } catch (error) {
    logger.error('Failed to generate opener', { error: error.message });
    await interaction.editReply('Failed to generate suggestions.');
  }
}

/**
 * Handle Barbie delete button
 */
async function handleBarbieDelete(interaction, services) {
  const contactId = parseInt(interaction.customId.split(':')[1]);

  await interaction.deferReply({ flags: 1 << 6 });

  try {
    const BarbieListManager = require('../../services/barbie/BarbieListManager');
    const manager = new BarbieListManager();

    const deleted = await manager.deleteContact(contactId, interaction.user.id);

    if (deleted) {
      await interaction.editReply('Contact deleted.');
    } else {
      await interaction.editReply('Contact not found or already deleted.');
    }

  } catch (error) {
    logger.error('Failed to delete contact', { error: error.message });
    await interaction.editReply('Failed to delete contact.');
  }
}

/**
 * ✅ Build Leaderboard payload (same look as /leaderboard)
 * Uses a 5-wide grid inside the embed description (no fields).
 *
 * ✅ FIXES:
 * - embed is created BEFORE setDescription (fixes "Cannot access 'embed' before initialization")
 * - accepts limit (fixes undefined limit)
 * - refresh button includes state in customId
 */
async function buildLeaderboardPayload(interaction, result, { range, statKey, page, limit }) {
  const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

  const COLOR_LUMINARCHS = 0x2b6cff;
  const COLOR_NOCTIVORES = 0x7b2cff;
  const COLOR_TIE = 0xff1e27;

  const MAX_SHOWN = 25;

  const prettyRange = (r) => (r === 'week' ? 'This Week' : r === 'month' ? 'This Month' : 'All-Time');

  const getFactionMeta = (faction) => {
    if (faction === 'Luminarchs') return { factionEmoji: '🦸', factionName: 'Luminarchs' };
    if (faction === 'Noctivores') return { factionEmoji: '🥷', factionName: 'Noctivores' };
    return { factionEmoji: '❔', factionName: 'No Faction' };
  };

  const sumFactionTotals = (entries, statKeyInner) => {
    const totals = {
      Luminarchs: { count: 0, total: 0 },
      Noctivores: { count: 0, total: 0 },
      None: { count: 0, total: 0 },
    };

    for (const e of entries) {
      const val = statKeyInner ? Number(e.statTotal || 0) : Number(e.xp || 0);
      if (e.faction === 'Luminarchs') {
        totals.Luminarchs.count += 1; totals.Luminarchs.total += val;
      } else if (e.faction === 'Noctivores') {
        totals.Noctivores.count += 1; totals.Noctivores.total += val;
      } else {
        totals.None.count += 1; totals.None.total += val;
      }
    }
    return totals;
  };

  const pickFactionColor = (totals) => {
    const lum = totals?.Luminarchs?.total || 0;
    const noc = totals?.Noctivores?.total || 0;
    if (lum === 0 && noc === 0) return COLOR_TIE;
    if (lum === noc) return COLOR_TIE;
    return lum > noc ? COLOR_LUMINARCHS : COLOR_NOCTIVORES;
  };

  const formatFactionSummaryFromShown = (totals) => {
    if (!totals) return '';
    const lum = totals.Luminarchs;
    const noc = totals.Noctivores;

    const parts = [];
    if (lum.count > 0) parts.push(`🦸 **Luminarchs**: ${lum.count} • ${Number(lum.total).toLocaleString()}`);
    if (noc.count > 0) parts.push(`🥷 **Noctivores**: ${noc.count} • ${Number(noc.total).toLocaleString()}`);

    if (parts.length === 0) return '';
    const leader =
      (lum.total > noc.total) ? '🦸 **Luminarchs**'
      : (noc.total > lum.total) ? '🥷 **Noctivores**'
      : '**Tie**';

    return parts.join('\n') + `\n\n👑 Leader: ${leader}`;
  };

  const getRankEmoji = (rank) => {
    const n = Number(rank);
    if (n === 1) return '🥇';
    if (n === 2) return '🥈';
    if (n === 3) return '🥉';
    if (!Number.isFinite(n)) return '#?';
    return `#${n}`;
  };

  const shortName6 = (displayName) => {
    const raw = String(displayName ?? '').trim();
    const first = raw.split(/\s+/)[0] || raw;
    return first.slice(0, 6);
  };

  function padRight(str, width) {
    const s = String(str ?? '');
    if (s.length >= width) return s.slice(0, width);
    return s + ' '.repeat(width - s.length);
  }

  function makeBarPlain(value, max, size = 8) {
    const v = Number(value || 0);
    const m = Math.max(Number(max || 0), 1);
    const ratio = Math.max(0, Math.min(1, v / m));
    const filled = Math.round(ratio * size);
    const empty = size - filled;
    return `${'▰'.repeat(filled)}${'▱'.repeat(empty)}`;
  }

  function fmtK(n) {
    const num = Number(n || 0);
    if (num >= 10000) return `${Math.round(num / 1000)}k`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`.replace('.0k', 'k');
    return String(num);
  }

  function buildGrid5(entries, statKeyInner) {
    const NAME_W = 10;
    const MID_W  = 13;
    const BAR_W  = 8;
    const PER_ROW = 5;

    const COL_SEP = ' · ';
    const CELL_GAP = '  ';

    const maxValueInner = statKeyInner
      ? Math.max(...entries.map(e => Number(e.statTotal || 0)), 1)
      : Math.max(...entries.map(e => Number(e.xp || 0)), 1);

    const emptyCell = () => ({
      nameLine: padRight('—', NAME_W),
      midLine:  padRight(' ', MID_W),
      barLine:  padRight(' ', BAR_W),
    });

    const cells = entries.map((e) => {
      const rankEmoji = getRankEmoji(e.rank ?? '?');
      const { factionEmoji, factionName } = getFactionMeta(e.faction);

      const nameLine = padRight(`${rankEmoji}${shortName6(e.displayName)}${factionEmoji}`, NAME_W);

      if (statKeyInner) {
        const v = Number(e.statTotal || 0);
        const mid = padRight(`${String(factionName).slice(0, 3)} ${fmtK(v)}`, MID_W);
        const bar = padRight(makeBarPlain(v, maxValueInner, BAR_W), BAR_W);
        return { nameLine, midLine: mid, barLine: bar };
      } else {
        const xp = Number(e.xp || 0);
        const lvl = e.level ?? '?';
        const mid = padRight(`${String(factionName).slice(0, 3)} Lv${lvl} ${fmtK(xp)}`, MID_W);
        const bar = padRight(makeBarPlain(xp, maxValueInner, BAR_W), BAR_W);
        return { nameLine, midLine: mid, barLine: bar };
      }
    });

    const rows = [];
    for (let i = 0; i < cells.length; i += PER_ROW) {
      const slice = cells.slice(i, i + PER_ROW);
      while (slice.length < PER_ROW) slice.push(emptyCell());

      const joiner = `${CELL_GAP}${COL_SEP}${CELL_GAP}`;

      const line1 = slice.map(c => `\`${c.nameLine}\``).join(joiner);
      const line2 = slice.map(c => `\`${c.midLine}\``).join(joiner);
      const line3 = slice.map(c => `\`${c.barLine}\``).join(joiner);

      rows.push(line1, line2, line3);
    }

    return rows.join('\n');
  }

  const shown = (result.leaderboard || []).slice(0, MAX_SHOWN);

  const guild = interaction.guild;
  const entries = [];
  for (const entry of shown) {
    const userId = entry.userId || entry.user_id;
    let displayName = entry.username || 'Unknown';

    if (guild && userId) {
      try {
        const member = await guild.members.fetch(userId);
        displayName =
          member?.user?.username ||
          member?.user?.globalName ||
          member?.displayName ||
          displayName;
      } catch {}
    }

    entries.push({ ...entry, userId, displayName });
  }

  if (!entries.length) {
    return { content: 'No data found for this range.', components: [] };
  }

  const factionTotals = sumFactionTotals(entries, statKey);
  const embedColor = pickFactionColor(factionTotals);
  const factionSummary = formatFactionSummaryFromShown(factionTotals);

  const title = statKey
    ? `${result.stat || statKey} Leaderboard`
    : 'XP Leaderboard';

  const descriptionParts = [
    `Range: **${prettyRange(result.range || range)}** • Page: **${page}**`,
    statKey ? `Stat: **${result.stat || statKey}**` : null,
    factionSummary ? `\n⚔️ **Faction War (Top Shown)**\n${factionSummary}` : null,
    `\nℹ️ Showing top **${entries.length}**`,
  ].filter(Boolean);

  const gridBlock = buildGrid5(entries, statKey);

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`🏆 ${title}`)
    .setDescription(descriptionParts.join('\n') + '\n\n' + gridBlock)
    .setTimestamp();

  try {
    const cfg = require('../../config/settings');
    if (cfg?.branding?.logoUrl) embed.setThumbnail(cfg.branding.logoUrl);
    if (cfg?.branding?.name) embed.setFooter({ text: cfg.branding.name });
  } catch {}

  const safeStat = statKey ? encodeURIComponent(statKey) : 'xp';
  const safeLimit = Math.max(5, Math.min(25, Number(limit || 25)));

  const refreshButton = new ButtonBuilder()
    .setCustomId(`refresh-leaderboard:${range}:${page}:${safeStat}:${safeLimit}`)
    .setLabel('🔄 Refresh')
    .setStyle(ButtonStyle.Primary);

  const scorecardButton = new ButtonBuilder()
    .setCustomId('view-my-scorecard')
    .setLabel('📊 My Scorecard')
    .setStyle(ButtonStyle.Secondary);

  const buttonRow = new ActionRowBuilder().addComponents(refreshButton, scorecardButton);

  return { embeds: [embed], components: [buttonRow] };
}

/**
 * ✅ Duel Status button
 */
async function handleDuelStatus(interaction, services) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 1 << 6 });
    }
  } catch (e) {
    const msg = e?.message || '';
    const code = e?.code;
    if (
      code === 10062 ||
      code === 40060 ||
      /Unknown interaction/i.test(msg) ||
      /already been acknowledged/i.test(msg)
    ) return;
    throw e;
  }

  try {
    const parts = (interaction.customId || '').split(':');
    const duelIdStr = parts[1];

    if (!duelIdStr || Number.isNaN(Number(duelIdStr))) {
      await interaction.editReply({ content: '❌ Invalid Duel ID in button payload.' });
      return;
    }

    const duelId = Number(duelIdStr);

    if (!services?.duelManager) {
      await interaction.editReply({ content: '❌ Duel system unavailable (duelManager missing).' });
      return;
    }

    let duel = null;

    if (typeof services.duelManager.getDuelStatus === 'function') {
      duel = await services.duelManager.getDuelStatus(duelId, interaction.guildId);
    } else if (typeof services.duelManager.getDuelById === 'function') {
      duel = await services.duelManager.getDuelById(duelId);
    } else if (typeof services.duelManager.getDuel === 'function') {
      duel = await services.duelManager.getDuel(duelId);
    }

    if (!duel) {
      await interaction.editReply({ content: `❌ Duel #${duelId} not found (or status method missing).` });
      return;
    }

    const challengerId = duel.challenger_id || duel.challengerId || duel.challenger;
    const opponentId = duel.opponent_id || duel.opponentId || duel.opponent;
    const status = duel.status || duel.state || duel.phase || 'unknown';
    const createdAt = duel.created_at || duel.createdAt;
    const endsAt = duel.ends_at || duel.endsAt;

    const lines = [
      `⚔️ **Duel Status**`,
      `🆔 **ID:** ${duelId}`,
      challengerId ? `🟥 **Challenger:** <@${challengerId}>` : null,
      opponentId ? `🟦 **Opponent:** <@${opponentId}>` : null,
      `📌 **State:** **${status}**`,
      createdAt ? `🕒 **Created:** ${new Date(createdAt).toLocaleString()}` : null,
      endsAt ? `⏳ **Ends:** ${new Date(endsAt).toLocaleString()}` : null,
    ].filter(Boolean);

    await interaction.editReply({ content: lines.join('\n') });
  } catch (error) {
    logger.error('Failed to show duel status', { error: error?.message });
    await interaction.editReply({ content: '❌ Failed to load duel status. Check logs.' }).catch(() => {});
  }
}

/**
 * ✅ Stats Help button
 * customId: stats_help
 * Shows a quick help message for /submit-stats
 */
async function handleStatsHelp(interaction, services) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 1 << 6 });
    }
  } catch {}

  const config = require('../../config/settings');

  const lines = [
    '🚀 **QUICK START — Submit Your Stats**',
    '',
    '**Use `/submit-stats` to get started!**',
    '',
    '🎯 **Core Social Stats**',
    '• Approaches',
    '• Numbers',
    '• Contact Response',
    '• Hellos',
    '• CTJ',
    '',
    '💕 **Dating & Results**',
    '• Dates Booked / Had',
    '• Instant Date',
    '• Got Laid',
    '• Same Night Pull',
    '',
    '🧘 **Inner Work**',
    '• Welcome Courage',
    '• SBMM',
    '• Grounding',
    '• Releasing',
    '',
    '📚 **Learning**',
    '• Undoing.U Modules',
    '• Group Calls',
    '',
    '🎭 **Daily State**',
    '• Overall State (1–10)',
    '• Semen Retention Streak',
    '',
    '_Interactive forms calculate XP automatically and validate your input!_',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '📊 **ALL COMMANDS OVERVIEW**',
    '',
    '**📝 Stat Submission**',
    '• `/submit-stats` — Main stat submission (use this)',
    '• `/submit-advanced-stats` — Advanced direct form',
    '',
    '**📈 View Progress**',
    '• `/stats` — Your personal statistics',
    '• `/leaderboard` — Server rankings',
    '• `/stats-menu` — All options menu',
    '',
    '**❓ Help & Support**',
    '• `/help` — Full help guide',
    '• Help button available in stat menus',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '⭐ **XP & LEVELING SYSTEM**',
    '',
    '**How XP Works**',
    '• Each stat gives different XP amounts',
    '• Semen Retention: **100 XP + 5% daily compounding**',
    '• Attended Calls: **250 XP** (Mage 0.8 • Warrior 0.2)',
    '• Level-ups trigger celebratory announcements',
    '',
    '**Class Progression**',
    'Awkward Initiate → Social Squire → Bold Explorer →',
    'Magnetic Challenger → Audacious Knight →',
    'Charisma Vanguard → Seduction Sage →',
    'Embodiment Warlord → Flirtation Overlord →',
    '💎 **Galactic Sexy Bastard God-King** 💎',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '🎭 **ARCHETYPE SYSTEM**',
    '',
    '**Three Overclasses**',
    '⚔️ Warrior — Action focused (approaches, dates, social)',
    '🔮 Mage — Inner work (meditation, journaling, learning)',
    '🛡️ Templar — Balanced approach',
    '',
    '**Archetype Changes**',
    '• Automatically detected when dominance shifts',
    '• Announced beautifully in general chat',
    '• Includes balance guidance',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '🎊 **SPECIAL FEATURES**',
    '',
    '**Celebrations**',
    '• 🎉 Level-ups get big announcements',
    '• 🎭 Archetype changes get detailed messages',
    '',
    '**Daily Limits**',
    '• Multiple submissions per day allowed',
    '• Stats are additive (cumulative)',
    '• Designed for real-time tracking',
    '',
    `_${config?.branding?.name || 'Artemis'} — Use /submit-stats to begin_`
  ];

  const content = lines.join('\n');
  const safe = content.length > 1900 ? content.slice(0, 1900) + '\n…(truncated)' : content;

  await interaction.editReply({
    content: safe,
    flags: 1 << 6
  }).catch(() => {});
}

module.exports = { handleButton };
