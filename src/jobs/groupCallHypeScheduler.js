/**
 * Group Call Hype Scheduler
 * Sends "N days out" hype reminders for weekly calls
 *
 * Uses Luxon (NO moment-timezone dependency)
 */

const cron = require('node-cron');
const { DateTime } = require('luxon');
const { EmbedBuilder } = require('discord.js');
const { createLogger } = require('../utils/logger');

const logger = createLogger('GroupCallHypeScheduler');

const TZ = 'America/New_York';

// ✅ Client requested 4 days out
const HYPE_OFFSET_DAYS = Number(process.env.GROUPCALL_HYPE_DAYS_OUT || 4);

// ✅ Prevent duplicates in-memory
const SENT = new Set();

function makeKey(callKey, occurrenceEt, slotKey) {
  // slotKey = "09:00" | "15:00" | "20:00" etc. so the same day can send multiple times safely
  return `${callKey}:${occurrenceEt.toISODate()}:${slotKey}`;
}

/**
 * Get next occurrence of a weekly call in ET.
 * weekday: Luxon weekday number (Mon=1 ... Sun=7)
 * hour: 0-23
 */
function nextOccurrenceWeekly(nowEt, { weekday, hour }) {
  const todayStart = nowEt.startOf('day');

  // candidate in the current week (or today)
  let candidate = todayStart.plus({ days: (weekday - nowEt.weekday + 7) % 7 })
    .set({ hour, minute: 0, second: 0, millisecond: 0 });

  // if candidate already passed, take next week
  if (candidate <= nowEt) {
    candidate = candidate.plus({ days: 7 });
  }

  return candidate;
}

function buildEmbed({ title, whenText, legendsCallSchedChannelId }) {
  const scheduleMention = legendsCallSchedChannelId
    ? `<#${legendsCallSchedChannelId}>`
    : 'the call schedule channel';

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`⚡ **${HYPE_OFFSET_DAYS} DAYS** until ${title}!`)
    .setDescription(
      `🕒 **${whenText}**\n\n` +
      `📌 **Check call links in:** ${scheduleMention}\n\n` +
      `Prepare for transformation! 💪`
    )
    .setTimestamp();
}

async function sendHype(client, channelId, embed) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased?.()) return;
  await channel.send({ embeds: [embed] }).catch(() => {});
}

/**
 * Start scheduler
 * - Runs daily at 9am, 3pm, 8pm ET (client wants daily reminders cadence)
 * - BUT only sends the "days out" hype when "today == (callDate - HYPE_OFFSET_DAYS)"
 *
 * If you want ONLY once per day, set:
 *   GROUPCALL_HYPE_TIMES=12   (or any hour)
 * Default: 9,15,20
 */
function startGroupCallHypeScheduler(client, {
  channelId,
  legendsCallSchedChannelId = process.env.LEGENDS_CALL_SCHED_CHANNEL_ID || null,
} = {}) {
  if (!channelId) {
    logger.warn('GroupCallHypeScheduler NOT started (missing channelId)');
    return;
  }

  const timesRaw = String(process.env.GROUPCALL_HYPE_TIMES || '9,15,20');
  const hours = timesRaw
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => Number.isInteger(n) && n >= 0 && n <= 23);

  if (!hours.length) {
    logger.warn('GroupCallHypeScheduler: no valid hours in GROUPCALL_HYPE_TIMES; using default 9,15,20');
    hours.push(9, 15, 20);
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

  // schedule per hour
  for (const h of hours) {
    const slotKey = `${String(h).padStart(2, '0')}:00`;

    cron.schedule(
      `0 ${h} * * *`, // at minute 0 of hour h, daily
      async () => {
        try {
          const nowEt = DateTime.now().setZone(TZ);

          for (const call of calls) {
            const nextCallEt = nextOccurrenceWeekly(nowEt, call);
            const hypeDayEt = nextCallEt.minus({ days: HYPE_OFFSET_DAYS }).startOf('day');

            // fire if it's hypeDay (same calendar day)
            if (!nowEt.hasSame(hypeDayEt, 'day')) continue;

            const key = makeKey(call.key, nextCallEt, slotKey);
            if (SENT.has(key)) continue;
            SENT.add(key);

            const embed = buildEmbed({
              title: call.title,
              whenText: call.label,
              legendsCallSchedChannelId,
            });

            await sendHype(client, channelId, embed);

            logger.info('Sent group call hype reminder', {
              call: call.key,
              occurrence: nextCallEt.toISO(),
              slot: slotKey,
              daysOut: HYPE_OFFSET_DAYS,
            });
          }
        } catch (err) {
          logger.error('GroupCallHypeScheduler tick failed', { error: err?.message });
        }
      },
      { timezone: TZ }
    );
  }

  logger.info('GroupCallHypeScheduler started', {
    channelId,
    tz: TZ,
    daysOut: HYPE_OFFSET_DAYS,
    hours,
    legendsCallSchedChannelId: legendsCallSchedChannelId || null,
  });
}

/**
 * 🧪 PREVIEW — force hype messages (NO scheduling)
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
    { title: 'Sunday Dating Strategy & Model Work Call', whenText: 'Sunday @ 8:00 PM ET' },
    { title: 'Wednesday Embodiment Call', whenText: 'Wednesday @ 7:00 PM ET' },
    { title: 'Saturday Social Flow Call', whenText: 'Saturday @ 5:00 PM ET' },
  ];

  for (const c of previews) {
    const embed = buildEmbed({
      title: c.title,
      whenText: c.whenText,
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
