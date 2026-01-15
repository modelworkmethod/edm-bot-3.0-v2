/**
 * Wins Monitor
 * Detects wins posted in #share-your-wins and replies with a nice message + emoji
 *
 * Option A:
 * - Only reacts/acknowledges wins posted in WINS_CHANNEL_ID
 * - Detect win type by keyword
 * - Replies with a pretty message (and reacts)
 */

const { createLogger } = require('../../utils/logger');

const logger = createLogger('WinsMonitor');

const DEFAULT_WINS_CHANNEL_ID = '1426640532318454043';

// keyword -> win type
function detectWinType(contentRaw) {
  const content = (contentRaw || '').toLowerCase();

  if (content.includes('approaches')) {
    return { key: 'approaches', emoji: '🔥', label: 'Approaches' };
  }

  if (content.includes('phone')) {
    return { key: 'phone', emoji: '📱', label: 'Numbers' };
  }

  if (content.includes('date')) {
    return { key: 'date', emoji: '❤️', label: 'Dates' };
  }

  if (content.includes('meditation')) {
    return { key: 'meditation', emoji: '🧘', label: 'Inner Work' };
  }

  if (content.includes('courage')) {
    return { key: 'courage', emoji: '🦁', label: 'Confidence' };
  }

  return { key: 'general', emoji: '🏆', label: 'General win' };
}

function buildWinReply({ authorId, win, original }) {
  const mention = `<@${authorId}>`;
  const snippet =
    (original || '').trim().length > 0
      ? `\n\n> ${String(original).trim().slice(0, 220)}${String(original).trim().length > 220 ? '…' : ''}`
      : '';

  // Mensaje “bonito” y corto (puedes ajustar copy cuando quieras)
  return [
    `${win.emoji} **Win logged — ${win.label}!**`,
    `Big move, ${mention}. Wins compound when they’re witnessed.`,
    `Keep stacking it. 🔥`,
    snippet,
  ].join('\n');
}

class WinsMonitor {
  constructor({ winsChannelId } = {}) {
    this.winsChannelId =
      winsChannelId ||
      process.env.WINS_CHANNEL_ID ||
      DEFAULT_WINS_CHANNEL_ID;

    // dedup simple en memoria por messageId para evitar doble procesamiento
    this._processed = new Set();
  }

  async handleMessage(message) {
    if (!message?.author || message.author.bot) return;
    if (!message.guild) return;

    const channelId = message.channel?.id;
    if (!channelId) return;

    // only handle wins channel
    if (channelId !== this.winsChannelId) return;

    // ignore empty/system messages
    const content = (message.content || '').trim();
    if (!content) return;

    // dedup
    if (this._processed.has(message.id)) return;
    this._processed.add(message.id);

    const win = detectWinType(content);

    // React to original message (safe)
    await message.react(win.emoji).catch(() => {});
    await message.react('🏆').catch(() => {});

    // Reply nicely (prefer reply to keep channel tidy)
    const reply = buildWinReply({
      authorId: message.author.id,
      win,
      original: content,
    });

    await message
      .reply({
        content: reply,
        allowedMentions: { repliedUser: false },
      })
      .catch(err => {
        logger.warn('WinsMonitor reply failed', { err: err?.message, messageId: message.id });
      });

    logger.info('Win processed', {
      messageId: message.id,
      userId: message.author.id,
      winKey: win.key,
      channelId,
    });
  }
}

module.exports = WinsMonitor;
