/**
 * Message Service
 * Handles Discord message operations and reactions
 */

const { createLogger } = require('../../utils/logger');
const { handleDiscordError } = require('../../utils/errorHandler');

const logger = createLogger('MessageService');

class MessageService {
  constructor(client) {
    this.client = client;
  }

  /**
   * Add reaction to message
   * @param {Message} message - Discord message
   * @param {string} emoji - Emoji to react with
   * @returns {Promise<void>}
   */
  async addReaction(message, emoji) {
    try {
      await message.react(emoji);
      logger.debug('Reaction added', { messageId: message.id, emoji });
    } catch (error) {
      if (error.code) {
        handleDiscordError(error, 'MessageService.addReaction');
      }
      // Don't throw - reactions are non-critical
      logger.warn('Failed to add reaction', { error: error.message });
    }
  }

  /**
   * Reply to message
   * @param {Message} message - Discord message
   * @param {string|object} content - Reply content
   * @returns {Promise<Message>} Reply message
   */
  async reply(message, content) {
    try {
      const replyOptions = typeof content === 'string'
        ? { content }
        : content;

      return await message.reply(replyOptions);
    } catch (error) {
      if (error.code) {
        handleDiscordError(error, 'MessageService.reply');
      }
      throw error;
    }
  }

  /**
   * Send ephemeral reply to interaction
   * @param {Interaction} interaction - Discord interaction
   * @param {string|object} content - Reply content
   * @returns {Promise<void>}
   */
  async replyEphemeral(interaction, content) {
    try {
      const replyOptions = typeof content === 'string'
        ? { content, ephemeral: true }
        : { ...content, ephemeral: true };

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(replyOptions);
      } else {
        await interaction.reply(replyOptions);
      }
    } catch (error) {
      logger.error('Failed to reply ephemerally', { error: error.message });
      throw error;
    }
  }

  /**
   * Defer interaction reply
   * @param {Interaction} interaction - Discord interaction
   * @param {boolean} ephemeral - Whether to defer ephemerally
   * @returns {Promise<void>}
   */
  async deferReply(interaction, ephemeral = false) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral });
      }
    } catch (error) {
      logger.error('Failed to defer reply', { error: error.message });
      throw error;
    }
  }
}

module.exports = MessageService;

