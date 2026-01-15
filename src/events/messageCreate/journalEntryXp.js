const { createLogger } = require('../../utils/logger');
const logger = createLogger('JournalEntryXP');

// ✅ Accept multiple channels (and legacy env names)
const JOURNAL_ENTRIES_CHANNEL_ID =
  process.env.JOURNAL_ENTRIES_CHANNEL_ID ||
  process.env.JOURNAL_CHANNEL_ID || // legacy
  null;

const CONFIDENCE_TENSION_JOURNAL_CHANNEL_ID =
  process.env.CONFIDENCE_TENSION_JOURNAL_CHANNEL_ID || null;

// Optional: comma-separated list
const EXTRA_JOURNAL_CHANNEL_IDS = (process.env.JOURNAL_XP_CHANNEL_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const ALLOWED_CHANNEL_IDS = [
  JOURNAL_ENTRIES_CHANNEL_ID,
  CONFIDENCE_TENSION_JOURNAL_CHANNEL_ID,
  ...EXTRA_JOURNAL_CHANNEL_IDS,
].filter(Boolean);

const JOURNAL_ENTRY_XP = Number(process.env.JOURNAL_ENTRY_XP || 100);
const COOLDOWN_HOURS = Number(process.env.JOURNAL_XP_COOLDOWN_HOURS || 24);

// No DB cooldown: memory only (resets on bot restart)
const lastAwardByUser = new Map(); // userId -> timestamp(ms)

function hasImageAttachment(message) {
  if (!message.attachments || message.attachments.size === 0) return false;

  for (const att of message.attachments.values()) {
    const ct = (att.contentType || '').toLowerCase();
    const name = (att.name || '').toLowerCase();

    const looksLikeImage =
      ct.startsWith('image/') ||
      name.endsWith('.png') ||
      name.endsWith('.jpg') ||
      name.endsWith('.jpeg') ||
      name.endsWith('.webp') ||
      name.endsWith('.gif');

    if (looksLikeImage) return true;
  }
  return false;
}

function canAward(userId) {
  if (!COOLDOWN_HOURS || COOLDOWN_HOURS <= 0) return true;
  const last = lastAwardByUser.get(userId);
  if (!last) return true;
  const diffMs = Date.now() - last;
  return diffMs >= COOLDOWN_HOURS * 60 * 60 * 1000;
}

module.exports = async function journalEntryXpHandler(message, services) {
  try {
    if (!ALLOWED_CHANNEL_IDS.length) return;
    if (!message.guild) return;
    if (message.author?.bot) return;

    // ✅ Only in allowed channels
    if (!ALLOWED_CHANNEL_IDS.includes(message.channelId)) return;

    // ✅ Must include image
    if (!hasImageAttachment(message)) return;

    const userId = message.author.id;

    // Cooldown anti-spam
    if (!canAward(userId)) {
      await message.react('⏳').catch(() => {});
      return;
    }

    // ✅ Use the service you already use everywhere else
    if (!services?.userService?.getOrCreateUser || !services?.userService?.updateUserStats) {
      logger.warn('userService.getOrCreateUser/updateUserStats not available');
      return;
    }

    // Ensure user exists
    await services.userService.getOrCreateUser(userId, message.author.username);

    // Award XP (no affinities)
    await services.userService.updateUserStats(
      userId,
      JOURNAL_ENTRY_XP,
      {},
      'journal_entry'
    );

    lastAwardByUser.set(userId, Date.now());

    // UX
    await message.react('✅').catch(() => {});

    logger.info('Journal XP awarded', {
      userId,
      channelId: message.channelId,
      xp: JOURNAL_ENTRY_XP,
    });
  } catch (err) {
    logger.error('Journal XP handler failed', { error: err?.message });
  }
};
