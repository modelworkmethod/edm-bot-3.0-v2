/**
 * Texting Practice Command
 * Start or resume a texting scenario
 */

const { SlashCommandBuilder } = require('discord.js');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('TextingPracticeCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('texting-practice')
    .setDescription('Start or resume a texting practice scenario')
    .addIntegerOption(option =>
      option.setName('scenario')
        .setDescription('Scenario ID to start')
        .setRequired(false)
    ),

  async execute(interaction, services) {
    const ephemeral = !interaction.guild;
    const flags = ephemeral ? (1 << 6) : undefined; // usar flags en vez de "ephemeral" para evitar warning

    try {
      // 🔹 1) Rate limit check (soporta implementación sync o async del rateLimiter)
      if (services && services.rateLimiter) {
        let limited = false;

        try {
          const maybeLimited = services.rateLimiter.isRateLimited(
            interaction.user.id,
            'texting-practice'
          );

          // soporta tanto retorno sync como Promise
          limited = typeof maybeLimited?.then === 'function'
            ? await maybeLimited
            : maybeLimited;
        } catch (rlError) {
          logger.warn('TextingPractice: rateLimiter error, continuing anyway', {
            error: rlError.message,
          });
        }

        if (limited) {
          try {
            await interaction.reply({
              content: '⏱️ Slow down a bit and try again shortly.',
              flags,
            });
          } catch (err) {
            const msg = err?.message || '';
            const code = err?.code;
            const isStateError =
              code === 10062 || // Unknown interaction
              code === 40060 || // already acknowledged
              msg.includes('Unknown interaction') ||
              msg.includes('already been acknowledged');

            if (isStateError) {
              logger.warn(
                'TextingPractice: interaction invalid while sending cooldown reply',
                { code, message: msg }
              );
              return;
            }
            throw err;
          }
          return;
        }
      }

      // 🔹 2) deferReply seguro
      try {
        await interaction.deferReply({ flags });
      } catch (err) {
        const msg = err?.message || '';
        const code = err?.code;
        const isStateError =
          code === 10062 ||
          code === 40060 ||
          msg.includes('Unknown interaction') ||
          msg.includes('already been acknowledged');

        if (isStateError) {
          logger.warn('TextingPractice: interaction invalid while deferring', {
            code,
            message: msg,
          });
          return;
        }
        throw err;
      }

      const scenarioKey = interaction.options.getInteger('scenario') || null;

      // 🔹 3) Validar servicio
      if (!services || !services.textingService) {
        await interaction.editReply(
          'Texting service not available. Please try again later.'
        );
        return;
      }

      // 🔹 4) Start or resume session
      let result;
      try {
        result = await services.textingService.startOrResume(
          interaction.user.id,
          scenarioKey
        );
      } catch (svcError) {
        logger.error('TextingPractice: textingService.startOrResume failed', {
          error: svcError.message,
        });
        await interaction.editReply(
          '❌ Failed to start texting practice. Please contact an admin.'
        );
        return;
      }

      if (!result || !result.success) {
        await interaction.editReply(
          `❌ ${result?.error || 'Failed to start texting practice.'}`
        );
        return;
      }

      // 🔹 5) Case 1: user tiene que elegir escenario
      if (result.needsScenario) {
        let scenariosResult = null;
        try {
          scenariosResult = await services.textingService.getAvailableScenarios(
            5
          );
        } catch (svcErr) {
          logger.error(
            'TextingPractice: getAvailableScenarios failed',
            { error: svcErr.message }
          );
        }

        if (
          !scenariosResult ||
          !scenariosResult.success ||
          !scenariosResult.scenarios ||
          scenariosResult.scenarios.length === 0
        ) {
          await interaction.editReply(
            'No scenarios available. Please contact an admin.'
          );
          return;
        }

        let reply = '**📱 Available Texting Scenarios:**\n\n';
        for (const s of scenariosResult.scenarios) {
          reply += `**${s.key}.** ${s.name} (${s.difficulty || 'normal'})\n`;
          if (s.description) {
            reply += `   ${s.description}\n`;
          }
          reply += '\n';
        }
        reply += 'Try: `/texting-practice scenario:<key>`';

        // Evitar pasar de 2000 chars
        if (reply.length > 1900) {
          reply = reply.slice(0, 1900) + '…';
        }

        await interaction.editReply(reply);

        logger.info('TextingPractice: scenarios listed', {
          userId: interaction.user.id,
          count: scenariosResult.scenarios.length,
        });
        return;
      }

      // 🔹 6) Case 2: Resumed existing session
      if (result.resumed) {
        let reply = `**📱 Resuming scenario:** ${result.scenarioName}\n`;
        reply += `**Progress:** ${result.turnCount ?? 0} messages\n\n`;

        if (result.promptText) {
          const promptPreview =
            result.promptText.length > 800
              ? result.promptText.slice(0, 800) + '…'
              : result.promptText;

          reply += `**Current prompt:**\n${promptPreview}\n\n`;
        }

        reply +=
          'Tip: use `/texting-send` to reply, `/texting-finish` to end the practice.';

        if (reply.length > 1900) {
          reply = reply.slice(0, 1900) + '…';
        }

        await interaction.editReply(reply);

        logger.info('TextingPractice: session resumed', {
          userId: interaction.user.id,
          sessionId: result.sessionId,
          scenarioKey: result.scenarioKey,
        });
        return;
      }

      // 🔹 7) Case 3: new session started
      let reply = `**📱 Scenario Started:** ${result.scenarioName}\n\n`;

      if (result.description) {
        const desc =
          result.description.length > 500
            ? result.description.slice(0, 500) + '…'
            : result.description;
        reply += `${desc}\n\n`;
      }

      if (result.promptText) {
        const promptPreview =
          result.promptText.length > 800
            ? result.promptText.slice(0, 800) + '…'
            : result.promptText;

        reply += `**Context:**\n${promptPreview}\n\n`;
      }

      reply +=
        'Use `/texting-send message:"..."` to respond.\nUse `/texting-finish` when done.';

      if (reply.length > 1900) {
        reply = reply.slice(0, 1900) + '…';
      }

      await interaction.editReply(reply);

      logger.info('TextingPractice: new session started', {
        userId: interaction.user.id,
        sessionId: result.sessionId,
        scenarioKey: result.scenarioKey,
      });
    } catch (error) {
      const msg = error?.message || '';
      const code = error?.code;
      const isStateError =
        code === 10062 ||
        code === 40060 ||
        msg.includes('Unknown interaction') ||
        msg.includes('already been acknowledged');

      if (isStateError) {
        logger.warn(
          'TextingPractice: interaction no longer valid in error path',
          { code, message: msg }
        );
        return;
      }

      logger.error('Failed to execute texting-practice', { error: msg });

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(
            'An error occurred. Please try again.'
          );
        } else {
          await interaction.reply({
            content: 'An error occurred. Please try again.',
            flags,
          });
        }
      } catch (e) {
        logger.warn('TextingPractice: failed to send error reply', {
          error: e.message,
        });
      }
    }
  },
};
