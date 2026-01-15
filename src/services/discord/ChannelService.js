/**
 * Channel Service
 * Handles Discord channel operations
 * FIXES: Missing sendToChannel function that broke call reminders
 */

const { createLogger } = require('../../utils/logger');
const { AppError, ErrorTypes, handleError, handleDiscordError } = require('../../utils/errorHandler');

const logger = createLogger('ChannelService');

class ChannelService {
  constructor(client) {
    this.client = client;
  }

  /**
   * Send message to channel by ID
   * @param {string} channelId - Channel ID
   * @param {string|object} content - Message content (string or embed object)
   * @returns {Promise<Message>} Sent message
   */
  async sendToChannel(channelId, content) {
    try {
      logger.debug('Sending to channel', { channelId });

      const channel = await this.client.channels.fetch(channelId);

      if (!channel) {
        throw new AppError(
          `Channel ${channelId} not found`,
          ErrorTypes.NOT_FOUND,
          { channelId }
        );
      }

      if (!channel.isTextBased()) {
        throw new AppError(
          `Channel ${channelId} is not text-based`,
          ErrorTypes.VALIDATION,
          { channelId, type: channel.type }
        );
      }

      // Handle both string and embed content
      const messageOptions = typeof content === 'string' 
        ? { content } 
        : content;

      const message = await channel.send(messageOptions);
      
      logger.debug('Message sent successfully', {
        channelId,
        messageId: message.id
      });

      return message;

    } catch (error) {
      // Use Discord-specific error handling if it's a Discord API error
      if (error.code && typeof error.code === 'number') {
        handleDiscordError(error, 'ChannelService.sendToChannel');
      } else {
        handleError(error, 'ChannelService.sendToChannel', { channelId });
      }
      throw error;
    }
  }

  /**
   * Fetch channel by ID
   * @param {string} channelId - Channel ID
   * @returns {Promise<Channel>} Channel object
   */
  async fetchChannel(channelId) {
    try {
      const channel = await this.client.channels.fetch(channelId);
      
      if (!channel) {
        throw new AppError(
          `Channel ${channelId} not found`,
          ErrorTypes.NOT_FOUND,
          { channelId }
        );
      }

      return channel;

    } catch (error) {
      if (error.code && typeof error.code === 'number') {
        handleDiscordError(error, 'ChannelService.fetchChannel');
      } else {
        handleError(error, 'ChannelService.fetchChannel', { channelId });
      }
      throw error;
    }
  }

  /**
   * Edit message in channel
   * @param {string} channelId - Channel ID
   * @param {string} messageId - Message ID
   * @param {string|object} newContent - New content
   * @returns {Promise<Message>} Edited message
   */
  async editMessage(channelId, messageId, newContent) {
    try {
      const channel = await this.fetchChannel(channelId);

      if (!channel.isTextBased()) {
        throw new AppError(
          'Cannot edit message in non-text channel',
          ErrorTypes.VALIDATION
        );
      }

      const message = await channel.messages.fetch(messageId);
      const messageOptions = typeof newContent === 'string'
        ? { content: newContent }
        : newContent;

      return await message.edit(messageOptions);

    } catch (error) {
      if (error.code && typeof error.code === 'number') {
        handleDiscordError(error, 'ChannelService.editMessage');
      } else {
        handleError(error, 'ChannelService.editMessage', { channelId, messageId });
      }
      throw error;
    }
  }

  /**
   * Delete message from channel
   * @param {string} channelId - Channel ID
   * @param {string} messageId - Message ID
   * @returns {Promise<void>}
   */
  async deleteMessage(channelId, messageId) {
    try {
      const channel = await this.fetchChannel(channelId);
      const message = await channel.messages.fetch(messageId);
      await message.delete();

    } catch (error) {
      if (error.code && typeof error.code === 'number') {
        handleDiscordError(error, 'ChannelService.deleteMessage');
      } else {
        handleError(error, 'ChannelService.deleteMessage', { channelId, messageId });
      }
      throw error;
    }
  }

  /**
   * Send embed to channel
   * @param {string} channelId - Channel ID
   * @param {EmbedBuilder} embed - Embed object
   * @returns {Promise<Message>} Sent message
   */
  async sendEmbed(channelId, embed) {
    return await this.sendToChannel(channelId, { embeds: [embed] });
  }

  /**
   * Pin message in channel
   * @param {string} channelId - Channel ID
   * @param {string} messageId - Message ID
   * @returns {Promise<void>}
   */
  async pinMessage(channelId, messageId) {
    try {
      const channel = await this.fetchChannel(channelId);
      const message = await channel.messages.fetch(messageId);
      await message.pin();

    } catch (error) {
      if (error.code) {
        handleDiscordError(error, 'ChannelService.pinMessage');
      }
      throw error;
    }
  }
}

module.exports = ChannelService;

