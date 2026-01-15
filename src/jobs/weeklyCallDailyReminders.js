// src/jobs/weeklyCallDailyReminders.js
const cron = require('node-cron');
const { DateTime } = require('luxon');
const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { createLogger } = require('../utils/logger');

const logger = createLogger('WeeklyCallDailyReminders');

const TZ = 'America/New_York';

// ✅ Prevent duplicate schedules
let started = false;
let tasks = [];

// ✅ Dedup: avoid sending same reminder twice per day/time in same process
// key example: 2026-01-15@09:00
const SENT = new Set();

function makeSentKey(nowEt, label) {
  return `${nowEt.toISODate()}@${label}`;
}

function fmtCountdown(targetEt, nowEt) {
  const totalMinutes = Math.floor(targetEt.diff(nowEt, 'minutes').minutes);

  if (totalMinutes <= 0) return '🟢 **Happening now / passed**';

  const diff = targetEt.diff(nowEt, ['days', 'hours', 'minutes']).toObject();
  const d = Math.floor(diff.days || 0);
  const h = Math.floor(diff.hours || 0);
  const m = Math.floor(diff.minutes || 0);

  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h || d) parts.push(`${h}h`);
  parts.push(`${m}m`);

  return `⏳ Starts in **${parts.join(' ')}**`;
}

/**
 * ✅ Next occurrence of weekday at hour:minute (ET)
 * Luxon weekday: Mon=1 ... Sun=7
 */
function nextOccurrence(nowEt, weekday, hour, minute) {
  const todayAt = nowEt.set({ hour, minute, second: 0, millisecond: 0 });

  // days ahead (0..6)
  let delta = (weekday - nowEt.weekday + 7) % 7;

  // if it's today but already passed -> next week
  if (delta === 0 && todayAt <= nowEt) delta = 7;

  return todayAt.plus({ days: delta });
}

function buildEmbed({ nowEt, legendsChannelId }) {
  const wed = nextOccurrence(nowEt, 3, 19, 0); // Wednesday 7pm ET
  const sat = nextOccurrence(nowEt, 6, 17, 0); // Saturday 5pm ET
  const sun = nextOccurrence(nowEt, 7, 20, 0); // Sunday 8pm ET

  const legendsLine = legendsChannelId
    ? `\n📌 **Call links:** <#${legendsChannelId}>`
    : '';

  const desc = [
    `**Wednesday — Embodiment Call** *(7:00 PM ET)*\n${fmtCountdown(wed, nowEt)}\n`,
    `**Saturday — Social Flow Call** *(5:00 PM ET)*\n${fmtCountdown(sat, nowEt)}\n`,
    `**Sunday — Dating Strategy & Model Work Call** *(8:00 PM ET)*\n${fmtCountdown(sun, nowEt)}\n`,
    legendsLine,
  ].join('\n');

  return new EmbedBuilder()
    .setTitle('📞 Weekly Call Reminders')
    .setDescription(desc)
    .setColor(0x5865F2)
    .setFooter({ text: `ET Time • Posted ${nowEt.toFormat("ccc LLL dd, h:mm a")}` })
    .setTimestamp();
}

