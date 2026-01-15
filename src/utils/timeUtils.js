/**
 * Time Utilities
 * Helper functions for date/time operations
 */

const config = require('../config/settings');

/**
 * Get local day string in YYYY-MM-DD format
 * @param {Date} date - Date object (defaults to now)
 * @returns {string} Day string
 */
function getLocalDayString(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.advanced.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;

  return `${year}-${month}-${day}`;
}

/**
 * Add days to a date string
 * @param {string} dayStr - Day string (YYYY-MM-DD)
 * @param {number} days - Number of days to add
 * @returns {string} New day string
 */
function addDays(dayStr, days) {
  const [y, m, d] = dayStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Get current UTC day string
 * @returns {string} UTC day string (YYYY-MM-DD)
 */
function getUTCDayString() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse day string to Date object
 * @param {string} dayString - Day string (YYYY-MM-DD)
 * @returns {Date} Date object
 */
function parseDayString(dayString) {
  const [year, month, day] = dayString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Check if day string is valid
 * @param {string} dayString - Day string
 * @returns {boolean} True if valid
 */
function isValidDayString(dayString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayString)) {
    return false;
  }
  
  const date = parseDayString(dayString);
  return !isNaN(date.getTime());
}

module.exports = {
  getLocalDayString,
  addDays,
  getUTCDayString,
  parseDayString,
  isValidDayString
};
