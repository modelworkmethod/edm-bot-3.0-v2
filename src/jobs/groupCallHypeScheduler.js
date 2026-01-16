/**
 * Group Call Reminder Scheduler
 * Sends reminders for weekly calls at specific offsets before call time:
 * - 24hrs before
 * - 6hrs before
 * - 3hrs before
 * - 1hr before
 * - 15min before
 * - Call start time
 */

const cron = require('node-cron');
const { DateTime } = require('luxon');
const { EmbedBuilder } = require('discord.js');
const { createLogger } = require('../utils/logger');

const logger = createLogger('GroupCallReminderScheduler');

const TZ = 'America/New_York';

// Reminder offsets in minutes (negative = before call)
const REMINDER_OFFSETS = [
  { key: '24h', mins: -24 * 60, label: '⏰ 24 hours' },
  { key: '6h',  mins: -6 * 60,  label: '⏰ 6 hours' },
  { key: '3h',  mins: -3 * 60,  label: '⏰ 3 hours' },
  { key: '1h',  mins: -60,      label: '⏰ 1 hour' },
  { key: '15m', mins: -15,      label: '⏱️ 15 minutes' },
  { key: 'now', mins: 0,        label: '🚀 Starting now' },
];

// Prevent duplicates in-memory
const SENT = new Set();

function makeKey(callKey, occurrenceEt, offsetKey) {
  return `${callKey}:${occurrenceEt.toISO()}:${offsetKey}`;
}

/**
 * Get next occurrence of a weekly call in ET.
 * weekday: Luxon weekday number (Mon=1 ... Sun=7)
 * hour: 0-23
 */
function nextOccurrenceWeekly(nowEt, { weekday, hour }) {
  const todayStart = nowEt.startOf('day');
  let candidate = todayStart.plus({ days: (weekday - nowEt.weekday + 7) % 7 })
    .set({ hour, minute: 0, second: 0, millisecond: 0 });
  
  if (candidate <= nowEt) {
    candidate = candidate.plus({ days: 7 });
  }
  
  return candidate;
}

function buildEmbed({ title, whenText, offset, legendsCallSchedChannelId }) {
  const scheduleMention = legendsCallSchedChannelId
    ? `<#${legendsCallSchedChannelId}>`
    : 'the call schedule channel';

  const titleText = offset.key === 'now'
    ? `🚀 **${title} is starting now!**`
    : `${offset.label} until ${title}!`;

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`⚡ ${titleText}`)
    .setDescription(
      `🕒 **${whenText}**\n\n` +
      `📌 **Check call links in:** ${scheduleMention}\n\n` +
      `Prepare for transformation! 💪`
    )
    .setTimestamp();
}

async function sendReminder(client, channelId, embed) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased?.()) return;
  await channel.send({ embeds: [embed] }).catch(() => {});
}

/**
 * Start scheduler
 * Checks every minute for upcoming reminders
 */
function startGroupCallHypeScheduler(client, {
  channelId,
  legendsCallSchedChannelId = process.env.LEGENDS_CALL_SCHED_CHANNEL_ID || null,
} = {}) {
  if (!channelId) {
    logger.warn('GroupCallReminderScheduler NOT started (missing channelId)');
    return;
  }

  const calls = [
    {
      key: 'SUNDAY',
      title: 'Sunday Dating Strategy & Model Work Call',
      weekday: 7, // Sunday
      hour: 20,   // 8pm ET
      label: 'Sunday @ 8:00 PM ET',
    },
    {
      key: 'WEDNESDAY',
      title: 'Wednesday Embodiment Call',
      weekday: 3, // Wednesday
      hour: 19,   // 7pm ET
      label: 'Wednesday @ 7:00 PM ET',
    },
    {
      key: 'SATURDAY',
      title: 'Saturday Social Flow Call',
      weekday: 6, // Saturday
      hour: 17,   // 5pm ET
      label: 'Saturday @ 5:00 PM ET',
    },
  ];

  // Check every minute for upcoming reminders
  cron.schedule('* * * * *', async () => {
    try {
      const nowEt = DateTime.now().setZone(TZ);

      for (const call of calls) {
        const nextCallEt = nextOccurrenceWeekly(nowEt, call);

        for (const offset of REMINDER_OFFSETS) {
          const reminderTimeEt = nextCallEt.plus({ minutes: offset.mins });
          
          // Check if current time matches reminder time (within 1 minute window)
          const diffMinutes = Math.abs(nowEt.diff(reminderTimeEt, 'minutes').minutes);
          if (diffMinutes > 1) continue; // Not the right time yet

          const key = makeKey(call.key, nextCallEt, offset.key);
          if (SENT.has(key)) continue; // Already sent
          SENT.add(key);

          const embed = buildEmbed({
            title: call.title,
            whenText: call.label,
            offset,
            legendsCallSchedChannelId,
          });

          await sendReminder(client, channelId, embed);

          logger.info('Sent group call reminder', {
            call: call.key,
            occurrence: nextCallEt.toISO(),
            offset: offset.key,
            reminderTime: reminderTimeEt.toISO(),
          });
        }
      }
    } catch (err) {
      logger.error('GroupCallReminderScheduler tick failed', { error: err?.message });
    }
  }, { timezone: TZ });

  logger.info('GroupCallReminderScheduler started', {
    channelId,
    tz: TZ,
    reminders: REMINDER_OFFSETS.map(o => o.key),
    legendsCallSchedChannelId: legendsCallSchedChannelId || null,
  });
}

/**
 * 🧪 PREVIEW — force reminder messages (NO scheduling)
 * Safe for client demo
 */
async function previewGroupCallHype(client, {
  channelId,
  legendsCallSchedChannelId = process.env.LEGENDS_CALL_SCHED_CHANNEL_ID || null,
} = {}) {
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased?.()) return;

  const previews = [
    { title: 'Sunday Dating Strategy & Model Work Call', whenText: 'Sunday @ 8:00 PM ET', offset: REMINDER_OFFSETS[0] },
    { title: 'Wednesday Embodiment Call', whenText: 'Wednesday @ 7:00 PM ET', offset: REMINDER_OFFSETS[0] },
    { title: 'Saturday Social Flow Call', whenText: 'Saturday @ 5:00 PM ET', offset: REMINDER_OFFSETS[0] },
  ];

  for (const c of previews) {
    const embed = buildEmbed({
      title: c.title,
      whenText: c.whenText,
      offset: c.offset,
      legendsCallSchedChannelId,
    });

    await channel.send({ embeds: [embed] }).catch(() => {});
  }

  logger.info('previewGroupCallHype sent', { channelId });
}

module.exports = {
  startGroupCallHypeScheduler,
  previewGroupCallHype,
};