async function postReminder(client, {
  channelId,
  legendsCallSchedChannelId = null,
  label = 'manual',
  bypassDedup = false,
} = {}) {
  if (!channelId) return;

  const nowEt = DateTime.now().setZone(TZ);

  // ✅ Dedup per day+label
  if (!bypassDedup) {
    const sentKey = makeSentKey(nowEt, label);
    if (SENT.has(sentKey)) {
      logger.warn('Skipping duplicate send (dedup)', { channelId, label, sentKey });
      return;
    }
    SENT.add(sentKey);
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased?.()) {
    logger.warn('Channel not found or not text-based', { channelId });
    return;
  }

  // ✅ Permission diagnostics (helps when it "does nothing")
  try {
    const perms = channel.permissionsFor?.(client.user);
    if (perms) {
      if (!perms.has(PermissionsBitField.Flags.SendMessages)) {
        logger.error('Missing permission: SendMessages', { channelId });
        return;
      }
      if (!perms.has(PermissionsBitField.Flags.EmbedLinks)) {
        logger.error('Missing permission: EmbedLinks', { channelId });
        // We can still send plain text, but your UX wants embeds; stop to avoid confusion.
        return;
      }
    }
  } catch (e) {
    logger.warn('Permission check failed (continuing)', { channelId, error: e?.message });
  }

  const embed = buildEmbed({ nowEt, legendsChannelId: legendsCallSchedChannelId });

  await channel.send({ embeds: [embed] });
  logger.info('Sent daily weekly-call reminder', { channelId, at: nowEt.toISO(), label });
}

function startWeeklyCallDailyReminders(client, {
  channelId,
  legendsCallSchedChannelId = process.env.LEGENDS_CALL_SCHED_CHANNEL_ID || null,
} = {}) {
  if (!channelId) {
    logger.warn('WeeklyCallDailyReminders NOT started (missing channelId)');
    return;
  }

  if (started) {
    logger.warn('WeeklyCallDailyReminders already started — skipping');
    return;
  }

  // ✅ 3 times per day ET: 09:00, 15:00, 20:00
  const schedules = [
    { label: '09:00', expr: '0 9 * * *' },
    { label: '15:00', expr: '0 15 * * *' },
    { label: '20:00', expr: '0 20 * * *' },
  ];

  for (const s of schedules) {
    const task = cron.schedule(
      s.expr,
      async () => {
        try {
          await postReminder(client, {
            channelId,
            legendsCallSchedChannelId,
            label: s.label,
          });
        } catch (e) {
          logger.error('Tick failed', { error: e?.message, label: s.label });
        }
      },
      { timezone: TZ }
    );

    tasks.push(task);
  }

  started = true;

  logger.info('WeeklyCallDailyReminders started', {
    tz: TZ,
    channelId,
    times: schedules.map(x => x.label),
    legendsCallSchedChannelId: legendsCallSchedChannelId || null,
  });

  // ✅ Optional preview on boot (client demo)
  // WEEKLYCALLS_PREVIEW=true -> sends ONE reminder after 4s
  if (String(process.env.WEEKLYCALLS_PREVIEW || '').toLowerCase() === 'true') {
    setTimeout(() => {
      postReminder(client, {
        channelId,
        legendsCallSchedChannelId,
        label: 'preview',
        bypassDedup: true,
      }).catch(() => {});
    }, 4000);
  }

  // ✅ Optional: send 3 previews (mimic daily times)
  // WEEKLYCALLS_PREVIEW_ALL=true -> sends 3 reminders quickly for demo
  if (String(process.env.WEEKLYCALLS_PREVIEW_ALL || '').toLowerCase() === 'true') {
    setTimeout(async () => {
      try {
        await postReminder(client, { channelId, legendsCallSchedChannelId, label: '09:00-preview', bypassDedup: true });
        await postReminder(client, { channelId, legendsCallSchedChannelId, label: '15:00-preview', bypassDedup: true });
        await postReminder(client, { channelId, legendsCallSchedChannelId, label: '20:00-preview', bypassDedup: true });
        logger.info('✅ WEEKLYCALLS_PREVIEW_ALL sent');
      } catch (e) {
        logger.error('WEEKLYCALLS_PREVIEW_ALL failed', { error: e?.message });
      }
    }, 4500);
  }
}

function stopWeeklyCallDailyReminders() {
  try {
    for (const t of tasks) {
      try { t.stop?.(); t.destroy?.(); } catch {}
    }
  } finally {
    tasks = [];
    started = false;
    SENT.clear();
  }
}

module.exports = { startWeeklyCallDailyReminders, stopWeeklyCallDailyReminders };
