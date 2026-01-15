const { DateTime } = require('luxon');

function toGCalDate(dt) {
  // Google Calendar wants UTC Z: YYYYMMDDTHHMMSSZ
  return dt.toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");
}

function buildGoogleCalendarLink({
  title,
  startEt,                // Luxon DateTime in America/New_York
  durationMinutes = 90,
  details = '',
  location = 'Zoom (link in Discord)',
  timezone = 'America/New_York',
}) {
  const endEt = startEt.plus({ minutes: durationMinutes });
  const dates = `${toGCalDate(startEt)}/${toGCalDate(endEt)}`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates,
    details,
    location,
    ctz: timezone,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

module.exports = { buildGoogleCalendarLink };
