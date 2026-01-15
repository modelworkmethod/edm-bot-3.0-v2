const { createLogger } = require('../../utils/logger');
const logger = createLogger('JournalPhotoXP');

// ✅ Accept multiple channels
const JOURNAL_ENTRIES_CHANNEL_ID = process.env.JOURNAL_ENTRIES_CHANNEL_ID;
const CONFIDENCE_TENSION_JOURNAL_CHANNEL_ID = process.env.CONFIDENCE_TENSION_JOURNAL_CHANNEL_ID;

// optional: support comma-separated list too
const EXTRA_JOURNAL_CHANNEL_IDS = (process.env.JOURNAL_PHOTO_XP_CHANNEL_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const ALLOWED_CHANNEL_IDS = [
  JOURNAL_ENTRIES_CHANNEL_ID,
  CONFIDENCE_TENSION_JOURNAL_CHANNEL_ID,
  ...EXTRA_JOURNAL_CHANNEL_IDS
].filter(Boolean);

const JOURNAL_PHOTO_XP = Number(process.env.JOURNAL_PHOTO_XP || 100);

function hasImageAttachment(message) {
  if (!message.attachments || message.attachments.size === 0) return false;

  for (const att of message.attachments.values()) {
    const ct = (att.contentType || '').toLowerCase();
    const name = (att.name || '').toLowerCase();

    if (
      ct.startsWith('image/') ||
      name.endsWith('.png') ||
      name.endsWith('.jpg') ||
      name.endsWith('.jpeg') ||
      name.endsWith('.webp') ||
      name.endsWith('.gif')
    ) return true;
  }
  return false;
}

module.exports = async function journalPhotoXp(message, services) {
  try {
    if (!ALLOWED_CHANNEL_IDS.length) return;
    if (!message.guild) return;
    if (message.author?.bot) return;

    // ✅ only these channels
    if (!ALLOWED_CHANNEL_IDS.includes(message.channelId)) return;

    // ✅ must include an image
    if (!hasImageAttachment(message)) return;

    if (!services?.userService) {
      logger.warn('userService not available in services');
      return;
    }

    // ✅ Anti-duplicate: 1 award per message
    if (services?.processedMsgsRepo?.isProcessed && services?.processedMsgsRepo?.markProcessed) {
      const already = await services.processedMsgsRepo.isProcessed(message.id);
      if (already) return;

      await services.processedMsgsRepo.markProcessed({
        messageId: message.id,
        userId: message.author.id,
        type: 'journal_photo',
      });
    }

    // ensure user exists
    await services.userService.getOrCreateUser(message.author.id, message.author.username);

    // award XP
    await services.userService.updateUserStats(
      message.author.id,
      JOURNAL_PHOTO_XP,
      {},
      'journal_photo'
    );

    // UX
    await message.react('✅').catch(() => {});
  } catch (err) {
    logger.error('Journal photo XP failed', { error: err?.message });
  }
};
