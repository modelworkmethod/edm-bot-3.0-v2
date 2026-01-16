const cron = require('node-cron');
const { DateTime } = require('luxon');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const { createLogger } = require('../../utils/logger');

const logger = createLogger('MonthlyCallsScheduler');

const TZ = 'America/New_York';

// offsets en minutos (negativos)
const REMINDER_OFFSETS = [
  { key: '1w',  mins: -7 * 24 * 60, label: '🗓️ 1 week out' },
  { key: '3d',  mins: -3 * 24 * 60, label: '📅 3 days out' },
  { key: '1d',  mins: -1 * 24 * 60, label: '⏳ 1 day out' },
  { key: '6h',  mins: -6 * 60,      label: '⏰ 6 hours' },
  { key: '3h',  mins: -3 * 60,      label: '⏰ 3 hours' },
  { key: '1h',  mins: -60,          label: '⏰ 1 hour' },
  { key: '15m', mins: -15,          label: '⏱️ 15 minutes' },
  { key: 'now', mins: 0,            label: '🚀 Starting now' },
];

// Dedup en memoria (si reinicias el bot puede repetir; si quieres luego lo persistimos)
const SENT = new Set();

// ✅ Prevent duplicate cron schedules
let started = false;
let scheduledTask = null;

function lastMondayOfMonth(dtEt) {
  const lastDay = dtEt.endOf('month').startOf('day');
  const monday = 1; // Luxon Monday=1
  let cursor = lastDay;
  while (cursor.weekday !== monday) cursor = cursor.minus({ days: 1 });
  return cursor;
}

/**
 * ✅ Monthly Accelerator Group Call:
 * - ONLY last Monday of the month @ 9:00 PM ET
 */
function nextOccurrenceLastMonday(nowEt) {
  const thisMonthBase = nowEt;
  const nextMonthBase = nowEt.plus({ months: 1 });

  const thisOcc = lastMondayOfMonth(thisMonthBase).set({
    hour: 21, minute: 0, second: 0, millisecond: 0
  });

  const nextOcc = lastMondayOfMonth(nextMonthBase).set({
    hour: 21, minute: 0, second: 0, millisecond: 0
  });

  // If it already passed (with 2h grace), use next month
  if (nowEt > thisOcc.plus({ hours: 2 })) return nextOcc;
  return thisOcc;
}

function humanEt(dtEt) {
  return dtEt.toFormat("ccc, LLL dd ' @ ' h:mm a 'ET'");
}

function buildEmbed({ eventTitle, reminderLabel, startEt, zoomLine, durationMinutes, legendsChannelId }) {
  const nowEt = DateTime.now().setZone(TZ);
  const minsTo = Math.round(startEt.diff(nowEt, 'minutes').minutes);

  const countdown =
    minsTo > 0 ? `Starts in **${minsTo} min**`
    : minsTo === 0 ? '**Starting now**'
    : `Started **${Math.abs(minsTo)} min** ago`;

  const legendsLine = legendsChannelId
    ? `\n\n📌 Check call links in: <#${legendsChannelId}>`
    : '';

  const desc = [
    `**When:** ${humanEt(startEt)}`,
    `**Duration:** ${durationMinutes} min`,
    `**Reminder:** ${reminderLabel}`,
    '',
    `**Zoom:** ${zoomLine}`,
    '',
    `**Status:** ${countdown}`,
    legendsLine,
  ].join('\n');

  return new EmbedBuilder()
    .setTitle(eventTitle)
    .setDescription(desc)
    .setColor(0x5865f2)
    .setTimestamp();
}

function buildButtons({ zoomUrl }) {
  const row = new ActionRowBuilder();

  // ✅ Only Zoom button now
  if (zoomUrl) {
    row.addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('🎥 Join Zoom')
        .setURL(zoomUrl)
    );
  }

  return row.components?.length ? row : null;
}

function shouldFire(nowEt, targetEt) {
  // mismo minuto (+/-30s)
  const diff = Math.abs(nowEt.diff(targetEt, 'seconds').seconds);
  return diff <= 30;
}

function makeDedupKey(eventKey, occurrenceEt, offsetKey) {
  return `${eventKey}:${occurrenceEt.toISO()}:${offsetKey}`;
}

/**
 * ✅ Optional helper to emit sample reminders immediately
 * env:
 *  MONTHLYCALLS_TEST_ON_START=true
 *  MONTHLYCALLS_TEST_OFFSETS=now,1h (comma list from REMINDER_OFFSETS keys)
 */
