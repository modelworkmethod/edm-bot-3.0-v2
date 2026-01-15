/**
 * Discord Attachments Utility
 * Helper functions for extracting and processing Discord message attachments
 */

const { createLogger } = require('./logger');

const logger = createLogger('DiscordAttachments');

/**
 * Extract image attachments from a Discord interaction or message
 * @param {Interaction|Message} source - Discord interaction or message object
 * @returns {Array} Array of image attachment objects
 */
function extractImageAttachments(source) {
  const imageAttachments = [];

  try {
    // Handle CommandInteraction with options
    if (source.options) {
      // Try to get attachments from command options
      const options = source.options;
      
      // Check for attachment option
      try {
        const attachment = options.getAttachment('image', false);
        if (attachment && isImageAttachment(attachment)) {
          imageAttachments.push(formatAttachment(attachment));
        }
      } catch (e) {
        // No attachment option defined, continue
      }

      // Check for multiple attachments if available
      // Note: Discord.js v14 handles attachments differently
    }

    // Handle Message object
    if (source.attachments && source.attachments.size > 0) {
      source.attachments.forEach(attachment => {
        if (isImageAttachment(attachment)) {
          imageAttachments.push(formatAttachment(attachment));
        }
      });
    }

    // Handle Interaction with resolved data
    if (source.type === 2 && source.options && source.options.resolved) { // APPLICATION_COMMAND
      const resolved = source.options.resolved;
      if (resolved.attachments) {
        resolved.attachments.forEach(attachment => {
          if (isImageAttachment(attachment)) {
            imageAttachments.push(formatAttachment(attachment));
          }
        });
      }
    }

    logger.debug('Extracted image attachments', {
      sourceType: source.constructor.name,
      count: imageAttachments.length
    });

  } catch (error) {
    logger.error('Failed to extract attachments', { error: error.message });
  }

  return imageAttachments;
}

/**
 * Check if attachment is an image
 * @param {Attachment} attachment - Discord attachment object
 * @returns {boolean} True if attachment is an image
 */
function isImageAttachment(attachment) {
  if (!attachment || !attachment.contentType) {
    return false;
  }

  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  return imageTypes.includes(attachment.contentType.toLowerCase());
}

/**
 * Format attachment object for storage
 * @param {Attachment} attachment - Discord attachment object
 * @returns {object} Formatted attachment data
 */
function formatAttachment(attachment) {
  return {
    url: attachment.url,
    proxyUrl: attachment.proxyURL || attachment.url,
    name: attachment.name || 'unknown.png',
    contentType: attachment.contentType,
    size: attachment.size || 0,
    width: attachment.width || null,
    height: attachment.height || null,
    ephemeral: attachment.ephemeral || false
  };
}

/**
 * Validate attachment limits
 * @param {Array} attachments - Array of attachment objects
 * @param {object} limits - Limit configuration
 * @returns {object} Validation result
 */
function validateAttachments(attachments, limits = {}) {
  const {
    minCount = 1,
    maxCount = 5,
    maxSizeMB = 10,
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  } = limits;

  const errors = [];

  // Check count
  if (attachments.length < minCount) {
    errors.push(`At least ${minCount} image(s) required`);
  }

  if (attachments.length > maxCount) {
    errors.push(`Maximum ${maxCount} images allowed`);
  }

  // Check each attachment
  attachments.forEach((att, index) => {
    // Check size
    const sizeMB = att.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      errors.push(`Image ${index + 1} exceeds ${maxSizeMB}MB limit`);
    }

    // Check type
    if (!allowedTypes.includes(att.contentType)) {
      errors.push(`Image ${index + 1} has unsupported format: ${att.contentType}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Extract attachments from slash command interaction
 * Specifically handles the case where users upload files with /command
 * @param {CommandInteraction} interaction - Discord slash command interaction
 * @returns {Array} Array of image attachment objects
 */
function extractSlashCommandAttachments(interaction) {
  const attachments = [];

  try {
    // In Discord.js v14, attachments from slash commands are in options.resolved.attachments
    if (interaction.options && interaction.options.data) {
      interaction.options.data.forEach(option => {
        if (option.type === 11) { // ATTACHMENT type
          const attachment = interaction.options.resolved?.attachments?.get(option.value);
          if (attachment && isImageAttachment(attachment)) {
            attachments.push(formatAttachment(attachment));
          }
        }
      });
    }

    // Also check the message reference if command was replied to a message with images
    if (interaction.message && interaction.message.attachments) {
      interaction.message.attachments.forEach(att => {
        if (isImageAttachment(att)) {
          attachments.push(formatAttachment(att));
        }
      });
    }

  } catch (error) {
    logger.error('Failed to extract slash command attachments', { error: error.message });
  }

  return attachments;
}

/**
 * Get attachment summary for display
 * @param {Array} attachments - Array of attachment objects
 * @returns {string} Human-readable summary
 */
function getAttachmentSummary(attachments) {
  if (!attachments || attachments.length === 0) {
    return 'No attachments';
  }

  const totalSize = attachments.reduce((sum, att) => sum + (att.size || 0), 0);
  const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);

  return `${attachments.length} image(s) (${sizeMB}MB total)`;
}

module.exports = {
  extractImageAttachments,
  extractSlashCommandAttachments,
  isImageAttachment,
  formatAttachment,
  validateAttachments,
  getAttachmentSummary
};
