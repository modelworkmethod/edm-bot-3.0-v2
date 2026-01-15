/**
 * Social Media Utilities
 * Instagram normalization and validation
 */

/**
 * Normalize Instagram handle or URL to standard format
 * @param {string} input - Instagram handle or URL
 * @returns {object|null} Normalized handle and URL or null if invalid
 */
function normalizeInstagram(input) {
  if (!input || typeof input !== 'string') {
    return null;
  }

  // Clean the input
  let handle = input.trim();

  // Remove @ prefix if present
  if (handle.startsWith('@')) {
    handle = handle.substring(1);
  }

  // Extract handle from various URL formats
  const urlPatterns = [
    /instagram\.com\/([^\/\?\#]+)/i,
    /^([a-zA-Z0-9._]+)$/i  // Direct handle format
  ];

  let extractedHandle = null;

  for (const pattern of urlPatterns) {
    const match = handle.match(pattern);
    if (match) {
      extractedHandle = match[1];
      break;
    }
  }

  if (!extractedHandle) {
    return null;
  }

  // Normalize handle: lowercase, remove trailing slashes, validate characters
  const normalizedHandle = extractedHandle
    .toLowerCase()
    .replace(/\/+$/, '')  // Remove trailing slashes
    .replace(/[^a-z0-9._]/g, ''); // Remove invalid characters

  // Validate handle format (alphanumeric, dots, underscores, 1-30 chars)
  if (!/^[a-z0-9._]{1,30}$/.test(normalizedHandle)) {
    return null;
  }

  // Ensure handle doesn't start or end with dot/underscore
  if (/^[._]|[._]$/.test(normalizedHandle)) {
    return null;
  }

  // Build standardized URL
  const url = `https://www.instagram.com/${normalizedHandle}`;

  return {
    handle: normalizedHandle,
    url: url
  };
}

/**
 * Validate Instagram handle format
 * @param {string} handle - Instagram handle to validate
 * @returns {boolean} True if valid format
 */
function isValidInstagramHandle(handle) {
  if (!handle || typeof handle !== 'string') {
    return false;
  }

  const normalized = normalizeInstagram(handle);
  return normalized !== null;
}

/**
 * Format Instagram handle for display
 * @param {string} handle - Instagram handle
 * @returns {string} Formatted handle with @ prefix
 */
function formatInstagramHandle(handle) {
  if (!handle) return '';
  return `@${handle}`;
}

/**
 * Extract Instagram handle from various input formats
 * @param {string} input - Raw input (handle, URL, etc.)
 * @returns {string|null} Clean handle or null
 */
function extractInstagramHandle(input) {
  const normalized = normalizeInstagram(input);
  return normalized ? normalized.handle : null;
}

/**
 * Sanitize caption text for safe storage
 * @param {string} caption - Raw caption text
 * @returns {string} Sanitized caption
 */
function sanitizeCaption(caption) {
  if (!caption || typeof caption !== 'string') {
    return '';
  }

  // Remove zero-width characters and other invisible Unicode
  let sanitized = caption
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width spaces
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Control characters
    .trim();

  // Limit length to 2000 characters (Discord message limit)
  if (sanitized.length > 2000) {
    sanitized = sanitized.substring(0, 1997) + '...';
  }

  return sanitized;
}

/**
 * Check if file appears to be an Instagram screenshot based on heuristics
 * @param {object} params - File parameters
 * @param {string} params.fileName - File name
 * @param {string} params.contentType - MIME type
 * @param {number} params.width - Image width
 * @param {number} params.height - Image height
 * @returns {boolean} True if likely an IG screenshot
 */
function isLikelyIGScreenshot({ fileName, contentType, width, height }) {
  // Basic heuristics - not foolproof, just a helper
  
  // Must be an image
  if (!contentType || !contentType.startsWith('image/')) {
    return false;
  }

  // Common screenshot patterns in filename
  const screenshotPatterns = [
    /screenshot/i,
    /screen_shot/i,
    /img_\d{8}/i,  // IMG_20240115
    /photo_\d{4}/i,
    /instagram/i,
    /ig_/i
  ];

  const hasScreenshotName = screenshotPatterns.some(pattern => 
    pattern.test(fileName || '')
  );

  // Common Instagram screenshot dimensions (portrait)
  const isPortrait = height && width && height > width;
  const isInstagramish = width >= 360 && width <= 1440 && height >= 640 && height <= 3200;

  return hasScreenshotName || (isPortrait && isInstagramish);
}

module.exports = {
  normalizeInstagram,
  isValidInstagramHandle,
  formatInstagramHandle,
  extractInstagramHandle,
  sanitizeCaption,
  isLikelyIGScreenshot
};