async function sendTestSamples(client, channelId, buildPayloadFn) {
  const on = String(process.env.MONTHLYCALLS_TEST_ON_START || '').toLowerCase() === 'true';
  if (!on) return;

  const keysRaw = String(process.env.MONTHLYCALLS_TEST_OFFSETS || 'now,1h');
  const keys = keysRaw.split(',').map(s => s.trim()).filter(Boolean);

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased?.()) return;

  for (const k of keys) {
    const off = REMINDER_OFFSETS.find(o => o.key === k);
    if (!off) continue;

    const payload = buildPayloadFn(off, true);
    if (!payload) continue;

    await channel.send(payload).catch(() => {});
  }

  logger.info('MonthlyCallsScheduler test samples sent', { channelId, keys });
}

function startMonthlyCallsScheduler(client, {
  channelId,
  monthlyZoomUrl = null,
  zoomPlaceholder = '🔗 (Zoom link will be posted in the call schedule channel)',
  durationMinutes = 90,

  // ✅ clickable schedule channel per client
  legendsCallSchedChannelId = process.env.LEGENDS_CALL_SCHED_CHANNEL_ID || null,
} = {}) {
  if (!channelId) {
    logger.warn('Monthly calls scheduler NOT started (missing channelId)');
    return;
  }

  if (started) {
    logger.warn('MonthlyCallsScheduler already started — skipping duplicate schedule', { channelId });
    return;
  }

  const buildPayload = (off, isTest = false) => {
    const nowEt = DateTime.now().setZone(TZ);
    const occurrenceEt = nextOccurrenceLastMonday(nowEt);

    const dedupKey = makeDedupKey('MONTHLY_LAST_MONDAY', occurrenceEt, off.key);
    if (!isTest) {
      if (SENT.has(dedupKey)) return null;
      SENT.add(dedupKey);
    }

    const title = 'Monthly Accelerator Group Call (Epic & 29 Club)';
    const zoomLine = monthlyZoomUrl ? monthlyZoomUrl : zoomPlaceholder;

    const embed = buildEmbed({
      eventTitle: title,
      reminderLabel: off.label,
      startEt: occurrenceEt,
      zoomLine,
      durationMinutes,
      legendsChannelId: legendsCallSchedChannelId,
    });

    const row = buildButtons({ zoomUrl: monthlyZoomUrl });

    return {
      content: `📣 **${off.label}** — ${title}`,
      embeds: [embed],
      components: row ? [row] : [],
    };
  };

  scheduledTask = cron.schedule('* * * * *', async () => {
    try {
      const nowEt = DateTime.now().setZone(TZ);
      const occurrenceEt = nextOccurrenceLastMonday(nowEt);

      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased?.()) return;

      for (const off of REMINDER_OFFSETS) {
        const fireAt = occurrenceEt.plus({ minutes: off.mins });
        if (!shouldFire(nowEt, fireAt)) continue;

        const payload = buildPayload(off, false);
        if (!payload) continue;

        await channel.send(payload);

        logger.info('Sent monthly call reminder', {
          event: 'MONTHLY_LAST_MONDAY',
          offset: off.key,
          occurrence: occurrenceEt.toISO(),
        });
      }
    } catch (e) {
      logger.error('Monthly calls scheduler tick failed', { error: e?.message || String(e) });
    }
  }, { timezone: TZ });

  started = true;
  logger.info('Monthly calls scheduler started', { tz: TZ, channelId });

  // ✅ optional: print samples right away (only if MONTHLYCALLS_TEST_ON_START=true)
  if (String(process.env.MONTHLYCALLS_TEST_ON_START || '').toLowerCase() === 'true') {
    setTimeout(() => {
      sendTestSamples(client, channelId, (off) => buildPayload(off, true)).catch(() => {});
    }, 2500);
  }
}

function stopMonthlyCallsScheduler() {
  try {
    if (scheduledTask && typeof scheduledTask.stop === 'function') {
      scheduledTask.stop();
    }
  } catch (e) {
    logger.warn('MonthlyCallsScheduler: stop failed', { error: e?.message });
  } finally {
    scheduledTask = null;
    started = false;
  }
}

module.exports = { startMonthlyCallsScheduler, stopMonthlyCallsScheduler };
