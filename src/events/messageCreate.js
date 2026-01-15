/**
 * Message Create Event Handler
 * Handles CTJ monitoring, chat engagement, wins tracking, Wingman logic,
 * and Journal Image XP awarding.
 */

const { createLogger } = require('../utils/logger');
const { handleError } = require('../utils/errorHandler');
const EngagementTracker = require('../services/analytics/EngagementTracker');
const WingmanMatcher = require('../services/wingman/WingmanMatcher');

const logger = createLogger('MessageCreateEvent');

module.exports = {
  name: 'messageCreate',
  once: false,

  async execute(message) {
    try {
      if (!message?.author || message.author.bot) return;
      if (!message.guild) return;

      const services = message.client?.services;
      if (!services) {
        logger.warn('Services not initialized for messageCreate');
        return;
      }

      const userId = message.author.id;

      // ✅ Journal Image XP awarder (runs independently, no DB)
      if (services.journalImageAwarder?.handleMessage) {
        await services.journalImageAwarder.handleMessage(message).catch(err =>
          logger.warn('journalImageAwarder failed', { err: err?.message })
        );
      }

      // ✅ Wingman: mark Alpha/Beta on first user message inside wingman threads
      try {
        const isThread =
          message.channel?.isThread?.() ||
          message.channel?.type?.toString?.().includes('Thread');

        if (isThread) {
          if (!services.__wingmanMatcher && services.userService) {
            services.__wingmanMatcher = new WingmanMatcher(services.userService);
          }

          if (services.__wingmanMatcher?.markAlphaOnFirstMessage) {
            await services.__wingmanMatcher
              .markAlphaOnFirstMessage(message)
              .catch(err =>
                logger.warn('WingmanMatcher.markAlphaOnFirstMessage failed', {
                  err: err.message,
                  channelId: message.channel?.id,
                })
              );
          }
        }
      } catch (err) {
        logger.warn('Wingman alpha/beta hook error', { err: err.message });
      }

      // Existing monitors (independent)
      if (services.ctjMonitor?.handleMessage) {
        await services.ctjMonitor.handleMessage(message).catch(err =>
          logger.warn('ctjMonitor failed', { err: err.message })
        );
      }

      if (services.chatEngagementMonitor?.handleMessage) {
        await services.chatEngagementMonitor.handleMessage(message).catch(err =>
          logger.warn('chatEngagementMonitor failed', { err: err.message })
        );
      }

      if (services.winsMonitor?.handleMessage) {
        await services.winsMonitor.handleMessage(message).catch(err =>
          logger.warn('winsMonitor failed', { err: err.message })
        );
      }

      // Track engagement
      try {
        await EngagementTracker.trackChatMessage(userId);
      } catch (err) {
        logger.warn('EngagementTracker.trackChatMessage failed', { err: err.message });
      }

      // Content moderation (should NOT gate other features)
      if (services.contentModerator?.analyzeContent) {
        const analysis = await services.contentModerator
          .analyzeContent(userId, 'message', message.id, message.content || '')
          .catch(err => {
            logger.warn('contentModerator.analyzeContent failed', { err: err.message });
            return null;
          });

        if (analysis?.flagged && analysis?.severity === 'high') {
          logger.warn('High-severity content detected', {
            userId,
            messageId: message.id,
            flags: analysis.flags,
          });

          if (analysis.flags?.includes('toxic_language') && services.warningSystem?.warnUser) {
            await services.warningSystem
              .warnUser(
                userId,
                'system',
                'Toxic language detected',
                'medium',
                { messageId: message.id, channelId: message.channel.id }
              )
              .catch(err =>
                logger.warn('warningSystem.warnUser failed', { err: err.message })
              );
          }
        }
      }

      // ✅ If you still want CTJ image awarder, run it independently (not inside moderation)
      if (services.ctjImageAwarder?.handleMessage) {
        await services.ctjImageAwarder.handleMessage(message).catch(err =>
          logger.warn('ctjImageAwarder failed', { err: err?.message })
        );
      }

    } catch (error) {
      handleError(error, 'MessageCreate', { messageId: message?.id });
    }
  },
};
