/**
 * Course Admin Command
 * Manage course content and answer questions
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const { createLogger } = require('../../utils/logger');
const config = require('../../config/settings');
const { query } = require('../../database/postgres');

const logger = createLogger('CourseAdminCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('course-admin')
    .setDescription('Manage course content (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand.setName('questions').setDescription('View unanswered questions'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('answer')
        .setDescription('Answer a question')
        .addIntegerOption((option) =>
          option
            .setName('question-id')
            .setDescription('Question ID')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('answer')
            .setDescription('Your answer')
            .setRequired(true),
        ),
    ),

  async execute(interaction, services) {
    const isAdmin =
      interaction.user.id === config.admin.userId ||
      interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

    if (!isAdmin) {
      try {
        await interaction.reply({
          content: '❌ Admin only.',
          flags: 1 << 6, // ephemeral
        });
      } catch (err) {
        logger.warn('CourseAdmin.execute: failed to reply (no admin)', {
          code: err.code,
          message: err.message,
        });
      }
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'questions') {
      await this.handleQuestions(interaction, services);
    } else if (subcommand === 'answer') {
      await this.handleAnswer(interaction, services);
    }
  },

  /**
   * /course-admin questions
   */
  async handleQuestions(interaction, services) {
    try {
      // 🔹 1) Leer preguntas directo de la DB (sin u.username)
      const limit = 10;

      const result = await query(
        `
        SELECT 
          q.id,
          q.user_id,
          q.question,
          q.asked_at,
          m.title AS module_title,
          v.title AS video_title
        FROM course_questions q
        LEFT JOIN course_modules m ON q.module_id = m.id
        LEFT JOIN course_videos v ON q.video_id = v.id
        WHERE q.answered_at IS NULL
        ORDER BY q.asked_at ASC
        LIMIT $1
        `,
        [limit]
      );

      const questions = result.rows || [];

      // 🔹 2) Construir payload (contenido / embed)
      if (questions.length === 0) {
        const payload = {
          content: 'No unanswered questions. 🎉',
          flags: 1 << 6 // ephemeral
        };

        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(payload);
        } else {
          await interaction.reply(payload);
        }
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('Unanswered Course Questions')
        .setFooter({ text: `${questions.length} questions pending` });

      for (const q of questions) {
        const date = q.asked_at
          ? new Date(q.asked_at).toLocaleDateString()
          : 'Unknown';

        embed.addFields({
          name: `Question ${q.id} - <@${q.user_id}> (${date})`,
          value: [
            `Module: ${q.module_title || 'N/A'}`,
            `Video: ${q.video_title || 'N/A'}`,
            `Question: ${q.question ? q.question.substring(0, 200) : 'N/A'}`
          ].join('\n'),
          inline: false
        });
      }

      const payload = {
        embeds: [embed],
        flags: 1 << 6 // ephemeral
      };

      // 🔹 3) Responder según estado del interaction (sin deferReply)
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch (error) {
      logger.error('CourseAdmin.questions: failed to load unanswered questions', {
        error: error.message
      });

      const msg = error?.message || '';
      const code = error?.code;

      const isInteractionStateError =
        code === 10062 ||
        code === 40060 ||
        msg.includes('Unknown interaction') ||
        msg.includes('already been acknowledged');

      if (isInteractionStateError) {
        logger.warn(
          'CourseAdmin.questions: interaction invalid when sending error reply',
          { code, message: msg }
        );
        return;
      }

      const errorPayload = {
        content: 'Failed to load unanswered questions. Please try again.',
        flags: 1 << 6 // ephemeral
      };

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(errorPayload);
        } else {
          await interaction.reply(errorPayload);
        }
      } catch (replyErr) {
        logger.error('CourseAdmin.questions: failed to send error reply', {
          error: replyErr.message
        });
      }
    }
  },

  /**
   * /course-admin answer
   */
  async handleAnswer(interaction, services) {
    let deferred = false;

    // defer seguro
    try {
      await interaction.deferReply({ flags: 1 << 6 });
      deferred = true;
    } catch (err) {
      if (err.code === 10062 || /Unknown interaction/i.test(err.message || '')) {
        logger.warn(
          'CourseAdmin.answer: interaction invalid while deferring',
          {
            code: err.code,
            message: err.message,
          },
        );
        return;
      }

      logger.error('CourseAdmin.answer: failed to defer reply', {
        error: err.message,
      });
      return;
    }

    try {
      if (!services?.courseManager || typeof services.courseManager.answerQuestion !== 'function') {
        await interaction.editReply({
          content:
            '❌ Course questions backend is not configured. Please contact an admin.',
        });
        return;
      }

      const questionId = interaction.options.getInteger('question-id');
      const answer = interaction.options.getString('answer');

      const question = await services.courseManager.answerQuestion(
        questionId,
        answer,
      );

      // Intentar DM al usuario
      try {
        const user = await interaction.client.users.fetch(question.user_id);

        await user.send({
          embeds: [
            {
              color: 0x00ff00,
              title: '📚 Your Course Question Was Answered!',
              fields: [
                {
                  name: 'Your Question',
                  value: String(question.question || '').substring(0, 1024),
                },
                {
                  name: 'Answer',
                  value: String(answer || '').substring(0, 1024),
                },
              ],
              footer: { text: config.branding.name },
            },
          ],
        });

        await interaction.editReply(
          `✅ Question **${questionId}** answered and user notified via DM.`,
        );
      } catch (dmError) {
        logger.warn('CourseAdmin.answer: could not DM user', {
          error: dmError.message,
          userId: question?.user_id,
        });

        await interaction.editReply(
          `✅ Question **${questionId}** answered, but I couldn't DM the user.`,
        );
      }
    } catch (error) {
      logger.error('CourseAdmin.answer: failed to answer question', {
        error: error.message,
      });

      if (!deferred) return;

      try {
        await interaction.editReply(
          '❌ Failed to answer question. Please try again.',
        );
      } catch (err2) {
        if (err2.code === 10062 || /Unknown interaction/i.test(err2.message || '')) {
          logger.warn(
            'CourseAdmin.answer: interaction invalid when sending error',
            {
              code: err2.code,
              message: err2.message,
            },
          );
        } else {
          logger.error(
            'CourseAdmin.answer: failed to send error reply',
            { error: err2.message },
          );
        }
      }
    }
  },
};
