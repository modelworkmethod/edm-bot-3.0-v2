/**
 * Plain Text Replies Utility
 * Consistent plain text messaging across all interaction handlers
 */

/**
 * Success message
 * @param {string} msg - Success message
 * @returns {string}
 */
function ok(msg) {
  return `✅ ${msg}`;
}

/**
 * Failure message
 * @param {string} msg - Error message
 * @returns {string}
 */
function fail(msg) {
  return `❌ ${msg}`;
}

/**
 * Throttled/rate-limited message
 * @param {number} windowSec - Cooldown window in seconds (optional)
 * @returns {string}
 */
function throttled(windowSec = null) {
  if (windowSec) {
    return `⏱️ Slow down a bit and try again shortly (wait up to ${windowSec}s).`;
  }
  return '⏱️ Slow down a bit and try again shortly.';
}

/**
 * Unknown interaction TODO marker
 * @param {string} kind - Interaction kind (button, modal, select-menu)
 * @param {string} idOrPrefix - CustomId or extracted prefix
 * @returns {string}
 */
function unknown(kind, idOrPrefix) {
  return `TODO:${kind}:${idOrPrefix} - This ${kind} handler is not yet implemented.`;
}

/**
 * Admin-only restriction message
 * @returns {string}
 */
function adminOnly() {
  return '🚫 Admin only.';
}

/**
 * Permission denied message
 * @param {string} reason - Optional reason
 * @returns {string}
 */
function permissionDenied(reason = null) {
  return reason ? `🚫 Permission denied: ${reason}` : '🚫 Permission denied.';
}

/**
 * Service unavailable message
 * @param {string} serviceName - Name of unavailable service
 * @returns {string}
 */
function serviceUnavailable(serviceName = null) {
  return serviceName 
    ? `⚠️ ${serviceName} service not available. Please try again later.`
    : '⚠️ Service not available. Please try again later.';
}

module.exports = {
  ok,
  fail,
  throttled,
  unknown,
  adminOnly,
  permissionDenied,
  serviceUnavailable
};


